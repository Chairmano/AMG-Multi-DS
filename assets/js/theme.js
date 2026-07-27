(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AMGTheme = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'amg-theme';
  const THEME_DARK = 'dark';
  const THEME_LIGHT = 'light';

  function normalizeTheme(value) {
    if (value === THEME_LIGHT) return THEME_LIGHT;
    return THEME_DARK;
  }

  function getInitialTheme(savedTheme, systemTheme) {
    if (savedTheme) {
      return normalizeTheme(savedTheme);
    }

    if (systemTheme) {
      return normalizeTheme(systemTheme);
    }

    return THEME_DARK;
  }

  function getStoredTheme() {
    if (typeof window === 'undefined') return null;

    return window.localStorage.getItem(STORAGE_KEY);
  }

  function setStoredTheme(theme) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, normalizeTheme(theme));
  }

  function applyTheme(theme, rootElement = document.documentElement) {
    if (!rootElement) return;

    const normalized = normalizeTheme(theme);
    rootElement.setAttribute('data-theme', normalized);
    rootElement.classList.toggle('theme-light', normalized === THEME_LIGHT);
    rootElement.classList.toggle('theme-dark', normalized === THEME_DARK);
    return normalized;
  }

  function initTheme(options = {}) {
    const rootElement = options.rootElement || document.documentElement;
    const savedTheme = options.savedTheme ?? getStoredTheme();
    const systemTheme = options.systemTheme ?? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? THEME_LIGHT : THEME_DARK);
    const theme = getInitialTheme(savedTheme, systemTheme);

    applyTheme(theme, rootElement);
    setStoredTheme(theme);
    return theme;
  }

  function toggleTheme(rootElement = document.documentElement) {
    const currentTheme = rootElement.getAttribute('data-theme') || getStoredTheme() || THEME_DARK;
    const nextTheme = currentTheme === THEME_LIGHT ? THEME_DARK : THEME_LIGHT;
    applyTheme(nextTheme, rootElement);
    setStoredTheme(nextTheme);
    return nextTheme;
  }

  return {
    STORAGE_KEY,
    THEME_DARK,
    THEME_LIGHT,
    normalizeTheme,
    getInitialTheme,
    getStoredTheme,
    setStoredTheme,
    applyTheme,
    initTheme,
    toggleTheme
  };
});
