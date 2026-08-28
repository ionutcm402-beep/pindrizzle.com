# Pindrizzle CSP origin inventory

This document separates origins used directly by the browser from origins used only by server-side code. It exists so a future full `Content-Security-Policy` can be enabled without guessing and accidentally breaking Map, realtime, media or payments.

## Current minimal blocking CSP

Production can safely enforce these directives without restricting resource loading:

```text
base-uri 'self'; object-src 'none'; frame-ancestors 'none'
```

A full `default-src` policy should only be enabled after rendered-browser verification on Feed, Map, Search, pin detail, photo media, realtime updates and installed/PWA mode.

## Browser-required origins

### Same origin

`'self'` is required for:

- Next.js scripts and route data
- CSS and local assets
- Pindrizzle API routes
- service worker (`/ping-sw.js`)
- manifest and icons
- push settings/API calls
- place lookup (`/api/location/place`)

### Supabase

Production currently uses the project host from `NEXT_PUBLIC_SUPABASE_URL`:

```text
https://qagbhjilnakmjrdvxodr.supabase.co
wss://qagbhjilnakmjrdvxodr.supabase.co
```

A future full policy will need the HTTPS origin for REST/auth/storage and the WSS origin for realtime subscriptions.

Likely directives:

```text
connect-src 'self' https://qagbhjilnakmjrdvxodr.supabase.co wss://qagbhjilnakmjrdvxodr.supabase.co ...
img-src 'self' data: blob: https://qagbhjilnakmjrdvxodr.supabase.co ...
media-src 'self' https://qagbhjilnakmjrdvxodr.supabase.co ...
```

### OpenFreeMap / MapLibre

The browser fetches Pindrizzle's OpenMapTiles vector source and glyph PBFs from:

```text
https://tiles.openfreemap.org
```

MapLibre also uses browser workers; a full policy should preserve worker support, normally with:

```text
worker-src 'self' blob:
```

OpenFreeMap belongs in `connect-src` because vector tiles/glyph resources are fetched by MapLibre.

### Inline Next.js / styled-jsx output

The current application uses Next.js client hydration and styled-jsx/global inline styles. A strict `script-src`/`style-src` policy will need either a nonce/hash strategy or temporary inline allowances. Do not add a restrictive script/style policy without browser verification.

## Server-only external origins

These do **not** need browser CSP permission unless the implementation changes.

### OpenStreetMap Nominatim

Reverse geocoding is performed by the server route `/api/location/place`, not directly by the browser:

```text
https://nominatim.openstreetmap.org
```

The browser only calls the same-origin Pindrizzle API route.

### Stripe

Stripe currently uses the server-side `stripe` package. The dedicated Pindrizzle Stripe-account gate must remain enabled before any Stripe API use.

Server-side API traffic does not require browser `connect-src`. If future Checkout or Stripe.js is enabled, re-audit for origins such as Stripe-hosted checkout/scripts before tightening `script-src`, `frame-src`, `connect-src` or `form-action`.

### Web Push delivery

Push delivery is server-side through subscription endpoint URLs. The browser only manages its local service worker/subscription and Pindrizzle same-origin APIs.

## Full-CSP activation checklist

Before replacing the minimal policy with a full resource policy, verify at minimum:

1. Feed loads nearby data and realtime refreshes.
2. Map loads vector tiles, glyphs and MapLibre workers.
3. Search loads and opens pin detail.
4. Signed Supabase media renders.
5. Authentication/session refresh works.
6. Activity/realtime notifications work.
7. Service worker and installed website mode work.
8. Photo upload works.
9. Stripe is re-audited if payments are being enabled.
10. No CSP violations appear in the browser console for required functionality.
