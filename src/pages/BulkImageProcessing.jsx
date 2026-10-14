
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
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



const outputTypes = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WEBP: "image/webp",
};

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
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

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Browser could not process this image.");
    }

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
            : reject(new Error("Image conversion failed.")),
        outputTypes[format],
        format === "PNG" ? undefined : quality / 100
      );
    });

    if (blob.type !== outputTypes[format]) {
      throw new Error(`${format} conversion is not supported by this browser.`);
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
  const [savedBatches, setSavedBatches] = useState([]);
const BULK_API = "http://localhost:4000/users/bulkimage";
 const loadSavedBatches = async () => {
  try {
    const response = await fetch(
      "http://localhost:4000/users/bulkimages"
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Failed to fetch batches (${response.status})`);
    }

    setSavedBatches(data.data || []);
  } catch (error) {
    setApiError(error.message);
  }
};

  useEffect(() => {
    loadSavedBatches();

    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current.clear();
    };
  }, []);

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);

    const valid = incoming.filter(
      (file) =>
        file.type.startsWith("image/") &&
        file.size > 0 &&
        file.size <= 20 * 1024 * 1024
    );

    setError(
      incoming.length !== valid.length
        ? "Some files were skipped. Choose image files up to 20 MB each."
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

    if (inputRef.current) inputRef.current.value = "";
  };

  const removeItem = (id) => {
    if (processing) return;

    const removed = items.find((item) => item.id === id);

    if (removed) {
      revokeObjectUrl(removed.previewUrl, urlsRef);
      revokeObjectUrl(removed.outputUrl, urlsRef);
    }

    setItems((current) => current.filter((item) => item.id !== id));
  };

 const clearQueue = () => {
  if (processing) return;

  items.forEach((item) => {
    revokeObjectUrl(item.previewUrl, urlsRef);
    revokeObjectUrl(item.outputUrl, urlsRef);
  });

  setItems([]);
  setError("");
};

const updateItem = async (id, images) => {
  const response = await fetch(
    `http://localhost:4000/users/bulkimage/${id}`,
    {
      method: "PATCH",
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update batch");
  }

  await loadSavedBatches();
  return data.data;
};
  const processOne = async (item, selectedFormat, selectedQuality, selectedWidth) => {
    updateItem(item.id, {
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
            editMaxWidth: selectedWidth ? String(selectedWidth) : "",
            status: "done",
            message: "Complete",
            editOpen: false,
          };
        })
      );

      return {
        success: true,
        originalFileName: item.file.name,
        originalFormat: item.file.type.split("/")[1] || "unknown",
        originalSize: item.file.size,
        convertedFileName: `${getBaseName(item.file.name)}.${getExtension(selectedFormat)}`,
        convertedFormat: selectedFormat,
        convertedSize: blob.size,
        width,
        height,
        quality: selectedQuality,
        maxWidth: selectedWidth || 0,
        status: "completed",
      };
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Could not process this image.";

      updateItem(item.id, { status: "error", message });

      return {
        success: false,
        originalFileName: item.file.name,
        originalFormat: item.file.type.split("/")[1] || "unknown",
        originalSize: item.file.size,
        quality: selectedQuality,
        maxWidth: selectedWidth || 0,
        status: "failed",
        errorMessage: message,
      };
    }
  };

 const saveBatch = async (images) => {
  const response = await fetch(
    "http://localhost:4000/users/bulkimage",
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to save batch");
  }

  await loadSavedBatches();
  return data.data;
};

  const processAll = async () => {
    const queue = items.filter((item) => item.status !== "done");

    if (!queue.length || processing) return;

    setProcessing(true);
    setError("");
    setApiError("");

    const results = [];

    try {
      for (const item of queue) {
        const result = await processOne(item, format, quality, Number(maxWidth));
        results.push(result);
      }

      await saveBatch(results);
    } catch (cause) {
      setApiError(
        cause instanceof Error ? cause.message : "Could not save this batch."
      );
    } finally {
      setProcessing(false);
    }
  };

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

      if (item.batchId) {
        const response = await fetch(`${BULK_API}/${item.batchId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageId: item.recordImageId, image: result }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not update the saved batch.");
        }

        await loadSavedBatches();
      }
    } catch (cause) {
      setApiError(
        cause instanceof Error ? cause.message : "Could not update the saved batch."
      );
    } finally {
      setProcessing(false);
    }
  };

 const downloadBulkImage = async (id) => {
  try {
    const response = await fetch(
      `http://localhost:4000/users/downloadbulk/${id}`
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Download failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "processed-image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    setApiError(
      error instanceof Error ? error.message : "Download failed"
    );
  }
};

