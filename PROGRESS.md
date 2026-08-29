# Pindrizzle current-state inventory

Audit date: 28 August 2026  
Baseline audited: `main` at `0a6df90`  
Scope: pre-map-first cleanup audit. No component, CSS, route, migration, or database data was deleted.

## Locked product decisions — 29 August 2026

- **Local Chat is kept.** It is an intentional product feature, not cleanup or removal work. The existing implementation already includes moderation integration, legal disclosures, radius-based visibility, reporting/blocking, rate limits and retention/anonymisation safeguards. Do not remove its route, components, database objects or legal copy unless this decision is explicitly revisited.
- **The Feed at `/feed` is kept as a secondary page.** The Map remains the home screen, while Feed continues to provide a list-based view of nearby pins. Do not remove it during map-first cleanup. Revisit only if it becomes clearly redundant after the Map experience is more complete.

## Map posting and pin-detail UX fixes — 29 August 2026

- “Drop a pin” now requests the existing composer directly on the Map home screen. It no longer sends the normal posting journey through the blank `/compose-start` screen or through `/feed`.
- The Map reuses the established Feed composer, publishing RPC, photo upload behavior, authentication prompt, location requirement and Private/Exact location bridge. No database, auth, RLS or moderation behavior changed.
- `/compose-start` remains as a compatibility preflight for old links, but its successful handoff now targets `/#ping`. Legacy `/feed#ping` links are redirected to the Map composer.
- A community marker click now only selects that marker and opens the lightweight `.map-v3-card`. It no longer dispatches `ping:open-detail` at the same time.
- The lightweight card’s explicit **Open →** button is the sole Map action that opens `Phase5PingDetail` for full details, replies, reporting and blocking.
- Nearby Places behavior is unchanged: its markers still open one lightweight public-place card and never invoke the community-pin detail sheet.

## Marketplace listing types — Step 3, 29 August 2026

- Marketplace creation now uses one flexible form with four clear listing types: **For Sale**, **To Rent**, **Car**, and **Parking Space**.
- The new choices reuse the existing Marketplace metadata fields and posting RPC. No table, enum, migration, RLS, auth or moderation change was needed.
- Price entry adapts to the selected type: **Price** for For Sale and Car; **£/month** for To Rent and Parking Space. Free remains a separate category and still has no price field.
- The form deliberately has no bedrooms, mileage, make/model, parking restrictions or other specialist fields. Add a specialist field only after real usage shows that it is necessary.
- Editing a Marketplace post uses the same four-type presentation. Older unsupported Marketplace combinations remain readable and are not converted unless the owner deliberately selects one of the new types.
- Map and Feed filters now share a listing-type preference for the four new choices. The Map exposes them both as quick chips and in the detailed filter sheet.
- Marketplace map pins use listing-specific icons and colours. For Sale, To Rent, Car and Parking Space are distinguishable from one another and from the square utility markers used by the OpenStreetMap Nearby Places layer.
- Existing Marketplace rows remain compatible. The four frontend choices map to the established `marketplace_type`, `marketplace_intent`, `marketplace_subtype` and `marketplace_price_period` values.

## Map-first home restructure — 28 August 2026

- The existing MapLibre experience is now the home screen at `/`.
- The same map remains available at `/map` for compatibility with existing links.
- The previous Feed implementation was preserved at `/feed`; no Feed query, posting, promotion, retention or detail logic was deleted.
- Existing `nearby_map_pings` data and `LivePingMap` marker rendering are reused unchanged. No new data source or category was introduced.
- Radius choices (0.5, 1, 3 and 5 miles) and horizontally scrollable category chips now sit together in the floating map overlay. The detailed filter sheet remains available, including existing Marketplace filters.
- Selecting a marker opens the lightweight Map card. Its explicit **Open →** action dispatches `ping:open-detail` to the existing global `Phase5PingDetail` sheet.
- Primary navigation now treats Map as home and keeps Feed as a secondary destination alongside Chat, My Pins, Activity and You.
- Feed-only phase bridges now recognise `/feed` instead of `/`, and product analytics/accessibility route labels distinguish Map home from the secondary Feed.
- The authenticated posting preflight now hands off to `/#ping`, where the existing composer opens over the Map.
- This step changed frontend routing/components only. Database schema, migrations, authentication, RLS and moderation code were not changed.

