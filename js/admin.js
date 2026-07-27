import DataMartClient from './api-client.js';

const out = (v) => { document.getElementById('output').textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); };

function loadKeys() {
  return {
    apiKey: localStorage.getItem('DM_API_KEY') || '',
    apiSecret: localStorage.getItem('DM_API_SECRET') || '',
    adminToken: localStorage.getItem('DM_ADMIN_TOKEN') || ''
  };
}

function saveKeys(apiKey, apiSecret, adminToken) {
  localStorage.setItem('DM_API_KEY', apiKey);
  localStorage.setItem('DM_API_SECRET', apiSecret);
  localStorage.setItem('DM_ADMIN_TOKEN', adminToken);
}

function clearKeys() {
  localStorage.removeItem('DM_API_KEY');
  localStorage.removeItem('DM_API_SECRET');
  localStorage.removeItem('DM_ADMIN_TOKEN');
}

function adminHeaders() {
  const token = localStorage.getItem('DM_ADMIN_TOKEN') || '';
  return token ? { 'X-Admin-Token': token } : {};
}

async function proxyFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}), ...(adminHeaders()) };
  const res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { /* ignore */ }
  if (!res.ok) {
    const err = new Error((json && json.error) || res.statusText || 'Proxy request failed');
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

document.addEventListener('DOMContentLoaded', () => {
  const { apiKey, apiSecret, adminToken } = loadKeys();
  document.getElementById('dmApiKey').value = apiKey;
  document.getElementById('dmApiSecret').value = apiSecret;
  document.getElementById('dmAdminToken').value = adminToken;

  document.getElementById('saveKeys').onclick = () => {
    const k = document.getElementById('dmApiKey').value.trim();
    const s = document.getElementById('dmApiSecret').value.trim();
    const t = document.getElementById('dmAdminToken').value.trim();
    saveKeys(k, s, t);
    out('Saved keys to localStorage (browser storage is not secure).');
  };

  document.getElementById('clearKeys').onclick = () => {
    clearKeys();
    document.getElementById('dmApiKey').value = '';
    document.getElementById('dmApiSecret').value = '';
    document.getElementById('dmAdminToken').value = '';
    out('Cleared stored keys.');
  };

  document.getElementById('btnBalance').onclick = async () => {
    try {
      const r = await proxyFetch('/proxy/balance');
      out(r);
    } catch (e) { out(e.body || e.message || String(e)); }
  };

  document.getElementById('btnPackages').onclick = async () => {
    try {
      const r = await proxyFetch('/proxy/data-packages');
      out(r);
    } catch (e) { out(e.body || e.message || String(e)); }
  };

  document.getElementById('btnInjectTracker').onclick = () => {
    const k = document.getElementById('dmApiKey').value.trim();
    if (!k) return out('Set API key first');
    DataMartClient.injectDeliveryTracker(k, { theme: 'dark', poll: 15 });
    out('Delivery tracker script appended.');
  };

  document.getElementById('btnPurchase').onclick = async () => {
    try {
      const phone = document.getElementById('phone').value.trim();
      const network = document.getElementById('network').value;
      const capacity = document.getElementById('capacity').value.trim();
      if (!phone || !capacity) return out('phone and capacity required');
      const id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      const r = await proxyFetch('/proxy/purchase', { method: 'POST', body: { phoneNumber: phone, network, capacity, gateway: 'wallet', ref: null }, headers: { 'X-Idempotency-Key': id } });
      out(r);
    } catch (e) { out(e.body || e.message || String(e)); }
  };
});
