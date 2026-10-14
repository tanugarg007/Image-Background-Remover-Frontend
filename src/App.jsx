
import Navbar from "./pages/Navbar.jsx";
import Image from "./pages/Image.jsx";
import BackgroundChanger from "./pages/BackgroundChanger.jsx";
import ImageCompressor from "./pages/image-compressor.jsx";
import ImageConverter from "./pages/ImageConverter.jsx";
import ImageCropper from "./pages/ImageCropper.jsx";
import BulkImageProcessing from "./pages/BulkImageProcessing.jsx";

function App() {
  return (
    <>
      <Navbar />
      <Image />
      <BackgroundChanger />
      <ImageCompressor />
      <ImageConverter />
      <ImageCropper />
      <BulkImageProcessing />
    </>
  );
}

export default App;
