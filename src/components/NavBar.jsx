import { Link, useLocation } from "react-router-dom";

function NavBar({ isDarkMode, onToggleTheme }) {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link to="/" className={`nav-link${isActive("/") ? " active" : ""}`}>
        Home
      </Link>
      <Link to="/projects" className={`nav-link${isActive("/projects") ? " active" : ""}`}>
        Projects
      </Link>
      <Link to="/contact" className={`nav-link${isActive("/contact") ? " active" : ""}`}>
        Contact
      </Link>
      <button className="theme-toggle" onClick={onToggleTheme} type="button">
        {isDarkMode ? "☀️ Light" : "🌙 Dark"}
      </button>
    </nav>
  );
}

export default NavBar;
