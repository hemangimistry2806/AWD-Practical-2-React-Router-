function Projects() {
  const projects = [
    {
      title: "Hand Gesture-Controlled Virtual Mouse",
      summary: "Hand gesture-controlled virtual mouse using OpenCV and MediaPipe for real-time cursor movement and click actions.",
      tag: "Computer Vision"
    },
    {
      title: "Student Portfolio Website",
      summary: "A responsive personal portfolio website built with React and Vite to showcase skills, projects, and contact information using reusable components.",
      tag: "React"
    },
    {
      title: "CNC Machine Data Integration & Real-Time Monitoring System",
      summary: "AI-powered predictive maintenance system that monitors CNC machine health, detects anomalies, predicts failures, and visualizes machine performance using machine learning.",
      tag: "AI / ML"
    }
  ];

  return (
    <section className="page-card">
      <h2>My Projects</h2>
      <p>Here are three of my recent work highlights.</p>

      <div className="project-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.title}>
            <span className="project-badge">{project.tag}</span>
            <h3>{project.title}</h3>
            <p>{project.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default Projects;
