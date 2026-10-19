const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    description: {
        type: String
    },

    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium"
    },

    dueDate: {
        type: Date
    },

    completed: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ["pending", "ongoing", "completed"],
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
