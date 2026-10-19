const React = require("react");

const TaskCreatedEmail = ({ task }) => React.createElement(
    "div",
    { style: { fontFamily: "Arial, sans-serif", color: "#172033" } },
    React.createElement("h2", null, "Task created"),
    React.createElement("p", null, `Your task "${task.title}" was created successfully.`),
    React.createElement("p", null, `Description: ${task.description || "None"}`),
    React.createElement("p", null, `Priority: ${task.priority || "Normal"}`),
    React.createElement("p", null, `Due date: ${task.dueDate || "Not set"}`),
    React.createElement("p", null, `Status: ${task.status}`)
);

module.exports = TaskCreatedEmail;
