import './Navbar.css'
import { Link } from 'react-router-dom'

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 2 1.55 6.45L20 10l-6.45 1.55L12 18l-1.55-6.45L4 10l6.45-1.55L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z"
        fill="currentColor"
      />
    </svg>
  )
}

function Navbar() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="AI Background Remover home">
        <span className="brand-mark">
          <SparkleIcon />
        </span>
        <span>AI BG Remover</span>
      </a>

      <nav className="topbar-nav" aria-label="Main navigation">
        <a href="#background-removal">BG remover</a>
        <a href="#background-changer">Backgrounds</a>
        <a href="#image-compressor">Compressor</a>
        <a href="#image-converter">Converter</a>
        <a href="#image-cropper">Cropper</a>
        <a href="#bulk-processing">Bulk</a>
        <a href="#download-options">Downloads</a>
        <a href="#image-analyzer">Analyzer</a>
        <a href="#quality-controls">Quality</a>
      </nav>

      <div className="topbar-actions">
        <div className="topbar-note">
          <span className="status-dot" />
          Free, fast & private
        </div>
        <Link className="nav-button nav-button-secondary" to="/login">
          Log in
        </Link>
        <button className="nav-button nav-button-primary" type="button">
          Get started
        </button>
      </div>
    </header>
  )
}

export default Navbar
