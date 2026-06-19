/* pages.js — navigation state machine. Builds Landing / Sector / Application /
   Comparison per the Pages.xlsx spec. Attaches App.Pages. */
(function (global) {
  const App = (global.App = global.App || {});
  const G = BABYLON.GUI;
  const V3 = BABYLON.Vector3;

  const Pages = {
    scene: null,
    current: null,
    history: [],
    _graphs: [],
    _transient: [],   // disposable meshes/panels for the stage
    _filter: null,    // Set of active element types (Application page)
  };

  Pages.init = function (scene) {
    Pages.scene = scene;
    App.UI.init(scene);
    Pages.goLanding();
    return Pages;
  };

  // ---------------------------------------------------------------- teardown
  function clearStage() {
    Pages._graphs.forEach((g) => g.dispose());
    Pages._graphs = [];
    Pages._transient.forEach((m) => { try { m.dispose(); } catch (e) {} });
    Pages._transient = [];
  }

  // transient center panel (floating numbers / extra controls)
  function centerPanel(w, h, pos, rot) {
    const p = App.UI.makePanel("panel.center." + Math.random().toString(36).slice(2), w, h, {
      position: pos, rotation: rot,
    });
    Pages._transient.push(p.mesh);
    return p;
  }

  // ------------------------------------------------------------- top nav bar
  function buildNav(crumbs) {
    App.UI.clear("top");
    const root = App.UI.docks.top.root;

    const home = App.UI.button("⌂ Home", () => Pages.goLanding(), { width: "130px", height: "44px", color: "#7fe9ff" });
    home.paddingLeft = "8px"; home.paddingRight = "8px";
    root.addControl(home);

    const back = App.UI.button("‹ Back", () => Pages.back(), { width: "120px", height: "44px", color: "#7fe9ff" });
    back.paddingRight = "12px";
    root.addControl(back);

    const crumb = new G.TextBlock();
    crumb.text = crumbs.join("   ›   ").toUpperCase();
    crumb.color = "#bfe9f5"; crumb.fontSize = 20; crumb.width = "1100px";
    crumb.textHorizontalAlignment = G.Control.HORIZONTAL_ALIGNMENT_LEFT;
    crumb.paddingLeft = "16px";
    crumb.shadowColor = "#00e5ff"; crumb.shadowBlur = 10;
    root.addControl(crumb);
  }

  Pages.back = function () {
    if (Pages.history.length < 2) return Pages.goLanding();
    Pages.history.pop();              // current
    const prev = Pages.history.pop(); // target
    prev();
  };
  function record(fn) { Pages.history.push(fn); if (Pages.history.length > 30) Pages.history.shift(); }

  // ================================================================ LANDING
  Pages.goLanding = function () {
    clearStage();
    Pages.current = "landing";
    record(Pages.goLanding);
    buildNav(["Landing"]);
    App.focusCamera && App.focusCamera(new V3(0, 0.6, -1.8), 14.5, 77);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", false);

    // LEFT: details of all applications (aggregate tiles)
    const agg = App.Data.aggregate();
    App.UI.clear("left");
    App.UI.add("left", App.UI.title("All Applications"));
    App.UI.add("left", App.UI.subtitle("Live landscape overview"));
    App.UI.add("left", App.UI.divider());
    const grid = twoCol([
      [App.fmt.num(agg.applications), "Applications", "#00e5ff"],
      [App.fmt.num(agg.sectors), "Sectors", "#36f1cd"],
      [App.fmt.pct(agg.avgUptime), "Avg Uptime", "#36f1cd"],
      [App.fmt.compact(agg.totalUsers), "Total Users", "#9b8cff"],
      [App.fmt.money(agg.totalCost), "Monthly Cost", "#ffd166"],
      [String(agg.incidents30d), "Incidents 30d", agg.incidents30d > 10 ? "#ff4d6d" : "#ffd166"],
    ]);
    App.UI.add("left", grid);
    // status mix
    App.UI.add("left", App.UI.divider());
    const mix = new G.TextBlock();
    mix.text = `${agg.byStatus.healthy} healthy    ${agg.byStatus.warning} warning    ${agg.byStatus.critical} critical`;
    mix.color = "#bfe9f5"; mix.fontSize = 15; mix.height = "26px";
    App.UI.add("left", mix);

    // MIDDLE: sectors as glowing 3D blocks in an arc
    buildSectorArc();
  };

  function buildSectorArc() {
    const scene = Pages.scene;
    const sectors = App.Data.sectors;
    const n = sectors.length;
    const radius = 4.6;
    const spread = Math.min(1.8, 0.4 * n);
    sectors.forEach((sec, i) => {
      const a = -spread / 2 + (n === 1 ? spread / 2 : (spread * i) / (n - 1));
      const x = Math.sin(a) * radius;
      const z = -Math.cos(a) * radius - 0.5;
      const block = buildSectorBlock(scene, sec, new V3(x, 0.5, z));
      Pages._transient.push(block);
    });
  }

  function buildSectorBlock(scene, sec, pos) {
    const node = new BABYLON.TransformNode("sec-" + sec.id, scene);
    node.position = pos;
    const hex = sec.color;
    const c = BABYLON.Color3.FromHexString(hex);

    const box = BABYLON.MeshBuilder.CreateBox("secbox-" + sec.id, { width: 1.05, height: 1.05, depth: 1.05 }, scene);
    box.parent = node;
    const m = new BABYLON.StandardMaterial("secm", scene);
    m.emissiveColor = c.scale(0.8); m.diffuseColor = c.scale(0.12);
    m.alpha = 0.8;
    m.emissiveFresnelParameters = new BABYLON.FresnelParameters();
    m.emissiveFresnelParameters.power = 2;
    m.emissiveFresnelParameters.leftColor = c.scale(1.5);
    m.emissiveFresnelParameters.rightColor = c.scale(0.3);
    box.material = m;
    box.metadata = { baseY: 0 };

    // wireframe shell
    const shell = BABYLON.MeshBuilder.CreateBox("secshell-" + sec.id, { size: 1.22 }, scene);
    shell.parent = node;
    const sm = new BABYLON.StandardMaterial("secshellm", scene);
    sm.wireframe = true; sm.emissiveColor = c.scale(0.6); sm.alpha = 0.35;
    sm.disableLighting = true;
    shell.material = sm; shell.isPickable = false;

    // label
    const lbl = labelPlane(scene, sec.name, `${sec.metrics.applications} APPS · ${sec.metrics.criticality}`, hex);
    lbl.parent = node; lbl.position = new V3(0, 1.15, 0); lbl.scaling = new V3(0.68, 0.68, 0.68);

    // metric ring text under
    const sub = labelPlane(scene, App.fmt.pct(sec.metrics.uptime) + " uptime", App.fmt.compact(sec.metrics.users) + " users", hex);
    sub.parent = node; sub.position = new V3(0, -1.0, 0); sub.scaling = new V3(0.55, 0.55, 0.55);

    // interaction
    box.actionManager = new BABYLON.ActionManager(scene);
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger,
      () => { box.scaling = new V3(1.12, 1.12, 1.12); shell.scaling = new V3(1.12, 1.12, 1.12); }));
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger,
      () => { box.scaling = V3.One(); shell.scaling = V3.One(); }));
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger,
      () => Pages.goSector(sec.id)));

    // idle motion
    let t = Math.random() * 6;
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 16.6;
      t += 0.02 * dt;
      box.position.y = Math.sin(t) * 0.06;
      box.rotation.y += 0.003 * dt;
      shell.rotation.y -= 0.0015 * dt;
    });
    node._obs = obs;
    const origDispose = node.dispose.bind(node);
    node.dispose = () => { scene.onBeforeRenderObservable.remove(obs); origDispose(false, true); };
    return node;
  }

  // ================================================================ SECTOR
  Pages.goSector = function (sectorId) {
    clearStage();
    Pages.current = "sector";
    record(() => Pages.goSector(sectorId));
    const sec = App.Data.sector(sectorId);
    buildNav(["Landing", sec.name]);
    App.focusCamera && App.focusCamera(new V3(0, 1.2, -0.6), 9.8, 74);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", true);

    // LEFT: list of all sectors
    App.UI.clear("left");
    App.UI.add("left", App.UI.title("Sectors"));
    App.UI.add("left", App.UI.divider());
    const ls = App.UI.scroller(440);
    App.Data.sectors.forEach((s) => {
      ls.stack.addControl(App.UI.listRow(
        s.name, `${s.metrics.applications} apps · ${App.fmt.pct(s.metrics.uptime)}`,
        s.color, () => Pages.goSector(s.id)));
    });
    App.UI.add("left", ls.sv);

    // MIDDLE: sector details in numbers (center floating panel) + sector hologram
    const cp = centerPanel(2.4, 2.4, new V3(0, 1.1, 0.6));
    cp.root.addControl(App.UI.title(sec.name, sec.color));
    const desc = App.UI.subtitle(sec.description); desc.height = "44px";
    cp.root.addControl(desc);
    cp.root.addControl(App.UI.divider());
    cp.root.addControl(twoCol([
      [App.fmt.num(sec.metrics.applications), "Applications", sec.color],
      [sec.metrics.criticality, "Criticality", sec.metrics.criticality === "Critical" ? "#ff4d6d" : "#ffd166"],
      [App.fmt.pct(sec.metrics.uptime), "Avg Uptime", "#36f1cd"],
      [App.fmt.compact(sec.metrics.users), "Users", "#9b8cff"],
      [App.fmt.money(sec.metrics.monthlyCost), "Monthly Cost", "#ffd166"],
      [sec.metrics.dataVolumeTB + " TB", "Data Volume", "#00e5ff"],
    ]));
    // floating sector emblem hovering above & behind the numbers panel
    const emblem = buildSectorBlock(Pages.scene, sec, new V3(0, 3.0, -3.2));
    emblem.scaling = new V3(0.85, 0.85, 0.85);
    Pages._transient.push(emblem);

    // RIGHT: list of applications in this sector
    App.UI.clear("right");
    App.UI.add("right", App.UI.title("Applications"));
    App.UI.add("right", App.UI.subtitle(sec.name + " sector"));
    App.UI.add("right", App.UI.divider());
    const la = App.UI.scroller(440);
    App.Data.appsInSector(sectorId).forEach((app) => {
      const st = App.Config.status[app.status];
      la.stack.addControl(App.UI.listRow(
        app.name, `${st.label} · ${App.fmt.pct(app.metrics.uptime)} · ${App.fmt.num(app.metrics.latencyMs)}ms`,
        st.hex, () => Pages.goApplication(app.id)));
    });
    App.UI.add("right", la.sv);
  };

  // ============================================================ APPLICATION
  Pages.goApplication = function (appId) {
    clearStage();
    Pages.current = "application";
    record(() => Pages.goApplication(appId));
    const app = App.Data.app(appId);
    const sec = App.Data.sector(app.sectorId);
    buildNav(["Landing", sec.name, app.name]);
    App.focusCamera && App.focusCamera(new V3(0.7, 0.9, -0.1), 8.6, 70);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", false);
    const st = App.Config.status[app.status];

    // LEFT: application details in numbers
    App.UI.clear("left");
    App.UI.add("left", App.UI.title(app.name, st.hex));
    App.UI.add("left", App.UI.subtitle(`${st.label} · ${sec.name} · ${app.owner}`));
    App.UI.add("left", App.UI.divider());
    App.UI.add("left", twoCol([
      [App.fmt.pct(app.metrics.uptime), "Uptime", st.hex],
      [app.metrics.latencyMs + "ms", "Latency p95", "#7fe9ff"],
      [App.fmt.compact(app.metrics.rps), "Req / s", "#36f1cd"],
      [App.fmt.compact(app.metrics.users), "Users", "#9b8cff"],
      [App.fmt.money(app.metrics.costPerMonth), "Cost / mo", "#ffd166"],
      [String(app.metrics.incidents30d), "Incidents 30d", app.metrics.incidents30d > 5 ? "#ff4d6d" : "#ffd166"],
      [App.fmt.compact(app.metrics.apiCallsDay), "API calls/day", "#00e5ff"],
      [App.fmt.compact(app.metrics.dataGB) + "GB", "Data", "#9b8cff"],
    ]));
    App.UI.add("left", App.UI.divider());
    const tech = App.UI.subtitle("Stack:  " + app.tech.join("  ·  ")); tech.height = "40px";
    App.UI.add("left", tech);
    App.UI.add("left", App.UI.spacer(6));
    App.UI.add("left", App.UI.button("⟂ Compare in 3D", () => Pages.goComparison(appId, null),
      { width: "260px", height: "48px", color: "#ff2bd6" }));

    // MIDDLE + RIGHT: the 3D architecture graph
    const graph = App.Graph.build(Pages.scene, app, { center: new V3(0.6, 0.7, 0), scale: 1.0, autoSpin: false });
    Pages._graphs.push(graph);

    // filter chips + legend (transient center-bottom panel)
    buildFilterPanel(app, graph);
  };

  function buildFilterPanel(app, graph) {
    const types = [...new Set(app.architecture.elements.map((e) => e.type))];
    Pages._filter = new Set(types);
    const fp = centerPanel(2.6, 1.1, new V3(0.6, -1.5, 1.4));
    fp.root.addControl(App.UI.title("Filter · Element Types"));
    const wrap = new G.StackPanel(); wrap.isVertical = false; wrap.height = "44px";
    fp.root.addControl(wrap);
    const wrap2 = new G.StackPanel(); wrap2.isVertical = false; wrap2.height = "44px";
    fp.root.addControl(wrap2);
    types.forEach((tp, i) => {
      const style = App.Config.elementTypes[tp];
      const chip = App.UI.chip(style.label, style.color, true, (on) => {
        if (on) Pages._filter.add(tp); else Pages._filter.delete(tp);
        graph.applyFilter(Pages._filter);
      });
      chip.paddingLeft = "5px"; chip.paddingRight = "5px";
      (i % 2 === 0 ? wrap : wrap2).addControl(chip);
    });
  }

  // ============================================================ COMPARISON
  Pages.goComparison = function (idA, idB) {
    clearStage();
    Pages.current = "comparison";
    record(() => Pages.goComparison(idA, idB));
    buildNav(["Landing", "3D Comparison"]);
    App.focusCamera && App.focusCamera(new V3(0, 0.9, 0.3), 13.5, 74);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", true);

    const appA = App.Data.app(idA);
    // default B = another app in same sector (or first different app)
    if (!idB) {
      const sib = App.Data.appsInSector(appA.sectorId).find((a) => a.id !== idA);
      idB = (sib || App.Data.applications.find((a) => a.id !== idA)).id;
    }
    const appB = App.Data.app(idB);

    Pages._graphs.push(App.Graph.build(Pages.scene, appA, { center: new V3(-2.6, 0.9, 0.5), scale: 0.7, autoSpin: true }));
    Pages._graphs.push(App.Graph.build(Pages.scene, appB, { center: new V3(2.6, 0.9, 0.5), scale: 0.7, autoSpin: true }));

    buildComparePanel("left", appA, "A", (id) => Pages.goComparison(id, idB));
    buildComparePanel("right", appB, "B", (id) => Pages.goComparison(idA, id));
  };

  function buildComparePanel(dock, app, tag, onPick) {
    const sec = App.Data.sector(app.sectorId);
    const st = App.Config.status[app.status];
    App.UI.clear(dock);
    App.UI.add(dock, App.UI.title("App " + tag + " · " + app.name, st.hex));
    App.UI.add(dock, App.UI.subtitle(`${sec.name} · ${st.label}`));
    App.UI.add(dock, App.UI.divider());
    App.UI.add(dock, twoCol([
      [App.fmt.pct(app.metrics.uptime), "Uptime", st.hex],
      [app.metrics.latencyMs + "ms", "Latency", "#7fe9ff"],
      [App.fmt.compact(app.metrics.rps), "Req/s", "#36f1cd"],
      [String(app.architecture.elements.length), "Elements", "#9b8cff"],
      [App.fmt.money(app.metrics.costPerMonth), "Cost/mo", "#ffd166"],
      [String(app.metrics.incidents30d), "Incidents", "#ff4d6d"],
    ]));
    App.UI.add(dock, App.UI.divider());
    const pick = App.UI.subtitle("Swap App " + tag + ":"); pick.height = "26px";
    App.UI.add(dock, pick);
    const sv = App.UI.scroller(220);
    App.Data.applications.forEach((a) => {
      const s = App.Config.status[a.status];
      sv.stack.addControl(App.UI.listRow(a.name, App.Data.sector(a.sectorId).name, s.hex, () => onPick(a.id)));
    });
    App.UI.add(dock, sv.sv);
  }

  // ----------------------------------------------------------- small helpers
  // two-column grid of metric tiles
  function twoCol(items) {
    const outer = new G.StackPanel(); outer.spacing = 8;
    for (let i = 0; i < items.length; i += 2) {
      const row = new G.StackPanel(); row.isVertical = false; row.height = "90px"; row.spacing = 8;
      [items[i], items[i + 1]].forEach((it) => {
        if (!it) return;
        const tile = App.UI.metricTile(it[0], it[1], it[2]);
        tile.width = "150px";
        row.addControl(tile);
      });
      outer.addControl(row);
    }
    return outer;
  }

  function labelPlane(scene, text, sub, hex) {
    const plane = BABYLON.MeshBuilder.CreatePlane("lbl", { width: 2.4, height: 0.8 }, scene);
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    plane.isPickable = false;
    const dt = new BABYLON.DynamicTexture("lt", { width: 512, height: 170 }, scene, true);
    dt.hasAlpha = true;
    const ctx = dt.getContext();
    ctx.clearRect(0, 0, 512, 170);
    ctx.textAlign = "center";
    ctx.font = "bold 52px Segoe UI";
    ctx.fillStyle = "#eaffff"; ctx.shadowColor = hex; ctx.shadowBlur = 18;
    ctx.fillText(text, 256, 64);
    ctx.shadowBlur = 0; ctx.font = "30px Segoe UI"; ctx.fillStyle = hex;
    ctx.fillText((sub || "").toUpperCase(), 256, 120);
    dt.update();
    const m = new BABYLON.StandardMaterial("lm", scene);
    m.diffuseTexture = dt; m.emissiveTexture = dt; m.opacityTexture = dt;
    m.emissiveColor = BABYLON.Color3.White(); m.disableLighting = true;
    plane.material = m;
    return plane;
  }

  App.Pages = Pages;
})(typeof window !== "undefined" ? window : this);
