import { useState } from "react";
import "./Task.css";

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [task, setTask] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);

  const addTask = () => {
    if (task.trim() === "") return;

    if (editingIndex !== null) {
      // Update existing task
      const updatedTasks = [...tasks];
      updatedTasks[editingIndex] = task;
      setTasks(updatedTasks);
      setEditingIndex(null);
    } else {
      // Add new task
      setTasks([...tasks, task]);
    }

    setTask("");
    setShowInput(false);
  };

  const deleteTask = (index) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const editTask = (index) => {
    setTask(tasks[index]);
    setEditingIndex(index);
    setShowInput(true);
  };

  return (
    <div className="tasks-container">

      <div className="header">
        <h2>📝 My Tasks</h2>

        <button
          className="add-btn"
          onClick={() => {
            setShowInput(!showInput);
            setEditingIndex(null);
            setTask("");
          }}
        >
          +
        </button>
      </div>


      {showInput && (
        <div className="input-box">
          <input
            type="text"
            placeholder="Enter Task..."
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />

          <button onClick={addTask}>
            {editingIndex !== null ? "Update" : "Add"}
          </button>
        </div>
      )}


      <ul>
        {tasks.map((t, index) => (
          <li key={index}>
            {t}

            <div>
              <button
                className="edit-btn"
                onClick={() => editTask(index)}
              >
                ✏️
              </button>

              <button
                className="delete-btn"
                onClick={() => deleteTask(index)}
              >
                ❌
              </button>
            </div>

          </li>
        ))}
      </ul>

    </div>
  );
}

export default Tasks;