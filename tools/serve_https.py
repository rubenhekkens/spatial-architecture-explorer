#!/usr/bin/env python3
"""HTTPS static server for viewing the demo on a Meta Quest over a LAN/hotspot.

WebXR's "Enter VR" requires a secure context (https or localhost), so plain
http://<laptop-ip> will NOT show the VR button. This serves the project over
https with the self-signed cert in .dev-certs/.

Usage:
    python tools/serve_https.py [port]      # default port 8443

Then on the Quest Browser open:  https://<this-laptop-ip>:8443
Accept the "not private" warning (self-signed cert) and tap Enter VR.
"""
import http.server, ssl, os, sys, socket

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CERT = os.path.join(ROOT, ".dev-certs", "cert.pem")
KEY = os.path.join(ROOT, ".dev-certs", "key.pem")
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8443


def lan_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and not ip.startswith("169.254."):
                ips.add(ip)
    except Exception:
        pass
    return sorted(ips)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


if not (os.path.exists(CERT) and os.path.exists(KEY)):
    sys.exit("Missing cert. Generate it first (see README / tools).")

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(CERT, KEY)

httpd = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)

print("=" * 60)
print(" Spatial Architecture Explorer  —  HTTPS (for Quest)")
print("=" * 60)
print(f"  Serving {ROOT}")
print(f"  Local:   https://localhost:{PORT}")
for ip in lan_ips():
    print(f"  Quest:   https://{ip}:{PORT}")
print("  (Self-signed cert — accept the browser warning once.)")
print("  Ctrl+C to stop.")
print("=" * 60)
try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nStopped.")
