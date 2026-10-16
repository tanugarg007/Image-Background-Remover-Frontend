
import Navbar from "./pages/Navbar.jsx";
import Image from "./pages/Image.jsx";
import BackgroundChanger from "./pages/BackgroundChanger.jsx";
import ImageCompressor from "./pages/image-compressor.jsx";
import ImageConverter from "./pages/ImageConverter.jsx";
import ImageCropper from "./pages/ImageCropper.jsx";
import BulkImageProcessing from "./pages/BulkImageProcessing.jsx";
import ImageAnalyzer from "./pages/ImageAnalyzer.jsx";
import ImageQualityControls from "./pages/ImageQualityControls.jsx";
import DownloadOptions from "./pages/DownloadOptions.jsx";

function App() {
  return (
    <>
      <Navbar />
      <section id="background-removal" className="app-section"><Image /></section>
      <section id="background-changer" className="app-section"><BackgroundChanger /></section>
      <section id="image-compressor" className="app-section"><ImageCompressor /></section>
      <section id="image-converter" className="app-section"><ImageConverter /></section>
      <section id="image-cropper" className="app-section"><ImageCropper /></section>
      <section id="bulk-processing" className="app-section"><BulkImageProcessing /></section>
      <section className="app-section"><DownloadOptions /></section>
      <section id="image-analyzer" className="app-section"><ImageAnalyzer /></section>
      <section id="quality-controls" className="app-section"><ImageQualityControls /></section>
    </>
  );
}

export default App;
