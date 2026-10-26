
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  FileImage,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import "./BulkImageProcessing.css";
import { API_ROOT } from "../config/api.js";

const API_BASE = `${API_ROOT}/users`;
const outputTypes = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WEBP: "image/webp",
};

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function createObjectUrl(file, urlSet) {
  const url = URL.createObjectURL(file);
  urlSet.current.add(url);
  return url;
}

function revokeObjectUrl(url, urlSet) {
  if (!url) return;
  URL.revokeObjectURL(url);
  urlSet.current.delete(url);
}

async function convertFile(item, format, quality, maxWidth) {
  let bitmap;

  try {
    bitmap = await createImageBitmap(item.file);

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
      throw new Error(
        "Browser could not process this image."
      );
    }

    // JPG does not support transparency.
    if (format === "JPG") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(
                new Error("Image conversion failed.")
              ),
        outputTypes[format],
        format === "PNG" ? undefined : quality / 100
      );
    });

    if (blob.type !== outputTypes[format]) {
      throw new Error(
        `${format} conversion is not supported by this browser.`
      );
    }

    return { blob, width, height };
  } finally {
    bitmap?.close();
  }
}

function getExtension(format) {
  return format === "JPG" ? "jpg" : format.toLowerCase();
}

function getBaseName(name = "image") {
  return name.replace(/\.[^.]+$/, "") || "image";
}

