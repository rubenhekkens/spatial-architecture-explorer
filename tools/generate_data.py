#!/usr/bin/env python3
"""Generate data/architecture.json -- the mock data that drives the spatial UI.

Deterministic (seeded) so the JSON is stable across runs. Re-run to regenerate:
    python tools/generate_data.py
"""
import json, os, random, datetime

random.seed(42)

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "architecture.json")

# ---------------------------------------------------------------- vocab
SECTORS = [
    ("Finance",       "#00e5ff", "Payments, ledgers and regulatory reporting."),
    ("Logistics",     "#36f1cd", "Warehousing, transport and last-mile delivery."),
    ("Customer",      "#ff2bd6", "CRM, support and customer engagement."),
    ("Manufacturing", "#ffd166", "Plant control, IoT telemetry and supply chain."),
    ("Platform",      "#9b8cff", "Shared identity, data and developer platform."),
]

# element type -> (shape, baseColor)
ELEMENT_TYPES = ["frontend", "gateway", "service", "database", "cache", "queue", "external"]

TECH = {
    "frontend": ["React", "Angular", "Vue", "Flutter", "Swift"],
    "gateway":  ["Kong", "NGINX", "Apigee", "Envoy"],
    "service":  ["Java/Spring", "Go", ".NET", "Node.js", "Python/FastAPI", "Rust"],
    "database": ["PostgreSQL", "Oracle", "MongoDB", "Cassandra", "MySQL"],
    "cache":    ["Redis", "Memcached", "Hazelcast"],
    "queue":    ["Kafka", "RabbitMQ", "SQS", "Pub/Sub"],
    "external": ["SWIFT", "Stripe", "SAP", "Salesforce", "Twilio", "AWS S3"],
}

APP_NAMES = {
    "Finance":       ["Core Ledger", "Payments Hub", "Fraud Shield", "Reporting Engine"],
    "Logistics":     ["Route Optimizer", "Warehouse OS", "Track & Trace", "Fleet Manager"],
    "Customer":      ["CRM 360", "Support Desk", "Loyalty Cloud"],
    "Manufacturing": ["Plant Control", "IoT Telemetry", "Supply Planner"],
    "Platform":      ["Identity Hub", "Data Lakehouse", "DevPortal"],
}

STATUS_WEIGHTS = [("healthy", 0.66), ("warning", 0.24), ("critical", 0.10)]
OWNERS = ["A. Vance", "M. Okoro", "L. Nakamura", "S. Patel", "J. Romero",
          "K. Larsen", "D. Haddad", "R. Hekkens", "T. Bauer"]


def pick_status():
    r = random.random()
    c = 0
    for s, w in STATUS_WEIGHTS:
        c += w
        if r <= c:
            return s
    return "healthy"


