# Homepage network and motion preview

Updated: 2026-11-09. Local baseline: `e4bb8615e0b321e2d7ea60e40c22f7927b4b1729`. The user approved GitHub publication through the existing CI/Webhook deployment flow. No Figma write.

## Final requirements

The map contains exactly the eight user-selected metro nodes: Frankfurt, Singapore, Tokyo, Los Angeles, Virginia (Ashburn area), São Paulo, Sydney and Johannesburg. Eleven corridors form one connected network. Europe has one visible node.

Every 2.4 seconds, the illustration randomly chooses a new origin and a different destination; consecutive rounds cannot repeat the origin. A shortest-hop search chooses connected links through the depicted network. Signals take 1.7 seconds to reach the destination, with a 380 ms pulse at each intermediate city and the destination. This is illustrative routing, not a BGP or latency simulation.

At the user's explicit request, this map no longer stops because of the system reduced-motion preference. There was no visible reduced-motion settings option to remove. Offscreen and hidden-tab animation still stops. This exception applies only to the map: existing menus, headline motion and the ad carousel retain their established preference handling. Without JavaScript the map remains static. Mobile widths up to 760 px retain the compact layout with no map.

## Network model

These are composite metro-to-metro corridors using named submarine systems plus terrestrial backhaul, not claims that a single submarine cable terminates inside each city. Waypoints are authored schematic geography. Land segments show plausible regional connections rather than surveyed fibre paths or a verified commercial circuit. No real-time status, throughput, latency or universal “best cable” ranking is implied.

| Metro connection | Depicted corridor |
| --- | --- |
| Frankfurt ↔ Virginia | European land backhaul, Dunant (Saint-Hilaire-de-Riez–Virginia Beach), Virginia backhaul |
| Virginia ↔ Los Angeles | US terrestrial backbone corridor; drawn as a stronger dashed line |
| Los Angeles ↔ Tokyo | Hermosa Beach–Maruyama section of JUPITER, with metro backhaul |
| Tokyo ↔ Singapore | SJC2 (Chikura–Changi South), with metro backhaul |
| Singapore ↔ Sydney | INDIGO-West via Perth, then INDIGO-Central to Sydney |
| Sydney ↔ Los Angeles | Southern Cross NEXT |
| Virginia ↔ São Paulo | BRUSA to Rio de Janeiro plus Brazilian land backhaul |
| São Paulo ↔ Frankfurt | Brazilian land backhaul, EllaLink (Fortaleza–Sines), European land backhaul |
| Frankfurt ↔ Johannesburg | European land backhaul, Equiano (Sesimbra–Melkbosstrand), South African land backhaul |
| São Paulo ↔ Johannesburg | Brazilian backhaul, SACS to Sangano, WACS to Yzerfontein, South African backhaul |
| Frankfurt ↔ Singapore | European backhaul to Toulon, SEA-ME-WE 5 including its Egyptian terrestrial crossing, Singapore backhaul |

Submarine paths are solid; land paths are dashed. The US backbone has 1.4 px strokes and 0.75 opacity to remain visible against the map. Trans-Pacific paths split at the date line and continue at the opposite map edge; no line is drawn across the world to join those segments.

Cable-system metadata and geographic references were checked against TeleGeography's publisher-operated Submarine Cable Map API; exact source URLs are retained per link in the JSON. Twelve system metadata responses and source receipts are in `test-results/global-network/`. The SEA-ME-WE 5 operator map was also inspected; source: https://www.seamewe5.com/wp-content/uploads/TTi_poster_SMW5_A1_2019-1.jpg. The US land reference is https://www.zayo.com/network/. Provider maps establish general connectivity, not the exact authored land waypoints.

## Files and design rules

- `src/data/global-network.json`: all metro coordinates, label offsets, named links, land/sea segments and references. No review measurements are introduced.
- `src/data/world-land.json`: Natural Earth-derived land silhouette; provenance retained in the asset. Source: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson. Public-domain terms: https://www.naturalearthdata.com/about/terms-of-use/.
- `src/components/RouteArt.astro`: data rendering, connected-path selection and native Web Animations enhancement; no new dependency. The decorative SVG remains hidden from assistive technology.
- `src/styles/motion.css` and its BaseLayout import: brief readable headline entrance, menu opening and small icon feedback from the preceding local pass.
- Removed obsolete orbit/logo art styles from `global.css` and `home.css`.

Impeccable, Apple motion and Web Guidelines were used within the established Tokyo theme and reading layout. The user's explicit map autoplay instruction overrides the skills' reduced-motion recommendation for this component. Small SVG dash animations repaint; they are not described as compositor-only. Existing Inter and article quote-border detector warnings are outside this illustration scope.

## Validation

- `check`: 70 files, zero errors, warnings or hints. Build, format check, release verification and diff whitespace check passed. Empty post collection warnings remain expected.
- Graph check: all 56 directed city pairs are reachable. Eight browser rounds covered each city as origin and confirmed valid intermediate hops and direction.
- Route timing verified at 1.7 seconds, with an observed 2.394-second round interval.
- Separate Virginia → Los Angeles and Los Angeles → Virginia checks confirmed the direct US backbone path, reversed signal direction and stronger visible track.
- Segment endpoint and date-line checks passed; two cross-Pacific joins do not create cross-map chords.
- Ten viewport/theme combinations (320, 390, 768, 1024, 1440 px; light/dark) showed no horizontal overflow. Desktop screenshots inspected. Map autoplay works with system reduced motion enabled as requested; offscreen stop/resume verified.
- Earlier motion checks covered theme scroll stability, keyboard menu focus, no-JavaScript navigation and the unchanged ad carousel. Content/readable checks passed earlier in this local pass; no collection or content changes followed.
- `src/content/posts/` remains `.gitkeep` only. No server configuration changes are required. Physical-device performance is not certified.

Local preview: `http://127.0.0.1:4321/`. Build preview: `http://127.0.0.1:4323/`.

OpenViking: `viking://resources/projects/lowendaff-ui/motion-preview.md`. The current full-text readback receipt is stored at `test-results/global-network/openviking-receipt.json`; older one-shot and 5.2-second behavior is superseded.

## Publication verification

The approved release uses the existing main push → Content validation → Deploy static site → signed Webhook → atomic static release flow. Before committing, formatting, type checks, build, content/release checks, 10 readable-parser tests and 7 deployment tests passed. The previous live release was `e4bb8615e0b321e2d7ea60e40c22f7927b4b1729`; the receiver was active with zero restarts. Final commit, CI runs, server release and public browser verification are recorded in `test-results/motion-deploy/final-receipt.json` after deployment, avoiding a follow-up documentation-only deployment. The site retains noindex and an empty article collection.
