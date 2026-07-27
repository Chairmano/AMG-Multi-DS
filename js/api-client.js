// Lightweight DataMart API client (browser-friendly)
export default class DataMartClient {
  constructor({ apiKey, apiSecret, baseUrl } = {}) {
    this.apiKey = apiKey || null;
    this.apiSecret = apiSecret || null;
    this.baseUrl = baseUrl || 'https://api.datamartgh.shop/api/developer';
  }

  setApiKey(key) { this.apiKey = key; }
  setApiSecret(secret) { this.apiSecret = secret; }

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    if (this.apiSecret) h['X-API-Secret'] = this.apiSecret;
    return h;
  }

  async _fetch(path, { method = 'GET', body = null, headers = {} } = {}) {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const opts = { method, headers: this._headers(headers) };
    if (body != null) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
    if (!res.ok) {
      const err = new Error((json && json.message) || res.statusText || 'Request failed');
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return { status: res.status, headers: res.headers, body: json };
  }

  // Helpers
  async get(path) { return this._fetch(path, { method: 'GET' }); }
  async post(path, body, headers = {}) { return this._fetch(path, { method: 'POST', body, headers }); }

  // API surface
  async verifyNumber(phoneNumber) {
    return (await this.post('/verify-number', { phoneNumber })).body;
  }

  async verifyNumberBulk(numbers = []) {
    return (await this.post('/verify-number/bulk', { numbers })).body;
  }

  async dataPackages(network = '') {
    const q = network ? `?network=${encodeURIComponent(network)}` : '';
    return (await this.get(`/data-packages${q}`)).body;
  }

  async balance() { return (await this.get('/balance')).body; }

  async purchase({ phoneNumber, network, capacity, gateway = 'wallet', ref = null }, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return (await this.post('/purchase', { phoneNumber, network, capacity, gateway, ref }, headers)).body;
  }

  async bulkPurchase(orders = [], idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return (await this.post('/bulk-purchase', { orders }, headers)).body;
  }

  async orderStatus(reference) { return (await this.get(`/order-status/${encodeURIComponent(reference)}`)).body; }

  // Checkers (result cards)
  async checkersPurchase(body, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return (await this.post('/api/checkers/purchase', body, headers)).body;
  }

  async checkersBulk(body, idempotencyKey = null) {
    const headers = {};
    if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;
    return (await this.post('/api/checkers/bulk-purchase', body, headers)).body;
  }

  async checkersProducts() { return (await this.get('/api/checkers/products')).body; }
  async checkersBalance() { return (await this.get('/api/checkers/balance')).body; }

  // Withdrawals (server-side recommended). This helper can build a signed request if you provide a signing secret.
  // Note: signing should be performed on a trusted server. Browsers expose secrets if used here.
  async createWithdrawal(body, { idempotencyKey, signingSecret } = {}) {
    if (!idempotencyKey) throw new Error('X-Idempotency-Key is required for withdrawals');
    if (!signingSecret) throw new Error('signingSecret required to build X-Signature (perform on server)');

    // Build payload for signing exactly as docs require
    const timestamp = Date.now().toString();
    const path = '/api/developer/v1/withdrawals';
    const raw = JSON.stringify(body);
    const payload = `${timestamp}.POST.${path}.${raw}`;

    // browser subtle crypto
    if (!window.crypto || !window.crypto.subtle) throw new Error('SubtleCrypto required for HMAC in browser');
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey('raw', enc.encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await window.crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const sigHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const headers = { 'X-Idempotency-Key': idempotencyKey, 'X-Signature': sigHex, 'X-Timestamp': timestamp };
    return (await this.post('/v1/withdrawals', body, headers)).body;
  }

  // Utility: inject delivery tracker widget into a page
  static injectDeliveryTracker(apiKey, { theme = 'dark', position = 'bottom-right', poll = 15, container = null } = {}) {
    const script = document.createElement('script');
    script.src = 'https://api.datamartgh.shop/widgets/delivery-tracker.js';
    script.defer = true;
    script.setAttribute('data-api-key', apiKey);
    script.setAttribute('data-theme', theme);
    script.setAttribute('data-position', position);
    script.setAttribute('data-poll', String(poll));
    if (container) script.setAttribute('data-container', container);
    document.body.appendChild(script);
    return script;
  }
}
