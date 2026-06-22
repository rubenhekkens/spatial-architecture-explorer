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
      let handTracking = null;
      try {
        handTracking = fm.enableFeature(BABYLON.WebXRFeatureName.HAND_TRACKING, "latest", {
          xrInput: xr.input,
          jointMeshes: { enablePhysics: false },
        });
      } catch (e) { console.warn("Hand tracking unavailable:", e.message); }

      // near interaction (poke/pinch GUI + blocks)
      try {
        fm.enableFeature(BABYLON.WebXRFeatureName.NEAR_INTERACTION, "latest", { xrInput: xr.input });
      } catch (e) { console.warn("Near interaction unavailable:", e.message); }

      // browse the interface with two-handed pinch gestures (no menu)
      setupGestureControl(xr, scene, handTracking);

      hudStatus.textContent = "SYS · VR READY";
    } catch (e) {
      console.warn("XR init failed, continuing in desktop mode:", e);
      hudStatus.textContent = "SYS · DESKTOP MODE";
    }
  }

  // Browse the interface in VR with multi-touch-style gestures (no menu):
  //   • two hands pinched  -> spread/pinch to ZOOM, twist to ROTATE, move to PAN
  //   • one hand pinched   -> grab to PAN the whole hologram
  // Mirrors trackpad/touch pinch-zoom-rotate. Works with hand tracking; a
  // controller squeeze is used as a fallback "pinch" when hands aren't tracked.
  function setupGestureControl(xr, scene, handTracking) {
    const cam = xr.baseExperience.camera;
    const stage = App.stage;
    const V = BABYLON.Vector3;
    const START = new V(0, 0, 3.4);
    const PINCH_ON = 0.03, PINCH_OFF = 0.05;   // hysteresis on thumb–index distance

    const J = BABYLON.WebXRHandJoint || {};
    const THUMB = J.THUMB_TIP !== undefined ? J.THUMB_TIP : 4;
    const INDEX = J.INDEX_FINGER_TIP !== undefined ? J.INDEX_FINGER_TIP : 9;

    App.stageReset = () => {
      if (stage) { stage.scaling.setAll(1); stage.rotation.set(0, 0, 0); stage.position.set(0, 0, 0); }
      cam.position.copyFrom(START);
    };

    // --- controller squeeze fallback (one entry per controller) ---
    const ctrlGrabs = [];
    if (xr.input && xr.input.onControllerAddedObservable) {
      xr.input.onControllerAddedObservable.add((ctrl) => {
        const g = { pressed: false, ctrl };
        ctrl.onMotionControllerInitObservable.add((mc) => {
          const sq = mc.getComponentOfType && (mc.getComponentOfType("squeeze") || mc.getComponentOfType("grip"));
          if (sq) sq.onButtonStateChangedObservable.add(() => (g.pressed = sq.pressed));
        });
        g.pos = () => {
          if (!g.pressed) return null;
          const n = ctrl.grip || ctrl.pointer;
          return n ? n.getAbsolutePosition().clone() : null;
        };
        ctrlGrabs.push(g);
      });
    }

    // pinch point for a hand, or null when not pinching (with hysteresis)
    const pinchState = { left: false, right: false };
    function handPinch(handedness) {
      if (!handTracking || !handTracking.getHandByHandedness) return null;
      const hand = handTracking.getHandByHandedness(handedness);
      if (!hand || !hand.getJointMesh) return null;
      const tt = hand.getJointMesh(THUMB), it = hand.getJointMesh(INDEX);
      if (!tt || !it) return null;
      const a = tt.getAbsolutePosition(), b = it.getAbsolutePosition();
      const d = V.Distance(a, b);
      if (pinchState[handedness]) { if (d > PINCH_OFF) pinchState[handedness] = false; }
      else { if (d < PINCH_ON) pinchState[handedness] = true; }
      return pinchState[handedness] ? V.Center(a, b) : null;
    }

    const clampScale = (s) => Math.max(0.3, Math.min(4.5, s));
    let prev = [];

    scene.onBeforeRenderObservable.add(() => {
      if (!stage || xr.baseExperience.state !== BABYLON.WebXRState.IN_XR) { prev = []; return; }

      // collect up to two active grab points (hands first, controllers as backfill)
      const pts = [];
      const lh = handPinch("left"); if (lh) pts.push(lh);
      const rh = handPinch("right"); if (rh) pts.push(rh);
      for (const g of ctrlGrabs) { if (pts.length >= 2) break; const p = g.pos(); if (p) pts.push(p); }

      if (pts.length >= 2 && prev.length >= 2) {
        const [a, b] = pts, [pa, pb] = prev;
        const d = V.Distance(a, b), pd = V.Distance(pa, pb);
        if (pd > 1e-3) stage.scaling.setAll(clampScale(stage.scaling.x * (d / pd)));   // ZOOM
        if (d > 0.05 && pd > 0.05) {                                                   // ROTATE (twist)
          stage.rotation.y += Math.atan2(b.z - a.z, b.x - a.x) - Math.atan2(pb.z - pa.z, pb.x - pa.x);
        }
        const mid = V.Center(a, b), pmid = V.Center(pa, pb);                           // PAN
        stage.position.addInPlace(mid.subtract(pmid));
        clampStagePos(stage);
      } else if (pts.length === 1 && prev.length === 1) {
        stage.position.addInPlace(pts[0].subtract(prev[0]));                           // grab-pan
        clampStagePos(stage);
      }
      prev = pts;
    });

    function clampStagePos(s) {
      const max = 6;
      if (s.position.length() > max) s.position.scaleInPlace(max / s.position.length());
    }

    // reset framing each time the user enters VR
    xr.baseExperience.onStateChangedObservable.add((state) => {
      if (state === BABYLON.WebXRState.IN_XR) App.stageReset();
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