## Nearby Places map layer — 28 August 2026

- Added an independent OpenStreetMap/Overpass public-place layer for `amenity=toilets`, `amenity=restaurant`, `leisure=park` and `leisure=playground`.
- Added `GET /api/places/nearby`, which validates and rounds the requested location, limits the radius to the product’s existing 5-mile maximum, queries Overpass once for all four categories, excludes explicitly private/no-access elements, normalises nodes/ways/relations and returns the nearest 500 results at most.
- Overpass responses use a 10-minute in-memory server cache plus `s-maxage=600`/stale revalidation headers. The map also keeps a 10-minute `sessionStorage` cache per rounded location and radius, so filter changes and ordinary rerenders do not query Overpass again.
- Nearby-place markers are rendered separately from Pindrizzle markers with category-specific colours and utility icons. They do not use or modify the Pings/Marketplace data path.
- Added independent Toilets, Food, Parks and Playgrounds toggles to the map chips and detailed filter sheet.
- Tapping an OpenStreetMap place opens a lightweight card with its name, category, distance, attribution and a link to the source OSM element. It does not open seller, price, reply or community-action controls.
- No database schema, Pindrizzle category, auth, RLS or moderation changes were made.

## What changed in this pass

- New-pin category choices are now limited to **Free**, **Deals**, **Marketplace**, and **Other local**.
- **Alert**, **Traffic**, **Outages**, **Events**, **Help**, and **Lost & Found** remain in the shared category types, definitions, icons, filters, map rendering, and database-compatible paths. Existing posts in those categories therefore remain viewable.
- The composer now starts on **Free**, the first allowed new category, instead of the retired **Alert** choice.
- No database migration was added and no existing rows were changed.

This was straightforward: the creation picker now has its own order (`CREATE_CATEGORY_ORDER`) while the read/display order (`CATEGORY_ORDER`) remains intact. Reusing one list for both creation and display would have hidden historical categories from filters, so the lists are deliberately separate.

## Phase component inventory (23 files)

“Used” means imported by a reachable app layout/page or by `ProductClientRuntime`. It does not mean the feature belongs in the next product direction.

