from __future__ import annotations

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


class ExpoStaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        self.root = Path(directory).resolve()
        super().__init__(*args, directory=directory, **kwargs)

    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        request_path = unquote(parsed.path)
        relative = request_path.lstrip("/") or "index"
        candidates = []

        direct = self.root / relative
        candidates.append(direct)

        if not direct.suffix:
            candidates.append(self.root / f"{relative}.html")
            candidates.append(self.root / relative / "index.html")

        if request_path == "/":
            candidates.insert(0, self.root / "index.html")

        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

        return str(self.root / "+not-found.html")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--dir", default="dist")
    args = parser.parse_args()

    directory = Path(args.dir).resolve()
    handler = lambda *handler_args, **handler_kwargs: ExpoStaticHandler(
        *handler_args,
        directory=str(directory),
        **handler_kwargs,
    )

    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Serving {directory} at http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
