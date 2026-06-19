/* config.js — palette, type styling and tunables. Attaches App.Config. */
(function (global) {
  const App = (global.App = global.App || {});

  const C = (hex) => BABYLON.Color3.FromHexString(hex);

  const Config = {
    dataUrl: "data/architecture.json",

    palette: {
      bg: C("#03060d"),
      primary: C("#00e5ff"),
      teal: C("#36f1cd"),
      magenta: C("#ff2bd6"),
      amber: C("#ffd166"),
      violet: C("#9b8cff"),
      red: C("#ff4d6d"),
      grid: C("#0a3346"),
      text: "#d7f3ff",
      textDim: "#6fb7cc",
      panelBg: "#06131fcc",      // GUI uses CSS-style colour strings
      panelBorder: "#1ea7c9",
      panelGlow: "#00e5ff",
    },

    // status -> accent colour
    status: {
      healthy:  { hex: "#36f1cd", label: "HEALTHY" },
      warning:  { hex: "#ffd166", label: "WARNING" },
      critical: { hex: "#ff4d6d", label: "CRITICAL" },
    },

    // element type -> 3D block styling
    elementTypes: {
      frontend: { shape: "box",      color: "#00e5ff", icon: "▢", label: "Frontend" },
      gateway:  { shape: "prism",    color: "#7fe9ff", icon: "◇", label: "Gateway"  },
      service:  { shape: "box",      color: "#36f1cd", icon: "▣", label: "Service"   },
      database: { shape: "cylinder", color: "#9b8cff", icon: "⛁", label: "Database"  },
      cache:    { shape: "octa",     color: "#ff2bd6", icon: "◆", label: "Cache"     },
      queue:    { shape: "torus",    color: "#ffd166", icon: "≋", label: "Queue"     },
      external: { shape: "sphere",   color: "#8aa0b5", icon: "◉", label: "External"  },
    },

    // selectable color schemes for the 3D comparison (per-application tint)
    schemes: {
      cyan:    { name: "Cyan",    base: "#00e5ff" },
      magenta: { name: "Magenta", base: "#ff2bd6" },
      amber:   { name: "Amber",   base: "#ffb000" },
      green:   { name: "Green",   base: "#36f1cd" },
      violet:  { name: "Violet",  base: "#9b8cff" },
      crimson: { name: "Crimson", base: "#ff4d6d" },
    },
    schemeOrder: ["cyan", "magenta", "amber", "green", "violet", "crimson"],

    // relation type -> connector styling
    relationTypes: {
      sync:  { color: "#00e5ff", dashed: false, label: "Sync"  },
      async: { color: "#ffd166", dashed: true,  label: "Async" },
      data:  { color: "#9b8cff", dashed: false, label: "Data"  },
      auth:  { color: "#ff2bd6", dashed: true,  label: "Auth"  },
    },

    tunables: {
      glowIntensity: 0.55,
      starCount: 1400,
      ambientParticles: 220,
      packetsPerRelation: 3,
      blockBob: 0.04,
      uiDockRadius: 3.0,
    },
  };

  App.Config = Config;
})(typeof window !== "undefined" ? window : this);
