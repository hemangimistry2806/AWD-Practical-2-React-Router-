import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../Task.css";

const getResponseMessage = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.message || fallback;
};

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const requestReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error(await getResponseMessage(response, "Unable to request password reset"));
      }

      const data = await response.json();
      navigate(`/reset-password?token=${encodeURIComponent(data.resetToken)}`);
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
        <h2>Forgot Password?</h2>
        <p>Request a reset token, then choose a new password.</p>
      </div>

      <form className="auth-form" onSubmit={requestReset}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button className="primary-task-button" type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Request reset"}
        </button>
        <Link className="text-button" to="/login">Back to login</Link>
      </form>
      {error && <p className="task-error">{error}</p>}
    </section>
  );
}

export default ForgotPassword;
