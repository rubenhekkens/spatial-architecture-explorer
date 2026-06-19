# Spatial Architecture Explorer

**▶ Live demo: https://rubenhekkens.github.io/spatial-architecture-explorer/**
(open it in a desktop browser, or in the **Meta Quest Browser** and tap *Enter VR*).

A WebXR "Jarvis / Minority Report" interface for exploring IT-architecture —
sectors, applications, and the 3D architecture elements and data relations
between them. Runs in a desktop/mobile browser **and** on the Meta Quest in VR.

See [`REQUIREMENTS.md`](REQUIREMENTS.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md)
for the design, both derived from `Pages.xlsx`.

## Run it

WebXR and the JSON `fetch()` need a secure context, so serve over http — do
**not** double-click `index.html` (`file://` is blocked by the browser).

```bash
# Windows
serve.cmd
# or, any OS
python -m http.server 8080
```

Then open **http://localhost:8080**.

### In VR on Meta Quest
Easiest: open the **live demo URL** above in the **Quest Browser** and tap
**Enter VR** (bottom-right). WebXR needs https — the GitHub Pages URL provides it.

Use **hand tracking** (pinch/poke the panels and blocks) or controllers. A
head-pinned console lets you **zoom and rotate** the whole interface (ZOOM ±,
ROTATE ↺↻, RESET) so you can browse it from any distance/angle.

Local alternative (no internet): run `serve-quest.cmd` for a self-signed-https
LAN server, or use `adb reverse tcp:8080 tcp:8080` over USB and open
`http://localhost:8080` on the headset.

## The four pages (from `Pages.xlsx`)
- **Landing** – aggregate stats of all applications; sectors float as glowing
  blocks. Click a sector →
- **Sector Overview** – sector numbers in the centre, all-sectors list left,
  applications list right. Click an application →
- **Application** – application metrics left; its architecture as 3D blocks with
  animated data relations in the centre; element-type filters; **Compare in 3D** →
- **3D Comparison** – two applications' architectures side by side; swap either
  app from the lists.

## Data
All content is mock data in [`data/architecture.json`](data/architecture.json)
(schema in `ARCHITECTURE.md`). Regenerate it with:

```bash
python tools/generate_data.py
```

Replace the JSON with your own (same schema) to drive the interface with real
architecture — no code changes needed.

## Controls (desktop)
Drag to orbit · scroll to zoom · hover a block for details · click panels &
blocks to navigate.
