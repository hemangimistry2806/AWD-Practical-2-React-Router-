import { useEffect, useState } from "react";
import "./Task.css";

const API_URL = "/api/tasks";

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [task, setTask] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to load tasks");
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const saveTask = async () => {
    const title = task.trim();
    if (!title) return;

    try {
      setError("");
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error("Unable to save task");
      }

      setTask("");
      setEditingId(null);
      setShowInput(false);
      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTask = async (id) => {
    try {
      setError("");
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete task");
      }

      fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const editTask = (currentTask) => {
    setTask(currentTask.title);
    setEditingId(currentTask._id);
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
            setEditingId(null);
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

          <button onClick={saveTask}>
            {editingId ? "Update" : "Add"}
          </button>
        </div>
      )}

      {loading && <p>Loading tasks...</p>}
      {error && <p className="task-error">{error}</p>}

      <ul>
        {tasks.map((currentTask) => (
          <li key={currentTask._id}>
            {currentTask.title}

            <div>
              <button
                className="edit-btn"
                onClick={() => editTask(currentTask)}
              >
                ✏️
              </button>

              <button
                className="delete-btn"
                onClick={() => deleteTask(currentTask._id)}
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