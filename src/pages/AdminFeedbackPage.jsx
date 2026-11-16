import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Inbox,
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

const feedbackFilters = [
  { value: "all", label: "All messages" },
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
];

function AdminFeedbackPage({ reloadKey }) {
  const [feedback, setFeedback] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [emailNoticeWarning, setEmailNoticeWarning] = useState(false);
  const [replyingId, setReplyingId] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [savingReplyId, setSavingReplyId] = useState("");
  const [savingStatusId, setSavingStatusId] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [feedbackToDelete, setFeedbackToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  const statusCounts = feedback.reduce((counts, item) => {
    const status = item.status || "pending";
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    return counts;
  }, { pending: 0, reviewed: 0, resolved: 0 });
  const visibleFeedback = activeFilter === "all"
    ? feedback
    : feedback.filter((item) => (item.status || "pending") === activeFilter);

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
    setEmailNotice("");
    setReplyingId(item._id);
    setReplyDraft(item.adminReply || "");
  };

  const saveReply = async (event, id) => {
    event.preventDefault();
    if (!replyDraft.trim() || savingReplyId) return;
    setSavingReplyId(id);
    setError("");
    setEmailNotice("");
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
      setEmailNoticeWarning(result.emailSent === false);
      setEmailNotice(result.emailSent === false
        ? result.message || "Reply saved, but the email could not be sent."
        : result.emailSent === true
          ? "Reply saved and emailed to the user."
          : "Reply saved.");
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
    <section className="admin-feedback-page" aria-label="User feedback">
      <header className="admin-feedback-heading">
        <div className="admin-feedback-heading-copy">
          <span className="admin-feedback-eyebrow"><MessageSquareText size={14} /> CUSTOMER VOICE</span>
          <h2>Feedback inbox</h2>
          <p>Review user messages, track progress, and send thoughtful replies.</p>
        </div>
        <div className="admin-feedback-total">
          <span><Inbox size={15} /> INBOX TOTAL</span>
          <strong>{feedback.length}</strong>
          <small>{feedback.length === 1 ? "message received" : "messages received"}</small>
        </div>
      </header>

      {error && <p className="admin-error admin-feedback-error" role="alert">{error}</p>}
      {emailNotice && (
        <p className={`admin-feedback-email-notice ${emailNoticeWarning ? "is-warning" : ""}`} role="status">
          {emailNotice}
        </p>
      )}
      {loading ? (
        <div className="admin-feedback-loading" role="status" aria-live="polite">
          <RefreshCw size={18} className="is-spinning" />
          <span>Loading your feedback inbox…</span>
        </div>
      ) : (
        <>
          <div className="admin-feedback-stats" aria-label="Feedback status totals">
            <article className="admin-feedback-stat stat-total">
              <span className="admin-feedback-stat-icon"><MessageSquareText size={18} /></span>
              <span className="admin-feedback-stat-copy"><small>ALL MESSAGES</small><strong>{feedback.length}</strong></span>
              <span className="admin-feedback-stat-note">Inbox</span>
            </article>
            <article className="admin-feedback-stat stat-pending">
              <span className="admin-feedback-stat-icon"><Clock3 size={18} /></span>
              <span className="admin-feedback-stat-copy"><small>PENDING</small><strong>{statusCounts.pending}</strong></span>
              <span className="admin-feedback-stat-note">Needs review</span>
            </article>
            <article className="admin-feedback-stat stat-reviewed">
              <span className="admin-feedback-stat-icon"><Eye size={18} /></span>
              <span className="admin-feedback-stat-copy"><small>REVIEWED</small><strong>{statusCounts.reviewed}</strong></span>
              <span className="admin-feedback-stat-note">In progress</span>
            </article>
            <article className="admin-feedback-stat stat-resolved">
              <span className="admin-feedback-stat-icon"><CheckCircle2 size={18} /></span>
              <span className="admin-feedback-stat-copy"><small>RESOLVED</small><strong>{statusCounts.resolved}</strong></span>
              <span className="admin-feedback-stat-note">Completed</span>
            </article>
          </div>

          <div className="admin-feedback-inbox">
            <div className="admin-feedback-list-heading">
              <div><span>INBOX</span><h3>Recent messages</h3></div>
              <div className="admin-feedback-filters" aria-label="Filter feedback by status">
                {feedbackFilters.map((filter) => {
                  const count = filter.value === "all" ? feedback.length : statusCounts[filter.value];
                  return (
                    <button
                      className={activeFilter === filter.value ? "is-active" : ""}
                      type="button"
                      key={filter.value}
                      aria-pressed={activeFilter === filter.value}
                      onClick={() => setActiveFilter(filter.value)}
                    >
                      {filter.label}<span>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {visibleFeedback.length ? (
              <div className="admin-feedback-list">
                {visibleFeedback.map((item) => {
                  const status = item.status || "pending";
                  const userName = item.name || "Anonymous user";
                  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
                  return (
                    <article className={`admin-feedback-item is-${status}`} key={item._id}>
                      <div className="admin-feedback-item-heading">
                        <span className={`admin-feedback-category is-${item.category}`}>
                          {categoryLabels[item.category] || "Feedback"}
                        </span>
                        <time dateTime={item.createdAt}>
                          <Clock3 size={13} />
                          {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                        </time>
                      </div>
                      <div className="admin-feedback-author">
                        <span className="admin-feedback-avatar" aria-hidden="true">{initials || "U"}</span>
                        <span className="admin-feedback-author-details">
                          <strong>{userName}</strong>
                          {item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}
                        </span>
                        <span className={`admin-feedback-status is-${status}`}>
                          {statusLabels[status] || "Pending"}
                        </span>
                      </div>
                      <div className="admin-feedback-message">
                        <span>USER MESSAGE</span>
                        <p>{item.message}</p>
                      </div>
                      <div className="admin-feedback-item-controls">
                        <label className="admin-feedback-status-control">
                          <span>Status</span>
                          <select
                            value={statusDrafts[item._id] || status}
                            onChange={(event) => void updateStatus(item._id, event.target.value)}
                            disabled={Boolean(savingStatusId) || Boolean(deletingId)}
                            aria-label={`Set status for feedback from ${userName}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          {savingStatusId === item._id && <small>Saving…</small>}
                        </label>
                        <div className="admin-feedback-actions">
                          <button
                            type="button"
                            className="admin-feedback-reply-button"
                            onClick={() => openReply(item)}
                            disabled={Boolean(deletingId) || Boolean(savingReplyId)}
                          >
                            <MessageSquareReply size={14} />
                            {item.adminReply ? "Edit reply" : "Reply to user"}
                          </button>
                          <button
                            type="button"
                            className="admin-feedback-delete-button"
                            onClick={() => setFeedbackToDelete(item)}
                            disabled={Boolean(deletingId) || Boolean(savingStatusId)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                      {item.adminReply && replyingId !== item._id && (
                        <aside className="admin-feedback-saved-reply">
                          <span><MessageSquareReply size={14} /> SUPERADMIN REPLY</span>
                          <p>{item.adminReply}</p>
                          <small>
                            {item.repliedAt ? `Replied ${new Date(item.repliedAt).toLocaleString()}` : "Reply saved"}
                          </small>
                        </aside>
                      )}
                      {replyingId === item._id && (
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
                              {savingReplyId === item._id ? "Saving…" : item.adminReply ? "Update reply" : "Send reply"}
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : feedback.length ? (
              <div className="admin-feedback-empty">
                <span><Inbox size={22} /></span>
                <strong>No {activeFilter} messages</strong>
                <p>Try another status filter to find feedback.</p>
                <button type="button" onClick={() => setActiveFilter("all")}>View all messages</button>
              </div>
            ) : (
              <div className="admin-feedback-empty">
                <span><MessageSquareText size={22} /></span>
                <strong>Your inbox is clear</strong>
                <p>User feedback will appear here as soon as it arrives.</p>
              </div>
            )}
          </div>
        </>
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
