(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.AMGAuth = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const STORAGE_KEY = 'amg-demo-auth-user';

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizeName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  function createDemoUser({ email, displayName, phone, password }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = normalizeName(displayName);

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    if (!password || String(password).trim().length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    return {
      uid: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email: normalizedEmail,
      displayName: normalizedName,
      phone: String(phone || '').trim(),
      password: String(password).trim(),
      provider: 'demo'
    };
  }

  function getStorageKey() {
    return STORAGE_KEY;
  }

  function saveUser(user) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return user;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  }

  function loadUser() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      return parsed && parsed.email ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function clearUser() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return true;
    }

    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  }

  function signUp({ email, displayName, phone, password }) {
    const user = createDemoUser({ email, displayName, phone, password });
    saveUser(user);
    return user;
  }

  function signIn({ email, password }) {
    const normalizedEmail = normalizeEmail(email);
    const storedUser = loadUser();

    if (!storedUser) {
      throw new Error('No account found. Please create an account first.');
    }

    if (storedUser.email !== normalizedEmail) {
      throw new Error('No account found for that email.');
    }

    if (storedUser.password !== String(password || '').trim()) {
      throw new Error('Incorrect password.');
    }

    return storedUser;
  }

  function signOut() {
    clearUser();
    return true;
  }

  return {
    createDemoUser,
    getStorageKey,
    signUp,
    signIn,
    signOut,
    loadUser,
    saveUser,
    clearUser
  };
});