| Component | Runtime status | What it does | Direction note |
|---|---|---|---|
| `Phase5PingDetail` | Used globally | Opens the pin detail sheet and loads the live pin, photo, replies, confirmations, Helpful state, reporting and blocking. | Core reusable pin infrastructure; not inherently tied to the old Feed. |
| `Phase6NotificationBadge` | Used globally | Subscribes to notification inserts, shows toast/badge activity, and links to Activity. | Live activity feature; review later if Activity is removed. |
| `Phase7ContributorContext` | Used when a pin detail opens | Adds contributor/profile and reputation context to the detail experience. | Detail enhancement, reusable outside the old Feed. |
| `Phase7VisibilityBridge` | Used on Feed, Map, Search and Following | Keeps pin visibility in sync after blocks, reports, resolves and promotion changes. | Shared data-consistency bridge; Map still depends on it. |
| `Phase8FollowBridge` | Used when a pin detail opens | Adds follow/unfollow and owner resolution controls to a pin detail. | Follow/retention feature; product decision needed. |
| `Phase8NearbyPulse` | Used on Feed only | Inserts a “busier than usual” card above the old filter row and scrolls to the Feed list. | Strongly coupled to the old Feed/filter DOM; likely replacement candidate. |
| `Phase8SinceLastVisit` | Used on Feed only | Shows counts of nearby pins/replies/confirmations/Helpful activity since the signed-in user’s last visit. | Feed-retention feature; likely redesign or removal candidate. |
| `Phase9CheckoutPanel` | Used on `/promote` | Lists approved unpaid promotions, launches Stripe Checkout, and verifies returned payment sessions. | Promotion/payment feature, separate from map-first core. Keep live payments disabled unless separately approved. |
| `Phase9PromotedLocal` | Used on Feed only | Fetches one local promoted pin, records impressions/opens, and inserts it above the old filter row. | Strongly coupled to old Feed DOM; replacement candidate even if promotion returns later. |
| `Phase14SearchEntry` | Used on Feed only | Renders a fixed shortcut from Feed to `/search`. | Old Feed chrome; likely replacement candidate. |
| `Phase15PlaceIntelligence` | Used on Feed only | Resolves/caches a human-readable area label and mutates the Feed location pill into a link to `/place`. | Useful place logic wrapped in old Feed DOM mutation; refactor candidate for map-first. |
| `Phase16PushSafetyBridge` | Used globally | Unsubscribes the local web-push subscription on sign-out. | Small safety cleanup; keep while push exists. |
| `Phase16PushSettings` | Used on `/notifications` | Manages browser push support, permission, subscription registration, device count, and notification preferences. | Used notification settings feature. |
| `Phase18BusinessShortcut` | Used on `/promote` | Portals a link to the promoter dashboard into the promotion intro. | Promotion-only and coupled to a specific DOM host. |
| `Phase19ProductAnalytics` | Used globally | Records consent-gated route and product events, including Feed, Map, Search, Chat and promotion events. | Used, but event vocabulary contains features that may be retired. |
| `Phase21AccessibilityBridge` | Used in root layout | Sets route titles, adds skip/focus behavior, announces navigation and traps focus in dialogs. | Shared accessibility infrastructure; route-name list needs future cleanup when routes change. |
| `Phase22LegalSettingsEntry` | Used on `/you` | Adds legal/privacy/storage controls to the You screen. | Supports a retained core screen. |
| `Phase22StorageChoice` | Used globally; helpers also imported elsewhere | Shows analytics allow/decline choice and exports storage-choice helpers used by analytics/settings. | Shared privacy/consent infrastructure. |
| `Phase23InstallEntry` | **Unused** | A self-contained install/PWA entry panel intended to be inserted into settings. | Only confirmed dead `PhaseN` component; superseded by other install entry points. Do not delete until approved. |
| `Phase23PwaBridge` | Used in root layout | Registers the service worker, handles install/update state and PWA lifecycle events. | Shared install/runtime infrastructure. |
| `Phase24BetaBridge` | Used globally | Enforces/synchronises closed-beta state and beta access behavior. | Still active while the product remains closed beta. |
| `Phase25BetaRoute` | Used by `/beta` | Supplies the closed-beta page UI and access/invite flow. | Still active closed-beta infrastructure. |
| `Phase25LocationChoiceBridge` | Used on Map and Feed | Adds the approximate/exact location choice into the shared composer and passes the choice to publishing. | Retained posting/privacy behavior shared by both composer hosts. |

### Phase audit conclusion

- **22 of 23** files are reachable in the current application.
- **1 of 23** is unused: `Phase23InstallEntry`.
- Several “used” files are nevertheless old-direction coupling points: `Phase8NearbyPulse`, `Phase8SinceLastVisit`, `Phase9PromotedLocal`, `Phase14SearchEntry`, `Phase15PlaceIntelligence`, and `Phase25LocationChoiceBridge`.
- `Phase5PingDetail`, `Phase7VisibilityBridge`, accessibility, privacy/consent, beta, PWA and push-safety bridges provide reusable infrastructure and should not be treated as dead just because their names contain a phase number.

## CSS inventory

There are **33 CSS files under `app/`**, not 31: **31 global/root CSS files** plus two route-scoped CSS modules (`app/my-pings/my-pings.module.css` and `app/you/you.module.css`). All 33 are imported. The global cascade has many overlapping migration, premium, audit, regression and final-override layers, so deleting a broadly named file without visual QA would be risky.

Status labels:

- **Retain**: primarily styles a screen/capability that still exists in the stated direction.
- **Replace candidate**: primarily styles old Feed, old bottom navigation, or old filter presentation.
- **Mixed / split first**: contains both retained and replacement selectors; do not delete wholesale.

