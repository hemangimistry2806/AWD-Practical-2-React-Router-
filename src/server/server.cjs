require("dotenv").config();

const bcrypt = require("bcryptjs");
const express = require("express");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const ActivityLog = require("./models/ActivityLog.cjs");
const Task = require("./models/Task.cjs");
const User = require("./models/User.cjs");
const { sendLoginEmail } = require("./services/emailService.cjs");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskdb";
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";
const LOG_DIRECTORY = path.join(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIRECTORY, "task-audit.txt");
let memoryMongo;

fs.mkdirSync(LOG_DIRECTORY, { recursive: true });

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Name");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

const publicUser = (user) => ({
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role || "user"
});

const recordActivity = async ({ req, user, action, userEmail, taskId, taskTitle, details }) => {
    try {
        await ActivityLog.create({
            action,
            userId: user?._id?.toString(),
            userName: user?.username,
            userEmail: user?.email || userEmail,
            taskId,
            taskTitle,
            details,
            ipAddress: req.ip,
            userAgent: req.get("User-Agent")
        });
    } catch (error) {
        console.error(`Activity log could not be saved: ${error.message}`);
    }
};

const appendTextAuditLog = async ({ action, taskId, taskTitle, userName }) => {
    const line = [
        `[${new Date().toISOString()}]`,
        `action=${action}`,
        `user=${userName}`,
        `taskId=${taskId}`,
        `taskTitle=${JSON.stringify(taskTitle)}`
    ].join(" | ") + "\n";

    await fs.promises.appendFile(LOG_FILE, line, "utf8");
};

const requireAuth = async (req, res, next) => {
    try {
        const authorization = req.get("Authorization") || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

        if (!token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: "User account no longer exists" });
        }

        req.user = user;
        req.token = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "Token missing, invalid, or expired" });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Administrator access required" });
    }

    next();
};

