import NavBar from "./NavBar";

function Header({ name, isDarkMode, onToggleTheme }) {
  return (
    <header className="header">
      <div className="brand-block">
        <p className="brand-label">Portfolio</p>
        <h1>{name}</h1>
      </div>
      <NavBar isDarkMode={isDarkMode} onToggleTheme={onToggleTheme} />
    </header>
  );
}

export default Header;
