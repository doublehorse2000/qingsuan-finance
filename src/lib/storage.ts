// Never silently accept unsaved financial records if persistent storage fails.
export const storage = {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
};
