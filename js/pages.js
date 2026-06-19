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
    // Stage root: holds all 3D content so VR zoom/rotate can transform it as one.
    App.stage = new BABYLON.TransformNode("stage", scene);
    Pages.goLanding();
    return Pages;
  };

  // ---------------------------------------------------------------- teardown
  function clearStage() {
    if (Pages._cmp && Pages._cmp.cleanup) { Pages._cmp.cleanup(); }
    Pages._cmp = null;
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
    node.parent = App.stage;
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
    App.focusCamera && App.focusCamera(new V3(1.0, 1.1, -0.4), 10.5, 74);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", false); // applications are now shown as 3D blocks

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
    // small floating sector emblem, up and to the back-left as an accent
    const emblem = buildSectorBlock(Pages.scene, sec, new V3(-1.6, 3.1, -4.2));
    emblem.scaling = new V3(0.5, 0.5, 0.5);
    Pages._transient.push(emblem);

    // RIGHT: applications shown as interactive 3D blocks (arc on the right)
    const apps = App.Data.appsInSector(sectorId);
    const n = apps.length;
    apps.forEach((app, i) => {
      const a = -0.5 + (n === 1 ? 0.5 : i / (n - 1));   // 0..1 fraction
      const x = 2.6 + Math.sin(i * 0.9) * 0.25;
      const y = 1.9 - a * 3.0;                            // stacked column
      const z = 0.3 - Math.cos(a * Math.PI) * 0.4;
      const block = buildAppBlock(Pages.scene, app, new V3(x, y, z));
      Pages._transient.push(block);
    });
  };

  // a small interactive 3D "card" for one application (used on the sector page)
  function buildAppBlock(scene, app, pos) {
    const st = App.Config.status[app.status];
    const c = BABYLON.Color3.FromHexString(st.hex);
    const node = new BABYLON.TransformNode("app-" + app.id, scene);
    node.parent = App.stage;
    node.position = pos;

    const box = BABYLON.MeshBuilder.CreateBox("appbox-" + app.id, { width: 1.0, height: 0.62, depth: 0.62 }, scene);
    box.parent = node;
    const m = new BABYLON.StandardMaterial("appm", scene);
    m.emissiveColor = c.scale(0.55); m.diffuseColor = c.scale(0.18); m.alpha = 0.85;
    m.emissiveFresnelParameters = new BABYLON.FresnelParameters();
    m.emissiveFresnelParameters.power = 2;
    m.emissiveFresnelParameters.leftColor = c.scale(1.5);
    m.emissiveFresnelParameters.rightColor = c.scale(0.3);
    box.material = m;

    const lbl = labelPlane(scene, app.name,
      `${st.label} · ${App.fmt.pct(app.metrics.uptime)} · ${app.metrics.latencyMs}ms`, st.hex);
    lbl.parent = node; lbl.position = new V3(0, 0.62, 0); lbl.scaling = new V3(0.5, 0.5, 0.5);

    box.actionManager = new BABYLON.ActionManager(scene);
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOverTrigger,
      () => { box.scaling.setAll(1.12); }));
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPointerOutTrigger,
      () => { box.scaling.setAll(1); }));
    box.actionManager.registerAction(new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger,
      () => Pages.goApplication(app.id)));

    let t = Math.random() * 6;
    const obs = scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime() / 16.6;
      t += 0.02 * dt; box.position.y = Math.sin(t) * 0.04;
    });
    const origDispose = node.dispose.bind(node);
    node.dispose = () => { scene.onBeforeRenderObservable.remove(obs); origDispose(false, true); };
    return node;
  }

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
    App.UI.add("left", App.UI.button("⟂ Compare in 3D", () => Pages.goComparePicker(appId),
      { width: "260px", height: "48px", color: "#ff2bd6" }));

    // MIDDLE + RIGHT: the 3D architecture graph
    const graph = App.Graph.build(Pages.scene, app, {
      center: new V3(0.6, 0.7, 0), scale: 1.0, autoSpin: false, parentNode: App.stage,
    });
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

  // ====================================================== COMPARE PICKER
  // Reached from the Application page "Compare in 3D" button: choose the
  // second application to compare the current one against.
  Pages.goComparePicker = function (appId) {
    clearStage();
    Pages.current = "comparePicker";
    record(() => Pages.goComparePicker(appId));
    const appA = App.Data.app(appId);
    const sec = App.Data.sector(appA.sectorId);
    const stA = App.Config.status[appA.status];
    buildNav(["Landing", sec.name, appA.name, "Compare"]);
    App.focusCamera && App.focusCamera(new V3(-0.4, 0.9, -0.2), 9.8, 72);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", false);

    // LEFT: which application we are comparing
    App.UI.clear("left");
    App.UI.add("left", App.UI.title(appA.name, stA.hex));
    App.UI.add("left", App.UI.subtitle("First application (App A)"));
    App.UI.add("left", App.UI.divider());
    const hint = App.UI.subtitle("Pick a second application from the list to compare with in 3D.");
    hint.height = "70px";
    App.UI.add("left", hint);

    // context: spinning small graph of A
    Pages._graphs.push(App.Graph.build(Pages.scene, appA, {
      center: new V3(-2.4, 0.9, 0.3), scale: 0.55, autoSpin: true, parentNode: App.stage,
    }));

    // CENTER: list of candidate applications to compare against
    const cp = centerPanel(2.7, 3.1, new V3(1.5, 1.0, 0.6));
    cp.root.addControl(App.UI.title("Compare With"));
    cp.root.addControl(App.UI.subtitle("Select the second application"));
    cp.root.addControl(App.UI.divider());
    const sv = App.UI.scroller(600);
    App.Data.applications.filter((a) => a.id !== appId).forEach((a) => {
      const s = App.Config.status[a.status];
      sv.stack.addControl(App.UI.listRow(
        a.name, `${App.Data.sector(a.sectorId).name} · ${s.label}`,
        s.hex, () => Pages.goComparison(appId, a.id)));
    });
    cp.root.addControl(sv.sv);
  };

  // ============================================================ COMPARISON
  Pages.goComparison = function (idA, idB, state) {
    clearStage();
    Pages.current = "comparison";
    record(() => Pages.goComparison(idA, idB, state));
    buildNav(["Landing", "3D Comparison"]);
    App.focusCamera && App.focusCamera(new V3(0, 0.9, 0.3), 13.5, 74);
    App.UI.setDockVisible("left", true);
    App.UI.setDockVisible("right", true);

    const appA = App.Data.app(idA);
    if (!idB) {
      const sib = App.Data.appsInSector(appA.sectorId).find((a) => a.id !== idA);
      idB = (sib || App.Data.applications.find((a) => a.id !== idA)).id;
    }
    const appB = App.Data.app(idB);
    const scene = Pages.scene;

    const cmp = (Pages._cmp = {
      idA, idB,
      schemeA: (state && state.schemeA) || "cyan",
      schemeB: (state && state.schemeB) || "magenta",
      detail: state && typeof state.detail === "number" ? state.detail : 1,
      selectedName: null,
      gA: null, gB: null, link: null, linkObs: null, statusText: null,
    });
    cmp.cleanup = () => clearLink(cmp);
    cmp.selectByName = (name) => updateSelection(cmp, name); // used by element picks
    const snap = () => ({ schemeA: cmp.schemeA, schemeB: cmp.schemeB, detail: cmp.detail });

    function rebuildGraphs() {
      [cmp.gA, cmp.gB].forEach((g) => {
        if (!g) return;
        const i = Pages._graphs.indexOf(g);
        if (i >= 0) Pages._graphs.splice(i, 1);
        g.dispose();
      });
      clearLink(cmp);
      const onSel = (id, e) => updateSelection(cmp, e.name);
      cmp.gA = App.Graph.build(scene, appA, {
        center: new V3(-2.6, 0.9, 0.5), scale: 0.7, autoSpin: false,
        scheme: App.Config.schemes[cmp.schemeA].base, parentNode: App.stage, onSelect: onSel,
      });
      cmp.gB = App.Graph.build(scene, appB, {
        center: new V3(2.6, 0.9, 0.5), scale: 0.7, autoSpin: false,
        scheme: App.Config.schemes[cmp.schemeB].base, parentNode: App.stage, onSelect: onSel,
      });
      Pages._graphs.push(cmp.gA, cmp.gB);
      cmp.gA.setDetail(cmp.detail);
      cmp.gB.setDetail(cmp.detail);
      if (cmp.selectedName) updateSelection(cmp, cmp.selectedName);
    }

    rebuildGraphs();

    // LEFT / RIGHT docks: per-app metrics + swap list
    buildComparePanel("left", appA, "A", cmp.schemeA, (id) => Pages.goComparison(id, idB, snap()));
    buildComparePanel("right", appB, "B", cmp.schemeB, (id) => Pages.goComparison(idA, id, snap()));

    // CENTER-BOTTOM: comparison controls (colour schemes + detail slider)
    buildCompareControls(cmp, appA, appB, rebuildGraphs);
  };

  // remove the live connector line + its updater
  function clearLink(cmp) {
    if (cmp.linkObs) { Pages.scene.onBeforeRenderObservable.remove(cmp.linkObs); cmp.linkObs = null; }
    if (cmp.link) { try { cmp.link.dispose(); } catch (e) {} cmp.link = null; }
  }

  // select an element by name: highlight it + its counterpart, draw a link
  function updateSelection(cmp, name) {
    cmp.selectedName = name;
    if (cmp.gA) cmp.gA.clearHighlights();
    if (cmp.gB) cmp.gB.clearHighlights();
    clearLink(cmp);
    const ea = cmp.gA && cmp.gA.findByName(name);
    const eb = cmp.gB && cmp.gB.findByName(name);
    if (ea) cmp.gA.highlight(ea.id, true, "#ffffff");
    if (eb) cmp.gB.highlight(eb.id, true, "#ffffff");

    if (cmp.statusText) {
      cmp.statusText.text = ea && eb
        ? `◉ ${name} — linked in both`
        : `◉ ${name} — only in App ${ea ? "A" : "B"}`;
      cmp.statusText.color = ea && eb ? "#eaffff" : "#ffd166";
    }

    if (ea && eb) {
      const scene = Pages.scene;
      cmp.link = BABYLON.MeshBuilder.CreateLines("cmp-link",
        { points: [V3.Zero(), V3.Zero()], updatable: true }, scene);
      cmp.link.color = new BABYLON.Color3(1, 1, 1);
      cmp.link.isPickable = false;
      cmp.linkObs = scene.onBeforeRenderObservable.add(() => {
        const pa = cmp.gA.worldPosOf(ea.id), pb = cmp.gB.worldPosOf(eb.id);
        if (!pa || !pb) return;
        cmp.link = BABYLON.MeshBuilder.CreateLines("cmp-link", { points: [pa, pb], instance: cmp.link });
      });
    }
  }

  function buildComparePanel(dock, app, tag, schemeKey, onPick) {
    const sec = App.Data.sector(app.sectorId);
    const st = App.Config.status[app.status];
    const schemeHex = App.Config.schemes[schemeKey].base;
    App.UI.clear(dock);
    App.UI.add(dock, App.UI.title("App " + tag + " · " + app.name, schemeHex));
    App.UI.add(dock, App.UI.subtitle(`${sec.name} · ${st.label} · ${App.Config.schemes[schemeKey].name} scheme`));
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
    const sv = App.UI.scroller(200);
    App.Data.applications.forEach((a) => {
      const s = App.Config.status[a.status];
      sv.stack.addControl(App.UI.listRow(a.name, App.Data.sector(a.sectorId).name, s.hex, () => onPick(a.id)));
    });
    App.UI.add(dock, sv.sv);
  }

  // colour-scheme pickers + detail slider for the comparison page
  function buildCompareControls(cmp, appA, appB, rebuild) {
    const ctrl = centerPanel(3.6, 1.7, new V3(0, -1.7, 1.8));
    ctrl.root.addControl(App.UI.title("Compare Controls"));

    ctrl.root.addControl(schemeRow("App A", cmp.schemeA, (k) => { cmp.schemeA = k; rebuild(); refreshDocks(); }));
    ctrl.root.addControl(schemeRow("App B", cmp.schemeB, (k) => { cmp.schemeB = k; rebuild(); refreshDocks(); }));

    function refreshDocks() {
      buildComparePanel("left", appA, "A", cmp.schemeA, (id) => Pages.goComparison(id, cmp.idB, { schemeA: cmp.schemeA, schemeB: cmp.schemeB, detail: cmp.detail }));
      buildComparePanel("right", appB, "B", cmp.schemeB, (id) => Pages.goComparison(cmp.idA, id, { schemeA: cmp.schemeA, schemeB: cmp.schemeB, detail: cmp.detail }));
    }

    // detail slider
    const row = new G.StackPanel(); row.isVertical = false; row.height = "44px"; row.paddingTop = "6px";
    const dl = new G.TextBlock(); dl.text = "DETAIL"; dl.width = "120px"; dl.color = "#7fe9ff"; dl.fontSize = 18;
    row.addControl(dl);
    const slider = new G.Slider();
    slider.minimum = 0; slider.maximum = 1; slider.value = cmp.detail;
    slider.height = "26px"; slider.width = "420px";
    slider.color = "#00e5ff"; slider.background = "#06222e"; slider.borderColor = "#1ea7c9";
    slider.onValueChangedObservable.add((v) => {
      cmp.detail = v;
      if (cmp.gA) cmp.gA.setDetail(v);
      if (cmp.gB) cmp.gB.setDetail(v);
    });
    row.addControl(slider);
    ctrl.root.addControl(row);

    const ends = new G.TextBlock();
    ends.text = "◄ merge into one shape          full detail ►";
    ends.color = App.Config.palette.textDim; ends.fontSize = 13; ends.height = "22px";
    ctrl.root.addControl(ends);

    cmp.statusText = new G.TextBlock();
    cmp.statusText.text = "Select an element to link it across both apps";
    cmp.statusText.color = App.Config.palette.textDim; cmp.statusText.fontSize = 16; cmp.statusText.height = "30px";
    ctrl.root.addControl(cmp.statusText);
  }

  // a single-select row of colour-scheme swatches
  function schemeRow(label, currentKey, onPick) {
    const row = new G.StackPanel(); row.isVertical = false; row.height = "44px";
    const lbl = new G.TextBlock(); lbl.text = label; lbl.width = "120px"; lbl.color = "#bfe9f5"; lbl.fontSize = 18;
    row.addControl(lbl);
    App.Config.schemeOrder.forEach((key) => {
      const sc = App.Config.schemes[key];
      const b = G.Button.CreateSimpleButton("sch", "");
      b.width = "52px"; b.height = "34px"; b.cornerRadius = 8;
      b.background = sc.base;
      b.thickness = key === currentKey ? 4 : 1;
      b.color = key === currentKey ? "#ffffff" : "#04111d";
      b.paddingLeft = "4px"; b.paddingRight = "4px";
      b.onPointerUpObservable.add(() => onPick(key));
      row.addControl(b);
    });
    return row;
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
