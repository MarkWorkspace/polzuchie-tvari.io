// ROLE: localStorage wrapper that never throws (private mode, quota, blocked storage). No game logic.

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function resolveStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Accessing the localStorage getter itself can throw in locked-down contexts.
    return null;
  }
}

export const safeStorage = {
  get(key: string): string | null {
    try {
      return resolveStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },

  /** Returns false when the value could not be persisted. */
  set(key: string, value: string): boolean {
    try {
      const storage = resolveStorage();
      if (!storage) return false;
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  /** Returns false when the key could not be removed. */
  remove(key: string): boolean {
    try {
      const storage = resolveStorage();
      if (!storage) return false;
      storage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
