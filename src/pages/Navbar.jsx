import './Navbar.css'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Image from './Image.jsx'
import BackgroundBlur from './BackgroundBlur.jsx'
import BackgroundChanger from './BackgroundChanger.jsx'
import ImageCompressor from './image-compressor.jsx'
import ImageConverter from './ImageConverter.jsx'
import ImageCropper from './ImageCropper.jsx'
import BulkImageProcessing from './BulkImageProcessing.jsx'
import DownloadOptions from './DownloadOptions.jsx'
import ImageAnalyzer from './ImageAnalyzer.jsx'
import ImageQualityControls from './ImageQualityControls.jsx'

// Register each frontend tool here; App, the navbar, and the admin list use this catalog.
export const toolCatalog = [
  { title: 'Background Remover', navLabel: 'BG remover', description: 'Remove an image background and download a transparent result.', icon: 'ImageIcon', route: '#background-removal', Component: Image },
  { title: 'Background Changer', navLabel: 'Backgrounds', description: 'Replace or customize the background of an image.', icon: 'Palette', route: '#background-changer', Component: BackgroundChanger },
  { title: 'Background Blur', navLabel: 'Blur', description: 'Keep your subject crisp and blur the background for a portrait-style finish.', icon: 'Aperture', route: '#background-blur', Component: BackgroundBlur },
  { title: 'Image Compressor', navLabel: 'Compressor', description: 'Reduce image file size while preserving useful quality.', icon: 'Minimize2', route: '#image-compressor', Component: ImageCompressor },
  { title: 'Image Converter', navLabel: 'Converter', description: 'Convert images between supported file formats.', icon: 'FileImage', route: '#image-converter', Component: ImageConverter },
  { title: 'Image Cropper', navLabel: 'Cropper', description: 'Crop and download an image to the desired dimensions.', icon: 'Crop', route: '#image-cropper', Component: ImageCropper },
  { title: 'Bulk Image Processing', navLabel: 'Bulk', description: 'Process multiple images in one workflow.', icon: 'Layers', route: '#bulk-processing', Component: BulkImageProcessing },
  { title: 'Download Options', navLabel: 'Downloads', description: 'View and manage available image download options.', icon: 'Archive', route: '#download-options', Component: DownloadOptions },
  { title: 'Image Analyzer', navLabel: 'Analyzer', description: 'Analyze an image and review its detected details.', icon: 'ScanSearch', route: '#image-analyzer', Component: ImageAnalyzer },
  { title: 'Image Quality Controls', navLabel: 'Quality', description: 'Adjust image quality settings and inspect the result.', icon: 'SlidersHorizontal', route: '#quality-controls', Component: ImageQualityControls },
]

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

function Navbar({ showAllTools, onToggleTools, tools = toolCatalog }) {
  const visibleToolLinks = showAllTools ? tools : tools.slice(0, 4)

  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="AI Background Remover home">
        <span className="brand-mark">
          <SparkleIcon />
        </span>
        <span>AI BG Remover</span>
      </a>

      <nav className="topbar-nav" aria-label="Main navigation">
        {visibleToolLinks.map((tool) => (
          <a key={tool.route} href={tool.route}>{tool.navLabel}</a>
        ))}
        {tools.length > 4 && (
          <button
            className="nav-tools-toggle"
            type="button"
            onClick={onToggleTools}
            aria-expanded={showAllTools}
          >
            {showAllTools ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAllTools ? 'Show fewer' : 'Show all tools'}
          </button>
        )}
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
