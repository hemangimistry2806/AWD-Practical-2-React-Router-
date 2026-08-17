const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const path = require("path");
const ActivityLog = require("./models/ActivityLog.cjs");
const Task = require("./models/Task.cjs");
const User = require("./models/User.cjs");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskdb";
const LOG_DIRECTORY = path.join(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIRECTORY, "task-audit.txt");
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24;

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

const hashPassword = (password, salt) => new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
        if (error) {
            reject(error);
            return;
        }

        resolve(derivedKey.toString("hex"));
    });
});

const verifyPassword = async (password, user) => {
    const passwordHash = await hashPassword(password, user.passwordSalt);
    const expected = Buffer.from(user.passwordHash, "hex");
    const actual = Buffer.from(passwordHash, "hex");

    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createSession = async (user) => {
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();

    user.sessions = (user.sessions || []).filter((session) => session.expiresAt > now);
    user.sessions.push({
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
    });
    await user.save();

    return token;
};

const publicUser = (user) => ({
    id: user._id.toString(),
    username: user.username,
    email: user.email
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

        const tokenHash = hashToken(token);
        const user = await User.findOne({ "sessions.tokenHash": tokenHash });
        const session = user?.sessions.find((item) => item.tokenHash === tokenHash);

        if (!user || !session || session.expiresAt <= new Date()) {
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }

        req.user = user;
        req.authTokenHash = tokenHash;
        next();
    } catch (error) {
        res.status(401).json({ message: "Unable to authenticate request" });
    }
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

        const passwordSalt = crypto.randomBytes(16).toString("hex");
        const passwordHash = await hashPassword(password, passwordSalt);
        const user = await User.create({ username, email, passwordHash, passwordSalt });
        const token = await createSession(user);

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
        const validPassword = user ? await verifyPassword(password, user) : false;

        if (!user || !validPassword) {
            await recordActivity({ req, action: "AUTH_LOGIN_FAILED", userEmail: email, details: "Invalid credentials" });
            return res.status(401).json({ message: "Invalid email or password" });
        }

        const token = await createSession(user);
        await recordActivity({ req, user, action: "AUTH_LOGIN", details: "Successful login" });
        res.json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(400).json({ message: "Unable to log in", error: error.message });
    }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
    req.user.sessions = req.user.sessions.filter((session) => session.tokenHash !== req.authTokenHash);
    await req.user.save();
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

app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
        const title = req.body.title?.trim();
        const status = req.body.status || "pending";

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

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

app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
        const title = req.body.title?.trim();
        const status = req.body.status || "pending";

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

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
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
};

connectToDatabase()
    .then(() => startServer())
    .catch((error) => {
        console.error(`MongoDB connection failed: ${error.message}`);
        console.error(`Check MONGO_URI (${MONGO_URI}) and make sure MongoDB is running.`);
        process.exitCode = 1;
    });

const shutdown = async () => {
    await mongoose.disconnect();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
