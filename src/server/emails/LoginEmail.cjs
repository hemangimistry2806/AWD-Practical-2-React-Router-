const React = require("react");

const LoginEmail = ({ user, loggedInAt, ipAddress, userAgent }) => React.createElement(
    "div",
    { style: { fontFamily: "Arial, sans-serif", color: "#172033" } },
    React.createElement("h2", null, "Task Manager sign-in confirmation"),
    React.createElement("p", null, `Hello ${user.username}, your account was signed in successfully.`),
    React.createElement("p", null, `Login time: ${loggedInAt}`),
    React.createElement("p", null, `IP address: ${ipAddress || "Unavailable"}`),
    React.createElement("p", null, `Browser: ${userAgent || "Unavailable"}`),
    React.createElement("p", null, "This is an automated security notification from Task Manager.")
);

module.exports = LoginEmail;
