const React = require("react");

const TaskPendingEmail = ({ task }) => React.createElement(
    "div",
    { style: { fontFamily: "Arial, sans-serif", color: "#172033" } },
    React.createElement("h2", null, "Task pending"),
    React.createElement("p", null, `Your task "${task.title}" is now pending.`),
    React.createElement("p", null, `Description: ${task.description || "None"}`),
    React.createElement("p", null, `Priority: ${task.priority || "Normal"}`),
    React.createElement("p", null, `Due date: ${task.dueDate || "Not set"}`),
    React.createElement("p", null, "Status: pending")
);

module.exports = TaskPendingEmail;
