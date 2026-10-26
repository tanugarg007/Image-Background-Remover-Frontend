
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ImagePlus,
  Layers3,
  LockKeyhole,
  Palette,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import "./BackgroundChanger.css";
import { API_ROOT } from "../config/api.js";

const API_BASE = API_ROOT;

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

function BackgroundChanger() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [cutoutUrl, setCutoutUrl] = useState("");
  const [selectedBackground, setSelectedBackground] = useState(0);
  const [customColor, setCustomColor] = useState("#f2eee8");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
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
};

  // Remove background using the Render backend.
  const removeBackground = async () => {
    if (!file || loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const body = new FormData();
      body.append("image", file);

      const response = await fetch(
        `${API_BASE}/users/remove-background`,
        {
          method: "POST",
          body,
        }
      );

      if (!response.ok) {
        const contentType =
          response.headers.get("content-type") || "";

        let errorMessage = "Could not remove the background.";

        if (contentType.includes("application/json")) {
          const data = await response.json();

          errorMessage =
            data.message ||
            data.error ||
            errorMessage;
        } else {
          errorMessage =
            (await response.text()) || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const contentType =
        response.headers.get("content-type") || "";

      let imageBlob;

      // Case 1: Backend directly returns an image.
      if (contentType.startsWith("image/")) {
        imageBlob = await response.blob();
      } else {
        // Case 2: Backend returns JSON with a filename.
        const data = await response.json();

        const filename =
          data.filename || data.data?.filename;

        if (!filename) {
          throw new Error(
            data.message ||
              "Backend did not return an image filename."
          );
        }

        const imageResponse = await fetch(
          `${API_BASE}/users/backgrounddownload/${encodeURIComponent(
            filename
          )}`,
          { cache: "no-store" }
        );

        if (!imageResponse.ok) {
          throw new Error(
            "Could not download the processed image."
          );
        }

        imageBlob = await imageResponse.blob();
      }

      if (
        !imageBlob.type.startsWith("image/") ||
        imageBlob.size === 0
      ) {
        throw new Error(
          "The server did not return a valid image."
        );
      }

      setCutoutUrl(URL.createObjectURL(imageBlob));
      setMessage("Background removed successfully!");
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
  if (!cutoutUrl || !file || loading) return;

  setLoading(true);
  setError("");
  setMessage("");

  let downloadUrl = "";

  try {
    // Load transparent cutout
    const cutout = new window.Image();
    cutout.src = cutoutUrl;

    await cutout.decode();

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = cutout.naturalWidth;
    canvas.height = cutout.naturalHeight;

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

    // Draw subject
    context.drawImage(cutout, 0, 0);

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
        "image/png,image.jpg,image/jpeg,image/webp,image/jfif"
      );
    });

    if (!result || result.size === 0) {
      throw new Error("Could not create the PNG image.");
    }

    // Save image through backend
    const body = new FormData();
    body.append("image", result, "background.png");
    body.append("originalFileName", file.name);
    body.append("selectedColor", activeBackground.from);

    const response = await fetch(
      `${API_BASE}/users/savebackground`,
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

    // Download saved image from backend
   
const downloadResponse = await fetch(
  `${API_BASE}/users/downloadbackground/${encodeURIComponent(imageId)}`
);

if (!downloadResponse.ok) {
  throw new Error(
    "Image saved, but download could not be prepared."
  );
}

const savedImage = await downloadResponse.blob();

if (savedImage.size === 0) {
  throw new Error("The downloaded image is empty.");
}

// Force the downloaded file to use PNG format
downloadUrl = URL.createObjectURL(savedImage);

const link = document.createElement("a");
link.href = downloadUrl;

const originalName =
  file.name.replace(/\.[^.]+$/, "") || "image";

link.download = `${originalName}-background.png`;

document.body.appendChild(link);
link.click();
link.remove();

setMessage("Image downloaded successfully!");

window.setTimeout(() => {
  if (downloadUrl) {
    URL.revokeObjectURL(downloadUrl);
    downloadUrl = "";
  }
}, 60000);

  }
  catch (error) {
    console.error("Download error:", error);
    setError(error.message || "Failed to download image.");
  }
};


  // Reset and start with another image.
  const reset = () => {
    setFile(null);
    setOriginalUrl("");
    setCutoutUrl("");
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
                    <div className="bgx-loading">
                      <RefreshCw size={22} />
                      <span>Processing your image…</span>
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
              className="bgx-primary"
              type="button"
              onClick={
                cutoutUrl ? downloadResult : removeBackground
              }
              disabled={!file || loading}
            >
              {loading ? (
                <RefreshCw className="bgx-spin" size={17} />
              ) : cutoutUrl ? (
                <ArrowDownToLine size={17} />
              ) : (
                <Sparkles size={17} />
              )}

              {loading
                ? "Working on your image…"
                : cutoutUrl
                  ? "Save & Download Image"
                  : "Change background"}
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
