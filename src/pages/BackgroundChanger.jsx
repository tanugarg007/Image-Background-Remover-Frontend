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

const backgrounds = [
  { name: "Cloud", from: "#dbeafe", to: "#f4f2ff", css: "linear-gradient(135deg, #dbeafe, #f4f2ff)" },
  { name: "Peach", from: "#ffbd9b", to: "#ffead7", css: "linear-gradient(135deg, #ffbd9b, #ffead7)" },
  { name: "Sage", from: "#a7c6ad", to: "#e2ead8", css: "linear-gradient(135deg, #a7c6ad, #e2ead8)" },
  { name: "Lilac", from: "#b6a5f6", to: "#ece5ff", css: "linear-gradient(135deg, #b6a5f6, #ece5ff)" },
  { name: "Midnight", from: "#1d2852", to: "#5a4b8a", css: "linear-gradient(135deg, #1d2852, #5a4b8a)" },
];

function paintBackground(context, width, height, background) {
  if (background.to) {
    const gradient = context.createLinearGradient(0, 0, width, height);
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

  const activeBackground = isCustom
    ? { name: "Custom", from: customColor, css: customColor }
    : backgrounds[selectedBackground];

  useEffect(() => () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
  }, [originalUrl]);

  useEffect(() => () => {
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
  }, [cutoutUrl]);

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    setError("");
    if (!nextFile.type.startsWith("image/")) {
      setError("Choose a valid image file to get started.");
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setError("Image size must be 20 MB or less.");
      return;
    }
    setFile(nextFile);
    setCutoutUrl("");
    setOriginalUrl(URL.createObjectURL(nextFile));
  };

 
