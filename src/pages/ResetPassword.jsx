import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "../Task.css";

const getResponseMessage = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.message || fallback;
};

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const resetToken = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetToken, password })
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to reset password"));
      }

      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="auth-copy">
        <p className="eyebrow">Account recovery</p>
        <h2>Reset Password</h2>
        <p>Choose a new password for your account.</p>
      </div>

      <form className="auth-form" onSubmit={resetPassword}>
        <label>
          New Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength="6"
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength="6"
            required
          />
        </label>
        <button className="primary-task-button" type="submit" disabled={loading || !resetToken}>
          {loading ? "Please wait..." : "Reset Password"}
        </button>
        <Link className="text-button" to="/login">Back to login</Link>
      </form>
      {error && <p className="task-error">{error}</p>}
    </section>
  );
}

export default ResetPassword;