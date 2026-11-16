import { useEffect, useState } from "react";
import { Clock3, MessageSquareText, RefreshCw } from "lucide-react";
import { API_USERS } from "../config/api.js";
import "./AdminFeedbackPage.css";

const categoryLabels = {
  suggestion: "Suggestion",
  bug: "Problem report",
  other: "Other",
};

function AdminFeedbackPage({ reloadKey }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadFeedback = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_USERS}/admin/feedback`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Could not load feedback.");
        setFeedback(Array.isArray(result.data) ? result.data : []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError instanceof Error ? requestError.message : "Could not load feedback.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadFeedback();
    return () => controller.abort();
  }, [reloadKey]);

  return (
    <section className="admin-card admin-feedback-card" aria-label="User feedback">
      <header className="admin-feedback-heading">
        <div>
          <span className="matrix-eyebrow"><MessageSquareText size={13} /> USER MESSAGES</span>
          <h2>Feedback inbox</h2>
          <p>Suggestions and problem reports submitted by users.</p>
        </div>
        <span className="matrix-count">{feedback.length} messages</span>
      </header>

      {error && <p className="admin-error admin-feedback-error" role="alert">{error}</p>}
      {loading ? (
        <p className="admin-feedback-empty"><RefreshCw size={16} className="is-spinning" /> Loading feedback…</p>
      ) : feedback.length === 0 ? (
        <p className="admin-feedback-empty">No feedback has been submitted yet.</p>
      ) : (
        <div className="admin-feedback-list">
          {feedback.map((item) => (
            <article className="admin-feedback-item" key={item._id}>
              <div className="admin-feedback-item-heading">
                <span className={`admin-feedback-category is-${item.category}`}>
                  {categoryLabels[item.category] || "Feedback"}
                </span>
                <time dateTime={item.createdAt}>
                  <Clock3 size={13} />
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                </time>
              </div>
              <p className="admin-feedback-message">{item.message}</p>
              <div className="admin-feedback-author">
                <strong>{item.name || "Anonymous user"}</strong>
                {item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminFeedbackPage;
