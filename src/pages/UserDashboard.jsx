import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, LogOut, Sparkles, UserRound } from "lucide-react";
import { API_USERS, getSessionStatus } from "../config/api.js";
import { toolCatalog } from "./Navbar.jsx";
import "./UserDashboard.css";

function UserDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [section, setSection] = useState("tools");
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const status = await getSessionStatus();
        if (!status.authenticated) {
          navigate("/login", { replace: true });
          return;
        }

        const response = await fetch(`${API_USERS}/me`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) {
          navigate("/login", { replace: true });
          return;
        }
        if (["admin", "superadmin"].includes(payload.user.role)) {
          navigate(payload.user.role === "superadmin" ? "/superadmin" : "/admin", { replace: true });
          return;
        }
        setUser(payload.user);
        const historyResponse = await fetch(`${API_USERS}/my/downloads`, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const history = await historyResponse.json().catch(() => ({}));
        if (!historyResponse.ok) throw new Error(history.message || "Could not load your downloads.");
        setDownloads(Array.isArray(history.data) ? history.data : []);
      } catch (requestError) {
        if (requestError.name !== "AbortError") setError(requestError.message || "Could not load your workspace.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [navigate]);

  const signOut = async () => {
    try { await fetch(`${API_USERS}/logout`, { method: "POST", credentials: "include" }); }
    finally { navigate("/login", { replace: true }); }
  };

  const openDownloads = async () => {
    setSection("downloads");
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_USERS}/my/downloads`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Could not load your downloads.");
      setDownloads(Array.isArray(payload.data) ? payload.data : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load your downloads.");
    } finally {
      setLoading(false);
    }
  };

  const activeTool = toolCatalog.find((tool) => tool.route === section);
  return (
    <div className="user-dashboard">
      <main className="user-main">
        <header className="user-topbar">
          <a className="user-brand" href="/" aria-label="Pixelcraft home"><span><Sparkles size={17} /></span> pixelcraft</a>
          <nav className="user-main-nav" aria-label="User dashboard">
            <button className={!['downloads', 'account'].includes(section) ? "selected" : ""} onClick={() => setSection("tools")}><Sparkles size={15} />Tools</button>
            <button className={section === "downloads" ? "selected" : ""} onClick={openDownloads}><Download size={15} />My Downloads</button>
            <button className={section === "account" ? "selected" : ""} onClick={() => setSection("account")}><UserRound size={15} />Account Details</button>
          </nav>
          <div className="user-topbar-account"><span>{user?.email}</span><button className="user-signout" onClick={signOut}><LogOut size={15} /><span>Sign out</span></button></div>
        </header>
        <div className="user-content">
          <div className="user-welcome"><span>YOUR CREATIVE SPACE</span><h1>{activeTool ? activeTool.title : section === "downloads" ? "My downloads" : section === "account" ? "Account details" : "Tools for your next idea"}</h1><p>{activeTool?.description || (section === "downloads" ? "A personal list of downloads made while signed in." : section === "account" ? "Your signed-in account information." : "Choose an image tool and start creating.")}</p></div>
          {error && <p className="user-error" role="alert">{error}</p>}
          {activeTool ? <activeTool.Component /> : section === "tools" ? (
            <div className="user-tool-grid">{toolCatalog.map((tool) => <button key={tool.route} onClick={() => setSection(tool.route)}><span><Sparkles size={17} /></span><strong>{tool.title}</strong><small>{tool.description}</small></button>)}</div>
          ) : section === "account" ? (
            <section className="user-info-card"><div><small>NAME</small><strong>{user?.name || "—"}</strong></div><div><small>EMAIL</small><strong>{user?.email || "—"}</strong></div><div><small>ROLE</small><strong>User</strong></div></section>
          ) : (
            <section className="user-history-card"><h2><Download size={17} /> Recent downloads</h2>{loading ? <p>Loading your downloads…</p> : downloads.length ? <div className="user-history-list">{downloads.map((item) => <article key={`${item.source}-${item._id}`}><span><strong>{item.fileName}</strong><small>{item.tool} · {item.downloadedAt ? new Date(item.downloadedAt).toLocaleString() : ""}</small></span><small>{typeof item.fileSize === "number" ? `${(item.fileSize / 1024).toFixed(1)} KB` : "—"}</small></article>)}</div> : <p>No downloads yet. Downloads you make while signed in will appear here.</p>}</section>
          )}
        </div>
      </main>
    </div>
  );
}

export default UserDashboard;
