# Spatial Architecture Explorer — Requirements

> A WebXR "Jarvis / Minority Report" spatial interface for understanding IT
> architecture: the **sectors**, the **applications** inside them, and the
> **architecture elements** and **data relations** that make up each application.

---

## 1. Goal

Help people understand an IT-architecture landscape — the elements, their
relations, and the data flowing between them — through an immersive, graphically
compelling 3D interface that runs **both in a desktop/mobile browser and on a
Meta Quest VR headset** (WebXR).

## 2. Source of truth

The page/navigation model is derived from `Pages.xlsx`. The spreadsheet defines
four pages and how the user moves between them:

| # | Page | Entered by | Purpose | Left column | Middle | Right column |
|---|------|-----------|---------|-------------|--------|--------------|
| 1 | **Landing Page** | Start the app | Show data of all applications | Details of all applications | List of all sectors | — |
| 2 | **Sector Overview** | Click a sector on Landing | Details of one sector | List of all sectors | Sector details in numbers | List of applications |
| 3 | **Application Page** | Click an application name | Details of one application | Application details in numbers | 3D model of architecture | 3D model of architecture |
| 4 | **3D Comparison** | Click "Compare in 3D", pick 1–2 apps | Compare two apps in 3D | 3D view of app A | — | 3D view of app B |

Everything not specified by the spreadsheet (concrete sectors, applications,
metrics, architecture elements and relations) is **mock data**, stored in a
single JSON file and rendered dynamically.

## 3. Domain model

- **Sector** — a business domain (e.g. Finance, Logistics). Has aggregate
  metrics and contains applications.
- **Application** — a software system belonging to one sector. Has metrics
  (uptime, latency, cost, users, incidents…) and an **architecture**.
- **Architecture element** — a node in an application's architecture
  (frontend, gateway, service, database, cache, queue, external system…).
  Each element is rendered as a **3D block**; its type drives shape and colour.
- **Relation** — a directed link between two elements, typed as `sync`,
  `async`, `data` or `auth`. Rendered as a glowing connector with animated
  "data packets" flowing along it; type drives the visual style.

## 4. Functional requirements

### 4.1 Navigation (state machine)
- FR-1 The app boots into the **Landing Page**.
- FR-2 Clicking a sector block opens the **Sector Overview** for that sector.
- FR-3 Clicking an application (from a sector's app list) opens the
  **Application Page** for that application.
- FR-4 From the Application Page, "Compare in 3D" opens the **3D Comparison**
  with the current app pre-selected as app A; the user picks app B.
- FR-5 A persistent **Back / Home** control returns to the previous / landing page.
- FR-6 A breadcrumb shows the current location (Landing › Sector › App).

### 4.2 Data display
- FR-7 Each page renders the left / middle / right content defined per the table
  above, fed entirely from the JSON.
- FR-8 Metrics are shown as holographic "numbers" panels (value + label + unit).
- FR-9 Lists (sectors, applications) are scrollable/paged sets of clickable rows.

### 4.3 3D architecture visualisation
- FR-10 An application's architecture renders as 3D blocks positioned in space,
  connected by relation links.
- FR-11 Relations animate to show direction and data flow (moving packets).
- FR-12 Hovering / pointing at an element highlights it and shows a tooltip
  with that element's details and metrics.
- FR-13 The 3D graph can be rotated/orbited (desktop) and is viewable from any
  angle (VR).
- FR-14 In 3D Comparison, two architectures render side by side for visual diff.

### 4.4 Floating 2D UI
- FR-15 2D floating windows host the buttons and filters (back, home, compare,
  filter-by-status, filter-by-element-type, legend).
- FR-16 Every interactive control responds to **mouse pointer** (desktop) and
  **hand tracking / controller ray** (Quest), using the same hit-testing.
- FR-17 A filter on element type and/or status dims non-matching blocks.

### 4.5 WebXR
- FR-18 An "Enter VR" button is shown when an immersive-vr session is available.
- FR-19 Hand tracking is enabled when supported; pinch/poke activates UI and
  selects blocks. Controllers work as a fallback.
- FR-20 The desktop fallback (no XR) is fully usable with mouse + drag-orbit.

## 5. Non-functional requirements
- NFR-1 **Aesthetic**: dark space, neon cyan/teal/magenta glow, holographic
  translucency, scanlines/grid floor, particle ambience — "Jarvis / Minority
  Report".
- NFR-2 **Zero build step**: runs from static files; libraries via CDN.
- NFR-3 Runs on the **Meta Quest Browser** and desktop Chrome/Edge/Firefox.
- NFR-4 Target ~72–90 fps in VR; keep draw calls and particle counts bounded.
- NFR-5 Data-driven: changing the JSON changes the interface with no code edits.
- NFR-6 Graceful degradation when WebXR / hand tracking is unavailable.

## 6. Constraints & assumptions
- WebXR requires a **secure context** (https or `localhost`). The app is served
  over a local static server during development (see ARCHITECTURE.md).
- The JSON is fetched at runtime, so the app must be served over http(s),
  not opened via `file://` (fetch + WebXR both require it).
- Mock metrics are illustrative, not real.

## 7. Out of scope (for this iteration)
- Editing architecture in-world / persistence back to a store.
- Real data integration / authentication.
- Multi-user / shared-presence sessions.