const removeBackground = async () => {
  if (!file || loading) return;

  setLoading(true);
  setError("");

  try {
    const body = new FormData();
    body.append("image", file);

    const response = await fetch(
      "http://localhost:4000/users/remove-background",
      {
        method: "POST",
        body,
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.message || "Could not remove the background."
      );
    }

    const result = await response.blob();

    if (!result.type.startsWith("image/")) {
      throw new Error("Server did not return a processed image.");
    }

    setCutoutUrl(URL.createObjectURL(result));
  } catch (cause) {
    setError(
      cause instanceof Error
        ? cause.message
        : "Something went wrong. Try again."
    );
  } finally {
    setLoading(false);
  }
};


 
const downloadResult = async () => {
  if (!cutoutUrl || !file || loading) return;

  setLoading(true);
  setError("");

  try {
    // Load the background-removed image
    const cutout = new Image();
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

    // Apply selected background color or gradient
    paintBackground(
      context,
      canvas.width,
      canvas.height,
      activeBackground
    );

    // Draw the transparent subject over the background
    context.drawImage(cutout, 0, 0);

    // Convert final image to PNG
    const result = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!result) {
      throw new Error("Could not create the PNG image.");
    }

    // Send final image to backend for saving
    const body = new FormData();
    body.append("image", result, "background.png");
    body.append("originalFileName", file.name);
    body.append("selectedColor", activeBackground.from);

    const response = await fetch("http://localhost:4000/users/savebackground", {
      method: "POST",
      body,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Could not save the image."
      );
    }

    const downloadResponse = await fetch(
      `http://localhost:4000/users/downloadbackground/${data.data._id}`
    );
    if (!downloadResponse.ok) {
      throw new Error("Image saved, but download could not be prepared.");
    }

    const savedImage = await downloadResponse.blob();
    const downloadUrl = URL.createObjectURL(savedImage);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download =
      `${file.name.replace(/\.[^.]+$/, "") || "image"}-background.png`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

  } catch (cause) {
    setError(
      cause instanceof Error
        ? cause.message
        : "Download failed."
    );
  } finally {
    setLoading(false);
  }
};


  const reset = () => {
    setFile(null);
    setOriginalUrl("");
    setCutoutUrl("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="bgx-page">
      <section className="bgx-intro">
        <div className="bgx-kicker"><Sparkles size={15} /> AI BACKGROUND STUDIO</div>
        <h1>Give your image <span>a new world.</span></h1>
        <p>Remove the old background and choose a fresh look in one simple edit.</p>
      </section>

      <section className="bgx-editor" aria-label="AI background editor">
        <div className="bgx-editor-topline">
          <div className="bgx-editor-title"><span className="bgx-title-icon"><Layers3 size={17} /></span><div><strong>Background studio</strong><small>Make your subject stand out</small></div></div>
          <span className="bgx-private"><LockKeyhole size={13} /> Private editing</span>
        </div>

        <div className="bgx-workspace">
          <div className={`bgx-canvas ${!file ? "bgx-canvas-empty" : ""}`}>
            {!file ? (
              <button className="bgx-dropzone" type="button" onClick={() => inputRef.current?.click()}>
                <span className="bgx-upload-icon"><ImagePlus size={25} /></span>
                <strong>Drop your image here</strong>
                <span>or browse files from your device</span>
                <span className="bgx-browse"><Upload size={15} /> Choose image</span>
                <small>PNG, JPG or WebP · Up to 20 MB</small>
              </button>
            ) : (
              <>
                <div className="bgx-canvas-toolbar">
                  <span><i /> {cutoutUrl ? "Preview ready" : "Original image"}</span>
                  <button type="button" onClick={() => inputRef.current?.click()}>Change image</button>
                </div>
                <div className="bgx-preview-stage" style={{ background: cutoutUrl ? activeBackground.css : "#f0efed" }}>
                  <img src={cutoutUrl || originalUrl} alt={cutoutUrl ? "Subject on selected background" : "Original image"} />
                  {loading && <div className="bgx-loading"><RefreshCw size={22} /><span>Removing background…</span></div>}
                </div>
                <div className="bgx-canvas-caption"><span title={file.name}>{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
              </>
            )}
          </div>

          <aside className="bgx-sidebar">
            <div className="bgx-side-heading"><span className="bgx-side-icon"><Palette size={16} /></span><div><strong>Choose a background</strong><small>Preview updates after removal</small></div></div>
            <div className="bgx-background-grid">
              {backgrounds.map((background, index) => (
                <button
                  className={`bgx-background-option ${!isCustom && selectedBackground === index ? "selected" : ""}`}
                  key={background.name}
                  type="button"
                  onClick={() => { setSelectedBackground(index); setIsCustom(false); }}
                  aria-label={`${background.name} background`}
                  aria-pressed={!isCustom && selectedBackground === index}
                >
                  <span style={{ background: background.css }}>{!isCustom && selectedBackground === index && <Check size={17} />}</span>
                  <small>{background.name}</small>
                </button>
              ))}
            </div>
            <label className={`bgx-custom-color ${isCustom ? "selected" : ""}`}>
              <span className="bgx-color-wheel"><Palette size={16} /></span>
              <span><strong>Custom color</strong><small>Pick your own shade</small></span>
              <input type="color" value={customColor} onChange={(event) => { setCustomColor(event.target.value); setIsCustom(true); }} aria-label="Choose a custom background color" />
            </label>

            <div className="bgx-sidebar-divider" />
            <div className="bgx-step-note"><span>01</span><p><strong>Remove the original</strong><small>AI isolates your subject with one click.</small></p></div>
            <div className="bgx-step-note"><span>02</span><p><strong>Pick your new scene</strong><small>Choose a studio color or your own shade.</small></p></div>

          <button
  className="bgx-primary"
  type="button"
  onClick={cutoutUrl ? downloadResult : removeBackground}
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
            {cutoutUrl && <button className="bgx-reset" type="button" onClick={reset}>Start with another image</button>}
            {error && <p className="bgx-error" role="alert">{error}</p>}
          </aside>
        </div>
      </section>

      <div className="bgx-trust"><span><LockKeyhole size={14} /> Your image stays private</span><i /> <span>Transparent PNG export</span><i /> <span>AI-powered cutout</span></div>
      <input ref={inputRef} className="bgx-hidden-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectFile(event.target.files?.[0])} />
    </main>
  );
}

export default BackgroundChanger;
