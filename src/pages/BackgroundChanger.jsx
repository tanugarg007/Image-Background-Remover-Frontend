
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ImagePlus,
  Layers3,
  LockKeyhole,
  Palette,
  Sparkles,
  Upload,
} from "lucide-react";
import "./BackgroundChanger.css";
import { API_USERS, getSessionStatus, removeBackgroundInBrowser } from "../config/api.js";
import { releaseGuestDownload, requireLoginForDownload, trackDownload } from "../config/downloadTracking.js";
import { triggerFileDownload } from "../config/triggerFileDownload.js";
import { claimPendingDownload, savePendingDownload } from "../config/downloadHandoff.js";

const API_BASE = API_USERS;

const backgrounds = [
  {
    name: "Cloud",
    from: "#dbeafe",
    to: "#f4f2ff",
    css: "linear-gradient(135deg, #dbeafe, #f4f2ff)",
  },
  {
    name: "Peach",
    from: "#ffbd9b",
    to: "#ffead7",
    css: "linear-gradient(135deg, #ffbd9b, #ffead7)",
  },
  {
    name: "Sage",
    from: "#a7c6ad",
    to: "#e2ead8",
    css: "linear-gradient(135deg, #a7c6ad, #e2ead8)",
  },
  {
    name: "Lilac",
    from: "#b6a5f6",
    to: "#ece5ff",
    css: "linear-gradient(135deg, #b6a5f6, #ece5ff)",
  },
  {
    name: "Midnight",
    from: "#1d2852",
    to: "#5a4b8a",
    css: "linear-gradient(135deg, #1d2852, #5a4b8a)",
  },
];

function paintBackground(context, width, height, background) {
  if (background.to) {
    const gradient = context.createLinearGradient(
      0,
      0,
      width,
      height
    );

    gradient.addColorStop(0, background.from);
    gradient.addColorStop(1, background.to);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = background.from;
  }

  context.fillRect(0, 0, width, height);
}

async function readImageResponse(response, onProgress) {
  const reader = response.body?.getReader?.();
  if (!reader) return response.blob();

  const totalBytes = Number(response.headers.get("content-length")) || 0;
  const chunks = [];
  let loadedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loadedBytes += value.byteLength;
    onProgress(totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : null);
  }

  return new Blob(chunks, { type: response.headers.get("content-type") || "image/png" });
}

