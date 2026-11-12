export const APP_TOAST_EVENT = "citc:app-toast";

export function showToast(type, title, message) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(APP_TOAST_EVENT, {
      detail: { type, title, message },
    })
  );
}
