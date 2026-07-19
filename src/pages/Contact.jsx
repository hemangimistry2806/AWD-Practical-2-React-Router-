import { useState } from "react";

function Contact({ studentName }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  return (
    <section className="contact-card">
      <h2>Contact Me</h2>
      <p>Reach out to {studentName} for collaboration, questions, or project ideas.</p>

      <form>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
          />
        </div>

        <div className="field">
          <label htmlFor="message">Message</label>
          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message"
          />
        </div>

        <p className="char-count">Characters: {message.length}</p>
      </form>

      <div className="preview-card">
        <h3>Live Preview</h3>
        <p><strong>Name:</strong> {name || "—"}</p>
        <p><strong>Message:</strong> {message || "—"}</p>
      </div>
    </section>
  );
}

export default Contact;