function BackgroundChanger() {
  const inputRef = useRef(null);
  const downloadLockRef = useRef(false);

  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [resumeDownload, setResumeDownload] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState(0);
  const [customColor, setCustomColor] = useState("#f2eee8");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ label: "", percent: null });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const activeBackground = isCustom
    ? {
        name: "Custom",
        from: customColor,
        css: customColor,
      }
    : backgrounds[selectedBackground];

  // Clean up temporary image URLs.
  useEffect(() => {
    return () => {
      if (originalUrl) {
        URL.revokeObjectURL(originalUrl);
      }
    };
  }, [originalUrl]);

  useEffect(() => {
    return () => {
      if (cutoutUrl) {
        URL.revokeObjectURL(cutoutUrl);
      }
    };
  }, [cutoutUrl]);

  useEffect(() => {
    let active = true;
    const restorePendingDownload = async () => {
      let pending;
      try {
        pending = await claimPendingDownload("Background changer");
        if (!pending) return;
        const session = await getSessionStatus();
        if (!session.authenticated || !active) {
          await savePendingDownload(pending);
          return;
        }
        const restoredOriginalUrl = URL.createObjectURL(pending.originalFile);
        const restoredCutoutUrl = URL.createObjectURL(pending.blob);
        setFile(pending.originalFile);
        setOriginalUrl(restoredOriginalUrl);
        setCutoutBlob(pending.blob);
        setCutoutUrl(restoredCutoutUrl);
        setSelectedBackground(pending.selectedBackground ?? 0);
        setCustomColor(pending.customColor || "#f2eee8");
        setIsCustom(pending.isCustom === true);
        setMessage("Signed in. Finishing your saved download…");
        setResumeDownload(true);
      } catch (restoreError) {
        if (pending) {
          try { await savePendingDownload(pending); } catch (storageError) {
            if (active) setError(`Could not restore your image: ${restoreError.message} ${storageError.message}`);
            return;
          }
        }
        if (active) setError(restoreError instanceof Error ? restoreError.message : "Could not restore your image.");
      }
    };
    const timer = window.setTimeout(() => { void restorePendingDownload(); }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  // Select and validate an image.
const selectFile = (selectedFile) => {
  if (!selectedFile) return;

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/jfif",
    "image/jpg"
  ];

  const fileExtension = selectedFile.name
    .split(".")
    .pop()
    .toLowerCase();

  const allowedExtensions = [
    "png",
    "jpg",
    "jpeg",
    "jfif",
    "webp",
  ];

  if (
    !allowedTypes.includes(selectedFile.type) &&
    !allowedExtensions.includes(fileExtension)
  ) {
    setError("Please upload PNG, JPG, JPEG, JFIF, or WEBP.");
    return;
  }

  if (selectedFile.size > 20 * 1024 * 1024) {
    setError("Image size must be less than 20 MB.");
    return;
  }

  setError("");
  setMessage("");
  setFile(selectedFile);

  const imageUrl = URL.createObjectURL(selectedFile);

  // IMPORTANT: Match the variable used in your preview JSX
  setOriginalUrl(imageUrl);

  setCutoutUrl("");
  setCutoutBlob(null);
};

  // Process locally so this long-running operation does not rely on Render.
  const removeBackground = async () => {
    if (!file || loading) return;

    setLoading(true);
    setProgressInfo({ label: "Loading background model", percent: null });
    setError("");
    setMessage("");

    try {
      const imageBlob = await removeBackgroundInBrowser(file, (status) => {
        setMessage(status);
        const percentMatch = status.match(/(\d{1,3})%/);
        setProgressInfo({
          label: status.replace(/\s*\d{1,3}%/, "").replace(/[.…]+$/, "").trim(),
          percent: percentMatch ? Math.min(100, Number(percentMatch[1])) : null,
        });
      });

      setCutoutBlob(imageBlob);
      setCutoutUrl(URL.createObjectURL(imageBlob));
      setMessage("Background removed successfully!");
      setProgressInfo({ label: "Background ready", percent: 100 });
    } catch (cause) {
      console.error("Background removal error:", cause);

      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Apply the chosen background and download the final PNG.
  
const downloadResult = async () => {
  if (!cutoutUrl || !file || downloadLockRef.current) return;
  downloadLockRef.current = true;
  const loadingStartedAt = Date.now();
  setLoading(true);
  setProgressInfo({ label: "Checking download access", percent: null });
  setError("");
  setMessage("");

  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    const hasQuota = await requireLoginForDownload(1, {
      returnTo: "/#background-changer",
      onLogin: () => savePendingDownload({
        tool: "Background changer",
        blob: cutoutBlob,
        fileName: file.name,
        originalFile: file,
        returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        selectedBackground,
        customColor,
        isCustom,
      }),
    });
    if (!hasQuota) return;
    setProgressInfo({ label: "Preparing your new background", percent: null });
    // Keep the original image frame for export. Some background-removal
    // models return a tightly cropped cutout, while the preview centers it
    // inside the editor. Drawing it into the source frame keeps that layout
    // and the original aspect ratio in the downloaded image.
    const cutout = new window.Image();
    cutout.src = cutoutUrl;

    await cutout.decode();

    const original = new window.Image();
    original.src = originalUrl;
    await original.decode();

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = original.naturalWidth;
    canvas.height = original.naturalHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not prepare the image.");
    }

    // Paint selected background
    paintBackground(
      context,
      canvas.width,
      canvas.height,
      activeBackground
    );

    // Contain and center the cutout in the original image frame, matching
    // the centered preview even when the model returns cropped dimensions.
    const scale = Math.min(
      canvas.width / cutout.naturalWidth,
      canvas.height / cutout.naturalHeight
    );
    const drawWidth = cutout.naturalWidth * scale;
    const drawHeight = cutout.naturalHeight * scale;
    context.drawImage(
      cutout,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );

    // Convert to PNG
    const result = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Image conversion failed."));
          }
        },
        "image/png"
      );
    });

    if (!result || result.size === 0) {
      throw new Error("Could not create the PNG image.");
    }
    setProgressInfo({ label: "Saving your image", percent: null });

    // Save image through backend
    const body = new FormData();
    body.append("image", result, "background.png");
    body.append("originalFileName", file.name);
    body.append("selectedColor", activeBackground.from);

    const response = await fetch(
      `${API_BASE}/savebackground`,
      {
        method: "POST",
        body,
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Could not save the image."
      );
    }

    const imageId = data.data?._id || data._id;

    if (!imageId) {
      throw new Error(
        "The server did not return the saved image ID."
      );
    }

    setProgressInfo({ label: "Downloading your image", percent: null });

    // Download saved image from backend
   
