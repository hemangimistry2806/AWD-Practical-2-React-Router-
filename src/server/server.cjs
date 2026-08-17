const express = require("express");
const mongoose = require("mongoose");
const Task = require("./models/Task.cjs");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/taskdb";

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        server: "running",
        mongoConnected: mongoose.connection.readyState === 1,
        database: mongoose.connection.name
    });
});

app.get("/api/tasks", async (req, res) => {
    try {
        const tasks = await Task.find().sort({ createdAt: -1 });
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ message: "Unable to fetch tasks", error: err.message });
    }
});

app.post("/api/tasks", async (req, res) => {
    try {
        const title = req.body.title?.trim();

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        const task = await Task.create({
            title,
            description: req.body.description || ""
        });

        res.status(201).json(task);
    } catch (err) {
        res.status(400).json({ message: "Unable to create task", error: err.message });
    }
});

app.put("/api/tasks/:id", async (req, res) => {
    try {
        const title = req.body.title?.trim();

        if (!title) {
            return res.status(400).json({ message: "Task title is required" });
        }

        const task = await Task.findByIdAndUpdate(
            req.params.id,
            {
                title,
                description: req.body.description || ""
            },
            { new: true, runValidators: true }
        );

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json(task);
    } catch (err) {
        res.status(400).json({ message: "Unable to update task", error: err.message });
    }
});

app.delete("/api/tasks/:id", async (req, res) => {
    try {
        const task = await Task.findByIdAndDelete(req.params.id);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ message: "Task deleted" });
    } catch (err) {
        res.status(400).json({ message: "Unable to delete task", error: err.message });
    }
});

const startServer = () => {
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    return server;
};

const connectToDatabase = async () => {
    await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 3000
    });
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
};

connectToDatabase()
    .then(() => {
        startServer();
    })
    .catch((err) => {
        console.error(`MongoDB connection failed: ${err.message}`);
        console.error(`Check MONGO_URI (${MONGO_URI}) and make sure MongoDB is running.`);
        process.exitCode = 1;
    });

const shutdown = async () => {
    await mongoose.disconnect();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
