# Spatial Architecture Explorer — Technical Architecture

How the WebXR app in this repo is built. Companion to `REQUIREMENTS.md`.

---

## 1. Technology choice

**Babylon.js 7 (UMD via CDN)** is the engine. Rationale:

- First-class **WebXR**: `createDefaultXRExperienceAsync` gives the Enter-VR
  button, controller input, **hand tracking** and **near-interaction**
  (poke/pinch) out of the box — exactly what FR-16/19 need.
- **GUI** (`babylon.gui`): `AdvancedDynamicTexture` rendered onto 3D planes
  gives floating 2D windows whose buttons are hit-tested identically by mouse
  pointer and XR ray/hand — one code path for both (FR-16).
- Built-in **GlowLayer**, particle systems, dynamic textures and node-free
  emissive/fresnel materials deliver the holographic "Jarvis" look (NFR-1)
  with no build tooling (NFR-2).

Loaded from CDN (no bundler): `babylon.js`, `babylonjs.gui.min.js`,
`babylonjs.materials.min.js`.

> Alternatives considered: **A-Frame** (simpler, but weaker 2D-in-3D UI and
> less control over effects) and **raw Three.js + WebXR** (max control, but we'd
> reimplement the GUI/hand-interaction layer). Babylon is the best fit for a
> data-driven holographic UI with hand tracking.

## 2. Runtime / serving

- Pure static files. WebXR + `fetch()` require a secure context, so the app is
  served at `http://localhost` (dev) — use `serve.cmd` / `python -m http.server`.
- On Quest: serve over the LAN with https (or use the headset on the same
  origin via a tunnel); open the URL in the Quest Browser and tap **Enter VR**.

## 3. File layout

```
jarvis/
├─ index.html              # CDN libs + canvas + bootstraps js/main.js
├─ serve.cmd               # convenience local static server (port 8080)
├─ data/
│  └─ architecture.json    # ALL mock data (sectors, apps, elements, relations)
├─ tools/
│  └─ generate_data.py     # regenerates architecture.json (dev convenience)
└─ js/
   ├─ config.js            # palette, element-type styling, tunables
   ├─ data.js              # fetch + index the JSON (lookups, joins)
   ├─ effects.js           # grid floor, starfield, glow, ambient particles
   ├─ ui.js                # floating 2D panels, buttons, lists, metric tiles
   ├─ graph3d.js           # architecture blocks + animated relation links
   ├─ pages.js             # page state machine (build/teardown per page)
   └─ main.js              # engine, scene, camera, lights, XR, wiring
```

Scripts load as classic (non-module) `<script>` tags in dependency order, each
attaching one namespace to a global `App` object (`App.Config`, `App.Data`,
`App.UI`, …). This keeps it buildless and `file://`-parseable while the JSON
fetch happens at runtime.

## 4. Data model (architecture.json)

```jsonc
{
  "meta":      { "title", "generatedAt" },
  "sectors":   [ { "id","name","color","description",
                   "metrics": { applications, uptime, monthlyCost,
                                users, dataVolumeTB, criticality },
                   "applicationIds": [] } ],
  "applications": [ {
     "id","name","sectorId","status","owner","tech":[],
     "metrics": { uptime, latencyMs, rps, users, costPerMonth,
                  incidents30d, dataGB, apiCallsDay },
     "architecture": {
        "elements":  [ { "id","name","type","tech","metrics":{} } ],
        "relations": [ { "source","target","type","label","throughput" } ]
     } } ]
}
```

- `type` ∈ {frontend, gateway, service, database, cache, queue, external} →
  block shape + colour (see `config.js`).
- relation `type` ∈ {sync, async, data, auth} → connector style + packet colour.

`data.js` builds id→object indexes and sector→apps / element→relations joins so
pages render by lookup, never by scanning.

## 5. Scene composition

- **Environment** (always on): dark background, grid floor with fresnel fade,
  starfield, GlowLayer, slow ambient particle drift, subtle camera dolly.
- **UI dock** (always on): left and right floating GUI panels + a top
  breadcrumb/back bar. Content is swapped per page.
- **Stage** (per page): the centre volume where sector blocks or an
  application's architecture graph live.

### Page builders (`pages.js`)
A simple state machine: `goLanding()`, `goSector(id)`, `goApplication(id)`,
`goComparePicker(appId)` (choose the 2nd app) and `goComparison(idA, idB, state)`.
Each builder:
1. tears down the previous stage + transient UI,
2. populates left/middle/right per the Excel spec,
3. animates content in (scale/fade/slide).

