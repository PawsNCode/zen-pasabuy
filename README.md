# Zen Pasabuy 🌸

Calm decisions, clear profits — a pricing calculator, inventory tracker, and customer order book for a Japan→Philippines pasabuy business.

**Live app:** https://pawsncode.github.io/zen-pasabuy/

## Features
- In-store pricing calculator (¥ first, ₱ alongside) with tiers, sourcing fees, buffer, and haggle room
- Inventory with photos, purchase batches (date + shop), and FIFO stock deduction
- Customer orders with a color-coded lifecycle: Sourcing → Ready → Dispatched → Received & Paid
- Monthly / yearly / all-time dashboards, search and filters
- Live JPY→PHP rate (free FX API) with manual override
- CSV export, full JSON backup/restore (photos included)

## Files
- `index.html` — the entire app, ready for GitHub Pages (React via CDN, data saved in the browser's localStorage)
- `zen-pasabuy.jsx` — the source component (edited here, then baked into `index.html`)

## Updating
Bump `APP_VERSION` and `APP_UPDATED` in both files, then:

```bash
git add .
git commit -m "vX.Y.Z: what changed"
git push
```

Open the app → Set-up → **Refresh to latest version** to pull the new build.
