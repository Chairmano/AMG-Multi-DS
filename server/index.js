#!/usr/bin/env node
/* Express proxy to keep DataMart secrets server-side
   - Protects API keys and signing secrets
   - Forwards requests from the admin UI or trusted clients
   - Simple admin token protection via X-Admin-Token
*/
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cookieSession = require('cookie-session');
const bcrypt = require('bcrypt');
const app = express();
const path = require('path');

const PORT = process.env.PORT || 4000;
const BASE = 'https://api.datamartgh.shop';

const DM_API_KEY = process.env.DM_API_KEY || '';
const DM_API_SECRET = process.env.DM_API_SECRET || '';
const SIGNING_SECRET = process.env.SIGNING_SECRET || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ADMIN_USER = process.env.ADMIN_USER || 'amgadmin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'amg123';
const SESSION_KEYS = (process.env.SESSION_KEYS || 'dev_key').split(',');

if (!DM_API_KEY) console.warn('Warning: DM_API_KEY not set. Proxy will forward but requests may be rejected.');

// capture raw body for webhook signature verification
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// cookie session for admin login
app.use(cookieSession({ name: 'amg_sess', keys: SESSION_KEYS, maxAge: 24 * 60 * 60 * 1000 }));

// Serve workspace static files so the admin UI can be loaded from the proxy origin
const STATIC_ROOT = path.join(__dirname, '..');
app.use(express.static(STATIC_ROOT));
app.get('/admin', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'pages', 'admin.html')));

function requireAdmin(req, res, next) {
  // If session shows admin, allow
  if (req.session && req.session.isAdmin) return next();

  // Fallback to header token for compatibility/testing
  if (!ADMIN_TOKEN) return next(); // no token configured — allow
  const t = req.get('X-Admin-Token') || '';
  if (t !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Admin login route — sets a session cookie
app.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    // Compare with env-configured admin creds. For demonstration we use bcrypt compare if password is hashed.
    if (password === ADMIN_PASSWORD && username === ADMIN_USER) {
      req.session.isAdmin = true;
      req.session.user = username;
      return res.json({ ok: true });
    }

    // If ADMIN_PASSWORD appears to be a bcrypt hash, try compare
    if (ADMIN_PASSWORD.startsWith('$2b$') || ADMIN_PASSWORD.startsWith('$2a$')) {
      const match = await bcrypt.compare(password, ADMIN_PASSWORD);
      if (match && username === ADMIN_USER) {
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
  res.json({ ok: true });
});

async function forward(req, res, path, method = 'post') {
  try {
    const url = `${BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': DM_API_KEY
    };
    if (DM_API_SECRET) headers['X-API-Secret'] = DM_API_SECRET;
    // propagate idempotency key from client if present
    const idem = req.get('X-Idempotency-Key');
    if (idem) headers['X-Idempotency-Key'] = idem;

    const axiosRes = await axios({ method, url, headers, data: req.body, timeout: 20000 });
    res.status(axiosRes.status).json(axiosRes.data);
  } catch (err) {
    if (err.response) {
      res.status(err.response.status).json(err.response.data || { error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
}

// Basic proxy endpoints
app.post('/proxy/purchase', requireAdmin, (req, res) => forward(req, res, '/api/developer/purchase'));
app.post('/proxy/bulk-purchase', requireAdmin, (req, res) => forward(req, res, '/api/developer/bulk-purchase'));
app.post('/proxy/verify-number', requireAdmin, (req, res) => forward(req, res, '/api/developer/verify-number'));
app.post('/proxy/verify-number/bulk', requireAdmin, (req, res) => forward(req, res, '/api/developer/verify-number/bulk'));
app.get('/proxy/balance', requireAdmin, async (req, res) => forward(req, res, '/api/developer/balance', 'get'));
app.get('/proxy/data-packages', requireAdmin, async (req, res) => {
  const q = req.query.network ? `?network=${encodeURIComponent(req.query.network)}` : '';
  return forward(req, res, `/api/developer/data-packages${q}`, 'get');
});
app.get('/proxy/order-status/:reference', requireAdmin, async (req, res) => forward(req, res, `/api/developer/order-status/${encodeURIComponent(req.params.reference)}`, 'get'));

// Withdrawals — sign server-side
app.post('/proxy/withdrawals', requireAdmin, async (req, res) => {
  try {
    const idempotency = req.get('X-Idempotency-Key') || req.body.idempotencyKey;
    if (!idempotency) return res.status(400).json({ error: 'X-Idempotency-Key required' });
    if (!SIGNING_SECRET) return res.status(500).json({ error: 'SIGNING_SECRET not configured on server' });

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
    res.status(axiosRes.status).json(axiosRes.data);
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data || { error: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Webhook receiver — verify signature
app.post('/webhook', (req, res) => {
  const sig = req.get('X-DataMart-Signature') || '';
  if (!WEBHOOK_SECRET) {
    console.warn('WEBHOOK_SECRET not configured — skipping verification');
  } else {
    const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody || '').digest('hex');
    if (sig !== expected) return res.status(401).json({ error: 'Invalid signature' });
  }

  // process webhook (for now, just log and ack)
  console.log('Webhook event:', req.body.event || req.get('X-DataMart-Event'));
  console.log(JSON.stringify(req.body.data || req.body, null, 2));
  res.json({ received: true });
});

app.get('/', (req, res) => res.sendFile(path.join(STATIC_ROOT, 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => console.log(`DataMart proxy listening on http://localhost:${PORT}`));
}

module.exports = { app };
