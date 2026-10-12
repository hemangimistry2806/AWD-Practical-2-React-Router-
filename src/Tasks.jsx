import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import "./Task.css";

const API_URL = "/api";
const TOKEN_KEY = "taskAuthToken";
const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" }
];

const getTaskStatus = (task) => {
  if (task.status === "in-progress") return "ongoing";
  return task.status || (task.completed ? "completed" : "pending");
};

const getResponseMessage = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.message || fallback;
};

function Tasks() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", email: "", password: "" });
  const [checkingAuth, setCheckingAuth] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [authLoading, setAuthLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showInput, setShowInput] = useState(false);
  const [task, setTask] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState("pending");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const [showActivity, setShowActivity] = useState(false);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAuthUser(null);
    setTasks([]);
  }, []);

  const requestApi = useCallback(async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, { ...options, headers });
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let active = true;

    const checkSession = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const data = await response.json();
        if (active) {
          setAuthUser(data.user);
        }
      } catch {
        if (active) {
          clearAuth();
        }
      } finally {
        if (active) {
          setCheckingAuth(false);
        }
      }
    };

    void checkSession();
    return () => {
      active = false;
    };
  }, [clearAuth, token]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await requestApi(`${API_URL}/tasks`);

      if (response.status === 401) {
        clearAuth();
        return;
      }

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to load tasks"));
      }

      setTasks(await response.json());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [clearAuth, requestApi]);

  useEffect(() => {
    if (!authUser) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void fetchTasks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [authUser, fetchTasks]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setError("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm)
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Authentication failed"));
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setAuthUser(data.user);
      setAuthForm({ username: "", email: "", password: "" });
      await Swal.fire({
        icon: "success",
        title: authMode === "login" ? "Welcome back" : "Account created",
        text: `Signed in as ${data.user.username}`,
        timer: 1600,
        showConfirmButton: false
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await requestApi(`${API_URL}/auth/logout`, { method: "POST" }).catch(() => undefined);
    clearAuth();
    await Swal.fire({
      icon: "success",
      title: "Logged out",
      timer: 1200,
      showConfirmButton: false
    });
  };

  const saveTask = async () => {
    const title = task.trim();
    if (!title) {
      await Swal.fire({ icon: "info", title: "Task title required", text: "Enter a task before saving." });
      return;
    }

    const wasEditing = Boolean(editingId);
    const confirmation = await Swal.fire({
      title: wasEditing ? "Update this task?" : "Add this task?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: wasEditing ? "Update" : "Add",
      cancelButtonText: "Cancel"
    });

    if (!confirmation.isConfirmed) return;

    try {
      setError("");
      const method = wasEditing ? "PUT" : "POST";
      const url = wasEditing ? `${API_URL}/tasks/${editingId}` : `${API_URL}/tasks`;
      const response = await requestApi(url, {
        method,
        body: JSON.stringify({ title, description, priority, dueDate, status: taskStatus })
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to save task"));
      }

      setTask("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setTaskStatus("pending");
      setEditingId(null);
      setShowInput(false);
      await fetchTasks();
      await Swal.fire({
        icon: "success",
        title: wasEditing ? "Task updated" : "Task added",
        timer: 1200,
        showConfirmButton: false
      });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteTask = async (currentTask) => {
    const confirmation = await Swal.fire({
      title: "Delete this task?",
      text: `This will remove "${currentTask.title}" and record the action in the activity log.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel"
    });

    if (!confirmation.isConfirmed) return;

    try {
      setError("");
      const response = await requestApi(`${API_URL}/tasks/${currentTask._id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to delete task"));
      }

      await fetchTasks();
      await Swal.fire({ icon: "success", title: "Task deleted", timer: 1200, showConfirmButton: false });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const editTask = (currentTask) => {
    setTask(currentTask.title);
    setDescription(currentTask.description || "");
    setPriority(currentTask.priority || "medium");
    setDueDate(currentTask.dueDate ? currentTask.dueDate.slice(0, 10) : "");
    setTaskStatus(getTaskStatus(currentTask));
    setEditingId(currentTask._id);
    setShowInput(true);
  };

  const fetchActivityLogs = async () => {
    try {
      const response = await requestApi(`${API_URL}/activity-logs`);
      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to load activity logs"));
      }
      setActivityLogs(await response.json());
      setShowActivity(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const downloadFile = (content, fileName, type) => {
    const file = new Blob([content], { type });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const taskGroups = useMemo(() => STATUS_OPTIONS.map(({ value, label }) => ({
    value,
    label,
    tasks: tasks.filter((currentTask) => getTaskStatus(currentTask) === value)
  })), [tasks]);

  const downloadExcel = () => {
    const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["Title", "Description", "Priority", "Due date", "Status", "Created"],
      ...tasks.map((currentTask) => [
        currentTask.title,
        currentTask.description,
        currentTask.priority,
        currentTask.dueDate ? new Date(currentTask.dueDate).toLocaleDateString() : "",
        getTaskStatus(currentTask),
        new Date(currentTask.createdAt).toLocaleString()
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
    downloadFile(csv, "tasks.csv", "text/csv;charset=utf-8");
  };

  const downloadPdf = async () => {
    const confirmation = await Swal.fire({
      title: "Save tasks as PDF?",
      text: "Choose Save as PDF in the browser print dialog.",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Open print dialog"
    });

    if (confirmation.isConfirmed) {
      window.print();
    }
  };

  if (checkingAuth) {
    return <div className="tasks-container"><p>Checking authentication...</p></div>;
  }

  if (!authUser) {
    return (
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Private workspace</p>
          <h2>{authMode === "login" ? "Sign in to your tasks" : "Create your task account"}</h2>
          <p>Sign in before entering the task board. Login, logout, and task actions are tracked securely.</p>
        </div>

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          {authMode === "register" && (
            <label>
              Username
              <input
                value={authForm.username}
                onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
                minLength="2"
                required
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              minLength="6"
              required
            />
          </label>
          <button className="primary-task-button" type="submit" disabled={authLoading}>
            {authLoading ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {authMode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
          </button>
          {authMode === "login" && <Link className="text-button" to="/forgot-password">Forgot Password?</Link>}
          {error && <p className="task-error">{error}</p>}
        </form>
      </section>
    );
  }

  return (
    <div className="tasks-container">
      <div className="tasks-heading">
        <div>
          <p className="eyebrow">Signed in as {authUser.username}</p>
          <h2>My Tasks</h2>
        </div>
        <div className="task-actions">
          {authUser.role === "admin" && <Link className="secondary-task-button" to="/admin/reports">Admin reports</Link>}
          <button className="secondary-task-button" onClick={fetchActivityLogs}>Activity</button>
          <button className="secondary-task-button" onClick={downloadExcel}>Excel</button>
          <button className="secondary-task-button" onClick={downloadPdf}>PDF</button>
          <button className="primary-task-button" onClick={() => {
            setShowInput(!showInput);
            setEditingId(null);
            setTask("");
            setDescription("");
            setPriority("medium");
            setDueDate("");
            setTaskStatus("pending");
          }}>
            {showInput ? "Close" : "Add task"}
          </button>
          <button className="text-button" onClick={logout}>Log out</button>
        </div>
      </div>

      {showInput && (
        <div className="task-editor">
          <input
            type="text"
            placeholder="Task title"
            value={task}
            onChange={(event) => setTask(event.target.value)}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
            {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <button className="primary-task-button" onClick={saveTask}>{editingId ? "Update" : "Add"}</button>
        </div>
      )}

      {loading && <p>Loading tasks...</p>}
      {error && <p className="task-error">{error}</p>}

      {taskGroups.map((group) => (
        <section className="task-group" key={group.value}>
          <h3>{group.label} ({group.tasks.length})</h3>
          <ul className="task-list">
            {group.tasks.map((currentTask) => (
              <li className="task-row" key={currentTask._id}>
                <div className="task-details">
                  <strong>{currentTask.title}</strong>
                  {currentTask.description && <span>{currentTask.description}</span>}
                </div>
                <span className={`task-status ${getTaskStatus(currentTask)}`}>{group.label}</span>
                <div className="task-row-actions">
                  <button className="icon-task-button" onClick={() => editTask(currentTask)} title="Edit task">Edit</button>
                  <button className="icon-task-button danger" onClick={() => deleteTask(currentTask)} title="Delete task">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!loading && tasks.length === 0 && <p className="empty-tasks">No tasks yet.</p>}

      {showActivity && (
        <section className="activity-panel">
          <div className="activity-heading">
            <h3>Activity log</h3>
            <button className="text-button" onClick={() => setShowActivity(false)}>Close</button>
          </div>
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead>
                <tr><th>Time</th><th>Action</th><th>User</th><th>Task</th><th>Details</th></tr>
              </thead>
              <tbody>
                {activityLogs.map((log) => (
                  <tr key={log._id}>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>{log.action}</td>
                    <td>{log.userName || log.userEmail || "Unknown"}</td>
                    <td>{log.taskTitle || "-"}</td>
                    <td>{log.details || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default Tasks;
