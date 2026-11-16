export function triggerFileDownload(url, fileName, { revokeUrl = false } = {}) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.position = "fixed";
  link.style.left = "-9999px";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => link.remove(), 1000);
  if (revokeUrl) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
