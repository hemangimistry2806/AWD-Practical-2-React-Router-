import About from "../components/About";
import Skills from "../components/Skills";

function Home({ studentName, mySkills }) {
  return (
    <>
      <section className="hero-card">
        <h2>Welcome to my portfolio</h2>
        <p>
          I am {studentName}, an aspiring AI and Machine Learning student who enjoys
          building creative digital experiences with React and modern web technologies.
        </p>
      </section>

      <About name={studentName} role="AI & Machine Learning Student" />
      <Skills skillList={mySkills} />
    </>
  );
}

export default Home;
