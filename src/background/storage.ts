// StrixBlock v2 — chrome.storage.local typed wrapper

/**
 * Get a single value from storage.
 * Returns defaultValue if the key does not exist.
 */
export async function get<T>(key: string, defaultValue?: T): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (key in result) {
        resolve(result[key] as T);
      } else {
        resolve(defaultValue as T);
      }
    });
  });
}

/**
 * Set a single key in storage.
 */
export async function set(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * Get multiple keys from storage at once.
 * Returns an object with the same shape as the keys parameter,
 * filling in defaults for missing keys.
 */
export async function getMultiple<T extends Record<string, unknown>>(keys: T): Promise<T> {
  const keyNames = Object.keys(keys);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keyNames, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const out = { ...keys };
      for (const k of keyNames) {
        if (k in result) {
          (out as Record<string, unknown>)[k] = result[k];
        }
      }
      resolve(out);
    });
  });
}

/**
 * Set multiple key-value pairs in storage.
 */
export async function setMultiple(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * Remove a single key from storage.
 */
export async function remove(key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * Clear all storage (use with caution).
 */
export async function clear(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

/**
 * Subscribe to storage change events.
 */
export function onChanged(
  callback: (changes: Record<string, chrome.storage.StorageChange>) => void
): void {
  chrome.storage.local.onChanged.addListener(callback);
}
