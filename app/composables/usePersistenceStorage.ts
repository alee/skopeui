function parseStoredValue(rawValue: string | null): unknown {
  if (rawValue == null) {
    return null;
  }
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

/** Storage is optional: privacy settings and quota limits must not block editing. */
export function usePersistenceStorage(onError: () => void = () => {}) {
  function get(key: string): unknown {
    if (typeof window === "undefined") return null;
    try {
      return parseStoredValue(window.localStorage.getItem(key));
    } catch {
      onError();
      return null;
    }
  }

  function set(key: string, value: unknown): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      onError();
      return false;
    }
  }

  function remove(key: string): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      onError();
      return false;
    }
  }

  return { get, set, remove };
}
