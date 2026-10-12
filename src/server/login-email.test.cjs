const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "login-email-test-secret";
process.env.SMTP_HOST = "mock.smtp.test";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASS = "test-password";
process.env.MAIL_TO = "other@example.test";
process.env.MAIL_CC = "copy@example.test";
process.env.MAIL_BCC = "hidden-copy@example.test";

let smtpFailure = false;
const sentMessages = [];
const originalCreateTransport = nodemailer.createTransport;
nodemailer.createTransport = () => ({
    sendMail: async (message) => {
        if (smtpFailure) {
            throw new Error("Mock SMTP credentials must not be returned to clients");
        }
        sentMessages.push(message);
        return { messageId: "mock-message-id" };
    }
});

const { app } = require("./server.cjs");
const User = require("./models/User.cjs");
let mongoServer;
let httpServer;
let baseUrl;
let user;

before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("login-email-tests"));
    user = await User.create({
        username: "Test User",
        email: "registered@example.test",
        password: await bcrypt.hash("correct-password", 10)
    });
    httpServer = app.listen(0);
    await new Promise((resolve) => httpServer.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
    if (httpServer) {
        await new Promise((resolve, reject) => {
            httpServer.close((error) => error ? reject(error) : resolve());
        });
    }
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    nodemailer.createTransport = originalCreateTransport;
});

const login = (password) => fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        email: user.email,
        password,
        notificationEmail: "attacker@example.test"
    })
});

test("invalid credentials do not send a login email", async () => {
    const response = await login("incorrect-password");

    assert.equal(response.status, 401);
    assert.equal(sentMessages.length, 0);
});

test("successful login sends one confirmation only to the registered email", async () => {
    const response = await login("correct-password");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.user.email, user.email);
    assert.equal(sentMessages.length, 1);
    assert.deepEqual(sentMessages[0].to, [user.email]);
    assert.deepEqual(sentMessages[0].cc, []);
    assert.deepEqual(sentMessages[0].bcc, []);
    assert.match(sentMessages[0].subject, /Task manager login notification/);
    assert.match(sentMessages[0].html, /Task Manager sign-in confirmation/);
    assert.match(sentMessages[0].html, /Login time:/);
    assert.match(sentMessages[0].html, /automated security notification from Task Manager/);
});

test("SMTP failure leaves successful authentication intact without exposing errors", async () => {
    smtpFailure = true;

    const response = await login("correct-password");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(payload.token);
    assert.doesNotMatch(JSON.stringify(payload), /Mock SMTP credentials/);
    assert.equal(sentMessages.length, 1);
});