| Page | Left panel | Middle (stage) | Right panel |
|------|-----------|----------------|-------------|
| Landing | aggregate app stats tiles | sector blocks in an arc | — |
| Sector | sectors list (buttons) | sector metric tiles + emblem | applications as **3D blocks** (clickable) |
| Application | app metric tiles + Compare button | 3D architecture graph | (graph spans middle+right) |
| Compare picker | App A summary + context graph | list of apps to pick App B | — |
| Comparison | app A graph + metrics + swap | colour-scheme pickers + detail slider | app B graph + metrics + swap |

The whole 3D stage (sector blocks, app blocks, graphs) is parented to a single
`App.stage` transform so VR zoom/rotate can move it as one unit; the floating
GUI panels stay fixed so controls remain reachable.

## 6. 3D architecture graph (`graph3d.js`)

- **Blocks**: one mesh per element; box/cylinder/sphere/etc. by type, sized by a
  metric, emissive + fresnel "hologram" material, floating label billboard.
- **Layout**: deterministic layered layout — frontend/gateway at the front,
  services in the middle ring, datastores/queues at the back — so graphs are
  readable and stable across reloads.
- **Relations**: a Catmull-Rom curve between block centres rendered as a glowing
  tube; small emissive spheres ("data packets") animate along the curve to show
  direction and throughput; colour/dash by relation type.
- **Interaction**: `ActionManager` (pointer over/out/pick) highlights a block
  and shows its tooltip; works for mouse and XR pointer/hand alike. A `onSelect`
  callback drives the comparison link.
- **Filters**: type/status filters set a dim factor on non-matching blocks and
  their relations.
- **Colour schemes** (comparison): `opts.scheme` tints a whole graph with one
  hue (shaded per layer) so each application is visually distinct; selectable
  per app from `config.schemes`.
- **Detail LOD** (comparison): `handle.setDetail(t)` lerps blocks between their
  full layout (t=1) and a single merged shape at the centre (t=0), fading
  labels/relations/packets — driven by the detail slider.
- **Element linking** (comparison): selecting an element highlights it and the
  same-named element in the other app (outline + scale) and draws a live world-
  space line between them, updated each frame.

## 7. Floating 2D UI (`ui.js`)

- Each window is a `Mesh` plane carrying an `AdvancedDynamicTexture`.
- Reusable factories: `panel()`, `button()`, `listRow()`, `metricTile()`,
  `breadcrumb()`, `toggle()`.
- Buttons fire normal Babylon pointer observables, which Babylon raises for
  mouse, XR controller rays and hand near-interaction uniformly (FR-16).
- Panels gently billboard / are placed in a curved dock so they face the user
  in VR.

## 8. WebXR (`main.js`)

- `scene.createDefaultXRExperienceAsync({ floorMeshes: [grid] })`.
- Enable features when available: **hand tracking**, **pointer selection**,
  **near interaction**.
- **Browsing** is by **zoom + rotate**, not teleport: a small head-pinned
  console (built in `setupLocomotion`) has ZOOM ±, ROTATE ↺↻ and RESET buttons
  that scale/rotate `App.stage` (the 3D content) so the user can inspect the
  interface from any distance/angle without walking. Pinchable with hands.
- Desktop fallback: `ArcRotateCamera` with mouse orbit/zoom; the same GUI is
  driven by the mouse pointer.
- Capability detection (`navigator.xr.isSessionSupported`) toggles the Enter-VR
  affordance; everything degrades gracefully (NFR-6).

## 9. Visual language (`config.js` + `effects.js`)
- Palette: near-black background; neon **cyan** (#00e5ff) primary, **teal**,
  **magenta** (#ff2bd6) accents, amber/red for warning/critical status.
- Materials: high emissive, additive glow, fresnel rim, slight transparency.
- Motion: everything eases in; idle bob on blocks; flowing packets; scanline
  shimmer on panels. Tuned for legibility first, spectacle second.

## 10. Performance notes
- Bounded packet count per relation; instancing/material reuse for blocks.
- Pause per-frame work for off-page meshes; dispose on teardown to avoid leaks.
- GlowLayer intensity and particle counts are tunables in `config.js`.

## 11. Extensibility
- New element/relation types: add to `config.js` styling maps.
- New page: add a builder to `pages.js` + a breadcrumb entry.
- Real data: replace `data/architecture.json` (same schema) — no code changes.
