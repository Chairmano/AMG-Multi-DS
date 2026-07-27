/**
 * Firebase Function wrapper for DataMart API proxy endpoints.
 * This proxy keeps DataMart credentials server-side and applies admin protection.
 */

const functions = require('firebase-functions');
const express = require('express');
const axios = require('axios');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const BASE = 'https://api.datamartgh.shop';

function getConfigValue(name, defaultValue = '') {
  const envValue = process.env[name];
  const configValue = functions.config()?.datamart?.[name.toLowerCase()];
  return envValue || configValue || defaultValue;
}

const DM_API_KEY = getConfigValue('DM_API_KEY');
const DM_API_SECRET = getConfigValue('DM_API_SECRET');
const SIGNING_SECRET = getConfigValue('SIGNING_SECRET');
const WEBHOOK_SECRET = getConfigValue('WEBHOOK_SECRET');
const ADMIN_TOKEN = getConfigValue('ADMIN_TOKEN');
const ADMIN_USER = getConfigValue('ADMIN_USER') || 'amgadmin';
const ADMIN_PASSWORD = getConfigValue('ADMIN_PASSWORD') || 'amg123';
const SESSION_KEYS = (getConfigValue('SESSION_KEYS') || 'dev_key').split(',');

if (!DM_API_KEY) {
  functions.logger.warn('DM_API_KEY is not configured; proxy requests may fail.');
}

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieSession({ name: 'amg_sess', keys: SESSION_KEYS, maxAge: 24 * 60 * 60 * 1000 }));

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();

  if (!ADMIN_TOKEN) return next();
  const token = req.get('X-Admin-Token') || '';
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      req.session.isAdmin = true;
      req.session.user = username;
      return res.json({ ok: true });
    }

    if ((ADMIN_PASSWORD.startsWith('$2b$') || ADMIN_PASSWORD.startsWith('$2a$')) && username === ADMIN_USER) {
      const match = await bcrypt.compare(password, ADMIN_PASSWORD);
      if (match) {
        req.session.isAdmin = true;
        req.session.user = username;
        return res.json({ ok: true });
      }
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/admin/logout', (req, res) => {
  req.session = null;
  return res.json({ ok: true });
});

async function forward(req, res, path, method = 'post') {
  try {
    const url = `${BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': DM_API_KEY
    };

    if (DM_API_SECRET) {
      headers['X-API-Secret'] = DM_API_SECRET;
    }

    const idem = req.get('X-Idempotency-Key');
    if (idem) {
      headers['X-Idempotency-Key'] = idem;
    }

    const axiosRes = await axios({ method, url, headers, data: req.body, timeout: 20000 });
    return res.status(axiosRes.status).json(axiosRes.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data || { error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

app.post('/proxy/purchase', requireAdmin, (req, res) => forward(req, res, '/api/developer/purchase'));
app.post('/proxy/bulk-purchase', requireAdmin, (req, res) => forward(req, res, '/api/developer/bulk-purchase'));
app.post('/proxy/verify-number', requireAdmin, (req, res) => forward(req, res, '/api/developer/verify-number'));
app.post('/proxy/verify-number/bulk', requireAdmin, (req, res) => forward(req, res, '/api/developer/verify-number/bulk'));
app.get('/proxy/balance', requireAdmin, (req, res) => forward(req, res, '/api/developer/balance', 'get'));
app.get('/proxy/data-packages', requireAdmin, (req, res) => {
  const q = req.query.network ? `?network=${encodeURIComponent(req.query.network)}` : '';
  return forward(req, res, `/api/developer/data-packages${q}`, 'get');
});
app.get('/proxy/order-status/:reference', requireAdmin, (req, res) => forward(req, res, `/api/developer/order-status/${encodeURIComponent(req.params.reference)}`, 'get'));

app.post('/proxy/withdrawals', requireAdmin, async (req, res) => {
  try {
    const idempotency = req.get('X-Idempotency-Key') || req.body.idempotencyKey;
    if (!idempotency) {
      return res.status(400).json({ error: 'X-Idempotency-Key required' });
    }
    if (!SIGNING_SECRET) {
      return res.status(500).json({ error: 'SIGNING_SECRET not configured' });
    }

    const timestamp = Date.now().toString();
    const path = '/api/developer/v1/withdrawals';
    const raw = JSON.stringify(req.body);
    const payload = `${timestamp}.POST.${path}.${raw}`;
    const signature = crypto.createHmac('sha256', SIGNING_SECRET).update(payload).digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': DM_API_KEY,
      'X-Idempotency-Key': idempotency,
      'X-Timestamp': timestamp,
      'X-Signature': signature
    };

    const axiosRes = await axios.post(`${BASE}${path}`, req.body, { headers, timeout: 20000 });
    return res.status(axiosRes.status).json(axiosRes.data);
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data || { error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
});

app.post('/webhook', (req, res) => {
  const sig = req.get('X-DataMart-Signature') || '';
  if (WEBHOOK_SECRET) {
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody || '').digest('hex');
    if (sig !== expected) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    functions.logger.warn('WEBHOOK_SECRET not configured; skipping webhook verification');
  }

  functions.logger.info('Webhook event received', { event: req.body.event, data: req.body.data || req.body });
  return res.json({ received: true });
});

app.get('/status', (req, res) => {
  res.json({ ok: true, adminSession: !!req.session?.isAdmin });
});

exports.api = functions.runWith({ maxInstances: 10 }).https.onRequest(app);
