DataMart proxy

This small Express proxy forwards requests to DataMart while keeping API keys and signing secrets on the server.

Usage

1. Copy `.env.example` to `.env` and fill in secrets.
2. Install dependencies: `npm install`
3. Start the proxy: `npm run start:server`

Endpoints

- `POST /proxy/purchase` — forward purchase requests (requires `X-Admin-Token` if configured)
- `POST /proxy/bulk-purchase`
- `POST /proxy/verify-number`
- `GET /proxy/balance`
- `GET /proxy/order-status/:reference`
- `POST /proxy/withdrawals` — server signs HMAC automatically
- `POST /webhook` — webhook receiver with signature verification

Security

Set `ADMIN_TOKEN` to protect proxy endpoints used by the browser admin UI. Keep `DM_API_KEY` and `SIGNING_SECRET` secret and never commit them.
