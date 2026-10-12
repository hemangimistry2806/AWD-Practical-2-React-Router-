const nodemailer = require("nodemailer");
const React = require("react");
const { render } = require("@react-email/render");
const LoginEmail = require("../emails/LoginEmail.cjs");

let transporter;

const splitRecipients = (value) => String(value || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

const configuredRecipients = () => ({
    to: splitRecipients(process.env.MAIL_TO),
    cc: splitRecipients(process.env.MAIL_CC),
    bcc: splitRecipients(process.env.MAIL_BCC)
});

const getTransporter = () => {
    if (transporter) return transporter;

    const host = String(process.env.SMTP_HOST || "").trim();
    const rawPort = String(process.env.SMTP_PORT || "").trim();
    const username = String(process.env.SMTP_USER || "").trim();
    const password = process.env.SMTP_PASS || "";
    const rawSecure = String(process.env.SMTP_SECURE || "false").trim().toLowerCase();

    if (!host || !rawPort || !username || !password) {
        return null;
    }

    const port = Number(rawPort);
    if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
        console.warn("Email skipped: SMTP_PORT must be an integer between 1 and 65535");
        return null;
    }
    if (rawSecure !== "true" && rawSecure !== "false") {
        console.warn("Email skipped: SMTP_SECURE must be true or false");
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port,
        secure: rawSecure === "true",
        auth: {
            user: username,
            pass: password
        }
    });

    return transporter;
};

const uniqueAddresses = (addresses) => {
    const seen = new Set();
    return addresses.filter((address) => {
        const key = address.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const sendEmail = async ({ userEmail, subject, element, includeConfiguredRecipients = true }) => {
    try {
        const mailTransporter = getTransporter();
        if (!mailTransporter) {
            console.warn(`Email skipped for ${subject}: SMTP configuration is incomplete`);
            return false;
        }

        const configured = configuredRecipients();
        const to = uniqueAddresses([
            ...splitRecipients(userEmail),
            ...(includeConfiguredRecipients ? configured.to : [])
        ]);
        if (to.length === 0) {
            console.warn(`Email skipped for ${subject}: no recipient configured`);
            return false;
        }

        const info = await mailTransporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to,
            cc: includeConfiguredRecipients ? uniqueAddresses(configured.cc) : [],
            bcc: includeConfiguredRecipients ? uniqueAddresses(configured.bcc) : [],
            subject,
            html: await render(element)
        });

        console.log(`Email sent for ${subject}: ${info.messageId}`);
        return true;
    } catch {
        console.error(`Email delivery failed for ${subject}`);
        return false;
    }
};

const sendTaskCreatedEmail = (user, task) => sendEmail({
    userEmail: user.email,
    subject: `Task created: ${task.title}`,
    element: React.createElement(require("../emails/TaskCreatedEmail.cjs"), { task })
});

const sendTaskCompletedEmail = (user, task) => sendEmail({
    userEmail: user.email,
    subject: `Task completed: ${task.title}`,
    element: React.createElement(require("../emails/TaskCompletedEmail.cjs"), {
        task,
        completedAt: new Date().toISOString()
    })
});

const sendTaskPendingEmail = (user, task) => sendEmail({
    userEmail: user.email,
    subject: `Task pending: ${task.title}`,
    element: React.createElement(require("../emails/TaskPendingEmail.cjs"), { task })
});

const sendLoginEmail = (user, req) => sendEmail({
    userEmail: user.email,
    subject: "Task manager login notification",
    includeConfiguredRecipients: false,
    element: React.createElement(LoginEmail, {
        user,
        loggedInAt: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get("User-Agent")
    })
});

const sendLogoutEmail = (user) => sendEmail({
    userEmail: user.email,
    subject: "Task manager logout notification",
    element: React.createElement(require("../emails/LogoutEmail.cjs"), {
        user,
        loggedOutAt: new Date().toISOString()
    })
});

module.exports = {
    sendTaskCreatedEmail,
    sendTaskCompletedEmail,
    sendTaskPendingEmail,
    sendLoginEmail,
    sendLogoutEmail
};
