const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    tokenHash: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
}, { _id: false });

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        minlength: 2
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    passwordSalt: {
        type: String,
        required: true
    },
    sessions: {
        type: [sessionSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    collection: "users"
});

module.exports = mongoose.model("User", userSchema);
