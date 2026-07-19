import { Link } from "react-router-dom";

function NotFound() {
  return (
    <section className="not-found-card">
      <h2>404 - Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <Link className="primary-button" to="/">
        Return Home
      </Link>
    </section>
  );
}

export default NotFound;
