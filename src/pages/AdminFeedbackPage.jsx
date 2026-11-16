import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock3,
  MessageSquareReply,
  MessageSquareText,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { API_USERS } from "../config/api.js";
import "./AdminFeedbackPage.css";

const categoryLabels = {
  suggestion: "Suggestion",
  bug: "Problem report",
  other: "Other",
};

const statusLabels = {
  pending: "Pending",
  reviewed: "Reviewed",
  resolved: "Resolved",
};

function AdminFeedbackPage({ reloadKey }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replyingId, setReplyingId] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReplyId, setSavingReplyId] = useState("");
  const [savingStatusId, setSavingStatusId] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [feedbackToDelete, setFeedbackToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");

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

  const openReply = (item) => {
    setError("");
    setReplyingId(item._id);
    setReplyDraft(item.adminReply || "");
  };

  const saveReply = async (event, id) => {
    event.preventDefault();
    if (!replyDraft.trim() || savingReplyId) return;
    setSavingReplyId(id);
    setError("");
    try {
      const response = await fetch(`${API_USERS}/admin/feedback/${encodeURIComponent(id)}/reply`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyDraft }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not save the reply.");
      setFeedback((current) => current.map((item) => item._id === id ? result.data : item));
      setReplyingId("");
      setReplyDraft("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save the reply.");
    } finally {
      setSavingReplyId("");
    }
  };

  const updateStatus = async (id, status) => {
    if (savingStatusId) return;
    setSavingStatusId(id);
    setStatusDrafts((current) => ({ ...current, [id]: status }));
    setError("");
    try {
      const response = await fetch(`${API_USERS}/admin/feedback/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not update feedback status.");
      setFeedback((current) => current.map((item) => item._id === id ? result.data : item));
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    } catch (requestError) {
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      setError(requestError instanceof Error ? requestError.message : "Could not update feedback status.");
    } finally {
      setSavingStatusId("");
    }
  };

  const deleteFeedback = async () => {
    if (!feedbackToDelete || deletingId) return;
    const item = feedbackToDelete;
    setDeletingId(item._id);
    setError("");
    try {
      const response = await fetch(`${API_USERS}/admin/feedback/${encodeURIComponent(item._id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not delete feedback.");
      setFeedback((current) => current.filter((entry) => entry._id !== item._id));
      setFeedbackToDelete(null);
      if (replyingId === item._id) {
        setReplyingId("");
        setReplyDraft("");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not delete feedback.");
    } finally {
      setDeletingId("");
    }
  };

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
                <div className="admin-feedback-item-meta">
                  <span className={`admin-feedback-status is-${item.status || "pending"}`}>
                    {statusLabels[item.status] || "Pending"}
                  </span>
                  <time dateTime={item.createdAt}>
                    <Clock3 size={13} />
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </time>
                </div>
              </div>
              <p className="admin-feedback-message">{item.message}</p>
              <div className="admin-feedback-author">
                <strong>{item.name || "Anonymous user"}</strong>
                {item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}
              </div>
              <label className="admin-feedback-status-control">
                <span>Feedback status</span>
                <select
                  value={statusDrafts[item._id] || item.status || "pending"}
                  onChange={(event) => void updateStatus(item._id, event.target.value)}
                  disabled={Boolean(savingStatusId) || Boolean(deletingId)}
                  aria-label={`Set status for feedback from ${item.name || "user"}`}
                >
                  <option value="pending">Pending</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="resolved">Resolved</option>
                </select>
                {savingStatusId === item._id && <small>Saving…</small>}
              </label>
              {item.adminReply && replyingId !== item._id && (
                <aside className="admin-feedback-saved-reply">
                  <span><MessageSquareReply size={14} /> SUPERADMIN REPLY</span>
                  <p>{item.adminReply}</p>
                  <small>
                    {item.repliedAt ? `Replied ${new Date(item.repliedAt).toLocaleString()}` : "Reply saved"}
                  </small>
                </aside>
              )}
              {replyingId === item._id ? (
                <form className="admin-feedback-reply-form" onSubmit={(event) => saveReply(event, item._id)}>
                  <label htmlFor={`feedback-reply-${item._id}`}>Your response</label>
                  <textarea
                    id={`feedback-reply-${item._id}`}
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
                    maxLength={3000}
                    rows={4}
                    placeholder="Write a helpful response…"
                    required
                  />
                  <div className="admin-feedback-reply-actions">
                    <button
                      type="button"
                      className="admin-feedback-cancel"
                      onClick={() => { setReplyingId(""); setReplyDraft(""); }}
                      disabled={Boolean(savingReplyId)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="admin-feedback-save"
                      disabled={Boolean(savingReplyId) || !replyDraft.trim()}
                    >
                      {savingReplyId === item._id ? "Saving…" : item.adminReply ? "Update reply" : "Save reply"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="admin-feedback-actions">
                  <button
                    type="button"
                    className="admin-feedback-reply-button"
                    onClick={() => openReply(item)}
                    disabled={Boolean(deletingId)}
                  >
                    <MessageSquareReply size={14} />
                    {item.adminReply ? "Edit reply" : "Reply"}
                  </button>
                  <button
                    type="button"
                    className="admin-feedback-delete-button"
                    onClick={() => setFeedbackToDelete(item)}
                    disabled={Boolean(deletingId)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {feedbackToDelete && (
        <div
          className="image-tool-confirm-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) setFeedbackToDelete(null);
          }}
        >
          <section
            className="image-tool-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="admin-feedback-delete-title"
            aria-describedby="admin-feedback-delete-description"
          >
            <button
              className="image-tool-confirm-close"
              type="button"
              onClick={() => setFeedbackToDelete(null)}
              disabled={Boolean(deletingId)}
              aria-label="Close confirmation"
            >
              <X size={17} />
            </button>
            <span className="image-tool-confirm-icon"><AlertTriangle size={23} /></span>
            <span className="image-tool-confirm-eyebrow">DELETE FEEDBACK</span>
            <h2 id="admin-feedback-delete-title">Delete this message?</h2>
            <p id="admin-feedback-delete-description">
              This permanently removes the feedback and any saved reply.
            </p>
            <div className="image-tool-confirm-actions">
              <button
                type="button"
                className="image-tool-confirm-cancel"
                onClick={() => setFeedbackToDelete(null)}
                disabled={Boolean(deletingId)}
              >
                Keep message
              </button>
              <button
                type="button"
                className="image-tool-confirm-delete"
                onClick={deleteFeedback}
                disabled={Boolean(deletingId)}
              >
                <Trash2 size={15} />
                {deletingId ? "Deleting…" : "Delete feedback"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default AdminFeedbackPage;
