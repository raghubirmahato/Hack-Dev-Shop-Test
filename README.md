# Hack-Dev-Shop-Test

A small, fictional computer-hardware web shop ("CoreByte") used as the **test target** for
Hack Dev Defence (HDD), a web application firewall and reverse proxy.

> **Lab only, deliberately vulnerable.** The admin login builds its SQL query by string concatenation on purpose, so a
> web application firewall can be demonstrated blocking the injection. All data is fake. Do not reuse this code, and do
> not put real data or real credentials in it.

## What it contains

- Storefront: categories, search, product pages, cart and checkout (no payment is taken).
- Admin panel at `/admin`: dashboard, orders, products, customers and team. Default lab login: `admin` / `admin`.
- Runs on Vercel as a single serverless function (`api/app.js`, in-memory sql.js database, so data resets on a cold start).

## Run locally

```bash
npm install
npm test
npm run dev        # http://127.0.0.1:8082
```

## Settings (environment variables)

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Admin password (default `admin`, lab only). |
| `SESSION_SECRET` | Key used to sign the admin session cookie. Set a random value on Vercel. |
| `SHOP_VULN` | Set to `0` to switch the login to a parameterised (fixed) query. |
| `HDD_ORIGIN_SECRET` (or `ORIGIN_SECRET_VALUE`) | The secret HDD sends in the `X-HDD-Origin-Secret` header. **The origin lock turns itself on whenever this is set**: a request without the right header is refused with a 403, so the shop can only be reached through the HDD proxy. Nothing to switch on or off. |
| `ORIGIN_SECRET_HEADER` | Header name (default `X-HDD-Origin-Secret`, matching HDD). |
| `ORIGIN_LOCKDOWN` | `0` is a manual escape hatch that turns the lock off (the shop is then reachable directly and is not protected). |

## Deploying

Pushing to `main` deploys to Vercel automatically once the Vercel project is connected to this repository.
