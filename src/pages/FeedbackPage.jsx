import { useState } from "react";
import { CheckCircle2, LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { API_USERS } from "../config/api.js";
import "./FeedbackPage.css";

const categoryLabels = {
  suggestion: "Suggestion",
  bug: "Problem report",
  other: "Other feedback",
};

function FeedbackPage() {
  const [category, setCategory] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedFeedback, setSubmittedFeedback] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

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
      setSubmittedFeedback({ name: name.trim(), email: email.trim(), category });
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
          <p>Thoughtful feedback helps us build a better experience. Your message is delivered directly to our superadmin.</p>
        </div>

        {submittedFeedback ? (
          <section className="feedback-success" role="status" aria-live="polite">
            <span className="feedback-success-icon"><CheckCircle2 size={30} /></span>
            <span className="feedback-success-eyebrow">MESSAGE RECEIVED</span>
            <h2>Thank you, {submittedFeedback.name}.</h2>
            <p>Your feedback has been submitted successfully. Our team will review it and can follow up at <strong>{submittedFeedback.email}</strong>.</p>
            <div className="feedback-receipt">
              <span>Feedback type</span>
              <strong>{categoryLabels[submittedFeedback.category]}</strong>
            </div>
            <button type="button" onClick={() => setSubmittedFeedback(null)}>
              Send another message <Send size={15} />
            </button>
          </section>
        ) : (
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
              <span>Name <b aria-hidden="true">*</b></span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span>Email <b aria-hidden="true">*</b></span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="email"
                required
              />
            </label>
          </div>

          {error && <p className="feedback-message is-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting || !message.trim()}>
            {submitting ? <LoaderCircle className="feedback-spinner" size={16} /> : <Send size={16} />}
            {submitting ? "Submitting securely…" : "Submit feedback"}
          </button>
          <p className="feedback-privacy">Name and email are required so our team can identify your message and follow up if needed. Your feedback is visible to the superadmin.</p>
        </form>
        )}
      </section>
    </main>
  );
}

export default FeedbackPage;
