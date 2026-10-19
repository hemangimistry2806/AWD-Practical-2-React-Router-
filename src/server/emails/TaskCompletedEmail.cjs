const React = require("react");

const TaskCompletedEmail = ({ task, completedAt }) => React.createElement(
    "div",
    { style: { fontFamily: "Arial, sans-serif", color: "#172033" } },
    React.createElement("h2", null, "Task completed"),
    React.createElement("p", null, `Your task "${task.title}" has been completed.`),
    React.createElement("p", null, `Completed: ${completedAt}`),
    React.createElement("p", null, `Description: ${task.description || "None"}`),
    React.createElement("p", null, `Priority: ${task.priority || "Normal"}`),
    React.createElement("p", null, `Due date: ${task.dueDate || "Not set"}`),
    React.createElement("p", null, "Status: completed")
);

module.exports = TaskCompletedEmail;
