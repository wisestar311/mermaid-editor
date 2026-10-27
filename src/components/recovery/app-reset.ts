/** Drops this app's service worker and stored build files, then loads the current version from the network. */
export async function resetAppFiles() {
  try {
    if ("serviceWorker" in navigator) {
      for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    }
    if ("caches" in window) {
      for (const key of await caches.keys()) if (key.startsWith("mermaid-editor:")) await caches.delete(key);
    }
  } finally {
    location.reload();
  }
}
