"""
Blockfall Development Server with Automatic Live Reload.
Uses only standard Python libraries (no pip install required).
"""

import http.server
import json
import os
import socket
import socketserver
import threading
import time

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
WATCH_EXTENSIONS = ('.html', '.css', '.js')
VERSION_FILE = os.path.join(DIRECTORY, 'version.json')


def get_local_ip():
    """Attempt to find the local LAN IP for easy iPad/phone access."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


def get_max_mtime():
    """Check the latest modification time among watched files."""
    latest = 0
    for root, _, files in os.walk(DIRECTORY):
        if 'Documentation' in root or '.git' in root:
            continue
        for f in files:
            if f.endswith(WATCH_EXTENSIONS):
                full_path = os.path.join(root, f)
                try:
                    mtime = os.path.getmtime(full_path)
                    if mtime > latest:
                        latest = mtime
                except OSError:
                    pass
    return latest


def file_watcher():
    """Background thread watching for saved file edits and updating version.json."""
    last_mtime = get_max_mtime()
    while True:
        time.sleep(0.8)
        current_mtime = get_max_mtime()
        if current_mtime > last_mtime:
            last_mtime = current_mtime
            new_ts = int(time.time() * 1000)
            try:
                with open(VERSION_FILE, 'w', encoding='utf-8') as f:
                    json.dump({
                        'version': 'dev',
                        'timestamp': new_ts,
                        'updatedAt': time.strftime('%Y-%m-%d %H:%M:%S')
                    }, f, indent=2)
                print(f"[LIVE RELOAD] File changed! Updated version.json (ts: {new_ts}) -> Client reload triggered.")
            except Exception as e:
                print(f"[ERROR] Failed to update version.json: {e}")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP handler with no-cache headers to guarantee fresh assets on mobile."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Service-Worker-Allowed', '/')
        super().end_headers()

    def log_message(self, format, *args):
        # Silence verbose GET logs for polling version.json
        if args and 'version.json' in str(args[0]):
            return
        super().log_message(format, *args)


def run_server():
    watcher_thread = threading.Thread(target=file_watcher, daemon=True)
    watcher_thread.start()

    lan_ip = get_local_ip()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
        print("=" * 60)
        print(" BLOCKFALL LIVE-RELOAD SERVER ACTIVE")
        print("=" * 60)
        print(f" PC / Localhost:     http://localhost:{PORT}")
        print(f" iPad / Phone (LAN): http://{lan_ip}:{PORT}")
        print(" Automatic reload:   Active (watches index.html, style.css, game.js)")
        print(" Press Ctrl+C to stop.")
        print("=" * 60)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")


if __name__ == '__main__':
    run_server()
