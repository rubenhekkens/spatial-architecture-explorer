/* graph3d.js — builds an application's architecture as 3D blocks + animated
   relation links. App.Graph.build(scene, app, opts) -> graph handle. */
(function (global) {
  const App = (global.App = global.App || {});
  const V3 = BABYLON.Vector3;

  const LAYER = { frontend: 0, gateway: 1, service: 2, database: 3, cache: 3, queue: 3, external: 4 };

  function holoMaterial(scene, hex, emissiveBoost = 1) {
    const c = BABYLON.Color3.FromHexString(hex);
    const m = new BABYLON.StandardMaterial("holo", scene);
    m.diffuseColor = c.scale(0.22);
    m.emissiveColor = c.scale(0.5 * emissiveBoost);
    m.specularColor = new BABYLON.Color3(1, 1, 1);
    m.specularPower = 64;
    m.alpha = 0.86;
    // fresnel rim glow
    m.emissiveFresnelParameters = new BABYLON.FresnelParameters();
    m.emissiveFresnelParameters.bias = 0.2;
    m.emissiveFresnelParameters.power = 2;
    m.emissiveFresnelParameters.leftColor = c.scale(1.4);
    m.emissiveFresnelParameters.rightColor = c.scale(0.4);
    m.opacityFresnelParameters = new BABYLON.FresnelParameters();
    m.opacityFresnelParameters.leftColor = BABYLON.Color3.White();
    m.opacityFresnelParameters.rightColor = new BABYLON.Color3(0.35, 0.35, 0.35);
    return m;
  }

  function makeShape(scene, shape, name, s) {
    switch (shape) {
      case "cylinder": return BABYLON.MeshBuilder.CreateCylinder(name, { height: s * 1.1, diameter: s }, scene);
      case "sphere":   return BABYLON.MeshBuilder.CreateSphere(name, { diameter: s }, scene);
      case "octa":     return BABYLON.MeshBuilder.CreatePolyhedron(name, { type: 1, size: s * 0.6 }, scene);
      case "torus":    return BABYLON.MeshBuilder.CreateTorus(name, { diameter: s, thickness: s * 0.32, tessellation: 24 }, scene);
      case "prism":    return BABYLON.MeshBuilder.CreateCylinder(name, { height: s, diameter: s * 1.1, tessellation: 3 }, scene);
      default:         return BABYLON.MeshBuilder.CreateBox(name, { size: s * 0.9 }, scene);
    }
  }

  // world-space text label as a billboarded plane
  function makeLabel(scene, text, sub, hex) {
    const plane = BABYLON.MeshBuilder.CreatePlane("label", { width: 1.5, height: 0.5 }, scene);
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    const dt = new BABYLON.DynamicTexture("labeltex", { width: 384, height: 128 }, scene, true);
    dt.hasAlpha = true;
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 384, 128);
    ctx.font = "bold 30px Segoe UI";
    ctx.fillStyle = "#eaffff";
    ctx.textAlign = "center";
    ctx.shadowColor = hex; ctx.shadowBlur = 12;
    ctx.fillText(text.slice(0, 20), 192, 52);
    ctx.shadowBlur = 0;
    ctx.font = "20px Segoe UI";
    ctx.fillStyle = hex;
    ctx.fillText((sub || "").toUpperCase(), 192, 90);
    dt.update();
    const m = new BABYLON.StandardMaterial("labelmat", scene);
    m.diffuseTexture = dt; m.emissiveTexture = dt;
    m.opacityTexture = dt; m.disableLighting = true;
    m.emissiveColor = BABYLON.Color3.White();
    plane.material = m;
    return plane;
  }

  App.Graph = {
    build(scene, app, opts = {}) {
      const cfg = App.Config;
      const center = opts.center || new V3(0, 0.6, 0);
      const scale = opts.scale || 1;

      const parent = new BABYLON.TransformNode("graph-" + app.id, scene);
      parent.position = center.clone();
      parent.scaling = new V3(scale, scale, scale);

      const els = app.architecture.elements;
      const rels = app.architecture.relations;

      // ---- layout: group by layer, spread along x, depth by layer ----
      const byLayer = {};
      els.forEach((e) => {
        const L = LAYER[e.type] ?? 2;
        (byLayer[L] = byLayer[L] || []).push(e);
      });
      const nodePos = {};      // elementId -> local V3
      const nodeMesh = {};     // elementId -> mesh
      const zSpacing = 2.0, xSpacing = 2.0;
      Object.keys(byLayer).map(Number).sort((a, b) => a - b).forEach((L) => {
        const arr = byLayer[L];
        arr.forEach((e, i) => {
          const x = (i - (arr.length - 1) / 2) * xSpacing;
          const z = (L - 2) * zSpacing;
          const y = (L % 2 ? 0.25 : -0.1) + Math.sin(i * 1.3) * 0.12;
          nodePos[e.id] = new V3(x, y, z);
        });
      });

      // ---- blocks ----
      const tooltip = makeTooltip(scene);
      els.forEach((e) => {
        const style = cfg.elementTypes[e.type] || cfg.elementTypes.service;
        const metricVal = firstNumber(e.metrics) || 100;
        const s = 0.55 + Math.min(0.5, Math.log10(metricVal + 10) / 10);
        const mesh = makeShape(scene, style.shape, "el-" + e.id, s);
        mesh.parent = parent;
        mesh.position = nodePos[e.id].clone();
        mesh.material = holoMaterial(scene, style.color);
        mesh.metadata = { element: e, baseY: nodePos[e.id].y, type: e.type };
        nodeMesh[e.id] = mesh;

        // label above
        const lbl = makeLabel(scene, e.name, style.label, style.color);
        lbl.parent = parent;
        lbl.position = nodePos[e.id].add(new V3(0, s * 0.5 + 0.45, 0));
        lbl.scaling = new V3(0.9, 0.9, 0.9);
        mesh.metadata.label = lbl;

        // interaction
        mesh.actionManager = new BABYLON.ActionManager(scene);
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOverTrigger, () => {
            mesh.scaling = new V3(1.18, 1.18, 1.18);
            showTooltip(tooltip, e, style, mesh);
          }));
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOutTrigger, () => {
            mesh.scaling = V3.One();
          }));
      });

      // ---- relations: glowing curved tubes + flowing packets ----
      const packets = [];
      rels.forEach((r, ri) => {
        const a = nodePos[r.source], b = nodePos[r.target];
        if (!a || !b) return;
        const rstyle = cfg.relationTypes[r.type] || cfg.relationTypes.sync;
        const col = BABYLON.Color3.FromHexString(rstyle.color);
        const mid = V3.Center(a, b).add(new V3(0, 0.6 + (ri % 3) * 0.25, 0));
        const curve = BABYLON.Curve3.CreateCatmullRomSpline([a, mid, b], 24);
        const pts = curve.getPoints();

        const tube = BABYLON.MeshBuilder.CreateTube("rel-" + ri, {
          path: pts, radius: 0.018, tessellation: 6, updatable: false,
        }, scene);
        tube.parent = parent;
        const tm = new BABYLON.StandardMaterial("relmat", scene);
        tm.emissiveColor = col.scale(0.9);
        tm.diffuseColor = col.scale(0.1);
        tm.alpha = rstyle.dashed ? 0.32 : 0.5;
        tm.disableLighting = true;
        tube.material = tm;
        tube.isPickable = false;
        tube.metadata = { srcType: app.architecture.elements.find((x) => x.id === r.source)?.type };

        // flowing packets
        const count = cfg.tunables.packetsPerRelation;
        const speed = 0.0025 + Math.min(0.01, (r.throughput || 100) / 80000);
        for (let p = 0; p < count; p++) {
          const pk = BABYLON.MeshBuilder.CreateSphere("pk", { diameter: 0.09, segments: 6 }, scene);
          pk.parent = parent;
          const pm = new BABYLON.StandardMaterial("pkm", scene);
          pm.emissiveColor = col.scale(1.5);
          pm.disableLighting = true;
          pk.material = pm;
          pk.isPickable = false;
          packets.push({ mesh: pk, pts, t: p / count, speed, relType: r.type, srcType: tube.metadata.srcType });
        }
      });

      // ---- per-frame animation (bob + packet flow) ----
      let time = 0;
      const obs = scene.onBeforeRenderObservable.add(() => {
        // clamp delta so a stalled tab / first frame can't produce huge jumps
        const dt = Math.min(3, scene.getEngine().getDeltaTime() / 16.6);
        time += 0.02 * dt;
        // gentle idle bob on blocks
        els.forEach((e, i) => {
          const m = nodeMesh[e.id];
          if (!m || !m.isEnabled()) return;
          m.position.y = m.metadata.baseY + Math.sin(time + i) * cfg.tunables.blockBob;
          m.rotation.y += 0.002 * dt;
        });
        // packets along curves
        packets.forEach((pk) => {
          if (!pk.mesh.isEnabled() || pk.pts.length < 2) return;
          pk.t += pk.speed * dt;
          pk.t -= Math.floor(pk.t);                 // robust wrap to [0,1)
          const last = pk.pts.length - 1;
          const f = pk.t * last;
          let i0 = Math.floor(f);
          if (i0 > last - 1) i0 = last - 1;
          if (i0 < 0) i0 = 0;
          pk.mesh.position = V3.Lerp(pk.pts[i0], pk.pts[i0 + 1], f - i0);
        });
        // slow auto-spin of the whole graph when idle
        if (opts.autoSpin) parent.rotation.y += 0.0015 * dt;
      });

      const handle = {
        parent, nodeMesh, packets, tooltip,
        // dim blocks/packets whose type is not in the active set
        applyFilter(activeTypes) {
          els.forEach((e) => {
            const on = !activeTypes || activeTypes.has(e.type);
            const m = nodeMesh[e.id];
            m.visibility = on ? 1 : 0.12;
            if (m.material) m.material.alpha = on ? 0.86 : 0.12;
            if (m.metadata.label) m.metadata.label.visibility = on ? 1 : 0.1;
          });
          packets.forEach((pk) => {
            const on = !activeTypes || activeTypes.has(pk.srcType);
            pk.mesh.setEnabled(on);
          });
        },
        setEnabled(v) { parent.setEnabled(v); },
        dispose() {
          scene.onBeforeRenderObservable.remove(obs);
          tooltip.mesh.dispose();
          parent.dispose(false, true);
        },
      };
      return handle;
    },
  };

  // ----- tooltip (shared world-space GUI plane) -----
  function makeTooltip(scene) {
    const plane = BABYLON.MeshBuilder.CreatePlane("tooltip", { width: 1.7, height: 1.15 }, scene);
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    plane.setEnabled(false);
    const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 512, 346, false);
    const bg = new BABYLON.GUI.Rectangle();
    bg.thickness = 2; bg.cornerRadius = 14; bg.color = "#00e5ff";
    bg.background = "#04111dee";
    adt.addControl(bg);
    const stack = new BABYLON.GUI.StackPanel();
    stack.paddingTop = "14px"; stack.width = "92%";
    bg.addControl(stack);
    return { mesh: plane, adt, bg, stack };
  }

  function showTooltip(tt, e, style, mesh) {
    tt.stack.clearControls();
    tt.bg.color = style.color;
    const title = new BABYLON.GUI.TextBlock();
    title.text = e.name; title.color = "#eaffff"; title.fontSize = 34;
    title.height = "46px"; title.shadowColor = style.color; title.shadowBlur = 14;
    tt.stack.addControl(title);
    const typ = new BABYLON.GUI.TextBlock();
    typ.text = style.label.toUpperCase() + "  ·  " + (e.tech || "");
    typ.color = style.color; typ.fontSize = 20; typ.height = "30px";
    tt.stack.addControl(typ);
    Object.entries(e.metrics || {}).slice(0, 4).forEach(([k, v]) => {
      const row = new BABYLON.GUI.TextBlock();
      row.text = prettyKey(k) + ":   " + formatVal(k, v);
      row.color = "#bfe9f5"; row.fontSize = 21; row.height = "30px";
      row.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      tt.stack.addControl(row);
    });
    // place above the block in world space
    tt.mesh.setEnabled(true);
    const wp = mesh.getAbsolutePosition();
    tt.mesh.position = wp.add(new BABYLON.Vector3(0, 1.1, 0));
  }

  function firstNumber(obj) {
    for (const v of Object.values(obj || {})) if (typeof v === "number") return v;
    return 0;
  }
  function prettyKey(k) {
    return k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace("p95ms", "P95 ms");
  }
  function formatVal(k, v) {
    if (typeof v !== "number") return String(v);
    if (/ms|latency|p95/i.test(k)) return v + " ms";
    if (/rate|availability|uptime/i.test(k)) return v + "%";
    if (/gb|size/i.test(k)) return App.fmt.compact(v) + " GB";
    return App.fmt.compact(v);
  }

  global.App = App;
})(typeof window !== "undefined" ? window : this);