const downloadAllBulkImages = async () => {
  try {
    const response = await fetch(
      "http://localhost:4000/users/download"
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message || "Download all failed");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "bulk-images.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    setApiError(
      error instanceof Error ? error.message : "Download all failed"
    );
  }
};
  const deleteBatch = async (id) => {
  try {
    const response = await fetch(
      `http://localhost:4000/users/bulkimage/${id}`,
      {
        method: "DELETE",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to delete batch");
    }

    setSavedBatches((current) =>
      current.filter((batch) => batch._id !== id)
    );
  } catch (error) {
    setApiError(error.message);
  }
};
  const completedCount = items.filter((item) => item.status === "done").length;

  return (
    <main className="bulk-page">
      <header className="bulk-hero">
        <span className="bulk-eyebrow">
          <Layers3 size={15} /> BATCH IMAGE STUDIO
        </span>
        <h1>
          More images. <span>One smooth workflow.</span>
        </h1>
        <p>Convert a whole set at once, with consistent quality and sizing.</p>
      </header>

      <section className="bulk-editor" aria-label="Bulk image processing">
        <div className="bulk-topbar">
          <div className="bulk-heading">
            <span><Layers3 size={17} /></span>
            <div>
              <strong>Bulk image processing</strong>
              <small>Images are processed locally in your browser</small>
            </div>
          </div>
          <div className="bulk-count">
            {items.length} {items.length === 1 ? "image" : "images"}
          </div>
        </div>

        <div className="bulk-main">
          <section className="bulk-list-section">
            <button
              type="button"
              className={`bulk-dropzone ${dragging ? "is-dragging" : ""}`}
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
              <span className="bulk-upload-icon"><ImagePlus size={21} /></span>
              <span>
                <strong>Add images</strong>
                <small>Drop files here or browse · up to 20 MB each</small>
              </span>
              <span className="bulk-browse"><Upload size={14} /> Browse files</span>
            </button>

            <input
              ref={inputRef}
              className="bulk-hidden-input"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => addFiles(event.target.files)}
            />

            {items.length ? (
              <div className="bulk-file-list">
                {items.map((item) => (
                  <article className="bulk-file-row" key={item.id}>
                    <img className="bulk-thumb" src={item.previewUrl} alt="" />

                    <div className="bulk-file-info">
                      <strong title={item.file.name}>{item.file.name}</strong>
                      <span>
                        {formatBytes(item.file.size)}
                        {item.dimensions ? ` · ${item.dimensions}` : ""}
                        {item.outputSize ? ` · Output ${formatBytes(item.outputSize)}` : ""}
                      </span>
                      <small className={`bulk-status ${item.status}`}>
                        {item.status === "processing" ? (
                          <LoaderCircle className="bulk-spin" size={12} />
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
                            updateItem(item.id, {
                              editOpen: !item.editOpen,
                              editFormat: item.outputFormat || format,
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
                            onChange={(event) =>
                              updateItem(item.id, { editFormat: event.target.value })
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
                            disabled={item.editFormat === "PNG"}
                            onChange={(event) =>
                              updateItem(item.id, {
                                editQuality: Math.min(
                                  100,
                                  Math.max(10, Number(event.target.value))
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
                            onChange={(event) =>
                              updateItem(item.id, {
                                editMaxWidth: event.target.value,
                              })
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => processItem(item)}
                          disabled={processing}
                        >
                          <RotateCcw size={14} /> Apply &amp; process again
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

            {error && <p className="bulk-error" role="alert">{error}</p>}
          </section>

          <aside className="bulk-settings">
            <div className="bulk-settings-heading">
              <strong>Output settings</strong>
              <small>Apply these settings to every image</small>
            </div>

            <label className="bulk-field">
              <span>Output format</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
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
                onChange={(event) => setQuality(Number(event.target.value))}
                disabled={processing || format === "PNG"}
              />
              <small>Higher quality keeps more detail and creates larger files.</small>
            </label>

            <label className="bulk-field">
              <span>Maximum width <small>(optional)</small></span>
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
                        : Math.max(0, Number(event.target.value))
                    )
                  }
                  disabled={processing}
                />
                <span>px</span>
              </div>
            </label>

            <div className="bulk-summary">
              <span>Queue</span><strong>{items.length} files</strong>
              <span>Completed</span><strong>{completedCount} files</strong>
            </div>

            <div className="bulk-actions">
              <button
                className="bulk-primary"
                type="button"
                onClick={processAll}
                disabled={!items.length || processing || completedCount === items.length}
              >
                {processing ? (
                  <LoaderCircle className="bulk-spin" size={16} />
                ) : (
                  <Layers3 size={16} />
                )}
                {processing
                  ? "Processing batch…"
                  : completedCount
                    ? "Process remaining"
                    : "Process all images"}
              </button>

              {completedCount > 0 && (
                <button
                  className="bulk-secondary"
                  type="button"
                  onClick={downloadAll}
                >
                  <ArrowDownToLine size={15} /> Download all
                </button>
              )}

              {items.length > 0 && (
                <button
                  className="bulk-clear"
                  type="button"
                  onClick={clearQueue}
                  disabled={processing}
                >
                  <Trash2 size={14} /> Clear queue
                </button>
              )}
            </div>

            <p className="bulk-privacy">Your images stay on this device.</p>
          </aside>
        </div>
      </section>

      {apiError && <p className="bulk-api-error" role="alert">{apiError}</p>}

      <section className="bulk-history" aria-label="Saved batches">
        <div className="bulk-history-heading">
          <div>
            <strong>Saved batches</strong>
            <small>Stored in your backend database</small>
          </div>
          <button type="button" onClick={loadSavedBatches}>Refresh</button>
        </div>

        {savedBatches.length ? (
          savedBatches.map((batch) => (
            <article className="bulk-history-row" key={batch._id}>
              <div>
                <strong>{batch.totalImages} images</strong>
                <small>
                  {batch.successCount} completed · {batch.failedCount} failed · {batch.status}
                </small>
              </div>

              <time>
                {batch.createdAt
                  ? new Date(batch.createdAt).toLocaleString()
                  : ""}
              </time>

              <button
                type="button"
                onClick={() => deleteBatch(batch._id)}
                aria-label="Delete saved batch"
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))
        ) : (
          <p className="bulk-history-empty">No saved batches yet.</p>
        )}
      </section>
    </main>
  );
}

export default BulkImageProcessing;
