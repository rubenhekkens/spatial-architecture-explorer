@echo off
REM HTTPS server so the Meta Quest can load the demo with WebXR enabled.
REM Open the https://<laptop-ip>:8443 URL printed below in the Quest Browser.
where py >nul 2>nul && (py tools\serve_https.py 8443) || (python tools\serve_https.py 8443)