### 31 global/root CSS files

| CSS file | Status | What it currently styles |
|---|---|---|
| `app/accessibility.css` | Mixed / split first | Global focus, touch targets, reduced motion, safe areas and dialog behavior, plus legacy bottom-nav, Feed card/filter and old shell selectors. |
| `app/globals.css` | Mixed / split first | Original base shell and most legacy UI: old Feed cards/filter row, old bottom nav, composer, map mock styles, basic profile and activity cards. It also contains still-needed resets and base typography. |
| `app/legal.css` | Retain | Privacy, terms, cookies, safety and compliance page shells/forms. |
| `app/pindrizzle-brand.css` | Retain | Brand tokens and Pindrizzle naming/colour treatment shared across current routes. |
| `app/pindrizzle-design-system-audit.css` | Mixed / split first | Late audit corrections across multiple current screens and legacy selectors; part of the override cascade. |
| `app/pindrizzle-design-system-final.css` | Mixed / split first | Broad “final” overrides spanning Feed, navigation, composer and retained routes. |
| `app/pindrizzle-design-system-routes.css` | Mixed / split first | Route-level Pindrizzle treatment across Map, My Pins, You, Auth and additional legacy/product routes. |
| `app/pindrizzle-design-system.css` | Mixed / split first | Shared design tokens/components plus Feed/navigation/filter-era rules. |
| `app/pindrizzle-functional-fixes.css` | Mixed / split first | Late functional/visibility fixes across the current shell; includes Map/current-route guards and legacy navigation/feed fixes. |
| `app/pindrizzle-native-shell.css` | Retain | Native/mobile shell, safe-area and runtime-specific presentation. |
| `app/pindrizzle-premium-auth.css` | Retain | Password authentication and reset-password presentation. |
| `app/pindrizzle-premium-business.css` | Retain for existing route; non-core | Business/promotion screens, which still exist but are outside the stated map-first core. |
| `app/pindrizzle-premium-layout-fixes.css` | Mixed / split first | Cross-route layout fixes including retained pages and old global navigation assumptions. |
| `app/pindrizzle-premium-my-pins.css` | Retain | My Pins screen styling. |
| `app/pindrizzle-premium.css` | Mixed / split first | Large premium layer covering Feed, composer, filters, navigation, Map and shared controls. Major split candidate. |
| `app/pindrizzle-regression-fixes.css` | Retain while onboarding exists | Guards onboarding and responsive behavior broken by later override layers. |
| `app/pindrizzle-signature-moments-final.css` | Mixed / split first | Final visual moments for Feed empty state, Map and My Pins. |
| `app/pindrizzle-signature-moments.css` | Mixed / split first | App-open/publish/refresh animation moments across Feed, Map, Search and My Pins. |
| `app/pindrizzle-wide-layout.css` | Mixed / split first | Desktop layouts for Feed, filters, Map, My Pins and You. Retained-route rules must be separated before Feed removal. |
| `app/ping-alerts-system.css` | Retain for existing route; non-core | Activity/alerts screen presentation. “Alerts” here means user activity notifications, not the retired Alert post category. |
| `app/ping-business-system.css` | Retain for existing route; non-core | Promote and business dashboard screens. |
| `app/ping-design-system.css` | Mixed / split first | Foundational tokens, shell, global nav, controls and older Feed/filter/auth rules used by later layers. |
| `app/ping-detail-system.css` | Retain, with old composer coupling | Pin detail and composer migration layer; detail remains reusable, composer will need map-first adaptation. |
| `app/ping-internal-system.css` | Retain | Internal operations/moderation baseline. |
| `app/ping-map-system.css` | Retain | Live Map screen, location state, map filters, map controls and map detail/card layout. |
| `app/ping-onboarding-system.css` | Retain | Auth, first-run onboarding and install/PWA screens. |
| `app/ping-polish-system.css` | Mixed / split first | Late cross-product polish for old navigation, Feed/filter/composer and retained Map/Search/You/business/detail screens. |
| `app/ping-search-system.css` | Retain for existing route | Search and place-discovery presentation; likely relevant to nearby places even if redesigned. |
| `app/ping-utility-system.css` | Retain | Public profile, Following and notification settings. |
| `app/ping-you-system.css` | Retain | You/settings screen. |
| `app/site-shell.css` | Mixed / split first | Current desktop header/shell and retained route layout, but also explicitly hides/replaces the old bottom nav and contains Feed/composer compatibility rules. |

