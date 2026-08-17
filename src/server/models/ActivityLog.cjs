const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true
    },
    userId: String,
    userName: String,
    userEmail: String,
    taskId: String,
    taskTitle: String,
    details: String,
    ipAddress: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: "activity_logs"
});

module.exports = mongoose.model("ActivityLog", activityLogSchema);