function BulkImageProcessing() {
  const inputRef = useRef(null);
  const urlsRef = useRef(new Set());

  const [items, setItems] = useState([]);
  const [format, setFormat] = useState("WEBP");
  const [quality, setQuality] = useState(88);
  const [maxWidth, setMaxWidth] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [batchId, setBatchId] = useState(null);
  const [savedBatches, setSavedBatches] = useState([]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) =>
        URL.revokeObjectURL(url)
      );
      urlsRef.current.clear();
    };
  }, []);

  // Add and validate images.
  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);

    const valid = incoming.filter(
      (file) =>
        ["image/png", "image/jpeg", "image/webp"].includes(
          file.type
        ) &&
        file.size > 0 &&
        file.size <= 20 * 1024 * 1024
    );

    setError(
      incoming.length !== valid.length
        ? "Some files were skipped. Choose PNG, JPG, or WebP images up to 20 MB each."
        : ""
    );

    if (valid.length) {
      setItems((current) => [
        ...current,
        ...valid.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: createObjectUrl(file, urlsRef),
          outputUrl: "",
          outputFormat: "",
          outputSize: 0,
          dimensions: "",
          status: "ready",
          editOpen: false,
          editFormat: format,
          editQuality: quality,
          editMaxWidth: maxWidth ? String(maxWidth) : "",
          message: "Ready to process",
        })),
      ]);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  // Remove an image from the queue.
  const removeItem = (id) => {
    if (processing) return;

    const removed = items.find((item) => item.id === id);

    if (removed) {
      revokeObjectUrl(removed.previewUrl, urlsRef);
      revokeObjectUrl(removed.outputUrl, urlsRef);
    }

    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  // Clear queue and delete the saved batch if present.
  const clearQueue = async () => {
    if (processing) return;

    items.forEach((item) => {
      revokeObjectUrl(item.previewUrl, urlsRef);
      revokeObjectUrl(item.outputUrl, urlsRef);
    });

    setItems([]);
    setError("");
    setApiError("");

    if (batchId) {
      try {
        const response = await fetch(
          `${API_BASE}/bulkimage/${encodeURIComponent(
            batchId
          )}`,
          { method: "DELETE" }
        );

        const result = await response
          .json()
          .catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            result.message ||
              result.error ||
              "Database delete failed."
          );
        }

        setSavedBatches((current) =>
          current.filter(
            (batch) =>
              (batch._id || batch.id) !== batchId
          )
        );

        setBatchId(null);
      } catch (err) {
        setApiError(
          err instanceof Error
            ? `Queue cleared locally, but database deletion failed: ${err.message}`
            : "Queue cleared locally, but database deletion failed."
        );
      }
    }
  };

  const patchItem = (id, changes) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  };

  // Process one image in the browser.
  const processOne = async (
    item,
    selectedFormat,
    selectedQuality,
    selectedWidth
  ) => {
    patchItem(item.id, {
      status: "processing",
      message: "Processing...",
    });

    try {
      const { blob, width, height } = await convertFile(
        item,
        selectedFormat,
        selectedQuality,
        selectedWidth
      );

      const outputUrl = createObjectUrl(blob, urlsRef);

      setItems((current) =>
        current.map((entry) => {
          if (entry.id !== item.id) return entry;

          revokeObjectUrl(entry.outputUrl, urlsRef);

          return {
            ...entry,
            outputUrl,
            outputFormat: selectedFormat,
            outputSize: blob.size,
            dimensions: `${width} × ${height}`,
            editQuality: selectedQuality,
            editMaxWidth: selectedWidth
              ? String(selectedWidth)
              : "",
            status: "done",
            message: "Complete",
            editOpen: false,
          };
        })
      );

      return {
        success: true,
        originalFileName: item.file.name,
        originalFormat:
          item.file.type.split("/")[1] || "unknown",
        originalSize: item.file.size,
        convertedFileName: `${getBaseName(
          item.file.name
        )}.${getExtension(selectedFormat)}`,
        convertedFormat: selectedFormat,
        convertedSize: blob.size,
        width,
        height,
        quality: selectedQuality,
        ...(selectedWidth > 0
          ? { maxWidth: selectedWidth }
          : {}),
        status: "completed",
      };
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not process this image.";

      patchItem(item.id, {
        status: "error",
        message,
      });

      return {
        success: false,
        originalFileName: item.file.name,
        originalFormat:
          item.file.type.split("/")[1] || "unknown",
        originalSize: item.file.size,
        quality: selectedQuality,
        ...(selectedWidth > 0
          ? { maxWidth: selectedWidth }
          : {}),
        status: "failed",
        errorMessage: message,
      };
    }
  };

  // Save batch metadata to the Render backend.
  const saveBatch = async (images) => {
    const response = await fetch(
      `${API_BASE}/bulkimage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images,
          totalImages: images.length,
          successCount: images.filter(
            (image) => image.status === "completed"
          ).length,
          failedCount: images.filter(
            (image) => image.status === "failed"
          ).length,
          status: images.every(
            (image) => image.status === "completed"
          )
            ? "completed"
            : "failed",
        }),
      }
    );

    const result = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
          result.message ||
          "Failed to save batch."
      );
    }

    const savedBatch = result.data;

    if (!savedBatch?._id && !savedBatch?.id) {
      throw new Error(
        "Batch saved, but the API did not return its ID."
      );
    }

    const id = savedBatch._id || savedBatch.id;

    setBatchId(id);

    setSavedBatches((current) => [
      savedBatch,
      ...current.filter(
        (batch) => (batch._id || batch.id) !== id
      ),
    ]);

    return savedBatch;
  };

  // Update an existing batch.
  const updateBatch = async (id, images) => {
    if (!id) {
      throw new Error(
        "Batch ID is missing. Save the batch first."
      );
    }

    const response = await fetch(
      `${API_BASE}/bulkimage/${encodeURIComponent(
        id
      )}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images,
          totalImages: images.length,
          successCount: images.filter(
            (image) => image.status === "completed"
          ).length,
          failedCount: images.filter(
            (image) => image.status === "failed"
          ).length,
          status: images.every(
            (image) => image.status === "completed"
          )
            ? "completed"
            : "failed",
        }),
      }
    );

    const result = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
          result.message ||
          "Failed to update batch."
      );
    }

    const updatedBatch = result.data;

    setSavedBatches((current) =>
      current.map((batch) =>
        (batch._id || batch.id) === id
          ? updatedBatch
          : batch
      )
    );

    return updatedBatch;
  };

  // Process all images that are not already completed.
  const processAll = async () => {
    const queue = items.filter(
      (item) => item.status !== "done"
    );

    if (!queue.length || processing) return;

    setProcessing(true);
    setError("");
    setApiError("");

    try {
      const results = [];

      for (const item of queue) {
        const result = await processOne(
          item,
          format,
          quality,
          Number(maxWidth)
        );

        results.push(result);
      }

      await saveBatch(results);
    } catch (cause) {
      setApiError(
        cause instanceof Error
          ? cause.message
          : "Could not save this batch."
      );
    } finally {
      setProcessing(false);
    }
  };

  // Reprocess one image and update its saved metadata.
  const processItem = async (item) => {
    if (processing) return;

    setProcessing(true);
    setApiError("");

    try {
      const result = await processOne(
        item,
        item.editFormat || format,
        item.editQuality ?? quality,
        Number(item.editMaxWidth) || 0
      );

      if (batchId) {
        const existingBatch = savedBatches.find(
          (batch) => (batch._id || batch.id) === batchId
        );

        const previousImages = existingBatch?.images || [];

        const updatedImages = [
          ...previousImages.filter(
            (image) =>
              image.originalFileName !==
              result.originalFileName
          ),
          result,
        ];

        await updateBatch(batchId, updatedImages);
      } else {
        await saveBatch([result]);
      }
    } catch (cause) {
      setApiError(
        cause instanceof Error
          ? cause.message
          : "Could not update the saved batch."
      );
    } finally {
      setProcessing(false);
    }
  };

  // Download the converted image from the browser.
  const downloadItem = async (item) => {
    try {
      if (!item.outputUrl || item.status !== "done") {
        setApiError(
          "Please process this image before downloading."
        );
        return;
      }

      setApiError("");

      const response = await fetch(item.outputUrl);

      if (!response.ok) {
        throw new Error(
          "Could not read the processed image."
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The downloaded image is empty.");
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = `${getBaseName(
        item.file.name
      )}.${getExtension(item.outputFormat)}`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 60000);
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Image download failed."
      );
    }
  };

  const completedCount = items.filter(
    (item) => item.status === "done"
  ).length;

  return (
    <main className="bulk-page">
      <header className="bulk-hero">
        <span className="bulk-eyebrow">
          <Layers3 size={15} />
          BATCH IMAGE STUDIO
        </span>

        <h1>
          More images. <span>One smooth workflow.</span>
        </h1>

        <p>
          Convert a whole set at once, with consistent quality
          and sizing.
        </p>
      </header>

      <section
        className="bulk-editor"
        aria-label="Bulk image processing"
      >
        <div className="bulk-topbar">
          <div className="bulk-heading">
            <span>
              <Layers3 size={17} />
            </span>

            <div>
              <strong>Bulk image processing</strong>
              <small>
                Images are processed locally in your browser
              </small>
            </div>
          </div>

          <div className="bulk-count">
            {items.length}{" "}
            {items.length === 1 ? "image" : "images"}
          </div>
        </div>

        <div className="bulk-main">
          <section className="bulk-list-section">
            <button
              type="button"
              className={`bulk-dropzone ${
                dragging ? "is-dragging" : ""
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(event.dataTransfer.files);
              }}
            >
              <span className="bulk-upload-icon">
                <ImagePlus size={21} />
              </span>

              <span>
                <strong>Add images</strong>
                <small>
                  Drop files here or browse · up to 20 MB each
                </small>
              </span>

              <span className="bulk-browse">
                <Upload size={14} />
                Browse files
              </span>
            </button>

            <input
              ref={inputRef}
              className="bulk-hidden-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event) =>
                addFiles(event.target.files)
              }
            />

            {items.length ? (
              <div className="bulk-file-list">
                {items.map((item) => (
                  <article
                    className="bulk-file-row"
                    key={item.id}
                  >
                    <img
                      className="bulk-thumb"
                      src={item.previewUrl}
                      alt=""
                    />

                    <div className="bulk-file-info">
                      <strong title={item.file.name}>
                        {item.file.name}
                      </strong>

                      <span>
                        {formatBytes(item.file.size)}
                        {item.dimensions
                          ? ` · ${item.dimensions}`
                          : ""}
                        {item.outputSize
                          ? ` · Output ${formatBytes(
                              item.outputSize
                            )}`
                          : ""}
                      </span>

                      <small
                        className={`bulk-status ${item.status}`}
                      >
                        {item.status === "processing" ? (
                          <LoaderCircle
                            className="bulk-spin"
                            size={12}
                          />
                        ) : item.status === "done" ? (
                          <CheckCircle2 size={12} />
                        ) : (
                          <FileImage size={12} />
                        )}

                        {item.message}
                      </small>
                    </div>

                    <div className="bulk-row-actions">
                      {item.status === "done" && (
                        <button
                          className="bulk-icon-button"
                          type="button"
                          onClick={() =>
                            patchItem(item.id, {
                              editOpen: !item.editOpen,
                              editFormat:
                                item.outputFormat || format,
                            })
                          }
                          disabled={processing}
                          aria-label={`Edit ${item.file.name} settings`}
                        >
                          <Pencil size={15} />
                        </button>
                      )}

                      {item.status === "done" ? (
                        <button
                          className="bulk-icon-button bulk-download"
                          type="button"
                          onClick={() => downloadItem(item)}
                          aria-label={`Download ${item.file.name}`}
                        >
                          <ArrowDownToLine size={16} />
                        </button>
                      ) : (
                        <button
                          className="bulk-icon-button"
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={processing}
                          aria-label={`Remove ${item.file.name}`}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {item.editOpen && (
                      <div className="bulk-item-editor">
                        <label>
                          Format
                          <select
                            value={item.editFormat}
                            disabled={processing}
                            onChange={(event) =>
                              patchItem(item.id, {
                                editFormat: event.target.value,
                              })
                            }
                          >
                            <option value="WEBP">WebP</option>
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
                            value={item.editQuality}
                            disabled={
                              processing ||
                              item.editFormat === "PNG"
                            }
                            onChange={(event) =>
                              patchItem(item.id, {
                                editQuality: Math.min(
                                  100,
                                  Math.max(
                                    10,
                                    Number(event.target.value)
                                  )
                                ),
                              })
                            }
                          />
                        </label>

                        <label>
                          Max width
                          <input
                            type="number"
                            min="1"
                            max="12000"
                            placeholder="Original"
                            value={item.editMaxWidth}
                            disabled={processing}
                            onChange={(event) =>
                              patchItem(item.id, {
                                editMaxWidth:
                                  event.target.value,
                              })
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => processItem(item)}
                          disabled={processing}
                        >
                          <RotateCcw size={14} />
                          Apply &amp; process again
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="bulk-empty">
                <FileImage size={24} />
                <span>Your image queue will appear here</span>
              </div>
            )}

            {error && (
              <p className="bulk-error" role="alert">
                {error}
              </p>
            )}
          </section>

          <aside className="bulk-settings">
            <div className="bulk-settings-heading">
              <strong>Output settings</strong>
              <small>
                Apply these settings to every image
              </small>
            </div>

            <label className="bulk-field">
              <span>Output format</span>

              <select
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value)
                }
                disabled={processing}
              >
                <option value="WEBP">WebP</option>
                <option value="JPG">JPG</option>
                <option value="PNG">PNG</option>
              </select>
            </label>

            <label className="bulk-field">
              <span className="bulk-quality-label">
                Quality <strong>{quality}%</strong>
              </span>

              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(event) =>
                  setQuality(Number(event.target.value))
                }
                disabled={processing || format === "PNG"}
              />

              <small>
                Higher quality keeps more detail and creates
                larger files.
              </small>
            </label>

            <label className="bulk-field">
              <span>
                Maximum width <small>(optional)</small>
              </span>

              <div className="bulk-number-wrap">
                <input
                  type="number"
                  min="1"
                  max="12000"
                  placeholder="Keep original size"
                  value={maxWidth || ""}
                  onChange={(event) =>
                    setMaxWidth(
                      event.target.value === ""
                        ? 0
                        : Math.max(
                            0,
                            Number(event.target.value)
                          )
                    )
                  }
                  disabled={processing}
                />

                <span>px</span>
              </div>
            </label>

            <div className="bulk-summary">
              <span>Queue</span>
              <strong>{items.length} files</strong>

              <span>Completed</span>
              <strong>{completedCount} files</strong>
            </div>

            <div className="bulk-actions">
              <button
                className="bulk-primary"
                type="button"
                onClick={processAll}
                disabled={
                  !items.length ||
                  processing ||
                  completedCount === items.length
                }
              >
                {processing ? (
                  <LoaderCircle
                    className="bulk-spin"
                    size={16}
                  />
                ) : (
                  <Layers3 size={16} />
                )}

                {processing
                  ? "Processing batch…"
                  : completedCount
                    ? "Process remaining"
                    : "Process all images"}
              </button>

              {items.length > 0 && (
                <button
                  className="bulk-clear"
                  type="button"
                  onClick={clearQueue}
                  disabled={processing}
                >
                  <Trash2 size={14} />
                  Clear queue
                </button>
              )}
            </div>

            <p className="bulk-privacy">
              Your images stay on this device.
            </p>
          </aside>
        </div>
      </section>

      {apiError && (
        <p className="bulk-api-error" role="alert">
          {apiError}
        </p>
      )}
    </main>
  );
}

export default BulkImageProcessing;
