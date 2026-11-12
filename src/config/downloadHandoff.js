const DATABASE_NAME = "citc-download-handoff";
const STORE_NAME = "pending-downloads";
const PENDING_DOWNLOAD_KEY = "resume-after-login";
const HANDOFF_MAX_AGE_MS = 15 * 60 * 1000;

const claimPromises = new Map();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not save your pending download."));
  });
}

function runTransaction(mode, action) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let result;
    try {
      action(transaction.objectStore(STORE_NAME), (value) => { result = value; });
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Could not update your pending download."));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Could not update your pending download."));
    };
  }));
}

export async function savePendingDownload(download) {
  if (!(download?.blob instanceof Blob) || !download.fileName || !download.returnTo) {
    throw new Error("The processed image is not available to save for login.");
  }
  await runTransaction("readwrite", (store) => { store.put({
    ...download,
    createdAt: Date.now(),
  }, PENDING_DOWNLOAD_KEY); });
}

export async function claimPendingDownload(expectedTool) {
  if (claimPromises.has(expectedTool)) return claimPromises.get(expectedTool);
  const claimPromise = runTransaction("readwrite", (store, setResult) => {
    const request = store.get(PENDING_DOWNLOAD_KEY);
    request.onsuccess = () => {
      const pending = request.result;
      if (!pending || pending.tool !== expectedTool) return;
      setResult(pending);
      store.delete(PENDING_DOWNLOAD_KEY);
    };
  }).then((download) => {
    if (!download || Date.now() - download.createdAt > HANDOFF_MAX_AGE_MS) return null;
    return download;
  }).finally(() => {
    claimPromises.delete(expectedTool);
  });
  claimPromises.set(expectedTool, claimPromise);
  return claimPromise;
}
