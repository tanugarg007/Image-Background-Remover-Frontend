import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Aperture,
  Archive,
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Crop,
  Download,
  Eye,
  FileArchive,
  FileImage,
  Layers,
  LogOut,
  MessageSquareReply,
  MessageSquareText,
  Minimize2,
  Palette,
  RefreshCw,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from "lucide-react";
import { API_USERS } from "../config/api.js";
import { toolCatalog } from "./Navbar.jsx";
import "./UserDashboard.css";

const toolIcons = {
  ImageIcon: FileImage,
  Palette,
  Aperture,
  Minimize2,
  FileImage,
  Crop,
  Layers,
  Archive,
  ScanSearch,
  SlidersHorizontal,
};

const feedbackStatusLabels = {
  pending: "Pending",
  reviewed: "Reviewed",
  resolved: "Resolved",
};

const feedbackStatusIcons = {
  pending: Clock3,
  reviewed: Eye,
  resolved: CheckCircle2,
};

function UserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [historyRefreshId, setHistoryRefreshId] = useState(0);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackState, setFeedbackState] = useState("idle");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackRefreshId, setFeedbackRefreshId] = useState(0);
  const userPath = location.pathname
    .slice("/user".length)
    .split("/")
    .filter(Boolean);
  const routeSection = userPath[0] || "tools";
  const routeTool =
    routeSection === "tool"
      ? toolCatalog.find((tool) => tool.route.slice(1) === userPath[1])
      : null;
  const section =
    routeTool?.route ||
    (["downloads", "account", "feedback"].includes(routeSection) ? routeSection : "tools");

  const changeSection = (nextSection) => {
    if (nextSection === "tools") {
      navigate("/user/tools");
      return;
    }

    if (["downloads", "account", "feedback"].includes(nextSection)) {
      navigate(`/user/${nextSection}`);
      return;
    }

    const selectedTool = toolCatalog.find(
      (tool) => tool.route === nextSection
    );
    if (selectedTool) {
      navigate(`/user/tool/${selectedTool.route.slice(1)}`);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${API_USERS}/me`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!response.ok || !payload.user) {
          throw new Error(payload.message || "Could not load your account.");
        }
        if (["admin", "superadmin"].includes(payload.user.role)) {
          navigate(payload.user.role === "superadmin" ? "/superadmin" : "/admin", { replace: true });
          return;
        }
        setUser(payload.user);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load your workspace.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [navigate]);

  useEffect(() => {
    if (section !== "downloads") return undefined;

    const controller = new AbortController();
    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError("");
      try {
        const response = await fetch(`${API_USERS}/my/downloads`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const history = await response.json().catch(() => ({}));
        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!response.ok) throw new Error(history.message || "Could not load your downloads.");
        setDownloads(Array.isArray(history.data) ? history.data : []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setHistoryError(requestError.message || "Could not load your downloads.");
        }
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => controller.abort();
  }, [historyRefreshId, navigate, section]);

  useEffect(() => {
    if (section !== "feedback") return undefined;

    const controller = new AbortController();
    const loadFeedback = async () => {
      try {
        const response = await fetch(`${API_USERS}/my/feedback`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (!response.ok) throw new Error(payload.message || "Could not load your feedback.");
        if (!Array.isArray(payload.data)) {
          throw new Error("The feedback history response was invalid.");
        }
        setFeedbackItems(payload.data);
        setFeedbackState("loaded");
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setFeedbackError(requestError.message || "Could not load your feedback.");
          setFeedbackState("error");
        }
      }
    };

    void loadFeedback();
    return () => controller.abort();
  }, [feedbackRefreshId, navigate, section]);

  const signOut = async () => {
    try { await fetch(`${API_USERS}/logout`, { method: "POST", credentials: "include" }); }
    finally { navigate("/login", { replace: true }); }
  };

  const openDownloads = () => {
    changeSection("downloads");
    setHistoryError("");
    setHistoryRefreshId((current) => current + 1);
  };

  const openFeedback = () => {
    changeSection("feedback");
    setFeedbackError("");
    setFeedbackState("loading");
    setFeedbackRefreshId((current) => current + 1);
  };

  const retryFeedback = () => {
    setFeedbackError("");
    setFeedbackState("loading");
    setFeedbackRefreshId((current) => current + 1);
  };

  const activeTool = routeTool;
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const feedbackCounts = feedbackItems.reduce((counts, item) => {
    const status = item.status || "pending";
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status] += 1;
    return counts;
  }, { pending: 0, reviewed: 0, resolved: 0 });
  const latestFeedbackDate = feedbackItems[0]?.createdAt ? new Date(feedbackItems[0].createdAt) : null;
  return (
    <div className="user-dashboard">
      <main className="user-main">
        <header className="user-topbar">
          <a className="user-brand" href="/" aria-label="Pixelcraft home"><span><Sparkles size={17} /></span> pixelcraft</a>
          <nav className="user-main-nav" aria-label="User dashboard">
            <button className={!['downloads', 'account', 'feedback'].includes(section) ? "selected" : ""} onClick={() => changeSection("tools")}><Sparkles size={15} />Tools</button>
            <button className={section === "downloads" ? "selected" : ""} onClick={openDownloads}><Download size={15} />My Downloads</button>
            <button className={section === "feedback" ? "selected" : ""} onClick={openFeedback}><MessageSquareText size={15} />My Feedback</button>
            <button className={section === "account" ? "selected" : ""} onClick={() => changeSection("account")}><UserRound size={15} />Account Details</button>
          </nav>
          <div className="user-topbar-account"><span>{user?.email}</span><button className="user-signout" onClick={signOut}><LogOut size={15} /><span>Sign out</span></button></div>
        </header>
        <div className={`user-content ${activeTool ? "has-active-tool" : ""}`}>
          {!activeTool && section !== "feedback" && (
            <section className={`user-welcome ${section === "tools" ? "user-welcome-tools" : ""}`}>
              <div className="user-welcome-copy">
                <span>{section === "tools" ? "YOUR CREATIVE WORKSPACE" : "YOUR ACCOUNT"}</span>
                <h1>
                  {section === "downloads"
                    ? "My downloads"
                    : section === "account"
                      ? "Account details"
                      : section === "feedback"
                        ? "My feedback"
                        : <>Welcome back{firstName ? `, ${firstName}` : ""}.</>}
                </h1>
                <p>
                  {section === "downloads"
                    ? "A personal list of downloads made while signed in."
                    : section === "account"
                      ? "Your signed-in account information."
                      : section === "feedback"
                        ? "See the feedback you’ve shared and any replies from our team."
                        : "A little inspiration goes a long way. What will you make today?"}
                </p>
                {section === "tools" && (
                  <button
                    className="user-browse-button"
                    type="button"
                    onClick={() => document.getElementById("user-tools")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Explore your tools <ArrowDown size={15} />
                  </button>
                )}
              </div>
              {section === "tools" && (
                <div className="user-welcome-art" aria-hidden="true">
                  <span className="welcome-orbit welcome-orbit-one" />
                  <span className="welcome-orbit welcome-orbit-two" />
                  <span className="welcome-art-icon"><Sparkles size={34} strokeWidth={1.5} /></span>
                  <span className="welcome-art-tag">Made for your next idea</span>
                </div>
              )}
            </section>
          )}
          {error && <p className="user-error" role="alert">{error}</p>}
          {section === "downloads" && historyError && <p className="user-error" role="alert">{historyError}</p>}
          {activeTool ? <activeTool.Component /> : section === "tools" ? (
            <section className="user-tools-section" id="user-tools" aria-label="Image tools">
              <div className="user-tools-heading">
                <div><span>THE TOOLKIT</span><h2>Find your next favorite</h2></div>
                <p>{toolCatalog.length} creative tools</p>
              </div>
              <div className="user-tool-grid">
                {toolCatalog.map((tool) => {
                  const Icon = toolIcons[tool.icon] || Sparkles;
                  return (
                    <button className="user-tool-card" key={tool.route} onClick={() => changeSection(tool.route)}>
                      <span className="user-tool-icon"><Icon size={20} strokeWidth={1.8} /></span>
                      <span className="user-tool-card-arrow"><ArrowUpRight size={17} /></span>
                      <strong>{tool.title}</strong>
                      <small>{tool.description}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : section === "account" ? (
            loading
              ? <section className="user-info-card" aria-busy="true"><div><small>ACCOUNT</small><strong>Loading your account…</strong></div></section>
              : <section className="user-info-card"><div><small>NAME</small><strong>{user?.name || "—"}</strong></div><div><small>EMAIL</small><strong>{user?.email || "—"}</strong></div><div><small>ROLE</small><strong>{user?.role || "—"}</strong></div></section>
          ) : section === "feedback" ? (
            <section className="user-feedback-page" aria-label="My feedback">
              <header className="user-feedback-hero">
                <div className="user-feedback-hero-copy">
                  <span className="user-feedback-eyebrow"><MessageSquareText size={14} /> FEEDBACK CENTER</span>
                  <h2>Your voice helps us improve.</h2>
                  <p>Track every message you’ve shared and see updates from our team in one place.</p>
                  <button className="user-feedback-new" type="button" onClick={() => navigate("/feedback")}>
                    Share new feedback <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="user-feedback-hero-art" aria-hidden="true">
                  <span className="user-feedback-orbit user-feedback-orbit-one" />
                  <span className="user-feedback-orbit user-feedback-orbit-two" />
                  <span className="user-feedback-art-icon"><MessageSquareText size={30} /></span>
                  <span className="user-feedback-art-spark">✦</span>
                </div>
              </header>

              <div className="user-feedback-overview" aria-label="Feedback summary">
                <article className="user-feedback-stat user-feedback-stat-total">
                  <span className="user-feedback-stat-icon"><MessageSquareText size={17} /></span>
                  <span><small>TOTAL MESSAGES</small><strong>{feedbackItems.length}</strong></span>
                  <em>{feedbackItems.length === 1 ? "message" : "messages"}</em>
                </article>
                <article className="user-feedback-stat user-feedback-stat-pending">
                  <span className="user-feedback-stat-icon"><Clock3 size={17} /></span>
                  <span><small>PENDING</small><strong>{feedbackCounts.pending}</strong></span>
                </article>
                <article className="user-feedback-stat user-feedback-stat-reviewed">
                  <span className="user-feedback-stat-icon"><Eye size={17} /></span>
                  <span><small>REVIEWED</small><strong>{feedbackCounts.reviewed}</strong></span>
                </article>
                <article className="user-feedback-stat user-feedback-stat-resolved">
                  <span className="user-feedback-stat-icon"><CheckCircle2 size={17} /></span>
                  <span><small>RESOLVED</small><strong>{feedbackCounts.resolved}</strong></span>
                </article>
              </div>

              <div className="user-feedback-history">
                <div className="user-feedback-history-heading">
                  <div>
                    <span>YOUR MESSAGES</span>
                    <h2>Feedback history</h2>
                    <p>Submitted messages, current status, and replies.</p>
                  </div>
                  <span className="user-feedback-history-count">
                    {feedbackItems.length} {feedbackItems.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                {feedbackState === "idle" || feedbackState === "loading" ? (
                  <div className="user-feedback-state" aria-busy="true" role="status">
                    <span className="user-history-loader" />
                    <strong>Loading your messages</strong>
                    <p>Your feedback history will be ready in a moment.</p>
                  </div>
                ) : feedbackState === "error" ? (
                  <div className="user-feedback-state" role="alert">
                    <span className="user-feedback-state-icon is-error"><MessageSquareText size={22} /></span>
                    <h3>We couldn’t load your feedback</h3>
                    <p>{feedbackError || "Please check your connection and try again."}</p>
                    <button type="button" onClick={retryFeedback}><RefreshCw size={14} /> Try again</button>
                  </div>
                ) : feedbackItems.length ? (
                  <div className="user-feedback-list">
                    {feedbackItems.map((item) => {
                      const submittedAt = item.createdAt ? new Date(item.createdAt) : null;
                      const repliedAt = item.repliedAt ? new Date(item.repliedAt) : null;
                      const categoryLabel = categoryLabels[item.category] || "Feedback";
                      const status = item.status || "pending";
                      const StatusIcon = feedbackStatusIcons[status] || Clock3;
                      return (
                        <article className={`user-feedback-item is-${status}`} key={item._id}>
                          <div className="user-feedback-item-top">
                            <span className="user-feedback-category">{categoryLabel}</span>
                            <span className={`user-feedback-status is-${status}`}>
                              <StatusIcon size={13} />
                              {feedbackStatusLabels[status] || "Pending"}
                            </span>
                          </div>
                          <div className="user-feedback-message">
                            <span>Your message</span>
                            <p>{item.message}</p>
                          </div>
                          <div className="user-feedback-date">
                            <CalendarDays size={14} />
                            <span>Submitted {submittedAt && !Number.isNaN(submittedAt.getTime())
                              ? submittedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                              : "date unavailable"}</span>
                          </div>
                          {item.adminReply && (
                            <div className="user-feedback-reply">
                              <span className="user-feedback-reply-icon"><MessageSquareReply size={15} /></span>
                              <div>
                                <strong>Reply from our team</strong>
                              <p>{item.adminReply}</p>
                              {repliedAt && !Number.isNaN(repliedAt.getTime()) && (
                                <small>{repliedAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</small>
                              )}
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="user-feedback-state">
                    <span className="user-feedback-state-icon"><MessageSquareText size={23} /></span>
                    <h3>No feedback yet</h3>
                    <p>Your feedback, status updates, and team replies will be saved here.</p>
                    <button type="button" onClick={() => navigate("/feedback")}>Share your first message <ArrowUpRight size={15} /></button>
                  </div>
                )}
              </div>
              <p className="user-feedback-latest">
                <CalendarDays size={13} />
                {latestFeedbackDate && !Number.isNaN(latestFeedbackDate.getTime())
                  ? `Latest message ${latestFeedbackDate.toLocaleDateString(undefined, { dateStyle: "medium" })}`
                  : "Your messages are visible only to you and our support team."}
              </p>
            </section>
          ) : (
            <section className="user-downloads" aria-label="My downloads">
              <div className="user-downloads-overview">
                <article className="user-download-stat-primary"><span className="user-download-stat-icon"><Download size={18} /></span><div><small>TOTAL DOWNLOADS</small><strong>{downloads.length}</strong></div></article>
                <article><span className="user-download-stat-icon user-download-stat-icon-alt"><FileImage size={18} /></span><div><small>LATEST DOWNLOAD</small><strong>{downloads[0]?.downloadedAt ? new Date(downloads[0].downloadedAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}</strong></div></article>
                <article><span className="user-download-stat-icon user-download-stat-icon-soft"><Sparkles size={18} /></span><div><small>LIBRARY</small><strong>Personal</strong></div></article>
              </div>
              <div className="user-history-card">
                <div className="user-history-heading"><div><span>YOUR LIBRARY</span><h2>Download history</h2><p>Files you’ve saved while signed in, all in one place.</p></div><span className="user-history-count">{downloads.length} {downloads.length === 1 ? "file" : "files"}</span></div>
                {downloads.length ? (
                  <div className="user-history-list">{downloads.map((item) => {
                    const date = item.downloadedAt ? new Date(item.downloadedAt) : null;
                    const fileSize = typeof item.fileSize === "number" ? (item.fileSize >= 1024 * 1024 ? `${(item.fileSize / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(item.fileSize / 1024))} KB`) : "Size unavailable";
                    return <article key={`${item.source}-${item._id}`}><span className="user-history-file-icon"><FileArchive size={19} /></span><span className="user-history-file-info"><strong title={item.fileName}>{item.fileName || "Untitled download"}</strong><small><span>{item.tool || "Creative tool"}</span><i />{date && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</small></span><span className="user-history-file-size">{fileSize}</span></article>;
                  })}</div>
                ) : loading || historyLoading ? null : <div className="user-history-state"><span className="user-history-empty-icon"><Download size={23} /></span><h3>Your library is ready</h3><p>Downloads you make while signed in will show up here.</p><button type="button" onClick={() => changeSection("tools")}>Explore your tools <ArrowUpRight size={15} /></button></div>}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

const categoryLabels = {
  suggestion: "Suggestion",
  bug: "Problem report",
  other: "Other feedback",
};

export default UserDashboard;
