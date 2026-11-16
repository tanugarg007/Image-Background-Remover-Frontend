import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { API_USERS } from "../config/api.js";
import "./FeedbackPage.css";

function FeedbackPage() {
  const [category, setCategory] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_USERS}/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message, name, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Could not submit your feedback.");
      }

      setMessage("");
      setSuccess(result.message || "Thank you for your feedback.");
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : "Could not submit your feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="feedback-page">
      <section className="feedback-card">
        <div className="feedback-heading">
          <span className="feedback-icon"><MessageSquareText size={22} /></span>
          <span className="feedback-eyebrow">YOUR VOICE MATTERS</span>
          <h1>Share your <em>feedback</em></h1>
          <p>Tell us what is working well or what we can improve. Your feedback goes directly to our superadmin.</p>
        </div>

        <form className="feedback-form" onSubmit={submit}>
          <label>
            <span>Feedback type</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="suggestion">Suggestion</option>
              <option value="bug">Report a problem</option>
              <option value="other">Other feedback</option>
            </select>
          </label>

          <label>
            <span>Your feedback</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write your feedback here…"
              maxLength={3000}
              rows={6}
              required
            />
            <small>{message.length}/3000 characters</small>
          </label>

          <div className="feedback-contact">
            <label>
              <span>Name <small>optional</small></span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </label>
            <label>
              <span>Email <small>optional</small></span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="email"
              />
            </label>
          </div>

          {error && <p className="feedback-message is-error" role="alert">{error}</p>}
          {success && <p className="feedback-message is-success" role="status">{success}</p>}

          <button type="submit" disabled={submitting || !message.trim()}>
            <Send size={16} />
            {submitting ? "Sending…" : "Send feedback"}
          </button>
          <p className="feedback-privacy">You can send feedback without signing in. If you are signed in, your account name and email are attached automatically.</p>
        </form>
      </section>
    </main>
  );
}

export default FeedbackPage;
