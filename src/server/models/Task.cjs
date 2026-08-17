const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    description: {
        type: String
    },

    completed: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ["pending", "in-progress", "completed"],
        default: "pending"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: "tasks"
});

module.exports = mongoose.model("Task", taskSchema);
