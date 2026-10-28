import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_USERS } from "../config/api.js";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const remember = formData.get("remember") === "on";

    if (mode === "register" && password !== formData.get("confirmPassword")) {
      setNotice("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = mode === "register" ? "register" : "login";
      const response = await fetch(`${API_USERS}/${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success !== true || !data.user) {
        throw new Error(
          data.message ||
            `Could not ${mode === "register" ? "create account" : "sign in"} (HTTP ${response.status}).`
        );
      }

      navigate("/", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not connect to the login service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((currentMode) => currentMode === "login" ? "register" : "login");
    setNotice("");
  };

  return (
    <main className="login-page">
      <div className="login-frame">
        <section className="login-showcase" aria-label="AI BG Remover introduction">
          <div className="showcase-glow showcase-glow-one" />
          <div className="showcase-glow showcase-glow-two" />

          <Link to="/" className="login-brand" aria-label="AI BG Remover home">
            <span className="login-brand-mark"><Sparkles size={18} strokeWidth={1.8} /></span>
            <span>AI BG Remover</span>
          </Link>

          <div className="showcase-copy">
            <span className="showcase-kicker"><span /> YOUR CREATIVE SPACE</span>
            <h1>Make room<br />for <em>better ideas.</em></h1>
            <p>Sign in to pick up where your creativity left off.</p>
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
            <span>AI BG Remover</span>
          </Link>

          <div className="login-content">
            <Link to="/" className="back-home"><ArrowLeft size={15} /> Back to home</Link>

            <div className="login-heading-block">
              <div className="welcome-icon"><LockKeyhole size={19} strokeWidth={1.8} /></div>
              <span className="login-eyebrow">{mode === "login" ? "WELCOME BACK" : "JOIN THE STUDIO"}</span>
              <h2 id="login-heading">{mode === "login" ? <>Sign in to your<br />creative space.</> : <>Create your<br />creative space.</>}</h2>
              <p>{mode === "login" ? "Enter your details below to continue." : "Create an account to get started."}</p>
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
                {mode === "login" && <button className="forgot-button" type="button" onClick={() => setNotice("Password reset is not available yet.")}>Forgot password?</button>}
              </div>
              <div className="login-input-wrap">
                <LockKeyhole className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
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

              {mode === "register" && <>
                <label className="login-label" htmlFor="login-confirm-password">Confirm password</label>
                <div className="login-input-wrap">
                  <LockKeyhole className="login-input-icon" size={17} strokeWidth={1.8} />
                  <input
                    id="login-confirm-password"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Enter your password again"
                    minLength={8}
                    required
                  />
                </div>
              </>}

              <label className="remember-option">
                <input type="checkbox" name="remember" />
                <span className="remember-box" />
                <span>Keep me signed in</span>
              </label>

              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
                {!isSubmitting && <ArrowUpRight size={17} strokeWidth={2} />}
              </button>

              {notice && <p className="login-notice" role="status">{notice}</p>}
            </form>

            <p className="login-signup">
              {mode === "login" ? "New to the studio? " : "Already have an account? "}
              <button type="button" onClick={switchMode}>{mode === "login" ? "Create an account" : "Sign in"}</button>
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
