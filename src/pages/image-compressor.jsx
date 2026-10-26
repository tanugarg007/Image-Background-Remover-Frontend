
import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Download } from "lucide-react";
import "./compressor.css";

const API_BASE = `${
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? "http://localhost:4000"
    : "https://image-background-remover-backend-wa3j.onrender.com")
}/users`;

function ImageCompressor() {
  const [original, setOriginal] = useState(null);
  const [compressed, setCompressed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState("1920");
  const [originalDimensions, setOriginalDimensions] = useState(null);
  const [compressedDimensions, setCompressedDimensions] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [compressedUrl, setCompressedUrl] = useState("");
  const [compressionId, setCompressionId] = useState("");

  const previewUrlRef = useRef("");
  const compressedUrlRef = useRef("");
  const compressionRequestRef = useRef(false);
  const downloadRequestRef = useRef(false);

  // Cleanup only; no API calls here.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }

      if (compressedUrlRef.current) {
        URL.revokeObjectURL(compressedUrlRef.current);
      }
    };
  }, []);

  const getDimensions = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
        URL.revokeObjectURL(url);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image dimensions."));
      };

      image.src = url;
    });

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      return;
    }

    setError("");
    setOriginal(file);
    setCompressed(null);
    setCompressionId("");
    setOriginalDimensions(null);
    setCompressedDimensions(null);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }

    if (compressedUrlRef.current) {
      URL.revokeObjectURL(compressedUrlRef.current);
      compressedUrlRef.current = "";
    }

    setCompressedUrl("");

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    try {
      const dimensions = await getDimensions(file);
      setOriginalDimensions(dimensions);
    } catch (err) {
      console.error("Image dimensions error:", err);
      setError("Unable to read this image.");
    }
  };

  // This function runs only when the Compress button is clicked.
  const handleCompress = async () => {
      console.log("COMPRESS BUTTON HANDLER CALLED");
    if (!original || compressionRequestRef.current) return;

    const dimension = Number(maxDimension);

    if (
      !Number.isInteger(dimension) ||
      dimension < 256 ||
      dimension > 8192
    ) {
      setError("Maximum dimension must be between 256 and 8192.");
      return;
    }

    compressionRequestRef.current = true;
    setLoading(true);
    setError("");

    let newUrl = "";

    try {
      // Compress locally in the browser.
      const result = await imageCompression(original, {
        maxSizeMB: 10,
        maxWidthOrHeight: dimension,
        initialQuality: quality / 100,
        useWebWorker: false,
      });

      const dimensions = await getDimensions(result);
      newUrl = URL.createObjectURL(result);

      const outputExtension =
        result.type === "image/png"
          ? ".png"
          : result.type === "image/webp"
            ? ".webp"
            : ".jpg";

      const baseName = original.name.replace(/\.[^.]+$/, "");

      const formData = new FormData();
      formData.append("image", result, `${baseName}${outputExtension}`);
      formData.append("url", original.name);
      formData.append("quality", String(quality));
      formData.append("width", String(dimensions.width));
      formData.append("height", String(dimensions.height));
      formData.append("originalSize", String(original.size));
      formData.append("compressedSize", String(result.size));
      formData.append(
        "reducedSize",
        String(Math.max(0, original.size - result.size))
      );

      // The backend POST occurs only from this button handler.
      const response = await fetch(`${API_BASE}/image-compresser`, {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          [responseData.message, responseData.detail].filter(Boolean).join(": ") ||
            responseData.error ||
            "Image compression failed."
        );
      }

      if (compressedUrlRef.current) {
        URL.revokeObjectURL(compressedUrlRef.current);
      }

      compressedUrlRef.current = newUrl;
      newUrl = "";

      setCompressed(result);
      setCompressedUrl(compressedUrlRef.current);
      setCompressedDimensions(dimensions);
      setCompressionId(responseData.data?._id || "");

      if (!responseData.data?._id) {
        setError(
          "Image compressed, but the server did not return a record ID. Local preview is available, but server download is unavailable."
        );
      }
    } catch (err) {
      console.error("Compression error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Compression failed. Please try another image."
      );
    } finally {
      if (newUrl) URL.revokeObjectURL(newUrl);

      compressionRequestRef.current = false;
      setLoading(false);
    }
  };

  // This function runs only when the Download button is clicked.
  const downloadImage = async () => {
    console.log("DOWNLOAD BUTTON HANDLER CALLED");

    if (!compressionId || !original || downloadRequestRef.current) {
      if (!compressionId) {
        setError("Please compress the image first.");
      }
      return;
    }

    downloadRequestRef.current = true;
    setDownloading(true);
    setError("");

    let downloadUrl = "";

    try {
      const response = await fetch(
        `${API_BASE}/downloadimage/${encodeURIComponent(compressionId)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.message || "Unable to download compressed image."
        );
      }

      const blob = await response.blob();
      downloadUrl = URL.createObjectURL(blob);

      const baseName = original.name.replace(/\.[^.]+$/, "");
      const extension =
        compressed?.type === "image/png"
          ? ".png"
          : compressed?.type === "image/webp"
            ? ".webp"
            : ".jpg";

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `compressed-${baseName}${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Download error:", err);

      setError(
        err instanceof Error ? err.message : "Download failed."
      );
    } finally {
      if (downloadUrl) {
        window.setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
        }, 1000);
      }

      downloadRequestRef.current = false;
      setDownloading(false);
    }
  };

  const savedPercent =
    original && compressed && original.size > 0
      ? ((original.size - compressed.size) / original.size) * 100
      : 0;

  return (
    <main className="compressor-page">
      <h1>Image Compressor</h1>

      <p>
        Reduce image size and dimensions while maintaining good quality.
      </p>

      <div className="compressor-settings">
        <label className="compressor-setting" htmlFor="compressor-quality">
          <span>
            Quality <output>{quality}%</output>
          </span>

          <input
            id="compressor-quality"
            type="range"
            min="10"
            max="100"
            step="5"
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />

          <span className="compressor-setting-hint">
            Lower quality may reduce file size. Compress again to apply.
          </span>
        </label>

        <label
          className="compressor-setting"
          htmlFor="compressor-dimension"
        >
          <span>Maximum dimension (pixels)</span>

          <input
            id="compressor-dimension"
            type="number"
            min="256"
            max="8192"
            value={maxDimension}
            onChange={(event) => setMaxDimension(event.target.value)}
          />

          <span className="compressor-setting-hint">
            Maximum width or height. Original proportions are maintained.
          </span>
        </label>
      </div>

      <label
        className={`compressor-upload${original ? " has-image" : ""}`}
      >
        {previewUrl ? (
          <>
            <img
              className="compressor-preview"
              src={previewUrl}
              alt="Original image preview"
            />

            <span className="compressor-selected-name">
              {original.name}
            </span>

            <span className="compressor-change-image">
              Choose a different image
            </span>
          </>
        ) : (
          <>
            <Upload size={24} />
            <span>Choose an image</span>
          </>
        )}

        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            handleFileSelect(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {original && originalDimensions && (
        <p>
          Original dimensions: {originalDimensions.width} ×{" "}
          {originalDimensions.height} px
          {" · "}
          Original size: {formatSize(original.size)}
        </p>
      )}

      {error && <p role="alert">{error}</p>}

      {original && (
        <button
          className="compressor-action"
          type="button"
          onClick={handleCompress}
          disabled={loading}
        >
          {loading
            ? "Compressing..."
            : compressed
              ? "Compress Again"
              : "Compress Image"}
        </button>
      )}

      {compressed && compressedUrl && (
        <section className="compressor-results" aria-live="polite">
          <h2>Compression Results</h2>

          <div className="image-comparison">
            <div>
              <h3>Original Image</h3>
              <img src={previewUrl} alt="Original image" />

              <p>Size: {formatSize(original.size)}</p>

              <p>
                Dimensions: {originalDimensions?.width} ×{" "}
                {originalDimensions?.height} px
              </p>
            </div>

            <div>
              <h3>Compressed Image</h3>
              <img src={compressedUrl} alt="Compressed image" />

              <p>Size: {formatSize(compressed.size)}</p>

              <p>
                Dimensions: {compressedDimensions?.width} ×{" "}
                {compressedDimensions?.height} px
              </p>
            </div>
          </div>

          <h3>
            {savedPercent >= 0 ? "Size reduced" : "Size increased"}:{" "}
            {Math.abs(savedPercent).toFixed(1)}%
          </h3>

          <p>Applied quality setting: {quality}%</p>

          <button
            className="compressor-action"
            type="button"
            onClick={downloadImage}
            disabled={!compressionId || downloading}
          >
            <Download size={18} />
            {downloading ? "Downloading..." : "Download Compressed Image"}
          </button>
        </section>
      )}
    </main>
  );
}

export default ImageCompressor;
