"""Serve the flight sketch locally with caching turned off, so every reload picks up the latest files."""
import http.server, socketserver, sys

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", port), NoCache) as s:
    print(f"Flight sketch: http://localhost:{port}")
    s.serve_forever()
