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

test("GET /api/tasks returns 200 with a task list", async () => {
    const response = await fetch(`${baseUrl}/api/tasks`, {
        headers: { Authorization: `Bearer ${regularToken}` }
    });
    const tasks = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(tasks));
});

test("AI description endpoint requires authentication and a valid title", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/ai/generate-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Prepare project report" })
    });
    const missingTitle = await fetch(`${baseUrl}/api/ai/generate-description`, {
        method: "POST",
        headers: { Authorization: `Bearer ${regularToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "  " })
    });
    const longTitle = await fetch(`${baseUrl}/api/ai/generate-description`, {
        method: "POST",
        headers: { Authorization: `Bearer ${regularToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: "a".repeat(161) })
    });

    assert.equal(unauthenticated.status, 401);
    assert.equal(missingTitle.status, 400);
    assert.equal(longTitle.status, 400);
});

test("AI description endpoint returns an editable suggestion and limits requests per task", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalModel = process.env.OPENAI_MODEL;
    let providerCalls = 0;
    process.env.OPENAI_API_KEY = "test-only-api-key";
    process.env.OPENAI_MODEL = "test-model";
    global.fetch = async (url, options) => {
        providerCalls += 1;
        assert.equal(url, "https://api.openai.com/v1/chat/completions");
        assert.equal(options.headers.Authorization, "Bearer test-only-api-key");
        const body = JSON.parse(options.body);
        assert.equal(body.model, "test-model");
        assert.match(body.messages[1].content, /Prepare the weekly project report/);
        return {
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "Collect updates and summarize project progress." } }]
            })
        };
    };

    try {
        const response = await originalFetch(`${baseUrl}/api/ai/generate-description`, {
            method: "POST",
            headers: { Authorization: `Bearer ${regularToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Prepare the weekly project report" })
        });
        const result = await response.json();
        const rateLimited = await originalFetch(`${baseUrl}/api/ai/generate-description`, {
            method: "POST",
            headers: { Authorization: `Bearer ${regularToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Prepare the weekly project report" })
        });

        assert.equal(response.status, 200);
        assert.deepEqual(result, {
            description: "Collect updates and summarize project progress.",
            fallback: false
        });
        assert.equal(rateLimited.status, 429);
        assert.equal(providerCalls, 1);
    } finally {
        global.fetch = originalFetch;
        if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = originalApiKey;
        if (originalModel === undefined) delete process.env.OPENAI_MODEL;
        else process.env.OPENAI_MODEL = originalModel;
    }
});

test("AI provider failures return a graceful fallback without exposing provider details", async () => {
    const originalFetch = global.fetch;
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "invalid-test-key";
    global.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "provider credentials must stay private" } })
    });

    try {
        const response = await originalFetch(`${baseUrl}/api/ai/generate-description`, {
            method: "POST",
            headers: { Authorization: `Bearer ${regularToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Fallback description test" })
        });
        const result = await response.json();

        assert.equal(response.status, 200);
        assert.equal(result.description, "");
        assert.equal(result.fallback, true);
        assert.match(result.message, /write the description yourself/i);
        assert.doesNotMatch(JSON.stringify(result), /provider credentials|invalid-test-key/);
    } finally {
        global.fetch = originalFetch;
        if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = originalApiKey;
    }
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
    const forgedRoleToken = jwt.sign({ id: user._id, role: "admin" }, process.env.JWT_SECRET);
    const forgedRole = await reportRequest(path, forgedRoleToken);

    assert.equal(unauthenticated.status, 401);
    assert.equal(regularUser.status, 403);
    assert.equal(forgedRole.status, 403);
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

test("activity report paginates records while totals cover the full date range", async () => {
    await ActivityLog.create(Array.from({ length: 51 }, (_, index) => ({
        action: "PAGINATED",
        userName: `Report row ${index}`,
        createdAt: new Date("2040-10-12T12:00:00.000Z")
    })));

    const firstPage = await reportRequest(
        "/api/admin/reports/activity?startDate=2040-10-12&endDate=2040-10-12&page=1",
        adminToken
    );
    const firstPageResult = await firstPage.json();
    const secondPage = await reportRequest(
        "/api/admin/reports/activity?startDate=2040-10-12&endDate=2040-10-12&page=2",
        adminToken
    );
    const secondPageResult = await secondPage.json();
    const invalidPage = await reportRequest(
        "/api/admin/reports/activity?startDate=2040-10-12&endDate=2040-10-12&page=0",
        adminToken
    );

    assert.equal(firstPage.status, 200);
    assert.equal(firstPageResult.total, 51);
    assert.equal(firstPageResult.totalPages, 2);
    assert.equal(firstPageResult.pageSize, 50);
    assert.equal(firstPageResult.records.length, 50);
    assert.deepEqual(firstPageResult.actionTotals, [{ action: "PAGINATED", count: 51 }]);
    assert.equal(secondPage.status, 200);
    assert.equal(secondPageResult.page, 2);
    assert.equal(secondPageResult.records.length, 1);
    assert.equal(invalidPage.status, 400);
});

test("task notifications run after the API response with a two-second delay", async () => {
    const output = [];
    const originalLog = console.log;
    console.log = (...args) => output.push(args.join(" "));

    const waitForLine = async (pattern) => {
        const deadline = Date.now() + 3500;
        while (Date.now() < deadline) {
            const line = output.find((entry) => pattern.test(entry));
            if (line) return line;
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        throw new Error(`Timed out waiting for log matching ${pattern}`);
    };

    const checkResponseBeforeNotification = (responseLine, completedLine) => {
        const responseTimestamp = Date.parse(responseLine.match(/^\[([^\]]+)\]/)[1]);
        const completedTimestamp = Date.parse(completedLine.match(/^\[([^\]]+)\]/)[1]);
        assert.ok(completedTimestamp - responseTimestamp >= 1900);
    };
    const authorization = { Authorization: ["Bearer", regularToken].join(" ") };

    try {
        const createdResponse = await fetch(`${baseUrl}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authorization },
            body: JSON.stringify({ title: "Practical 10 event test" })
        });
        const createdTask = await createdResponse.json();
        const createResponseLine = await waitForLine(/API response: POST \/api\/tasks status=201/);
        const createdNotificationLine = await waitForLine(/Task-created notification completed: title="Practical 10 event test"/);

        assert.equal(createdResponse.status, 201);
        assert.match(createdNotificationLine, /assignedUser="Test User"/);
        assert.match(output.join("\n"), /Simulated background delay: 2000ms/);
        checkResponseBeforeNotification(createResponseLine, createdNotificationLine);

        const deletedResponse = await fetch(`${baseUrl}/api/tasks/${createdTask._id}`, {
            method: "DELETE",
            headers: authorization
        });
        assert.equal(deletedResponse.status, 200);
        const deleteResponseLine = await waitForLine(/API response: DELETE .* status=200/);
        const deletedNotificationLine = await waitForLine(/Task-deleted notification completed: title="Practical 10 event test"/);

        assert.match(deletedNotificationLine, /assignedUser="Test User"/);
        checkResponseBeforeNotification(deleteResponseLine, deletedNotificationLine);
    } finally {
        console.log = originalLog;
    }
});
