/* ui.js — floating 2D GUI panels (clickable by mouse + XR ray/hand).
   Attaches App.UI. Built on babylon.gui AdvancedDynamicTexture-on-mesh. */
(function (global) {
  const App = (global.App = global.App || {});
  const G = BABYLON.GUI;
  const UI = { docks: {}, _scene: null };

  const PX = 256; // texture pixels per world-unit

  // ------------------------------------------------------------------ panel
  // Creates a plane in world space carrying a GUI texture + a scrollable stack.
  UI.makePanel = function (name, wWorld, hWorld, opts = {}) {
    const scene = UI._scene;
    const plane = BABYLON.MeshBuilder.CreatePlane(
      name, { width: wWorld, height: hWorld }, scene
    );
    plane.position = opts.position || new BABYLON.Vector3(0, 0, 0);
    if (opts.rotation) plane.rotation = opts.rotation;
    plane.isPickable = true;

    const adt = G.AdvancedDynamicTexture.CreateForMesh(
      plane, Math.round(wWorld * PX), Math.round(hWorld * PX), false
    );
    adt.background = "transparent";

    // glassy backing
    const bg = new G.Rectangle("bg");
    bg.thickness = 2;
    bg.cornerRadius = 18;
    bg.color = App.Config.palette.panelBorder;
    bg.background = App.Config.palette.panelBg;
    bg.alpha = 1;
    adt.addControl(bg);

    // faint inner border for the HUD feel
    const inner = new G.Rectangle("inner");
    inner.thickness = 1;
    inner.cornerRadius = 14;
    inner.color = "#0e5e74";
    inner.width = 0.96; inner.height = 0.97;
    inner.background = "transparent";
    bg.addControl(inner);

    const root = new G.StackPanel("root");
    root.width = 0.9;
    root.paddingTop = "12px"; root.paddingBottom = "12px";
    root.spacing = 8;
    bg.addControl(root);

    const panel = { mesh: plane, adt, root, bg };
    return panel;
  };

  UI.init = function (scene) {
    UI._scene = scene;

    // Left dock (front-left, angled toward the user)
    UI.docks.left = UI.makePanel("panel.left", 1.9, 2.5, {
      position: new BABYLON.Vector3(-4.0, 1.5, 1.2),
      rotation: new BABYLON.Vector3(0, BABYLON.Tools.ToRadians(26), 0),
    });
    // Right dock
    UI.docks.right = UI.makePanel("panel.right", 1.9, 2.5, {
      position: new BABYLON.Vector3(4.0, 1.5, 1.2),
      rotation: new BABYLON.Vector3(0, BABYLON.Tools.ToRadians(-26), 0),
    });
    // Top breadcrumb / nav bar
    UI.docks.top = UI.makePanel("panel.top", 4.6, 0.62, {
      position: new BABYLON.Vector3(0, 3.05, 1.6),
    });
    UI.docks.top.root.isVertical = false;
    UI.docks.top.root.height = "60px";

    return UI;
  };

  // ------------------------------------------------------------- control kit
  UI.title = function (text, color) {
    const t = new G.TextBlock();
    t.text = (text || "").toUpperCase();
    t.color = color || "#7fe9ff";
    t.fontSize = 26;
    t.fontFamily = "Segoe UI";
    t.height = "40px";
    t.textHorizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.paddingLeft = "6px";
    t.shadowColor = "#00e5ff"; t.shadowBlur = 16;
    return t;
  };

  UI.subtitle = function (text) {
    const t = new G.TextBlock();
    t.text = text || "";
    t.color = App.Config.palette.textDim;
    t.fontSize = 15;
    t.height = "26px";
    t.textWrapping = true;
    t.textHorizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    t.paddingLeft = "6px";
    return t;
  };

  UI.divider = function () {
    const r = new G.Rectangle();
    r.height = "2px"; r.width = "94%";
    r.background = "#0e5e74"; r.thickness = 0; r.alpha = 0.7;
    return r;
  };

  UI.spacer = function (h) {
    const r = new G.Rectangle();
    r.height = (h || 8) + "px"; r.thickness = 0; r.background = "transparent";
    return r;
  };

  // Big holographic number tile
  UI.metricTile = function (value, label, color) {
    const card = new G.Rectangle();
    card.height = "86px"; card.thickness = 1; card.cornerRadius = 12;
    card.color = "#0e5e74"; card.background = "#06141fbb";
    card.paddingTop = "4px"; card.paddingBottom = "4px";

    const stack = new G.StackPanel();
    card.addControl(stack);

    const v = new G.TextBlock();
    v.text = String(value);
    v.color = color || "#eaffff";
    v.fontSize = 38; v.height = "48px";
    v.shadowColor = color || "#00e5ff"; v.shadowBlur = 18;
    stack.addControl(v);

    const l = new G.TextBlock();
    l.text = (label || "").toUpperCase();
    l.color = App.Config.palette.textDim;
    l.fontSize = 13; l.height = "22px";
    stack.addControl(l);
    return card;
  };

  // Clickable list row (sectors / applications)
  UI.listRow = function (text, sub, accentHex, onClick) {
    const btn = G.Button.CreateSimpleButton("row", "");
    btn.height = "60px";
    btn.thickness = 1; btn.cornerRadius = 10;
    btn.color = "#0e5e74";
    btn.background = "#06141f99";
    btn.paddingTop = "3px"; btn.paddingBottom = "3px";

    const accent = new G.Rectangle();
    accent.width = "6px"; accent.height = "70%";
    accent.background = accentHex || "#00e5ff";
    accent.thickness = 0; accent.cornerRadius = 3;
    accent.horizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    accent.left = "6px";
    btn.addControl(accent);

    const col = new G.StackPanel();
    col.horizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    col.left = "22px"; col.width = "86%";
    btn.addControl(col);

    const t = new G.TextBlock();
    t.text = text; t.color = "#dff6ff"; t.fontSize = 19;
    t.height = "26px";
    t.textHorizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    col.addControl(t);

    if (sub) {
      const s = new G.TextBlock();
      s.text = sub; s.color = App.Config.palette.textDim; s.fontSize = 13;
      s.height = "20px";
      s.textHorizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
      col.addControl(s);
    }

    const chev = new G.TextBlock();
    chev.text = "›"; chev.color = accentHex || "#7fe9ff"; chev.fontSize = 28;
    chev.horizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_RIGHT;
    chev.paddingRight = "14px";
    btn.addControl(chev);

    btn.onPointerEnterObservable.add(() => { btn.background = "#0b2b3aee"; btn.color = accentHex || "#00e5ff"; });
    btn.onPointerOutObservable.add(() => { btn.background = "#06141f99"; btn.color = "#0e5e74"; });
    if (onClick) btn.onPointerUpObservable.add(onClick);
    return btn;
  };

  // Generic action button
  UI.button = function (text, onClick, opts = {}) {
    const btn = G.Button.CreateSimpleButton("btn", text);
    btn.height = opts.height || "46px";
    btn.width = opts.width || "180px";
    btn.thickness = 1.5; btn.cornerRadius = 10;
    const accent = opts.color || "#00e5ff";
    btn.color = accent; btn.background = "#06141f";
    if (btn.textBlock) {
      btn.textBlock.color = accent; btn.textBlock.fontSize = opts.fontSize || 17;
      btn.textBlock.text = (text || "").toUpperCase();
    }
    btn.onPointerEnterObservable.add(() => { btn.background = accent; if (btn.textBlock) btn.textBlock.color = "#03121a"; });
    btn.onPointerOutObservable.add(() => { btn.background = "#06141f"; if (btn.textBlock) btn.textBlock.color = accent; });
    if (onClick) btn.onPointerUpObservable.add(onClick);
    return btn;
  };

  // Filter toggle (chip) — returns control with .isOn state + onChange
  UI.chip = function (text, accentHex, initial, onChange) {
    const btn = G.Button.CreateSimpleButton("chip", text);
    btn.height = "34px";
    btn.width = (Math.max(64, text.length * 11 + 28)) + "px";
    btn.thickness = 1; btn.cornerRadius = 16;
    let on = initial !== false;
    const paint = () => {
      btn.background = on ? accentHex : "#06141f";
      if (btn.textBlock) { btn.textBlock.color = on ? "#03121a" : accentHex; btn.textBlock.fontSize = 14; }
      btn.color = accentHex;
    };
    paint();
    btn.onPointerUpObservable.add(() => { on = !on; paint(); onChange && onChange(on); });
    btn._setOn = (v) => { on = v; paint(); };
    return btn;
  };

  // ------------------------------------------------------------- dock helpers
  UI.clear = function (dockName) {
    const d = UI.docks[dockName];
    if (!d) return;
    d.root.clearControls();
  };

  UI.add = function (dockName, control) {
    UI.docks[dockName].root.addControl(control);
    return control;
  };

  // Wrap a set of controls into a vertical scroll viewer (for long lists)
  UI.scroller = function (heightPx) {
    const sv = new G.ScrollViewer();
    sv.height = heightPx + "px"; sv.width = "98%";
    sv.thickness = 0; sv.background = "transparent";
    sv.barColor = "#1ea7c9"; sv.barBackground = "#06141f";
    sv.wheelPrecision = 0.02;
    const stack = new G.StackPanel();
    stack.spacing = 8; stack.width = "94%";
    sv.addControl(stack);
    return { sv, stack };
  };

  // visibility toggle for whole docks (e.g. hide right panel on comparison)
  UI.setDockVisible = function (dockName, v) {
    const d = UI.docks[dockName];
    if (d) d.mesh.setEnabled(v);
  };

  App.UI = UI;
})(typeof window !== "undefined" ? window : this);
