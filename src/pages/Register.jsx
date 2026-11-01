import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { API_USERS } from "../config/api.js";
import "./Login.css";

function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setNotice("The passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_USERS}/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          remember: formData.get("remember") === "on",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not create your account.");
      }

      navigate("/", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not connect to the registration service.");
    } finally {
      setIsSubmitting(false);
    }
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
            <p>Create an account and start making.</p>
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

        <section className="login-panel" aria-labelledby="register-heading">
          <Link to="/" className="mobile-login-brand">
            <span className="login-brand-mark"><Sparkles size={17} strokeWidth={1.8} /></span>
            <span>AI BG Remover</span>
          </Link>

          <div className="login-content">
            <Link to="/" className="back-home"><ArrowLeft size={15} /> Back to home</Link>

            <div className="login-heading-block">
              <div className="welcome-icon"><Sparkles size={19} strokeWidth={1.8} /></div>
              <span className="login-eyebrow">JOIN THE STUDIO</span>
              <h2 id="register-heading">Create your<br />creative space.</h2>
              <p>Sign up to get started.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-label" htmlFor="register-name">Full name</label>
              <div className="login-input-wrap">
                <UserRound className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="register-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Your name"
                  minLength={1}
                  maxLength={80}
                  required
                />
              </div>

              <label className="login-label" htmlFor="register-email">Email address</label>
              <div className="login-input-wrap">
                <Mail className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <label className="login-label" htmlFor="register-password">Password</label>
              <div className="login-input-wrap">
                <LockKeyhole className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="register-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  minLength={8}
                  maxLength={128}
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

              <label className="login-label" htmlFor="register-confirm-password">Confirm password</label>
              <div className="login-input-wrap">
                <LockKeyhole className="login-input-icon" size={17} strokeWidth={1.8} />
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>

              <label className="remember-option">
                <input type="checkbox" name="remember" />
                <span className="remember-box" />
                <span>Keep me signed in</span>
              </label>

              <button className="login-submit" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Please wait…" : "Create account"}
                {!isSubmitting && <ArrowUpRight size={17} strokeWidth={2} />}
              </button>

              {notice && <p className="login-notice" role="status">{notice}</p>}
            </form>

            <p className="login-signup">Already have an account? <Link to="/login">Sign in</Link></p>
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

export default Register;
