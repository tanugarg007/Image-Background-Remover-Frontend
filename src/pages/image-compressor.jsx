
import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Upload, Download } from "lucide-react";
import "./compressor.css";
import { API_USERS } from "../config/api.js";
import { releaseGuestDownload, requireLoginForDownload, trackDownload } from "../config/downloadTracking.js";

const API_BASE = API_USERS;
function ImageCompressor() {
  const [original, setOriginal] = useState(null);
  const [compressed, setCompressed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState(80);
  const [maxDimension, setMaxDimension] = useState("1920");
  const [contentScale, setContentScale] = useState(100);
  const [originalDimensions, setOriginalDimensions] = useState(null);
  const [compressedDimensions, setCompressedDimensions] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [compressedUrl, setCompressedUrl] = useState("");
  const [compressionId, setCompressionId] = useState("");
  const [appliedSettings, setAppliedSettings] = useState(null);

  const previewUrlRef = useRef("");
  const compressedUrlRef = useRef("");
  const compressionRequestRef = useRef(false);
  const downloadRequestRef = useRef(false);
  const compressorRef = useRef(null);

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

  const addCanvasPadding = async (blob, scale, outputQuality) => {
    if (scale >= 100) return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Could not prepare the resized image.");
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const drawWidth = canvas.width * (scale / 100);
    const drawHeight = canvas.height * (scale / 100);
    context.drawImage(bitmap, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
    bitmap.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (output) => output ? resolve(output) : reject(new Error("Could not create the padded image.")),
        "image/jpeg",
        outputQuality / 100,
      );
    });
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
    setAppliedSettings(null);
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
      const resizedImage = await imageCompression(original, {
        maxSizeMB: 10,
        maxWidthOrHeight: dimension,
        initialQuality: quality / 100,
        fileType: "image/jpeg",
        useWebWorker: false,
      });
      const result = await addCanvasPadding(resizedImage, contentScale, quality);

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
      setAppliedSettings({ quality, dimension, contentScale });
      window.requestAnimationFrame(() => {
        compressorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

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
    if (!compressionId || !original || downloadRequestRef.current) {
      if (!compressionId) {
        setError("Please compress the image first.");
      }
      return;
    }
    if (!(await requireLoginForDownload())) return;

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
      await trackDownload("Image compressor", link.download, blob.size);
    } catch (err) {
      await releaseGuestDownload();
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
  const settingsAreCurrent = Boolean(compressionId) && appliedSettings?.quality === quality && appliedSettings?.dimension === Number(maxDimension) && appliedSettings?.contentScale === contentScale;

  return (
    <main className="compressor-page" ref={compressorRef}>
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
          {compressed && (
            <span className={`compressor-quality-state${appliedSettings?.quality === quality ? " is-current" : ""}`}>
              {appliedSettings?.quality === quality
                ? `Applied to preview: ${appliedSettings.quality}%`
                : `Preview still uses ${appliedSettings?.quality}%. Click Compress Again to apply ${quality}%.`}
            </span>
          )}
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

        <label className="compressor-setting" htmlFor="compressor-content-scale">
          <span>Image size inside canvas <output>{contentScale}%</output></span>
          <input
            id="compressor-content-scale"
            type="range"
            min="40"
            max="100"
            step="5"
            value={contentScale}
            onChange={(event) => setContentScale(Number(event.target.value))}
          />
          <span className="compressor-setting-hint">Lower values add white space so the image looks smaller after download.</span>
        </label>
      </div>

      <div className={`compressor-workspace${original ? " has-image" : ""}`}>
      <label className={`compressor-upload${original ? " has-image" : ""}`}>
        {previewUrl ? (
          <>
            {compressedUrl ? (
              <div className="compressor-preview-comparison">
                <div>
                  <span>Original</span>
                  <img src={previewUrl} alt="Original image preview" style={{ width: "100%" }} />
                  <small>{originalDimensions?.width} × {originalDimensions?.height} px · {formatSize(original.size)}</small>
                </div>
                <div>
                  <span>Compressed</span>
                  <img
                    src={compressedUrl}
                    alt="Compressed image preview"
                    style={{ width: `${Math.max(20, Math.min(100, Math.max(compressedDimensions?.width || 0, compressedDimensions?.height || 0) / Math.max(originalDimensions?.width || 1, originalDimensions?.height || 1) * 100))}%` }}
                  />
                  <small>{compressedDimensions?.width} × {compressedDimensions?.height} px · {formatSize(compressed.size)}</small>
                </div>
              </div>
            ) : (
              <img className="compressor-preview" src={previewUrl} alt="Original image preview" />
            )}

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

      {original && (
        <div className="compressor-quick-actions">
          <button
            className="compressor-action"
            type="button"
            onClick={handleCompress}
            disabled={loading}
          >
            {loading ? "Compressing..." : compressed ? "Compress Again" : "Compress Image"}
          </button>
          <button
            className="compressor-action compressor-download-quick"
            type="button"
            onClick={downloadImage}
            disabled={!settingsAreCurrent || downloading}
          >
            <Download size={18} />
            {downloading ? "Downloading..." : "Download Compressed Image"}
          </button>
          {compressed && (
            <div className="compressor-result-summary" aria-live="polite">
              <strong>{savedPercent >= 0 ? "Size reduced" : "Size increased"}: {Math.abs(savedPercent).toFixed(1)}%</strong>
              <span>Quality used: {appliedSettings?.quality}%</span>
              <span>File size: {formatSize(original.size)} → {formatSize(compressed.size)}</span>
              {!settingsAreCurrent && <span>Settings changed. Compress again to apply them.</span>}
            </div>
          )}
        </div>
      )}
      </div>

      {original && originalDimensions && (
        <p>
          Original dimensions: {originalDimensions.width} ×{" "}
          {originalDimensions.height} px
          {" · "}
          Original size: {formatSize(original.size)}
        </p>
      )}

      {error && <p role="alert">{error}</p>}

    </main>
  );
}

export default ImageCompressor;