const parseReportDateRange = (req, res, next) => {
    const { startDate, endDate } = req.query;
    const isCalendarDate = (value) => (
        typeof value === "string"
        && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
        && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
    );

    if (!isCalendarDate(startDate) || !isCalendarDate(endDate)) {
        return res.status(400).json({ message: "Valid startDate and endDate are required in YYYY-MM-DD format" });
    }
    if (startDate > endDate) {
        return res.status(400).json({ message: "Start date must not be later than end date" });
    }

    const endExclusive = new Date(`${endDate}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    req.reportDateRange = {
        startDate,
        endDate,
        query: {
            createdAt: {
                $gte: new Date(`${startDate}T00:00:00.000Z`),
                $lt: endExclusive
            }
        }
    };
    next();
};

const parseReportPage = (req, res, next) => {
    const rawPage = req.query.page === undefined ? "1" : String(req.query.page);
    if (!/^[1-9]\d*$/.test(rawPage)) {
        return res.status(400).json({ message: "Page must be a positive integer" });
    }
    req.reportPage = Number(rawPage);
    next();
};

const validateTask = (req, res, next) => {
    const title = String(req.body.title || "").trim();

    if (!title) {
        return res.status(400).json({ message: "Task title is required" });
    }

    req.body.title = title;
    next();
};

app.get("/api/health", (req, res) => {
    res.json({
        server: "running",
        mongoConnected: mongoose.connection.readyState === 1,
        database: mongoose.connection.name
    });
});

app.post("/api/auth/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (username.length < 2 || !email || password.length < 6) {
            return res.status(400).json({ message: "Username, valid email, and a 6-character password are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ username, email, password: hashedPassword });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

        await recordActivity({ req, user, action: "AUTH_REGISTER", details: "Account created" });
        res.status(201).json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(400).json({ message: "Unable to create account", error: error.message });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    try {
        const user = await User.findOne({ email });
        const validPassword = user ? await bcrypt.compare(password, user.password) : false;

        if (!user || !validPassword) {
            await recordActivity({ req, action: "AUTH_LOGIN_FAILED", userEmail: email, details: "Invalid credentials" });
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });
        await recordActivity({ req, user, action: "AUTH_LOGIN", details: "Successful login" });
        void sendLoginEmail(user, req);
        res.json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(400).json({ message: "Unable to log in", error: error.message });
    }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
    await recordActivity({ req, user: req.user, action: "AUTH_LOGOUT", details: "Successful logout" });
    res.json({ message: "Logged out" });
});

app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Unable to fetch tasks", error: error.message });
    }
});

app.post("/api/tasks", requireAuth, validateTask, async (req, res) => {
    try {
        const title = req.body.title;
        const status = req.body.status || "pending";

        const task = await Task.create({
            title,
            description: req.body.description || "",
            status,
            completed: status === "completed"
        });

        await recordActivity({
            req,
            user: req.user,
            action: "TASK_CREATE",
            taskId: task._id.toString(),
            taskTitle: task.title,
            details: `Status: ${task.status}`
        });
        res.status(201).json(task);
    } catch (error) {
        res.status(400).json({ message: "Unable to create task", error: error.message });
    }
});

app.put("/api/tasks/:id", requireAuth, validateTask, async (req, res) => {
    try {
        const title = req.body.title;
        const status = req.body.status || "pending";

        const task = await Task.findByIdAndUpdate(
            req.params.id,
            {
                title,
                description: req.body.description || "",
                status,
                completed: status === "completed"
            },
            { new: true, runValidators: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        await recordActivity({
            req,
            user: req.user,
            action: "TASK_UPDATE",
            taskId: task._id.toString(),
            taskTitle: task.title,
            details: `Status: ${task.status}`
        });
        res.json(task);
    } catch (error) {
        res.status(400).json({ message: "Unable to update task", error: error.message });
    }
});

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        await Task.findByIdAndDelete(task._id);
        await recordActivity({
            req,
            user: req.user,
            action: "TASK_DELETE",
            taskId: task._id.toString(),
            taskTitle: task.title,
            details: `Deleted task with status: ${task.status || "pending"}`
        });

        try {
            await appendTextAuditLog({
                action: "TASK_DELETE",
                taskId: task._id.toString(),
                taskTitle: task.title,
                userName: req.user.username
            });
        } catch (logError) {
            console.error(`Text audit log could not be saved: ${logError.message}`);
        }

        res.json({ message: "Task deleted" });
    } catch (error) {
        res.status(400).json({ message: "Unable to delete task", error: error.message });
    }
});

app.get("/api/activity-logs", requireAuth, async (req, res) => {
    try {
        const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(500);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: "Unable to fetch activity logs", error: error.message });
    }
});

app.get(
    "/api/admin/reports/activity",
    requireAuth,
    requireAdmin,
    parseReportDateRange,
    parseReportPage,
    async (req, res) => {
        const pageSize = 50;
        const { query, startDate, endDate } = req.reportDateRange;
        const skip = (req.reportPage - 1) * pageSize;

        try {
            const [total, actionTotals, records] = await Promise.all([
                ActivityLog.countDocuments(query),
                ActivityLog.aggregate([
                    { $match: query },
                    { $group: { _id: "$action", count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ]),
                ActivityLog.find(query)
                    .select("action userName taskTitle details createdAt")
                    .sort({ createdAt: 1, _id: 1 })
                    .skip(skip)
                    .limit(pageSize)
                    .lean()
            ]);

            res.json({
                startDate,
                endDate,
                total,
                page: req.reportPage,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                actionTotals: actionTotals.map(({ _id, count }) => ({ action: _id, count })),
                records
            });
        } catch (error) {
            console.error(`Activity report query failed: ${error.message}`);
            res.status(500).json({ message: "Unable to generate activity report" });
        }
    }
);

app.get(
    "/api/admin/reports/activity.csv",
    requireAuth,
    requireAdmin,
    parseReportDateRange,
    async (req, res) => {
        const { query, startDate, endDate } = req.reportDateRange;
        const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
        const columns = ["Created (UTC)", "Action", "User", "Task", "Details"];

        try {
            res.attachment(`activity-report-${startDate}-to-${endDate}.csv`);
            res.type("text/csv; charset=utf-8");
            res.write(`${columns.map(csvCell).join(",")}\r\n`);

            const cursor = ActivityLog.find(query)
                .select("action userName taskTitle details createdAt")
                .sort({ createdAt: 1, _id: 1 })
                .lean()
                .cursor();

            for await (const record of cursor) {
                res.write([
                    record.createdAt.toISOString(),
                    record.action,
                    record.userName,
                    record.taskTitle,
                    record.details
                ].map(csvCell).join(",") + "\r\n");
            }
            res.end();
        } catch (error) {
            console.error(`Activity report export failed: ${error.message}`);
            if (!res.headersSent) {
                return res.status(500).json({ message: "Unable to export activity report" });
            }
            res.destroy(error);
        }
    }
);

app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
        const logs = await fs.promises.readFile(LOG_FILE, "utf8");
        res.type("text/plain").send(logs);
    } catch (error) {
        if (error.code === "ENOENT") {
            return res.type("text/plain").send("");
        }

        res.status(500).json({ message: "Unable to fetch audit logs", error: error.message });
    }
});

const startServer = () => {
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    return server;
};

const connectToDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
        console.log(`MongoDB connected: ${mongoose.connection.name}`);
    } catch (error) {
        console.log(`Local MongoDB unavailable (${error.message}). Starting in-memory MongoDB...`);
        memoryMongo = await MongoMemoryServer.create();
        await mongoose.connect(memoryMongo.getUri("taskdb"));
        console.log(`In-memory MongoDB connected: ${mongoose.connection.name}`);
    }
};

if (require.main === module) {
    connectToDatabase()
        .then(() => startServer())
        .catch((error) => {
            console.error(`MongoDB connection failed: ${error.message}`);
            process.exitCode = 1;
        });

    const shutdown = async () => {
        await mongoose.disconnect();
        if (memoryMongo) {
            await memoryMongo.stop();
        }
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

module.exports = { app };
