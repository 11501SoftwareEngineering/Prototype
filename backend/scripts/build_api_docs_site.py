#!/usr/bin/env python3
"""Build a static Swagger UI page from the FastAPI OpenAPI schema.

Uses ``swagger-ui-bundle-v2`` (Swagger UI 5, OpenAPI 3.1) for assets and
FastAPI's ``get_swagger_ui_html`` for the entry page (relative URLs).
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from fastapi.openapi.docs import get_swagger_ui_html, swagger_ui_default_parameters
from swagger_ui_bundle import swagger_ui_path

from scripts.export_openapi import write_openapi_json

# Files required for a relative-path Swagger UI page.
_ASSET_NAMES = (
    "swagger-ui-bundle.js",
    "swagger-ui.css",
    "favicon-32x32.png",
)


def build_site(out: Path, *, title: str = "SocratesBot API") -> Path:
    """Write Swagger UI + ``openapi.json`` directly into ``out``.

    Default Make target uses ``../docs/openapi`` so repo markdown under
    ``docs/`` is left alone.
    """
    out = out.resolve()
    # Fresh tree so stale assets/HTML cannot mask a bad build.
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    write_openapi_json(out / "openapi.json")

    vendor = Path(swagger_ui_path)
    for name in _ASSET_NAMES:
        src = vendor / name
        if not src.is_file():
            msg = f"missing swagger-ui asset: {src}"
            raise FileNotFoundError(msg)
        shutil.copy2(src, out / name)

    params = {
        **swagger_ui_default_parameters,
        "supportedSubmitMethods": [],  # no Try it out against a live API
    }
    html_response = get_swagger_ui_html(
        openapi_url="./openapi.json",
        title=title,
        swagger_js_url="./swagger-ui-bundle.js",
        swagger_css_url="./swagger-ui.css",
        swagger_favicon_url="./favicon-32x32.png",
        swagger_ui_parameters=params,
    )
    # FastAPI's template omits charset; python -m http.server also sends
    # text/html without charset, so Chromium defaults to windows-1252 and
    # mis-decodes swagger-ui-bundle.js (UTF-8) → SyntaxError / blank page.
    html = html_response.body.decode("utf-8")
    if "<meta charset=" not in html.lower():
        html = html.replace("<head>", '<head>\n    <meta charset="utf-8">', 1)
    html = html.replace(
        '<script src="./swagger-ui-bundle.js"></script>',
        '<script src="./swagger-ui-bundle.js" charset="utf-8"></script>',
        1,
    )
    (out / "index.html").write_text(html, encoding="utf-8")
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        required=True,
        help="Directory for index.html, openapi.json, and Swagger assets",
    )
    parser.add_argument(
        "--title",
        default="SocratesBot API",
        help="HTML title for the Swagger UI page",
    )
    args = parser.parse_args(argv)
    try:
        root = build_site(args.out, title=args.title)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(f"built site at {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
