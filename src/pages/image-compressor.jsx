
import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Download } from "lucide-react";
import "./compressor.css";

function ImageCompressor() {
  const [original, setOriginal] = useState(null);
  const [compressed, setCompressed] = useState(null);
  const [loading, setLoading] = useState(false);
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

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCompressedUrl("");

    try {
      const dimensions = await getDimensions(file);
      setOriginalDimensions(dimensions);
    } catch (err) {
      console.error(err);
      setError("Unable to read this image.");
    }
  };

  const handleCompress = async () => {
    if (!original || loading) return;

    const dimension = Number(maxDimension);

    if (
      !Number.isInteger(dimension) ||
      dimension < 256 ||
      dimension > 8192
    ) {
      setError("Maximum dimension must be between 256 and 8192.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await imageCompression(original, {
        maxSizeMB: 10,
        maxWidthOrHeight: dimension,
        initialQuality: quality / 100,
        useWebWorker: false,
      });

      const dimensions = await getDimensions(result);

      const newUrl = URL.createObjectURL(result);

      const formData = new FormData();
      const outputExtension = result.type === "image/png" ? ".png" : result.type === "image/webp" ? ".webp" : ".jpg";
      formData.append("image", result, original.name.replace(/\.[^.]+$/, outputExtension));
      formData.append("url", original.name);
      formData.append("quality", String(quality));
      formData.append("width", String(dimensions.width));
      formData.append("height", String(dimensions.height));
      formData.append("originalSize", String(original.size));
      formData.append("compressedSize", String(result.size));
      formData.append("reducedSize", String(Math.max(0, original.size - result.size)));

      const response = await fetch(
        "http://localhost:4000/users/image-compresser",
        {
          method: "POST",
          body: formData,
        }
      );

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        URL.revokeObjectURL(newUrl);
        throw new Error(
          responseData.message || responseData.error || "Image compression failed."
        );
      }

      if (compressedUrlRef.current) {
        URL.revokeObjectURL(compressedUrlRef.current);
      }
      compressedUrlRef.current = newUrl;

      setCompressed(result);
      setCompressionId(responseData.data?._id || "");
      setCompressedUrl(newUrl);
      setCompressedDimensions(dimensions);

    } catch (err) {
      console.error("Compression error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Compression failed. Please try another image."
      );
    } finally {
      setLoading(false);
    }
  };

  

const downloadImage = async () => {
  if (!compressionId) {
    setError("Please compress the image first.");
    return;
  }

  try {
    setError("");

    const response = await fetch(
      `http://localhost:4000/users/image-compresser/${compressionId}/download`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.message || "Unable to download compressed image."
      );
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `compressed-${original.name.replace(
      /\.[^.]+$/,
      ""
    )}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  } catch (err) {
    console.error("Download error:", err);

    setError(
      err instanceof Error
        ? err.message
        : "Download failed."
    );
  }
};

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const savedPercent =
    original && compressed && original.size > 0
      ? ((original.size - compressed.size) / original.size) * 100
      : 0;

  return (
    <main className="compressor-page">
      <h1>Image Compressor</h1>
      <p>Reduce image size and dimensions while maintaining good quality.</p>

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
            Lower quality may reduce file size. Click Compress Again to apply.
          </span>
        </label>

        <label className="compressor-setting" htmlFor="compressor-dimension">
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

      <label className={`compressor-upload${original ? " has-image" : ""}`}>
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
            disabled={!compressionId}
          >
            <Download size={18} />
            Download Compressed Image
          </button>
        </section>
      )}
    </main>
  );
}

export default ImageCompressor;
