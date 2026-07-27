import DataMartClient from './api-client.js';

const out = (v) => { document.getElementById('output').textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); };

function loadKeys() {
  return { apiKey: localStorage.getItem('DM_API_KEY') || '', apiSecret: localStorage.getItem('DM_API_SECRET') || '' };
}

function saveKeys(apiKey, apiSecret) {
  localStorage.setItem('DM_API_KEY', apiKey);
  localStorage.setItem('DM_API_SECRET', apiSecret);
}

function clearKeys() {
  localStorage.removeItem('DM_API_KEY');
  localStorage.removeItem('DM_API_SECRET');
}

document.addEventListener('DOMContentLoaded', () => {
  const { apiKey, apiSecret } = loadKeys();
  document.getElementById('dmApiKey').value = apiKey;
  document.getElementById('dmApiSecret').value = apiSecret;

  let client = new DataMartClient({ apiKey: apiKey || undefined, apiSecret: apiSecret || undefined });

  document.getElementById('saveKeys').onclick = () => {
    const k = document.getElementById('dmApiKey').value.trim();
    const s = document.getElementById('dmApiSecret').value.trim();
    saveKeys(k, s);
    client.setApiKey(k);
    client.setApiSecret(s);
    out('Saved keys to localStorage (browser storage is not secure).');
  };

  document.getElementById('clearKeys').onclick = () => {
    clearKeys();
    document.getElementById('dmApiKey').value = '';
    document.getElementById('dmApiSecret').value = '';
    client = new DataMartClient({});
    out('Cleared stored keys.');
  };

  document.getElementById('btnBalance').onclick = async () => {
    try {
      const r = await client.balance();
      out(r);
    } catch (e) { out(e.body || e.message || String(e)); }
  };

  document.getElementById('btnPackages').onclick = async () => {
    try {
      const r = await client.dataPackages();
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
      const r = await client.purchase({ phoneNumber: phone, network, capacity }, id);
      out(r);
    } catch (e) { out(e.body || e.message || String(e)); }
  };
});