### Route-scoped CSS modules (additional two)

| CSS file | Status | What it currently styles |
|---|---|---|
| `app/my-pings/my-pings.module.css` | Retain | Current My Pins route, tabs, cards, owner actions and empty/error states. |
| `app/you/you.module.css` | Retain | Current You route, profile summary, stats and settings/actions. |

### CSS audit conclusion

- The old Feed list, filter row and bottom navigation are not isolated in three removable files. Their selectors are spread through `globals.css`, both design systems, premium layers, polish, wide-layout, accessibility and site-shell overrides.
- Map, My Pins, You and Auth do have identifiable dedicated files, but they also rely on shared tokens and late overrides.
- Safe cleanup should first move retained shared rules into a small, explicit base and route-owned files, verify each retained route visually, and only then remove the legacy selectors/layers. Wholesale deletion now would be more complex and risky than the requested audit-only step allows.

## Local Chat inventory

This is not just a stub. A substantial, integrated Local Chat feature exists.

### Front end and routing

- `app/chat/page.tsx`: a full nearby group-chat client. It requires authentication and location; shares the 0.5/1/3/5 mile radius preference; loads/paginates messages; subscribes to Realtime; sends, edits and soft-deletes own messages; reports messages; blocks authors; shows moderation notices; and emits analytics events.
- `app/chat/layout.tsx`: route metadata/layout for `/chat`.
- `SiteHeader`, `ProductClientRuntime`, accessibility route names and current shell/navigation code still recognise `/chat`.

### Database and server behavior

- `supabase/migrations/084_local_chat_foundation.sql` creates `chat_messages`, `chat_message_hides` and short-lived `chat_viewer_scopes`.
- The migration adds row-level security and helper functions for radius-based visibility and blocked/hidden content.
- RPCs include `chat_set_viewer_scope`, `nearby_chat_messages`, `post_chat_message`, `report_chat_message`, `my_chat_moderation_notices` and `purge_expired_chat_messages`.
- It integrates chat reports into the existing moderation queue/history, enables Realtime for `chat_messages`, adds analytics event types, rate limits posting, and schedules 90-day retention/anonymisation cleanup.
- `supabase/migrations/085_local_chat_report_compatibility.sql` extends existing report anti-abuse triggers to support either a pin or a chat message safely.

### Cross-feature integration

- `app/moderation/page.tsx` moderates pins and chat messages in one queue.
- Privacy, Terms and Safety pages contain detailed Local Chat disclosures, retention language and community rules.
- `Phase19ProductAnalytics` contains Chat view/send/report/block events.
- `Phase21AccessibilityBridge` names the Chat route.

### Chat conclusion

Local Chat is **implemented end-to-end in source**, not merely half-built. This audit did not verify whether migrations 084–085 have been applied to the connected production Supabase project or whether real users have chat rows; that requires an environment/database check outside this code-only cleanup. Removing Chat later would require a coordinated route, navigation, analytics, moderation, legal-copy and database-retention decision. Do not simply delete `app/chat`.

## Recommended deletion decision points (no deletions made)

1. Decide whether the old Feed is removed entirely or becomes a map-adjacent results/list panel. That determines the fate of the six Feed-coupled Phase components and most mixed CSS.
2. Decide whether Following, Activity/push, promotions and Local Chat remain future features. They are separate feature clusters, not dead files.
3. Preserve `CATEGORY_DEFINITIONS` and database enum/check compatibility for historical data even if more creation categories are retired later.
4. When deletions are approved, use a branch/PR and visual QA for Map, My Pins, You and Auth because the CSS cascade is highly shared.
