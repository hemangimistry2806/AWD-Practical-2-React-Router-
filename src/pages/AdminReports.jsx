import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../Task.css";

const API_URL = "/api";
const TOKEN_KEY = "taskAuthToken";
const PAGE_SIZE = 50;

const responseMessage = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.message || fallback;
};

function AdminReports() {
  const [access, setAccess] = useState("checking");
  const [token, setToken] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const storedToken = localStorage.getItem(TOKEN_KEY);

    const checkAdmin = async () => {
      if (!storedToken) {
        if (active) setAccess("denied");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        if (!response.ok) {
          if (active) setAccess("denied");
          return;
        }
        const data = await response.json();
        if (active) {
          setToken(storedToken);
          setAccess(data.user.role === "admin" ? "admin" : "denied");
        }
      } catch {
        if (active) {
          setAccess("denied");
          setError("Unable to verify administrator access. Please try again.");
        }
      }
    };

    checkAdmin();
    return () => {
      active = false;
    };
  }, []);

  const fetchReport = async (page = 1, reportStartDate = startDate, reportEndDate = endDate) => {
    if (!reportStartDate || !reportEndDate) {
      setError("Choose both a start date and an end date.");
      return;
    }
    if (reportStartDate > reportEndDate) {
      setError("Start date must not be later than end date.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: reportStartDate,
        endDate: reportEndDate,
        page: String(page)
      });
      const response = await fetch(`${API_URL}/admin/reports/activity?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to load activity report."));
      }
      setReport(await response.json());
    } catch (requestError) {
      setReport(null);
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadCsv = async () => {
    setDownloading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: report.startDate,
        endDate: report.endDate
      });
      const response = await fetch(`${API_URL}/admin/reports/activity.csv?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response, "Unable to export activity report."));
      }
      const downloadUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `activity-report-${report.startDate}-to-${report.endDate}.csv`;
      link.click();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloading(false);
    }
  };

  if (access === "checking") {
    return <section className="report-card"><p>Checking administrator access...</p></section>;
  }

  if (access !== "admin") {
    return (
      <section className="report-card">
        <h2>Administrator access required</h2>
        <p className="report-error">{error || "Sign in with an administrator account to view reports."}</p>
        <Link className="secondary-task-button" to="/login">Go to sign in</Link>
      </section>
    );
  }

  return (
    <section className="report-card">
      <div className="report-heading">
        <div>
          <p className="eyebrow">Administrator</p>
          <h2>Activity report</h2>
        </div>
        <Link className="secondary-task-button" to="/tasks">Back to tasks</Link>
      </div>

      <form
        className="report-filters"
        onSubmit={(event) => {
          event.preventDefault();
          fetchReport(1);
        }}
      >
        <label>
          Start date
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </label>
        <label>
          End date
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </label>
        <button className="primary-task-button" type="submit" disabled={loading}>
          {loading ? "Loading report..." : "Generate report"}
        </button>
      </form>

      {error && <p className="report-error" role="alert">{error}</p>}
      {loading && <p role="status">Loading activity records...</p>}

      {report && !loading && (
        <>
          <div className="report-summary">
            <p><strong>Date range:</strong> {report.startDate} to {report.endDate} (UTC)</p>
            <p><strong>Total matching activities:</strong> {report.total}</p>
            {report.actionTotals.map(({ action, count }) => (
              <p key={action}><strong>{action}:</strong> {count}</p>
            ))}
            <button
              className="secondary-task-button"
              type="button"
              onClick={downloadCsv}
              disabled={downloading || report.total === 0}
            >
              {downloading ? "Preparing CSV..." : "Download CSV"}
            </button>
          </div>

          {report.records.length === 0 ? (
            <p className="empty-tasks">No activity records were found in this date range.</p>
          ) : (
            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead>
                  <tr><th>Time (UTC)</th><th>Action</th><th>User</th><th>Task</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {report.records.map((record) => (
                    <tr key={record._id}>
                      <td>{new Date(record.createdAt).toISOString().replace("T", " ").replace("Z", "")}</td>
                      <td>{record.action}</td>
                      <td>{record.userName || "Unknown"}</td>
                      <td>{record.taskTitle || "-"}</td>
                      <td>{record.details || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="report-pagination">
            <button
              className="secondary-task-button"
              type="button"
              onClick={() => fetchReport(report.page - 1, report.startDate, report.endDate)}
              disabled={loading || report.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {report.page} of {Math.max(report.totalPages, 1)} ({PAGE_SIZE} records per page)
            </span>
            <button
              className="secondary-task-button"
              type="button"
              onClick={() => fetchReport(report.page + 1, report.startDate, report.endDate)}
              disabled={loading || report.page >= report.totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default AdminReports;
