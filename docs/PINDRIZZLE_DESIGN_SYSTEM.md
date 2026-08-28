# Pindrizzle Design System

This is the canonical visual contract for Pindrizzle. It is derived from the supplied Pindrizzle identity and is enforced in code by `app/pindrizzle-design-system.css`, `app/pindrizzle-design-system-routes.css`, and `app/pindrizzle-design-system-final.css`.

The supplied logo/icon assets are immutable. Do not redraw, regenerate, stylise, recolour or replace them.

## 1. Wordmark

Public prose uses **Pindrizzle**. The visual wordmark is always lowercase **pindrizzle** and uses one exact treatment:

- size: `22px`
- weight: `790`
- tracking: `-0.052em`
- line height: `.95`
- colour direction: navy `#082b49` → blue `#2f83d6` → aqua `#25bdc8`
- visual wordmark only; never alter the supplied logo artwork

The same visual treatment is used in app headers, auth surfaces and the documented auth-email templates.

## 2. Palette

Core product colours:

- Ink 950: `#061f36`
- Ink 900: `#082b49`
- Ink 800: `#0d3d60`
- Blue 600: `#2f83d6`
- Blue 500: `#3698e5`
- Aqua 500: `#25bdc8`
- Aqua 400: `#55cad3`
- Aqua 100: `#e6f8fa`
- Silver 300: `#dbe6eb`
- Silver 200: `#e8eff2`
- Silver 100: `#f4f8fa`
- Canvas: `#eef5f7`
- Coral: `#ef6f64`
- Amber: `#e5a64d`

Do not introduce new decorative brand colours for ordinary UI.

## 3. Spacing

Only this spacing scale is used for product layout:

- 4px
- 8px
- 16px
- 24px
- 32px

New components should consume the `--pd-space-*` tokens. Avoid one-off padding/margin values unless required for an optical or native safe-area correction.

## 4. Two layout patterns

### Moment

Use for one-purpose states:

- onboarding
- empty states
- location-required states
- confirmation/success/error states
- offline state
- signed-out prompts

Structure: centered visual/icon → headline → short support copy → one primary CTA. Optional tertiary dismissal may be used only when the flow genuinely needs it.

### Content

Use for scannable information and management:

- Feed
- Map overlays/controls
- My Pins
- Activity
- Notifications settings
- You/settings
- Following
- Search
- Local area snapshot
- Business/Promote
- public profile
- legal pages

Structure: left-aligned hierarchy, predictable spacing, cards/lists only where they improve scanning.

Never mix Moment and Content composition in the same state.

## 5. Buttons

There are exactly three action styles:

### Primary

- solid Ink 900 / navy
- white text
- pill radius
- minimum 44px touch height
- used for the main action only

### Secondary

- light/white surface
- Ink 800 text
- subtle outline
- pill radius
- minimum 44px touch height

### Tertiary

- text-only
- teal/navy accent text
- no card-like background
- minimum 44px touch target where interactive

Tabs, chips, switches and icon-only controls are selection/navigation controls, not extra button styles.

## 6. Iconography

Use `components/PingIcon.tsx` for product icons.

- line-based SVG only
- stroke weight: `1.75`
- rounded line caps/joins
- navy default
- aqua/blue active/accent states
- no emoji or mixed third-party icon families in customer-facing UI

Map pins are a simplified flat interpretation of the location-pin form in the supplied logo. They are not copies or redraws of the logo artwork.

## 7. Depth

Exactly three elevation levels:

1. cards/content surfaces: `--pd-elevation-1`
2. floating navigation/map chrome: `--pd-elevation-2`
3. sheets/dialogs: `--pd-elevation-3`

Avoid arbitrary one-off shadows and heavy gloss.

## 8. Map

Both the main nearby Map and any location picker use `lib/pindrizzle-map-style.ts`.

Map language:

- muted navy/grey land base
- aqua/teal water
- restrained blue/aqua road hierarchy
- quiet label colours
- low-value POI/transit clutter suppressed
- category-coded flat Pindrizzle-style pins
- compact attribution remains visible as required by map data/style providers

Do not reintroduce a stock MapLibre/OpenStreetMap visual style on any customer-facing map surface.

## 9. Native shell

The design system operates inside the Capacitor-ready shell:

- `100dvh/100svh`
- safe-area insets
- persistent bottom tab bar
- internal screen scrolling
- full-width bottom sheets
- minimum ~44px tap targets
- restrained 180–240ms transitions

Do not design around a floating desktop browser card and then shrink it for mobile.

## 10. Exceptions

Internal moderation and operations consoles are functional tooling, not customer-facing Pindrizzle product surfaces. They may retain denser operational presentation until a dedicated internal-tools pass. They must never leak legacy public branding into customer-facing routes.

Any new customer-facing route must conform to this document before merge.
