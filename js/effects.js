/* effects.js — environment: grid floor, starfield, glow, ambient particles.
   Attaches App.Effects. */
(function (global) {
  const App = (global.App = global.App || {});
  const Effects = {};

  Effects.build = function (scene) {
    const cfg = App.Config;
    const pal = cfg.palette;
    scene.clearColor = new BABYLON.Color4(pal.bg.r, pal.bg.g, pal.bg.b, 1);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(pal.bg.r, pal.bg.g, pal.bg.b);
    scene.fogDensity = 0.012;

    // --- Glow layer (the "hologram" bloom) ---
    const glow = new BABYLON.GlowLayer("glow", scene, { blurKernelSize: 32 });
    glow.intensity = cfg.tunables.glowIntensity;
    Effects.glow = glow;

    // --- Grid floor ---
    const grid = BABYLON.MeshBuilder.CreateGround(
      "gridFloor", { width: 60, height: 60, subdivisions: 1 }, scene
    );
    grid.position.y = -2.4;
    const gm = new BABYLON.GridMaterial("gridMat", scene);
    gm.majorUnitFrequency = 5;
    gm.minorUnitVisibility = 0.35;
    gm.gridRatio = 1;
    gm.mainColor = pal.bg;
    gm.lineColor = pal.grid;
    gm.opacity = 0.55;
    gm.backFaceCulling = false;
    grid.material = gm;
    grid.isPickable = false;
    Effects.grid = grid;

    // soft radial vignette under the stage
    const halo = BABYLON.MeshBuilder.CreateDisc("halo", { radius: 16, tessellation: 64 }, scene);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -2.39;
    const hm = new BABYLON.StandardMaterial("haloMat", scene);
    hm.emissiveColor = pal.primary.scale(0.25);
    hm.alpha = 0.06;
    hm.disableLighting = true;
    halo.material = hm;
    halo.isPickable = false;

    // --- Starfield ---
    Effects.buildStars(scene);
    // --- Ambient drifting particles ---
    Effects.buildAmbient(scene);

    return Effects;
  };

  Effects.buildStars = function (scene) {
    const n = App.Config.tunables.starCount;
    const sps = new BABYLON.PointsCloudSystem("stars", 1, scene);
    sps.addPoints(n, (p) => {
      // shell of stars around the scene
      const r = 26 + Math.random() * 22;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      p.position = new BABYLON.Vector3(
        r * Math.sin(ph) * Math.cos(th),
        Math.abs(r * Math.cos(ph)) * 0.6 - 2,
        r * Math.sin(ph) * Math.sin(th)
      );
      const t = Math.random();
      const c = App.Config.palette.primary;
      p.color = new BABYLON.Color4(0.5 + t * 0.5, 0.8, 1.0, 0.4 + Math.random() * 0.6);
    });
    sps.buildMeshAsync().then((mesh) => {
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true;
    });
  };

  Effects.buildAmbient = function (scene) {
    const ps = new BABYLON.ParticleSystem("ambient", App.Config.tunables.ambientParticles, scene);
    ps.particleTexture = Effects._dotTexture(scene);
    ps.emitter = new BABYLON.Vector3(0, 0, 0);
    ps.minEmitBox = new BABYLON.Vector3(-14, -2, -14);
    ps.maxEmitBox = new BABYLON.Vector3(14, 9, 14);
    const c = App.Config.palette.primary;
    ps.color1 = new BABYLON.Color4(c.r, c.g, c.b, 0.5);
    ps.color2 = new BABYLON.Color4(0.6, 0.2, 0.9, 0.4);
    ps.colorDead = new BABYLON.Color4(0, 0, 0, 0);
    ps.minSize = 0.02; ps.maxSize = 0.08;
    ps.minLifeTime = 6; ps.maxLifeTime = 12;
    ps.emitRate = 30;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.direction1 = new BABYLON.Vector3(-0.05, 0.15, -0.05);
    ps.direction2 = new BABYLON.Vector3(0.05, 0.4, 0.05);
    ps.minEmitPower = 0.05; ps.maxEmitPower = 0.2;
    ps.gravity = new BABYLON.Vector3(0, 0.02, 0);
    ps.start();
    Effects.ambient = ps;
  };

  // small soft white dot used as particle/sprite texture
  Effects._dotTexture = function (scene) {
    if (Effects._dot) return Effects._dot;
    const size = 64;
    const dt = new BABYLON.DynamicTexture("dot", size, scene, false);
    const ctx = dt.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    dt.hasAlpha = true;
    dt.update();
    Effects._dot = dt;
    return dt;
  };

  App.Effects = Effects;
})(typeof window !== "undefined" ? window : this);
