"""A loopback-only teaching API. No packages, credentials, or trained model."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from urllib.parse import urlsplit


def reject_constant(value):
    raise ValueError(f"Non-JSON number: {value}")


def make_prediction(payload):
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object with size_mb.")
    size = payload.get("size_mb")
    if type(size) not in (int, float) or not 0 <= size <= 1_000_000:
        raise ValueError("size_mb must be a number from 0 to 1000000.")
    if not math.isfinite(size):
        raise ValueError("size_mb must be finite.")
    return {"prediction_seconds": 2.0 * size + 1.0, "model_version": "demo-v1"}


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def send_json(self, status, payload):
        data = json.dumps(payload, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urlsplit(self.path).path == "/health":
            self.send_json(200, {"status": "ok"})
        else:
            self.send_json(404, {"error": "Unknown endpoint."})

    def do_POST(self):
        if urlsplit(self.path).path != "/predict":
            self.send_json(404, {"error": "Unknown endpoint."})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Use Content-Type: application/json."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "Invalid Content-Length."})
            return
        if not 0 < length <= 65536:
            self.send_json(413 if length > 65536 else 400, {"error": "Expected 1 to 65536 body bytes."})
            return
        try:
            text = self.rfile.read(length).decode("utf-8")
            payload = json.loads(text, parse_constant=reject_constant)
            result = make_prediction(payload)
        except (ValueError, UnicodeError, RecursionError):
            self.send_json(400, {"error": "Send a JSON object with numeric size_mb from 0 to 1000000."})
            return
        except TimeoutError:
            self.send_json(408, {"error": "Request body timed out."})
            return
        self.send_json(200, result)

    def log_message(self, format, *args):
        # Keep this lesson's console clear. No request bodies or secrets are logged.
        pass


def create_server(port=8765):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    try:
        with create_server(args.port) as server:
            print(f"Local API: http://127.0.0.1:{server.server_port}", flush=True)
            print("Stop with Ctrl+C. Fixed formula only; no model training.", flush=True)
            server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    except OSError as error:
        raise SystemExit(f"Could not start the API: {error}") from None
