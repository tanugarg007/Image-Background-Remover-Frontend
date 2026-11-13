
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  Sparkles,
  ShieldCheck,
  Download,
  Image as ImageIcon,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import "./Image.css";
import { getSessionStatus, removeBackgroundInBrowser } from "../config/api.js";
import {
  releaseGuestDownload,
  requireLoginForDownload,
  trackDownload,
} from "../config/downloadTracking.js";
import { claimPendingDownload, savePendingDownload } from "../config/downloadHandoff.js";


function Image() {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [originalImage, setOriginalImage] = useState("");
  const [processedImage, setProcessedImage] = useState("");
  const [processedBlob, setProcessedBlob] = useState(null);
  const [processedFilename, setProcessedFilename] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [downloadPreparing, setDownloadPreparing] = useState(false);

  // Clean up temporary image URLs.
  useEffect(() => {
    return () => {
      if (originalImage) {
        URL.revokeObjectURL(originalImage);
      }

      if (processedImage) {
        URL.revokeObjectURL(processedImage);
      }
    };
  }, [originalImage, processedImage]);

  useEffect(() => {
    let active = true;
    const restoreProcessedImage = async () => {
      let pending;
      try {
        pending = await claimPendingDownload("Background removal");
        if (!pending) return;
        const status = await getSessionStatus();
        if (!status.authenticated) {
          await savePendingDownload(pending);
          if (active) setError("Please sign in to download your processed image.");
          return;
        }
        if (!active) {
          await savePendingDownload(pending);
          return;
        }

        const previewUrl = URL.createObjectURL(pending.blob);
        const originalUrl = pending.originalFile
          ? URL.createObjectURL(pending.originalFile)
          : "";
        setSelectedFile(pending.originalFile || null);
        setOriginalImage(originalUrl);
        setProcessedImage(previewUrl);
        setProcessedBlob(pending.blob);
        setProcessedFilename(pending.fileName);
        setMessage("You’re signed in. Your processed image is ready—click Download Image when you’re ready.");
      } catch (resumeError) {
        if (pending) {
          try {
            await savePendingDownload(pending);
          } catch (storageError) {
            if (active) setError(`Could not resume the download: ${resumeError.message} ${storageError.message}`);
            return;
          }
        }
        if (active) setError(resumeError instanceof Error ? resumeError.message : "Could not resume your download.");
      }
    };

    const timer = window.setTimeout(() => { void restoreProcessedImage(); }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  // Select and validate an image.
  const handleFile = (file) => {
    if (!file) return;

    setError("");
    setMessage("");
    setProcessedImage("");
    setProcessedBlob(null);
    setProcessedFilename("");

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/jpg"
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Image size must be less than 20 MB.");
      return;
    }

    setSelectedFile(file);
    setOriginalImage(URL.createObjectURL(file));
  };

  const handleFileChange = (event) => {
    handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  // Drag and drop.
  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  // Run background removal in the browser so image processing does not depend
  // on the Render service staying awake or completing a long request.
  const handleRemoveBackground = async () => {
    if (!selectedFile || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    if (processedImage) {
      URL.revokeObjectURL(processedImage);
      setProcessedImage("");
    }

    setProcessedFilename("");

    try {
      const imageBlob = await removeBackgroundInBrowser(selectedFile, setMessage);

      const resultUrl = URL.createObjectURL(imageBlob);

      setProcessedImage(resultUrl);
      setProcessedBlob(imageBlob);
      setProcessedFilename("background-removed.png");
      setMessage("Background removed successfully!");
    } catch (err) {
      console.error("Background removal error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Download the processed image.
  const handleDownload = async () => {
    if (!processedImage || !processedBlob || loading || downloadPreparing) return;
    let reservationPending = false;
    try {
      setDownloadPreparing(true);
      setError("");
      setMessage("");
      const fileName = processedFilename || "background-removed.png";
      if (!(await requireLoginForDownload())) return;
      reservationPending = true;

      const link = document.createElement("a");
      link.href = processedImage;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      reservationPending = false;
      setMessage("Your download has started.");

      try {
        await trackDownload("Background removal", fileName, processedBlob.size);
      } catch (trackingError) {
        console.error("Download tracking error:", trackingError);
        setError("The download started, but its activity could not be recorded.");
      }
    } catch (err) {
      if (reservationPending) await releaseGuestDownload();
      console.error("Download error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Image download failed. Please try again."
      );
    } finally {
      setDownloadPreparing(false);
    }
  };

  // Start again with another image.
  const handleReset = () => {
    setSelectedFile(null);
    setOriginalImage("");
    setProcessedImage("");
    setProcessedBlob(null);
    setProcessedFilename("");
    setError("");
    setMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  return (
    <div className="page-shell">
      <main className={`hero ${selectedFile ? "has-selected-file" : ""}`}>
        <div className="eyebrow">
          <Sparkles aria-hidden="true" />
          AI-POWERED IMAGE EDITING
        </div>

        <h1>
          Remove backgrounds.
          <br />
          Keep the magic.
        </h1>

        <p className="hero-subtitle">
          Clean, transparent images in seconds. No complicated
          editing required.
        </p>

        {/* Upload section */}
        <section
          className={`upload-card ${
            isDragging ? "is-dragging" : ""
          } ${selectedFile ? "has-file" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {!selectedFile ? (
            <>
              <div className="upload-icon-wrap">
                <Upload aria-hidden="true" />
              </div>

              <h2>Drop your image here</h2>

              <p className="upload-hint">
                Or select an image from your computer
              </p>

              <button
                type="button"
                className="upload-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                Choose an image
              </button>

              <p className="file-types">
                PNG <span>·</span> JPG <span>·</span> WebP
                <span>·</span> Max 20 MB
              </p>
            </>
          ) : (
            <div className="file-preview">
              <div className="preview-image-wrap">
                <img
                  src={originalImage}
                  alt="Selected original"
                />
              </div>

              <div className="preview-copy">
                <span className="preview-label">
                  IMAGE SELECTED
                </span>

                <strong title={selectedFile.name}>
                  {selectedFile.name}
                </strong>

                <span>
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>

                <button
                  type="button"
                  className="change-button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change image
                </button>

                <div className="file-preview-actions">
                  <button
                    type="button"
                    className="remove-background-button"
                    onClick={handleRemoveBackground}
                    disabled={loading || !selectedFile}
                  >
                    <Sparkles aria-hidden="true" />
                    {loading ? "Processing..." : "Remove background"}
                  </button>
                  <button
                    type="button"
                    className="download-png-button"
                    onClick={handleDownload}
                    disabled={!processedImage || loading || downloadPreparing}
                  >
                    <Download aria-hidden="true" />
                    {downloadPreparing ? "Preparing..." : "Download Image"}
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
          />
        </section>

        {/* Feature information */}
        <div className="trust-row">
          <span>
            <CheckCircle2 className="check-mark" />
            Easy to use
          </span>

          <span>
            <ShieldCheck className="check-mark" />
            Transparent PNG
          </span>

          <span>
            <Sparkles className="check-mark" />
            AI powered
          </span>
        </div>

        {/* Image comparison */}
        {selectedFile && (
          <section className="image-preview-section">
            <div className="preview-section-heading">
              <div>
                <h2>Your image preview</h2>
                <p>
                  Compare your original and processed images.
                </p>
              </div>

              <span
                className="preview-file-name"
                title={selectedFile.name}
              >
                {selectedFile.name}
              </span>
            </div>

            <div className="preview-comparison">
              <article className="comparison-panel">
                <div className="comparison-label">
                  <span>Original image</span>
                  <span className="image-state pending">
                    Original
                  </span>
                </div>

                <div className="comparison-image">
                  <img
                    src={originalImage}
                    alt="Original image with background"
                  />
                </div>
              </article>

              <article className="comparison-panel">
                <div className="comparison-label">
                  <span>Background removed</span>

                  <span
                    className={`image-state ${
                      processedImage ? "" : "pending"
                    }`}
                  >
                    {processedImage ? "Completed" : "Waiting"}
                  </span>
                </div>

                <div
                  className={`comparison-image ${
                    !processedImage ? "result-placeholder" : ""
                  }`}
                >
                  {loading ? (
                    <div className="processing-state">
                      <RefreshCw
                        className="processing-spinner"
                        aria-hidden="true"
                      />
                      <p>Removing background...</p>
                    </div>
                  ) : processedImage ? (
                    <img
                      src={processedImage}
                      alt="Image with background removed"
                    />
                  ) : (
                    <div>
                      <ImageIcon aria-hidden="true" />
                      <p>
                        Your transparent image will appear here.
                      </p>
                    </div>
                  )}
                </div>
              </article>
            </div>

            {message && (
              <p className="action-message" role="status">
                {message}
              </p>
            )}

            {error && (
              <p
                className="action-message action-message-error"
                role="alert"
              >
                {error}
              </p>
            )}

            {processedImage && (
              <button
                type="button"
                className="change-button"
                onClick={handleReset}
                style={{ marginTop: "14px" }}
              >
                Start with another image
              </button>
            )}
          </section>
        )}

        {error && !selectedFile && (
          <p className="upload-error" role="alert">
            {error}
          </p>
        )}
      </main>

      <footer className="page-footer">
        <span>Image Background Remover</span>

        <span className="footer-sparkle">
          <Sparkles aria-hidden="true" />
          Made for simpler editing
        </span>
      </footer>
    </div>
  );
}

export default Image;
