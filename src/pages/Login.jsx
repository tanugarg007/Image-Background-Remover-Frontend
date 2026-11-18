import { useEffect, useState } from "react";
import { Apple, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, Eye, EyeOff, GitBranch, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_USERS } from "../config/api.js";
import "./Login.css";

function getSafeReturnTo() {
  const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) return "";

  try {
    const target = new URL(requestedPath, window.location.origin);
    if (target.origin !== window.location.origin || target.pathname === "/login") return "";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "";
  }
}

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [loginSuccess, setLoginSuccess] = useState(null);

  const unavailableProvider = (provider) => setNotice(`${provider} sign-in is not connected yet. Please continue with email.`);

  useEffect(() => {
    if (
      !loginSuccess
      || new URLSearchParams(window.location.search).get("popup") !== "1"
      || !window.opener
    ) return;

    window.opener.postMessage({ type: "citc-login-complete" }, window.location.origin);
    window.close();
  }, [loginSuccess]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "error") {
      setNotice("Google sign-in could not be completed. Please try again or use email.");
      return;
    }
    if (params.get("google") !== "success") return;

    let cancelled = false;
    fetch(`${API_USERS}/me`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Could not finish Google sign-in.");
        if (cancelled) return;
        const role = data.user?.role || "user";
        const destination = role === "superadmin"
          ? "/superadmin"
          : role === "admin"
            ? "/admin"
            : getSafeReturnTo() || "/user";
        setLoginSuccess({ destination, role });
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not finish Google sign-in.");
      });
    return () => { cancelled = true; };
  }, []);

  const handleGoogleLogin = () => {
    const params = new URLSearchParams();
    const returnTo = getSafeReturnTo();
    if (returnTo) params.set("returnTo", returnTo);
    if (new URLSearchParams(window.location.search).get("popup") === "1") params.set("popup", "1");
    window.location.assign(`${API_USERS}/google/login${params.size ? `?${params}` : ""}`);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const remember = formData.get("remember") === "on";

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_USERS}/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not sign in.");
      }

      const role = data.user?.role || "user";
      const destination = role === "superadmin"
        ? "/superadmin"
        : role === "admin"
          ? "/admin"
          : getSafeReturnTo() || "/user";
      setLoginSuccess({ destination, role });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not connect to the login service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loginSuccess) {
    return (
      <main className="login-success-page">
        <div className="login-success-glow login-success-glow-one" />
        <div className="login-success-glow login-success-glow-two" />
        <section className="login-success-card" role="status" aria-live="polite">
          <Link to="/" className="login-success-brand"><span><Sparkles size={18} /></span> Pixelcraft</Link>
          <div className="login-success-content">
            <div className="login-success-icon"><CheckCircle2 size={31} strokeWidth={1.8} /></div>
            <span className="login-success-eyebrow">ACCESS CONFIRMED <i /></span>
            <h1>Welcome back<span>.</span></h1>
            <p>You’re signed in with the <strong>{loginSuccess.role}</strong> role.<br />Everything is ready for you.</p>
            <button type="button" className="login-success-continue" onClick={() => navigate(loginSuccess.destination, { replace: true })}>
              Open my workspace <ArrowRight size={17} />
            </button>
            <div className="login-success-secure"><ShieldCheck size={14} /> Securely connected to your workspace</div>
          </div>
          <div className="login-success-bottom"><span>PIXELCRAFT</span><span>YOUR CREATIVE SPACE</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-frame">
        <section className="login-showcase" aria-label="AI BG Remover introduction">
          <div className="showcase-glow showcase-glow-one" />
          <div className="showcase-glow showcase-glow-two" />

          <Link to="/" className="login-brand" aria-label="AI BG Remover home">
            <span className="login-brand-mark"><Sparkles size={18} strokeWidth={1.8} /></span>
            <span>Pixelcraft</span>
          </Link>

          <div className="showcase-copy">
            <span className="showcase-kicker"><span /> YOUR PIXELCRAFT WORKSPACE</span>
            <h1>Make room<br />for <em>better ideas.</em></h1>
            <p>Sign in to continue to your Pixelcraft workspace.</p>
          </div>

          <div className="showcase-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sun" />
            <div className="art-mountain mountain-back" />
            <div className="art-mountain mountain-front" />
            <div className="art-ground" />
            <div className="art-chip chip-top"><Sparkles size={13} /> Background removed</div>
            <div className="art-chip chip-bottom"><span className="chip-check">✓</span> Ready to create</div>
          </div>

          <div className="showcase-footer">
            <span>Thoughtful tools for image makers.</span>
            <div className="showcase-dots"><i /><i /><i /></div>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-heading">
          <Link to="/" className="mobile-login-brand">
            <span className="login-brand-mark"><Sparkles size={17} strokeWidth={1.8} /></span>
            <span>Pixelcraft</span>
          </Link>

          <div className="login-content">
            <Link to="/" className="back-home"><ArrowLeft size={15} /> Back to home</Link>

            <div className="login-heading-block">
              <div className="welcome-icon"><LockKeyhole size={19} strokeWidth={1.8} /></div>
              <span className="login-eyebrow">WELCOME TO PIXELCRAFT</span>
              <h2 id="login-heading">Welcome to<br />Pixelcraft.</h2>
              <p>Sign in to continue to your creative space.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-label" htmlFor="login-email">Email address</label>
              <div className="login-input-wrap">
                <Mail className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="password-label-row">
                <label className="login-label" htmlFor="login-password">Password</label>
                <button className="forgot-button" type="button" onClick={() => setNotice("Password reset is not available yet.")}>Forgot password?</button>
              </div>
              <div className="login-input-wrap">
                <LockKeyhole className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  minLength={8}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <label className="remember-option">
                <input type="checkbox" name="remember" />
                <span className="remember-box" />
                <span>Keep me signed in</span>
              </label>

              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : "Sign in"}
                {!isSubmitting && <ArrowUpRight size={17} strokeWidth={2} />}
              </button>

              {notice && <p className="login-notice" role="alert">{notice}</p>}
            </form>

            <div className="provider-divider login-options-divider"><span>OR CONTINUE WITH</span></div>
            <div className="login-providers" aria-label="Other sign in options">
              <button type="button" className="provider-button provider-google" onClick={handleGoogleLogin}>
                <span className="google-mark" aria-hidden="true">G</span> Continue with Google
              </button>
              <button type="button" className="provider-button" onClick={() => unavailableProvider("GitHub")}>
                <GitBranch size={18} /> Continue with GitHub
              </button>
              <button type="button" className="provider-button" onClick={() => unavailableProvider("Facebook")}>
                <span className="facebook-mark" aria-hidden="true">f</span> Continue with Facebook
              </button>
              <button type="button" className="provider-button" onClick={() => unavailableProvider("Apple")}>
                <Apple size={18} fill="currentColor" /> Continue with Apple
              </button>
            </div>

            <p className="login-signup">
              New to Pixelcraft? <Link to="/register">Create an account</Link>
            </p>
          </div>

          <footer className="login-legal">
            <span>© 2026 AI BG Remover</span>
            <span><ShieldCheck size={13} /> Your workspace, your way</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default Login;
