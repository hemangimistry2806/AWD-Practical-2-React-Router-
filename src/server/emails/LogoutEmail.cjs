const React = require("react");

const LogoutEmail = ({ user, loggedOutAt }) => React.createElement(
    "div",
    { style: { fontFamily: "Arial, sans-serif", color: "#172033" } },
    React.createElement("h2", null, "Account logout"),
    React.createElement("p", null, `Hello ${user.username}, your account was logged out successfully.`),
    React.createElement("p", null, `Logout time: ${loggedOutAt}`)
);

module.exports = LogoutEmail;
