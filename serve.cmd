@echo off
REM Local static server for the Spatial Architecture Explorer.
REM WebXR + fetch() require http(s)/localhost, so do NOT open index.html via file://.
echo Serving Spatial Architecture Explorer at http://localhost:8080
echo Press Ctrl+C to stop.
where py >nul 2>nul && (py -m http.server 8080) || (python -m http.server 8080)