def make_architecture(app_id, status):
    """Build a small, readable architecture: front -> gateway -> services -> stores."""
    elements, relations = [], []

    def el(suffix, name, etype, **metrics):
        eid = f"{app_id}-{suffix}"
        elements.append({
            "id": eid, "name": name, "type": etype,
            "tech": random.choice(TECH[etype]),
            "metrics": metrics,
        })
        return eid

    # Frontend(s)
    fe = el("fe", "Web Client", "frontend",
            sessions=random.randint(200, 9000), p95ms=random.randint(40, 320))
    # Gateway
    gw = el("gw", "API Gateway", "gateway",
            rps=random.randint(80, 4000), p95ms=random.randint(8, 90))
    relations.append({"source": fe, "target": gw, "type": "sync",
                      "label": "HTTPS", "throughput": random.randint(50, 900)})

    # Services (2-4)
    svc_names = ["Account Service", "Transaction Service", "Notification Service",
                 "Risk Engine", "Inventory Service", "Pricing Service",
                 "Profile Service", "Telemetry Ingest"]
    random.shuffle(svc_names)
    n_svc = random.randint(2, 4)
    svc_ids = []
    for i in range(n_svc):
        sid = el(f"svc{i}", svc_names[i], "service",
                 rps=random.randint(20, 1500), p95ms=random.randint(5, 140),
                 errorRate=round(random.uniform(0.0, 2.5), 2),
                 instances=random.randint(2, 24))
        svc_ids.append(sid)
        relations.append({"source": gw, "target": sid, "type": "sync",
                          "label": "REST", "throughput": random.randint(20, 600)})

    # Datastore per couple of services
    store_types = ["database", "cache", "queue"]
    for i, sid in enumerate(svc_ids):
        st = store_types[i % len(store_types)]
        nm = {"database": "Primary DB", "cache": "Cache", "queue": "Event Bus"}[st]
        store = el(f"st{i}", nm, st,
                   sizeGB=random.randint(5, 4000), p95ms=random.randint(1, 40),
                   connections=random.randint(10, 500))
        rtype = {"database": "data", "cache": "data", "queue": "async"}[st]
        relations.append({"source": sid, "target": store, "type": rtype,
                          "label": st.upper(), "throughput": random.randint(10, 800)})

    # A shared external dependency
    ext = el("ext", random.choice(["Payment Network", "Email Provider",
             "Object Storage", "Partner API"]), "external",
             p95ms=random.randint(60, 600), availability=round(random.uniform(98.5, 99.99), 2))
    relations.append({"source": random.choice(svc_ids), "target": ext, "type": "sync",
                      "label": "Outbound", "throughput": random.randint(5, 200)})

    # An auth relation from gateway to an identity-ish service
    relations.append({"source": gw, "target": random.choice(svc_ids), "type": "auth",
                      "label": "OAuth2", "throughput": random.randint(5, 120)})

    return {"elements": elements, "relations": relations}


def make_app(sector_name, name, idx):
    app_id = f"app-{name.lower().replace(' ', '-')}"
    status = pick_status()
    base_up = {"healthy": (99.9, 99.99), "warning": (99.0, 99.8),
               "critical": (95.0, 98.9)}[status]
    metrics = {
        "uptime": round(random.uniform(*base_up), 2),
        "latencyMs": random.randint(20, 280),
        "rps": random.randint(50, 5200),
        "users": random.randint(300, 120000),
        "costPerMonth": random.randint(8000, 540000),
        "incidents30d": {"healthy": random.randint(0, 1),
                          "warning": random.randint(2, 5),
                          "critical": random.randint(6, 14)}[status],
        "dataGB": random.randint(40, 18000),
        "apiCallsDay": random.randint(50_000, 42_000_000),
    }
    return {
        "id": app_id,
        "name": name,
        "sectorId": f"sec-{sector_name.lower()}",
        "status": status,
        "owner": random.choice(OWNERS),
        "tech": random.sample(sum(TECH.values(), []), k=3),
        "metrics": metrics,
        "architecture": make_architecture(app_id, status),
    }


def build():
    sectors, applications = [], []
    for name, color, desc in SECTORS:
        sec_id = f"sec-{name.lower()}"
        app_ids = []
        for i, app_name in enumerate(APP_NAMES[name]):
            app = make_app(name, app_name, i)
            applications.append(app)
            app_ids.append(app["id"])
        apps = [a for a in applications if a["id"] in app_ids]
        sectors.append({
            "id": sec_id, "name": name, "color": color, "description": desc,
            "applicationIds": app_ids,
            "metrics": {
                "applications": len(app_ids),
                "uptime": round(sum(a["metrics"]["uptime"] for a in apps) / len(apps), 2),
                "monthlyCost": sum(a["metrics"]["costPerMonth"] for a in apps),
                "users": sum(a["metrics"]["users"] for a in apps),
                "dataVolumeTB": round(sum(a["metrics"]["dataGB"] for a in apps) / 1024, 1),
                "criticality": random.choice(["High", "High", "Medium", "Critical"]),
            },
        })

    return {
        "meta": {
            "title": "Spatial Architecture Explorer",
            "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
            "elementTypes": ELEMENT_TYPES,
            "relationTypes": ["sync", "async", "data", "auth"],
        },
        "sectors": sectors,
        "applications": applications,
    }


if __name__ == "__main__":
    data = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {os.path.abspath(OUT)}")
    print(f"  sectors={len(data['sectors'])} applications={len(data['applications'])}"
          f" elements={sum(len(a['architecture']['elements']) for a in data['applications'])}")
