import { lazy, Suspense, useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const Projects = lazy(() => import("./pages/Projects"));
const Contact = lazy(() => import("./pages/Contact"));
const Tasks = lazy(() => import("./Tasks"));

function App() {
  const studentName = "Hemangi Mistry";
  const mySkills = ["Python", "Machine Learning", "React", "JavaScript", "SQL", "C++"];
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Toggle the portfolio theme from the navbar.
  const toggleTheme = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <div className={`app-shell ${isDarkMode ? "dark" : "light"}`}>
      <Header
        name={studentName}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
      />

      <main className="page-content">
        <Suspense fallback={<div className="page-loading">Loading page...</div>}>
          <Routes>
            <Route path="/" element={<Home studentName={studentName} mySkills={mySkills} />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact studentName={studentName} />} />

            <Route path="/tasks" element={<Tasks />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      <Footer name={studentName} />
    </div>
  );
}

export default App;