const downloadResponse = await fetch(
  `${API_BASE}/downloadbackground/${encodeURIComponent(imageId)}`
);

if (!downloadResponse.ok) {
  throw new Error(
    "Image saved, but download could not be prepared."
  );
}

const savedImage = await readImageResponse(downloadResponse, (percent) => {
  setProgressInfo({ label: "Downloading your image", percent });
});

if (savedImage.size === 0) {
  throw new Error("The downloaded image is empty.");
}

// Force the downloaded file to use PNG format
const downloadUrl = URL.createObjectURL(savedImage);
const originalName =
  file.name.replace(/\.[^.]+$/, "") || "image";
const fileName = `${originalName}-background.png`;
setProgressInfo({ label: "Download ready", percent: 100 });
triggerFileDownload(downloadUrl, fileName, { revokeUrl: true });
await trackDownload("Background changer", fileName, savedImage.size);
reset();

  }
  catch (error) {
    await releaseGuestDownload();
    console.error("Download error:", error);
    setError(error.message || "Failed to download image.");
  } finally {
    const remainingLoadingTime = 900 - (Date.now() - loadingStartedAt);
    if (remainingLoadingTime > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, remainingLoadingTime));
    }
    setLoading(false);
    downloadLockRef.current = false;
    setProgressInfo({ label: "", percent: null });
  }
};

  useEffect(() => {
    if (!resumeDownload || !file || !cutoutBlob || !cutoutUrl) return;
    setResumeDownload(false);
    void downloadResult();
  }, [resumeDownload, file, cutoutBlob, cutoutUrl, downloadResult]);


  // Reset and start with another image.
  const reset = () => {
    setFile(null);
    setOriginalUrl("");
    setCutoutUrl("");
    setCutoutBlob(null);
    setError("");
    setMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <main className="bgx-page">
      <section className="bgx-intro">
        <div className="bgx-kicker">
          <Sparkles size={15} />
          AI BACKGROUND STUDIO
        </div>

        <h1>
          Give your image <span>a new world.</span>
        </h1>

        <p>
          Remove the old background and choose a fresh look in one
          simple edit.
        </p>
      </section>

      <section
        className="bgx-editor"
        aria-label="AI background editor"
      >
        <div className="bgx-editor-topline">
          <div className="bgx-editor-title">
            <span className="bgx-title-icon">
              <Layers3 size={17} />
            </span>

            <div>
              <strong>Background studio</strong>
              <small>Make your subject stand out</small>
            </div>
          </div>

          <span className="bgx-private">
            <LockKeyhole size={13} />
            Private editing
          </span>
        </div>

        <div className="bgx-workspace">
          <div
            className={`bgx-canvas ${
              !file ? "bgx-canvas-empty" : ""
            }`}
          >
            {!file ? (
              <button
                className="bgx-dropzone"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <span className="bgx-upload-icon">
                  <ImagePlus size={25} />
                </span>

                <strong>Drop your image here</strong>
                <span>or browse files from your device</span>

                <span className="bgx-browse">
                  <Upload size={15} />
                  Choose image
                </span>

                <small>PNG, JPG or WebP · Up to 20 MB</small>
              </button>
            ) : (
              <>
                <div className="bgx-canvas-toolbar">
                  <span>
                    <i />
                    {cutoutUrl ? "Preview ready" : "Original image"}
                  </span>

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                  >
                    Change image
                  </button>
                </div>

                <div
                  className="bgx-preview-stage"
                  style={{
                    background: cutoutUrl
                      ? activeBackground.css
                      : "#f0efed",
                  }}
                >
                  <img
                    src={cutoutUrl || originalUrl}
                    alt={
                      cutoutUrl
                        ? "Subject on selected background"
                        : "Original image"
                    }
                  />

                  {loading && (
                    <div className="bgx-loading" role="status" aria-live="polite">
                      <span className="bgx-download-spinner" aria-hidden="true" />
                      <div className="bgx-progress-copy">
                        <strong>{progressInfo.label || (cutoutUrl ? "Preparing your download" : "Removing the background")}</strong>
                        <span>{progressInfo.percent == null ? "Working on your image" : `${progressInfo.percent}% complete`}</span>
                      </div>
                      <div
                        className={`bgx-progress-track ${progressInfo.percent == null ? "bgx-progress-indeterminate" : ""}`}
                        role="progressbar"
                        aria-label={progressInfo.label || "Image processing progress"}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={progressInfo.percent ?? undefined}
                      >
                        <span style={progressInfo.percent == null ? undefined : { width: `${progressInfo.percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bgx-canvas-caption">
                  <span title={file.name}>{file.name}</span>
                  <span>
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </>
            )}
          </div>

          <aside className="bgx-sidebar">
            <div className="bgx-side-heading">
              <span className="bgx-side-icon">
                <Palette size={16} />
              </span>

              <div>
                <strong>Choose a background</strong>
                <small>Preview updates after removal</small>
              </div>
            </div>

            <div className="bgx-background-grid">
              {backgrounds.map((background, index) => (
                <button
                  className={`bgx-background-option ${
                    !isCustom && selectedBackground === index
                      ? "selected"
                      : ""
                  }`}
                  key={background.name}
                  type="button"
                  onClick={() => {
                    setSelectedBackground(index);
                    setIsCustom(false);
                  }}
                  aria-label={`${background.name} background`}
                  aria-pressed={
                    !isCustom && selectedBackground === index
                  }
                >
                  <span style={{ background: background.css }}>
                    {!isCustom && selectedBackground === index && (
                      <Check size={17} />
                    )}
                  </span>

                  <small>{background.name}</small>
                </button>
              ))}
            </div>

            <label
              className={`bgx-custom-color ${
                isCustom ? "selected" : ""
              }`}
            >
              <span className="bgx-color-wheel">
                <Palette size={16} />
              </span>

              <span>
                <strong>Custom color</strong>
                <small>Pick your own shade</small>
              </span>

              <input
                type="color"
                value={customColor}
                onChange={(event) => {
                  setCustomColor(event.target.value);
                  setIsCustom(true);
                }}
                aria-label="Choose a custom background color"
              />
            </label>

            <div className="bgx-sidebar-divider" />

            <div className="bgx-step-note">
              <span>01</span>
              <p>
                <strong>Remove the original</strong>
                <small>
                  AI isolates your subject with one click.
                </small>
              </p>
            </div>

            <div className="bgx-step-note">
              <span>02</span>
              <p>
                <strong>Pick your new scene</strong>
                <small>
                  Choose a studio color or your own shade.
                </small>
              </p>
            </div>

            <button
              className={`bgx-primary ${loading ? "bgx-primary-loading" : ""}`}
              type="button"
              onClick={
                cutoutUrl ? downloadResult : removeBackground
              }
              disabled={!file || loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="bgx-download-spinner" aria-hidden="true" />
              ) : cutoutUrl ? (
                <ArrowDownToLine size={17} />
              ) : (
                <Sparkles size={17} />
              )}

              <span>
                {loading
                  ? "Preparing your download…"
                  : cutoutUrl
                    ? "Save & Download Image"
                    : "Change background"}
              </span>
            </button>

            {cutoutUrl && (
              <button
                className="bgx-reset"
                type="button"
                onClick={reset}
                disabled={loading}
              >
                Start with another image
              </button>
            )}

            {message && (
              <p className="bgx-success" role="status">
                {message}
              </p>
            )}

            {error && (
              <p className="bgx-error" role="alert">
                {error}
              </p>
            )}
          </aside>
        </div>
      </section>

      <div className="bgx-trust">
        <span>
          <LockKeyhole size={14} />
          Your image stays private
        </span>

        <i />

        <span>Transparent PNG export</span>

        <i />

        <span>AI-powered cutout</span>
      </div>

      <input
        ref={inputRef}
        className="bgx-hidden-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg,image/jfif"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </main>
  );
}

export default BackgroundChanger;
