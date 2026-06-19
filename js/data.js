/* data.js — fetch + index the mock data. Attaches App.Data. */
(function (global) {
  const App = (global.App = global.App || {});

  const Data = {
    raw: null,
    sectors: [],
    applications: [],
    _sectorById: {},
    _appById: {},

    async load(url) {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error(`Failed to load ${url}: HTTP ${res.status}`);
      const json = await res.json();
      this.raw = json;
      this.sectors = json.sectors || [];
      this.applications = json.applications || [];
      this._sectorById = Object.fromEntries(this.sectors.map((s) => [s.id, s]));
      this._appById = Object.fromEntries(this.applications.map((a) => [a.id, a]));
      return this;
    },

    sector(id) { return this._sectorById[id]; },
    app(id) { return this._appById[id]; },

    appsInSector(sectorId) {
      const sec = this.sector(sectorId);
      if (!sec) return [];
      return sec.applicationIds.map((id) => this.app(id)).filter(Boolean);
    },

    // aggregate metrics across all applications (Landing page)
    aggregate() {
      const apps = this.applications;
      const n = apps.length || 1;
      const sum = (f) => apps.reduce((acc, a) => acc + f(a), 0);
      const byStatus = { healthy: 0, warning: 0, critical: 0 };
      apps.forEach((a) => (byStatus[a.status] = (byStatus[a.status] || 0) + 1));
      return {
        applications: apps.length,
        sectors: this.sectors.length,
        avgUptime: +(sum((a) => a.metrics.uptime) / n).toFixed(2),
        totalUsers: sum((a) => a.metrics.users),
        totalCost: sum((a) => a.metrics.costPerMonth),
        totalDataGB: sum((a) => a.metrics.dataGB),
        incidents30d: sum((a) => a.metrics.incidents30d),
        elements: sum((a) => a.architecture.elements.length),
        byStatus,
      };
    },

    // outgoing/incoming relations for an element id within an app
    relationsFor(app, elementId) {
      return app.architecture.relations.filter(
        (r) => r.source === elementId || r.target === elementId
      );
    },
  };

  // ---- formatting helpers (shared) ----
  App.fmt = {
    num(n) { return (n ?? 0).toLocaleString("en-US"); },
    compact(n) {
      n = n || 0;
      if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
      return String(Math.round(n));
    },
    money(n) {
      n = n || 0;
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return "$" + (n / 1e3).toFixed(0) + "K";
      return "$" + n;
    },
    pct(n) { return (n ?? 0).toFixed(2) + "%"; },
  };

  App.Data = Data;
})(typeof window !== "undefined" ? window : this);
