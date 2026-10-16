
import { useEffect, useState } from "react";
import "./ImageQualityControls.css";

const API_BASE = "http://localhost:4000/users";

const formats = {
  WEBP: "image/webp",
  JPG: "image/jpeg",
  PNG: "image/png",
};

const initialUpdateData = {
  imageName: "",
  outputFormat: "WEBP",
  quality: 82,
  width: 0,
  height: 0,
  maxWidth: 0,
};

function formatBytes(bytes = 0) {
  const size = Number(bytes) || 0;

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileBaseName(name = "") {
  return name.replace(/\.[^.]+$/, "");
}

function ImageQualityControls() {
  // Image states
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [outputUrl, setOutputUrl] = useState("");
  const [outputBlob, setOutputBlob] = useState(null);

  // Compression settings
  const [format, setFormat] = useState("WEBP");
  const [quality, setQuality] = useState(82);
  const [maxWidth, setMaxWidth] = useState(0);
  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  // History and selected record
  const [history, setHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Update form
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateFormData, setUpdateFormData] = useState({
    ...initialUpdateData,
  });

  // UI states
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const downloadName = file
    ? `${getFileBaseName(file.name)}-optimized.${
        format === "JPG" ? "jpg" : format.toLowerCase()
      }`
    : "optimized-image.webp";

  const savings =
    file && outputBlob && file.size > 0
      ? Math.round((1 - outputBlob.size / file.size) * 100)
      : 0;

  const level =
    quality < 55
      ? "Compact"
      : quality < 82
        ? "Balanced"
        : "High quality";

  // Load history from backend
  const loadHistory = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/compress-image`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not load compression history."
        );
      }

      setHistory(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err.message || "Could not load history.");
    }
  };

  // Load history when page opens
  useEffect(() => {
    loadHistory();
  }, []);

  // Select image
  const chooseFile = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setError("");
    setMessage("");
    setSelectedRecord(null);
    setShowUpdateForm(false);

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image.");
      event.target.value = "";
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      setError("Image must be 25 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  // Original image preview
  useEffect(() => {
    if (!file) {
      setSourceUrl("");
      return;
    }

    const url = URL.createObjectURL(file);
    setSourceUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Compress image in browser
  useEffect(() => {
    if (!file) {
      setOutputBlob(null);
      setOutputUrl("");
      setDimensions({ width: 0, height: 0 });
      return;
    }

    let cancelled = false;
    let generatedUrl = "";

    const compressImage = async () => {
      let bitmap;

      try {
        setError("");
        setOutputBlob(null);
        setOutputUrl("");

        bitmap = await createImageBitmap(file);

        const scale =
          maxWidth > 0 && bitmap.width > maxWidth
            ? maxWidth / bitmap.width
            : 1;

        const width = Math.max(
          1,
          Math.round(bitmap.width * scale)
        );

        const height = Math.max(
          1,
          Math.round(bitmap.height * scale)
        );

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Unable to process this image.");
        }

        // JPG does not support transparency
        if (format === "JPG") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
        }

        context.drawImage(bitmap, 0, 0, width, height);

        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (result) => {
              if (result) {
                resolve(result);
              } else {
                reject(new Error("Image compression failed."));
              }
            },
            formats[format],
            format === "PNG" ? undefined : quality / 100
          );
        });

        if (blob.type !== formats[format]) {
          throw new Error(
            `Your browser could not create ${format} format.`
          );
        }

        if (cancelled) return;

        generatedUrl = URL.createObjectURL(blob);

        setDimensions({ width, height });
        setOutputBlob(blob);
        setOutputUrl(generatedUrl);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message || "Unable to compress this image."
          );
        }
      } finally {
        bitmap?.close();
      }
    };

    compressImage();

    return () => {
      cancelled = true;

      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [file, format, quality, maxWidth]);

  // Save compressed image and its details
  const saveCompression = async () => {
    if (!file || !outputBlob) {
      setError("Please select an image and wait for compression.");
      return;
    }

    try {
      setApiLoading(true);
      setError("");
      setMessage("");

      const formData = new FormData();

      formData.append("image", outputBlob, downloadName);
      formData.append("imageName", file.name);
      formData.append("originalFormat", file.type);
      formData.append("outputFormat", format);
      formData.append(
        "quality",
        String(format === "PNG" ? 100 : quality)
      );
      formData.append("width", String(dimensions.width));
      formData.append("height", String(dimensions.height));
      formData.append("maxWidth", String(maxWidth));
      formData.append("originalSize", String(file.size));
      formData.append("compressedSize", String(outputBlob.size));

      const response = await fetch(
        `${API_BASE}/compress-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message || "Failed to save compression."
        );
      }

      if (result.data) {
        setSelectedRecord(result.data);
        setShowUpdateForm(false);
      }

      setMessage("Image saved to history successfully.");
      await loadHistory();
    } catch (err) {
      setError(err.message || "Failed to save image.");
    } finally {
      setApiLoading(false);
    }
  };

  // View record details
  const viewRecord = async (id) => {
    try {
      setApiLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/compress-image/${id}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok || result.success === false || !result.data) {
        throw new Error(
          result.message || "Could not load record details."
        );
      }

      setSelectedRecord(result.data);
      setShowUpdateForm(false);
      setMessage("Record details loaded successfully.");
    } catch (err) {
      setError(err.message || "Could not load record.");
    } finally {
      setApiLoading(false);
    }
  };

  // Open editable form
  const handleUpdateClick = () => {
    if (!selectedRecord) {
      setError("Please select a record by clicking View.");
      return;
    }

    setUpdateFormData({
      imageName: selectedRecord.imageName || "",
      outputFormat: selectedRecord.outputFormat || "WEBP",
      quality: Number(selectedRecord.quality ?? 82),
      width: Number(selectedRecord.width ?? 0),
      height: Number(selectedRecord.height ?? 0),
      maxWidth: Number(selectedRecord.maxWidth ?? 0),
    });

    setError("");
    setMessage("");
    setShowUpdateForm(true);
  };

  // Save updated record to backend
  const updateImage = async (event) => {
    event.preventDefault();

    if (!selectedRecord?._id) {
      setError("Please select a record first.");
      return;
    }

    if (!updateFormData.imageName.trim()) {
      setError("Image name cannot be empty.");
      return;
    }

    try {
      setApiLoading(true);
      setError("");
      setMessage("");

      const payload = {
        ...updateFormData,
        imageName: updateFormData.imageName.trim(),
        quality: Number(updateFormData.quality),
        width: Number(updateFormData.width),
        height: Number(updateFormData.height),
        maxWidth: Number(updateFormData.maxWidth),
      };

      const response = await fetch(
        `${API_BASE}/compress-image/${selectedRecord._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Update failed.");
      }

      // Prefer the record returned by the backend
      let updatedRecord = result.data;

      // If the backend doesn't return data, reload this record
      if (!updatedRecord) {
        const refreshResponse = await fetch(
          `${API_BASE}/compress-image/${selectedRecord._id}`,
          { cache: "no-store" }
        );

        const refreshResult = await refreshResponse.json();

        if (!refreshResponse.ok || !refreshResult.data) {
          throw new Error(
            "Update may have succeeded, but refreshed details could not be loaded."
          );
        }

        updatedRecord = refreshResult.data;
      }

      setSelectedRecord(updatedRecord);
      setShowUpdateForm(false);
      setMessage(result.message || "Record updated successfully.");

      await loadHistory();
    } catch (err) {
      setError(err.message || "Unable to update record.");
    } finally {
      setApiLoading(false);
    }
  };

  // Delete record
  const deleteRecord = async (id) => {
    if (!window.confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      setApiLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/compress-image/${id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Delete failed.");
      }

      if (selectedRecord?._id === id) {
        setSelectedRecord(null);
        setShowUpdateForm(false);
      }

      setMessage(result.message || "Record deleted successfully.");
      await loadHistory();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setApiLoading(false);
    }
  };

  // Download saved image
  const downloadSavedImage = async (
    id,
    imageName = "optimized-image",
    outputFormat = "WEBP"
  ) => {
    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_BASE}/download-image/${id}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        let errorMessage = "Download failed.";

        try {
          const result = await response.json();
          errorMessage = result.message || errorMessage;
        } catch {
          // Response was not JSON
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const extension =
        outputFormat === "JPG"
          ? "jpg"
          : outputFormat.toLowerCase();

      const link = document.createElement("a");
      link.href = url;
      link.download = `${getFileBaseName(imageName)}-optimized.${extension}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
      setMessage("Download started.");
    } catch (err) {
      setError(err.message || "Download failed.");
    }
  };

  return (
    <main className="quality-page">
      <div className="quality-shell">
        <header className="quality-hero">
          <h1>Quality Studio</h1>
          <p>Control image compression and output quality.</p>
        </header>

        <section className="quality-workspace">
          <h2>Compression Settings</h2>

          <label className="upload-label">
            Upload or Replace Image
            <input
              type="file"
              accept="image/*"
              onChange={chooseFile}
            />
          </label>

          {file && (
            <div className="quality-layout">
              <section className="quality-preview-panel">
                <h3>Live Preview</h3>

                {(outputUrl || sourceUrl) && (
                  <img
                    className="quality-preview-image"
                    src={outputUrl || sourceUrl}
                    alt={`Preview of ${file.name}`}
                  />
                )}

                <p className="file-name">{file.name}</p>
                <p>{formatBytes(file.size)} · Original</p>

                {outputBlob && (
                  <>
                    <p>
                      Output: {formatBytes(outputBlob.size)} ·{" "}
                      {savings > 0
                        ? `${savings}% smaller`
                        : savings < 0
                          ? `${Math.abs(savings)}% larger`
                          : "Same size"}
                    </p>

                    <p>
                      Dimensions: {dimensions.width} ×{" "}
                      {dimensions.height} px
                    </p>
                  </>
                )}
              </section>

              <section className="quality-controls">
                <h3>Output Settings</h3>

                <label htmlFor="quality-format">
                  Output Format
                </label>

                <select
                  id="quality-format"
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                >
                  <option value="WEBP">WebP</option>
                  <option value="JPG">JPG</option>
                  <option value="PNG">PNG</option>
                </select>

                <label htmlFor="quality-range">
                  Compression Quality:{" "}
                  {format === "PNG" ? "Lossless" : `${quality}%`}
                </label>

                <input
                  id="quality-range"
                  type="range"
                  min="10"
                  max="100"
                  value={quality}
                  disabled={format === "PNG"}
                  onChange={(event) =>
                    setQuality(Number(event.target.value))
                  }
                />

                <div className="quality-presets">
                  <button
                    type="button"
                    onClick={() => setQuality(45)}
                  >
                    Compact
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuality(72)}
                  >
                    Balanced
                  </button>

                  <button
                    type="button"
                    onClick={() => setQuality(90)}
                  >
                    High Quality
                  </button>
                </div>

                <p>{level} preset</p>

                <label htmlFor="quality-width">
                  Maximum Width (pixels)
                </label>

                <input
                  id="quality-width"
                  type="number"
                  min="0"
                  max="12000"
                  placeholder="Keep original dimensions"
                  value={maxWidth || ""}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setMaxWidth(
                      Math.min(12000, Math.max(0, value || 0))
                    );
                  }}
                />

                <a
                  className={`quality-download-link ${
                    !outputUrl ? "disabled" : ""
                  }`}
                  href={outputUrl || undefined}
                  download={downloadName}
                  onClick={(event) => {
                    if (!outputUrl) event.preventDefault();
                  }}
                  aria-disabled={!outputUrl}
                >
                  Download Optimized Image
                </a>

                <button
                  type="button"
                  onClick={saveCompression}
                  disabled={!file || !outputBlob || apiLoading}
                >
                  {apiLoading ? "Please wait..." : "Save to History"}
                </button>

                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={apiLoading}
                >
                  Refresh History
                </button>
              </section>
            </div>
          )}

          <section className="quality-history">
            <h2>Saved Compression History</h2>

            {history.length === 0 && (
              <p>No saved records yet.</p>
            )}

            {history.map((record) => (
              <div className="history-item" key={record._id}>
                <div className="history-info">
                  <strong>{record.imageName}</strong>

                  <p>
                    {record.outputFormat} · Quality {record.quality}% ·{" "}
                    {formatBytes(record.compressedSize)}
                  </p>

                  <p>Size reduced: {record.reducedSize}%</p>
                </div>

                <div className="history-actions">
                  <button
                    type="button"
                    onClick={() => viewRecord(record._id)}
                    disabled={apiLoading}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadSavedImage(
                        record._id,
                        record.imageName,
                        record.outputFormat
                      )
                    }
                    disabled={apiLoading}
                  >
                    Download
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteRecord(record._id)}
                    disabled={apiLoading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {selectedRecord && (
              <section className="record-details">
                <div className="record-heading">
                  <div>
                    <h3>Record Details</h3>
                    <p>View and edit saved image metadata.</p>
                  </div>

                  <button
                    type="button"
                    className="close-details"
                    onClick={() => {
                      setSelectedRecord(null);
                      setShowUpdateForm(false);
                      setMessage("");
                      setError("");
                    }}
                  >
                    Close
                  </button>
                </div>

                <div className="record-grid">
                  <div>
                    <span>Image Name</span>
                    <strong>{selectedRecord.imageName}</strong>
                  </div>

                  <div>
                    <span>Output Format</span>
                    <strong>{selectedRecord.outputFormat}</strong>
                  </div>

                  <div>
                    <span>Quality</span>
                    <strong>{selectedRecord.quality}%</strong>
                  </div>

                  <div>
                    <span>Dimensions</span>
                    <strong>
                      {selectedRecord.width} × {selectedRecord.height} px
                    </strong>
                  </div>

                  <div>
                    <span>Original Size</span>
                    <strong>{formatBytes(selectedRecord.originalSize)}</strong>
                  </div>

                  <div>
                    <span>Compressed Size</span>
                    <strong>
                      {formatBytes(selectedRecord.compressedSize)}
                    </strong>
                  </div>

                  <div>
                    <span>Size Reduced</span>
                    <strong>{selectedRecord.reducedSize}%</strong>
                  </div>

                  <div>
                    <span>Maximum Width</span>
                    <strong>{selectedRecord.maxWidth || 0} px</strong>
                  </div>
                </div>

                <div className="record-buttons">
                  <button
                    type="button"
                    onClick={handleUpdateClick}
                    disabled={apiLoading}
                  >
                    Update Record Details
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      downloadSavedImage(
                        selectedRecord._id,
                        selectedRecord.imageName,
                        selectedRecord.outputFormat
                      )
                    }
                    disabled={apiLoading}
                  >
                    Download Saved Image
                  </button>
                </div>

                {showUpdateForm && (
                  <form
                    className="record-update-form"
                    onSubmit={updateImage}
                  >
                    <h3>Edit Record Details</h3>

                    <label>
                      Image Name
                      <input
                        type="text"
                        value={updateFormData.imageName}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            imageName: event.target.value,
                          })
                        }
                        required
                      />
                    </label>

                    <label>
                      Output Format
                      <select
                        value={updateFormData.outputFormat}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            outputFormat: event.target.value,
                          })
                        }
                      >
                        <option value="WEBP">WEBP</option>
                        <option value="JPG">JPG</option>
                        <option value="PNG">PNG</option>
                      </select>
                    </label>

                    <label>
                      Quality
                      <input
                        type="number"
                        min="10"
                        max="100"
                        value={updateFormData.quality}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            quality: event.target.value,
                          })
                        }
                        required
                      />
                    </label>

                    <label>
                      Width (pixels)
                      <input
                        type="number"
                        min="1"
                        value={updateFormData.width}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            width: event.target.value,
                          })
                        }
                        required
                      />
                    </label>

                    <label>
                      Height (pixels)
                      <input
                        type="number"
                        min="1"
                        value={updateFormData.height}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            height: event.target.value,
                          })
                        }
                        required
                      />
                    </label>

                    <label>
                      Maximum Width (pixels)
                      <input
                        type="number"
                        min="0"
                        max="12000"
                        value={updateFormData.maxWidth}
                        onChange={(event) =>
                          setUpdateFormData({
                            ...updateFormData,
                            maxWidth: event.target.value,
                          })
                        }
                        required
                      />
                    </label>

                    <div className="update-form-actions">
                      <button type="submit" disabled={apiLoading}>
                        {apiLoading ? "Saving..." : "Save Changes"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUpdateForm(false)}
                        disabled={apiLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}

            {message && (
              <p className="quality-message" role="status">
                {message}
              </p>
            )}

            {error && (
              <p className="quality-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </section>

        <footer className="quality-footnote">
          Images are compressed in your browser. Saving to history
          uploads the compressed image and its metadata to your server.
        </footer>
      </div>
    </main>
  );
}

export default ImageQualityControls;
