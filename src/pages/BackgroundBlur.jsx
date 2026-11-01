import { useEffect, useRef, useState } from "react";
import {
  Aperture,
  ArrowDownToLine,
  Check,
  ImagePlus,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { API_USERS, removeBackgroundInBrowser } from "../config/api.js";
import { trackDownload } from "../config/downloadTracking.js";
import "./BackgroundBlur.css";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function BackgroundBlur() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [originalUrl, setOriginalUrl] = useState("");
  const [subjectUrl, setSubjectUrl] = useState("");
  const [subjectBlob, setSubjectBlob] = useState(null);
  const [blurStrength, setBlurStrength] = useState(16);
  const [processing, setProcessing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setOriginalUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!subjectBlob) {
      setSubjectUrl("");
      return undefined;
    }

    const url = URL.createObjectURL(subjectBlob);
    setSubjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [subjectBlob]);

  const chooseFile = (nextFile) => {
    if (!nextFile) return;
    setError("");
    setStatus("");
    setSubjectBlob(null);

    if (!nextFile.type.startsWith("image/")) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError("Choose an image smaller than 20 MB.");
      return;
    }

    setFile(nextFile);
  };

  const handleProcess = async () => {
    if (!file || processing) return;
    setProcessing(true);
    setError("");
    setStatus("Preparing subject detection…");

    try {
      const transparentSubject = await removeBackgroundInBrowser(file, setStatus);
      setSubjectBlob(transparentSubject);
      setStatus("Subject isolated. Adjust the blur to your liking.");
    } catch (processingError) {
      setError(processingError instanceof Error
        ? processingError.message
        : "Could not isolate the subject. Please try another image.");
      setStatus("");
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!file || !subjectBlob || downloading) return;
    setDownloading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("subject", subjectBlob, "isolated-subject.png");
      formData.append("blurStrength", String(blurStrength));

      const response = await fetch(`${API_USERS}/background-blur`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        const message = contentType.includes("application/json")
          ? (await response.json()).message
          : "Background blur processing failed.";
        throw new Error(message || "Background blur processing failed.");
      }

      const output = await response.blob();
      if (!output.type.startsWith("image/") || output.size === 0) {
        throw new Error("The server did not return a valid blurred image.");
      }

      const downloadUrl = URL.createObjectURL(output);
      const link = document.createElement("a");
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
      link.href = downloadUrl;
      link.download = `${baseName}-background-blur.png`;
      trackDownload("Background Blur", link.download, output.size);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error
        ? downloadError.message
        : "Could not download the blurred image.");
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSubjectBlob(null);
    setStatus("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <main className="background-blur-page">
      <section className="background-blur-shell">
        <div className="background-blur-hero">
          <div className="background-blur-hero-copy">
            <span className="background-blur-eyebrow"><Aperture size={15} /> DEPTH STUDIO <i /></span>
            <h1>Bring the subject<br /><em>into focus.</em></h1>
            <p>Give your photo a little more depth. Keep what matters sharp and soften everything behind it.</p>
            <div className="background-blur-trust"><LockKeyhole size={15} /> Your image stays on your device</div>
          </div>

          <div className="background-blur-orbit" aria-hidden="true">
            <div className="blur-orbit-ring ring-one" />
            <div className="blur-orbit-ring ring-two" />
            <div className="blur-orbit-core"><Aperture size={72} strokeWidth={1.2} /></div>
            <Sparkles className="blur-orbit-sparkle sparkle-one" size={19} />
            <Sparkles className="blur-orbit-sparkle sparkle-two" size={13} />
          </div>
        </div>

        {!file ? (
          <button
            className={`background-blur-dropzone ${dragging ? "is-dragging" : ""}`}
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="blur-upload-icon"><ImagePlus size={25} /></span>
            <strong>Drop a photo to start</strong>
            <span>or browse from your device</span>
            <small>PNG, JPG, WEBP <b>·</b> UP TO 20 MB</small>
          </button>
        ) : (
          <div className="background-blur-workspace">
            <div className="background-blur-workspace-heading">
              <div>
                <span className="background-blur-section-kicker">YOUR CANVAS</span>
                <h2>Shape the depth</h2>
              </div>
              <button className="background-blur-reset" type="button" onClick={reset}>Choose another photo</button>
            </div>

            <div className="background-blur-previews">
              <article className="background-blur-preview-card">
                <div className="background-blur-preview-title"><span>01</span> Original <small>BEFORE</small></div>
                <div className="background-blur-image-frame">
                  <img src={originalUrl} alt="Original uploaded photo" />
                  <span className="background-blur-image-chip">ORIGINAL</span>
                </div>
              </article>

              <article className="background-blur-preview-card result-card">
                <div className="background-blur-preview-title"><span>02</span> Soft focus <small>AFTER</small></div>
                <div className="background-blur-image-frame result-frame">
                  {subjectUrl ? (
                    <>
                      <img
                        className="background-blur-layer"
                        src={originalUrl}
                        alt="Photo with softened background"
                        style={{ filter: `blur(${blurStrength}px)` }}
                      />
                      <img className="background-blur-subject" src={subjectUrl} alt="Isolated sharp subject" />
                      <span className="background-blur-image-chip result-chip"><Check size={12} /> LIVE PREVIEW</span>
                    </>
                  ) : (
                    <div className="background-blur-placeholder">
                      {processing ? <RefreshCw className="blur-spinner" size={25} /> : <Sparkles size={25} />}
                      <span>{processing ? "Finding your subject…" : "Your focused photo will appear here"}</span>
                    </div>
                  )}
                </div>
              </article>
            </div>

            <div className="background-blur-controls">
              <div className="background-blur-control-heading">
                <label htmlFor="blur-strength">Background softness</label>
                <span>{blurStrength}<small> px</small></span>
              </div>
              <input
                id="blur-strength"
                className="background-blur-slider"
                type="range"
                min="2"
                max="32"
                value={blurStrength}
                onChange={(event) => setBlurStrength(Number(event.target.value))}
                disabled={!subjectUrl}
                style={{ "--blur-progress": `${((blurStrength - 2) / 30) * 100}%` }}
              />
              <div className="background-blur-range-labels"><span>SUBTLE</span><span>PORTRAIT</span><span>DREAMY</span></div>
            </div>

            {!subjectUrl ? (
              <button className="background-blur-primary" type="button" onClick={handleProcess} disabled={processing}>
                {processing ? <RefreshCw className="blur-spinner" size={17} /> : <Sparkles size={17} />}
                {processing ? "Creating depth…" : "Create background blur"}
              </button>
            ) : (
              <button className="background-blur-primary" type="button" onClick={handleDownload} disabled={downloading}>
                {downloading ? <RefreshCw className="blur-spinner" size={17} /> : <ArrowDownToLine size={17} />}
                {downloading ? "Preparing download…" : "Download focused photo"}
              </button>
            )}

            {status && <p className="background-blur-status" role="status">{status}</p>}
          </div>
        )}

        {error && <p className="background-blur-error" role="alert">{error}</p>}
        <input
          ref={fileInputRef}
          className="background-blur-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <footer className="background-blur-footer">
          <span>MADE FOR THE MOMENTS THAT MATTER</span>
          <span><LockKeyhole size={13} /> Processed privately in your browser</span>
        </footer>
      </section>
    </main>
  );
}

export default BackgroundBlur;
