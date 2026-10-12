
import { useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Download } from "lucide-react";
import "./Compressor.css";
function ImageCompressor() {
  const [original, setOriginal] = useState(null);
  const [compressed, setCompressed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCompress = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      return;
    }

    setError("");
    setOriginal(file);
    setCompressed(null);
    setLoading(true);

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      };

      const result = await imageCompression(file, options);
      setCompressed(result);
    } catch (err) {
      console.error("Compression error:", err);
      setError("Image compression failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };


const downloadImage = () => {
  if (!compressed) return;

  const url = URL.createObjectURL(compressed);
  const link = document.createElement("a");

  link.href = url;
  link.download = `compressed-${compressed.name || "image.jpg"}`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

  const formatSize = (bytes) =>
    `${(bytes / 1024).toFixed(2)} KB`;

  const savedPercent =
    original && compressed
      ? Math.max(
          0,
          ((original.size - compressed.size) / original.size) * 100
        ).toFixed(1)
      : 0;

  return (
    <main className="compressor-page">
      <h1>Image Compressor</h1>
      <p>Reduce image size while maintaining good quality.</p>

      <label className="compressor-upload">
        <Upload size={24} />
        <span>Choose an image</span>
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleCompress(e.target.files?.[0])}
        />
      </label>

      {loading && <p>Compressing image...</p>}
      {error && <p role="alert">{error}</p>}

      {original && (
        <p>Original size: {formatSize(original.size)}</p>
      )}

      {compressed && (
        <section>
          <p>Compressed size: {formatSize(compressed.size)}</p>
          <p>Size reduced: {savedPercent}%</p>

          <button onClick={downloadImage}>
            <Download size={18} />
            Download compressed image
          </button>
        </section>
      )}
    </main>
  );
}

export default ImageCompressor;
