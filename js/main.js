/* main.js — engine, scene, camera, lights, WebXR, boot wiring. */
(function (global) {
  const App = global.App;
  const V3 = BABYLON.Vector3;

  const boot = document.getElementById("boot");
  const bootMsg = document.getElementById("bootMsg");
  const hudStatus = document.getElementById("hudStatus");
  const setMsg = (m) => { if (bootMsg) bootMsg.textContent = m; };
  function fail(msg) {
    boot.classList.add("err");
    boot.querySelector("h1").textContent = "Error";
    setMsg(msg);
    console.error(msg);
  }

  async function start() {
    const canvas = document.getElementById("renderCanvas");
    const engine = new BABYLON.Engine(canvas, true, { stencil: true, antialias: true });
    const scene = new BABYLON.Scene(engine);

    // ---- camera (desktop orbit) ----
    const camera = new BABYLON.ArcRotateCamera(
      "cam", BABYLON.Tools.ToRadians(-90), BABYLON.Tools.ToRadians(77), 14.5, new V3(0, 1.0, 0.2), scene
    );
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 5;
    camera.upperRadiusLimit = 24;
    camera.lowerBetaLimit = 0.3;
    camera.upperBetaLimit = BABYLON.Tools.ToRadians(100);
    camera.wheelDeltaPercentage = 0.02;
    camera.panningSensibility = 0;       // disable pan; keep orbit clean
    camera.minZ = 0.1;
    App.camera = camera;

    // --- smooth per-page camera framing ---
    const focus = { target: camera.target.clone(), radius: camera.radius, beta: camera.beta, active: false };
    App.focusCamera = (target, radius, beta) => {
      if (target) focus.target = target.clone();
      if (radius) focus.radius = radius;
      if (beta) focus.beta = BABYLON.Tools.ToRadians(beta);
      focus.active = true;
    };
    scene.onBeforeRenderObservable.add(() => {
      if (!focus.active) return;
      const k = 0.06;
      camera.target = BABYLON.Vector3.Lerp(camera.target, focus.target, k);
      camera.radius += (focus.radius - camera.radius) * k;
      camera.beta += (focus.beta - camera.beta) * k;
      if (Math.abs(focus.radius - camera.radius) < 0.02 &&
          BABYLON.Vector3.Distance(camera.target, focus.target) < 0.02) focus.active = false;
    });

    // ---- lights ----
    const hemi = new BABYLON.HemisphericLight("hemi", new V3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = App.Config.palette.primary;
    hemi.groundColor = new BABYLON.Color3(0.02, 0.04, 0.08);
    const key = new BABYLON.DirectionalLight("key", new V3(-0.4, -1, 0.6), scene);
    key.intensity = 0.5;

    // ---- environment + data + pages ----
    setMsg("Building holographic environment…");
    App.Effects.build(scene);

    setMsg("Loading architecture data…");
    try {
      await App.Data.load(App.Config.dataUrl);
    } catch (e) {
      fail(
        "Could not load " + App.Config.dataUrl + ". " +
        "Serve this folder over http(s) (e.g. run serve.cmd or `python -m http.server 8080`) " +
        "and open http://localhost:8080 — opening index.html directly via file:// is blocked by the browser. (" + e.message + ")"
      );
      return;
    }

    setMsg("Rendering interface…");
    App.Pages.init(scene);

    // ---- WebXR ----
    setMsg("Checking WebXR / VR support…");
    await setupXR(scene);

    // ---- run ----
    engine.runRenderLoop(() => scene.render());
    window.addEventListener("resize", () => engine.resize());

    // fade out boot overlay
    boot.style.transition = "opacity .6s ease";
    boot.style.opacity = "0";
    setTimeout(() => (boot.style.display = "none"), 650);
    hudStatus.textContent = "SYS · ONLINE";
  }

  async function setupXR(scene) {
    let supported = false;
    try {
      supported = !!(navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr")));
    } catch (e) { supported = false; }

    if (!supported) {
      hudStatus.textContent = "SYS · DESKTOP MODE";
      return; // desktop-only; everything still works with mouse
    }

    try {
      const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: App.Effects.grid ? [App.Effects.grid] : [],
        uiOptions: { sessionMode: "immersive-vr", referenceSpaceType: "local-floor" },
      });
      App.xr = xr;
      const fm = xr.baseExperience.featuresManager;

      // hand tracking (Quest)
      try {
        fm.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, "latest", {
          xrInput: xr.input,
          jointMeshes: { enablePhysics: false },
        });
      } catch (e) { console.warn("Hand tracking unavailable:", e.message); }

      // near interaction (poke/pinch GUI + blocks)
      try {
        fm.enableFeature(BABYLON.WebXRFeatureName.NEAR_INTERACTION, "latest", { xrInput: xr.input });
      } catch (e) { console.warn("Near interaction unavailable:", e.message); }

      // teleport on the grid (controllers with a thumbstick)
      try {
        if (App.Effects.grid) {
          const tp = fm.enableFeature(BABYLON.WebXRFeatureName.TELEPORTATION, "stable", {
            xrInput: xr.input, floorMeshes: [App.Effects.grid],
            defaultTargetMeshOptions: { teleportationFillColor: "#00e5ff", teleportationBorderColor: "#7fe9ff" },
          });
          if (tp && tp.parabolicCheckRadius !== undefined) tp.parabolicRayEnabled = true;
        }
      } catch (e) { /* optional */ }

      // hand-friendly locomotion: a wrist console with teleport-step buttons
      setupLocomotion(xr, scene);

      hudStatus.textContent = "SYS · VR READY";
    } catch (e) {
      console.warn("XR init failed, continuing in desktop mode:", e);
      hudStatus.textContent = "SYS · DESKTOP MODE";
    }
  }

  // Hand-friendly locomotion. Builds a small console pinned in front of the
  // user (always within reach) that teleports the rig closer / back along the
  // gaze direction, plus a reset. Works with hand tracking and controllers.
  function setupLocomotion(xr, scene) {
    const cam = xr.baseExperience.camera;
    const START = new BABYLON.Vector3(0, 0, 3.2);   // comfortable VR start spot
    const STEP = 1.1;                               // metres per teleport press

    // move the rig horizontally along where the user is looking
    App.rigMove = (metres) => {
      const f = cam.getDirection(BABYLON.Axis.Z);
      f.y = 0;
      if (f.lengthSquared() < 1e-4) return;
      f.normalize();
      cam.position.addInPlace(f.scale(metres));
    };
    App.rigReset = () => cam.position.copyFrom(START);

    // --- wrist console (GUI plane parented to the head) ---
    const plane = BABYLON.MeshBuilder.CreatePlane("vrnav", { width: 0.40, height: 0.16 }, scene);
    plane.parent = cam;
    plane.position = new BABYLON.Vector3(0, -0.34, 0.7); // low and in front
    plane.rotation.x = BABYLON.Tools.ToRadians(38);
    plane.isVisible = false;
    plane.renderingGroupId = 1; // draw on top

    const adt = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(plane, 760, 304, false);
    const bg = new BABYLON.GUI.Rectangle();
    bg.thickness = 2; bg.cornerRadius = 22; bg.color = "#1ea7c9"; bg.background = "#06131fdd";
    adt.addControl(bg);
    const title = new BABYLON.GUI.TextBlock();
    title.text = "TELEPORT"; title.color = "#7fe9ff"; title.fontSize = 34;
    title.top = "-110px"; title.shadowColor = "#00e5ff"; title.shadowBlur = 14;
    bg.addControl(title);

    const row = new BABYLON.GUI.StackPanel();
    row.isVertical = false; row.height = "150px"; row.top = "22px";
    bg.addControl(row);

    const mkBtn = (label, color, fn) => {
      const b = BABYLON.GUI.Button.CreateSimpleButton("b", label);
      b.width = "220px"; b.height = "130px"; b.thickness = 2; b.cornerRadius = 16;
      b.color = color; b.background = "#06131f"; b.paddingLeft = "10px"; b.paddingRight = "10px";
      if (b.textBlock) { b.textBlock.color = color; b.textBlock.fontSize = 36; }
      b.onPointerEnterObservable.add(() => { b.background = color; if (b.textBlock) b.textBlock.color = "#03121a"; });
      b.onPointerOutObservable.add(() => { b.background = "#06131f"; if (b.textBlock) b.textBlock.color = color; });
      b.onPointerUpObservable.add(fn);
      row.addControl(b);
      return b;
    };
    mkBtn("‹ BACK", "#7fe9ff", () => App.rigMove(-STEP));
    mkBtn("RESET", "#ffd166", () => App.rigReset());
    mkBtn("CLOSER ›", "#36f1cd", () => App.rigMove(STEP));

    // show only while immersed; place the user well on entry
    xr.baseExperience.onStateChangedObservable.add((state) => {
      if (state === BABYLON.WebXRState.IN_XR) { App.rigReset(); plane.isVisible = true; }
      else if (state === BABYLON.WebXRState.NOT_IN_XR) { plane.isVisible = false; }
    });
  }

  // kick off after libraries are present
  function bootstrap() {
    if (typeof BABYLON === "undefined" || !BABYLON.GUI) {
      return fail("Babylon.js failed to load from CDN. Check your internet connection.");
    }
    start().catch((e) => fail("Unexpected error: " + (e && e.message ? e.message : e)));
  }

  if (document.readyState === "complete") bootstrap();
  else window.addEventListener("load", bootstrap);
})(typeof window !== "undefined" ? window : this);
