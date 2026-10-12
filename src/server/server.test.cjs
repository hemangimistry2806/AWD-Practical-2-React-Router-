const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "integration-test-secret";
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
const ActivityLog = require("./models/ActivityLog.cjs");
const User = require("./models/User.cjs");
let mongoServer;
let httpServer;
let baseUrl;
let user;
let admin;
let regularToken;
let adminToken;

before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri("login-email-tests"));
    user = await User.create({
        username: "Test User",
        email: "registered@example.test",
        password: await bcrypt.hash("correct-password", 10)
    });
    admin = await User.create({
        username: "Report Admin",
        email: "admin@example.test",
        password: await bcrypt.hash("admin-password", 10),
        role: "admin"
    });
    regularToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ id: admin._id }, process.env.JWT_SECRET);
    await ActivityLog.create([
        { action: "BEGIN", userName: "Test User", userEmail: "private@example.test", createdAt: new Date("2026-10-10T00:00:00.000Z") },
        { action: "END", userName: "Test User", createdAt: new Date("2026-10-10T23:59:59.999Z") },
        { action: "OUTSIDE", userName: "Test User", createdAt: new Date("2026-10-11T00:00:00.000Z") }
    ]);
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

const reportRequest = (path, token) => fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
});

test("invalid credentials do not send a login email", async () => {
    const response = await login("incorrect-password");

    assert.equal(response.status, 401);
    assert.equal(sentMessages.length, 0);
});

test("successful login sends one confirmation to the registered email", async () => {
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

test("SMTP failure does not fail an otherwise successful login", async () => {
    smtpFailure = true;

    const response = await login("correct-password");
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(payload.token);
    assert.doesNotMatch(JSON.stringify(payload), /Mock SMTP credentials/);
    assert.equal(sentMessages.length, 1);
});

test("registration cannot choose an administrator role", async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            username: "Escalation Attempt",
            email: "escalation@example.test",
            password: "secure-password",
            role: "admin"
        })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.user.role, "user");
});

test("report API rejects unauthenticated and non-admin users", async () => {
    const path = "/api/admin/reports/activity?startDate=2026-10-01&endDate=2026-10-31";
    const unauthenticated = await reportRequest(path);
    const regularUser = await reportRequest(path, regularToken);

    assert.equal(unauthenticated.status, 401);
    assert.equal(regularUser.status, 403);
});

test("activity report validates dates and includes both UTC calendar-day boundaries", async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const missingDate = await reportRequest("/api/admin/reports/activity?startDate=2026-10-10", adminToken);
    const invalidDate = await reportRequest("/api/admin/reports/activity?startDate=2026-02-30&endDate=2026-10-10", adminToken);
    const reversedRange = await reportRequest("/api/admin/reports/activity?startDate=2026-10-11&endDate=2026-10-10", adminToken);

    assert.equal(missingDate.status, 400);
    assert.equal(invalidDate.status, 400);
    assert.equal(reversedRange.status, 400);

    const response = await fetch(`${baseUrl}/api/admin/reports/activity?startDate=2026-10-10&endDate=2026-10-10`, {
        headers: auth
    });
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.total, 2);
    assert.deepEqual(result.records.map(({ action }) => action), ["BEGIN", "END"]);
    assert.deepEqual(result.actionTotals, [
        { action: "BEGIN", count: 1 },
        { action: "END", count: 1 }
    ]);
    assert.equal(result.startDate, "2026-10-10");
    assert.equal(result.endDate, "2026-10-10");
    assert.equal(JSON.stringify(result).includes("private@example.test"), false);
});

test("empty report results are successful and CSV export is admin-only", async () => {
    const empty = await reportRequest(
        "/api/admin/reports/activity?startDate=2026-12-01&endDate=2026-12-02",
        adminToken
    );
    const emptyResult = await empty.json();
    const unauthorizedCsv = await reportRequest(
        "/api/admin/reports/activity.csv?startDate=2026-10-10&endDate=2026-10-10",
        regularToken
    );
    const csv = await reportRequest(
        "/api/admin/reports/activity.csv?startDate=2026-10-10&endDate=2026-10-10",
        adminToken
    );
    const csvText = await csv.text();

    assert.equal(empty.status, 200);
    assert.equal(emptyResult.total, 0);
    assert.deepEqual(emptyResult.records, []);
    assert.equal(unauthorizedCsv.status, 403);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type"), /text\/csv/);
    assert.match(csvText, /BEGIN/);
    assert.match(csvText, /END/);
    assert.doesNotMatch(csvText, /OUTSIDE|private@example\.test/);
});
