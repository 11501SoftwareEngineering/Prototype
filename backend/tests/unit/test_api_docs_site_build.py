"""Unit tests for static API docs site assembly."""

from __future__ import annotations

from pathlib import Path

from scripts.build_api_docs_site import build_site


def test_build_site_layout(tmp_path: Path) -> None:
    out = build_site(tmp_path / "docs" / "openapi")
    assert (out / "index.html").is_file()
    assert (out / "openapi.json").is_file()
    assert (out / "swagger-ui-bundle.js").is_file()
    assert (out / "swagger-ui.css").is_file()


def test_build_site_uses_relative_openapi_and_assets(tmp_path: Path) -> None:
    out = build_site(tmp_path / "docs" / "openapi")
    html = (out / "index.html").read_text(encoding="utf-8")
    assert "./openapi.json" in html
    assert "./swagger-ui-bundle.js" in html
    assert "./swagger-ui.css" in html
    assert 'url: "/openapi.json"' not in html
    assert 'src="/swagger-ui-bundle.js"' not in html


def test_build_site_declares_utf8_charset(tmp_path: Path) -> None:
    out = build_site(tmp_path / "docs" / "openapi")
    html = (out / "index.html").read_text(encoding="utf-8")
    assert '<meta charset="utf-8">' in html
    assert 'src="./swagger-ui-bundle.js" charset="utf-8"' in html


def test_build_site_keeps_openapi_31(tmp_path: Path) -> None:
    out = build_site(tmp_path / "docs" / "openapi")
    spec = (out / "openapi.json").read_text(encoding="utf-8")
    assert '"openapi": "3.1' in spec


def test_build_site_disables_try_it_out(tmp_path: Path) -> None:
    out = build_site(tmp_path / "docs" / "openapi")
    html = (out / "index.html").read_text(encoding="utf-8")
    assert "supportedSubmitMethods" in html


def test_two_output_dirs_are_independent(tmp_path: Path) -> None:
    a = build_site(tmp_path / "a")
    b = build_site(tmp_path / "b")
    assert (a / "openapi.json").read_text() == (b / "openapi.json").read_text()
    assert a.resolve() != b.resolve()


def test_build_site_preserves_sibling_docs_markdown(tmp_path: Path) -> None:
    site = tmp_path / "repo"
    kept = site / "docs" / "開發須知.md"
    kept.parent.mkdir(parents=True)
    kept.write_text("keep me\n", encoding="utf-8")
    build_site(site / "docs" / "openapi")
    assert kept.read_text(encoding="utf-8") == "keep me\n"
    assert (site / "docs" / "openapi" / "index.html").is_file()


def test_build_site_removes_stale_files_in_out(tmp_path: Path) -> None:
    out = tmp_path / "docs" / "openapi"
    out.mkdir(parents=True)
    stale = out / "stale-cache.js"
    stale.write_text("old\n", encoding="utf-8")
    build_site(out)
    assert not stale.exists()
    assert (out / "index.html").is_file()
