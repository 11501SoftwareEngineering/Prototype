from __future__ import annotations

import pytest

from scripts.check_migrations_align_with_main import (
    _validate_git_ref,
    _validate_versions_path,
    ancestors,
    build_graph,
    check,
    file_at_worktree,
    find_heads,
    list_version_paths_worktree,
    missing_down_revisions,
    parse_revision_meta,
)

A = "backend/alembic/versions/a.py"
B = "backend/alembic/versions/b.py"
C = "backend/alembic/versions/c.py"


def test_parse_revision_meta_linear() -> None:
    content = """
revision: str = "child"
down_revision: str | None = "parent"
"""
    rev, down = parse_revision_meta(content)
    assert rev == "child"
    assert down == "parent"


def test_parse_revision_meta_merge_down_revision() -> None:
    content = """
revision = "merge"
down_revision = ("rev_a", "rev_b")
"""
    rev, down = parse_revision_meta(content)
    assert rev == "merge"
    assert down == ("rev_a", "rev_b")


def test_find_heads_and_ancestors() -> None:
    files = [
        ("a.py", 'revision: str = "root"\ndown_revision = None\n'),
        ("b.py", 'revision: str = "child"\ndown_revision: str = "root"\n'),
    ]
    graph = build_graph(files)
    assert find_heads(graph) == {"child"}
    assert ancestors("child", graph) == {"child", "root"}


def test_build_graph_rejects_duplicate_revision() -> None:
    files = [
        (A, 'revision = "m1"\ndown_revision = None\n'),
        (B, 'revision = "m1"\ndown_revision = None\n'),
    ]
    with pytest.raises(ValueError, match="duplicate revision id"):
        build_graph(files)


def test_missing_down_revisions_detects_ghost_parent() -> None:
    graph = build_graph(
        [
            (A, 'revision = "m1"\ndown_revision = None\n'),
            (B, 'revision = "m2"\ndown_revision = ("m1", "ghost")\n'),
        ]
    )
    assert missing_down_revisions(graph) == ["m2 -> ghost"]


def test_branch_extends_main_head() -> None:
    main_files = [
        ("a.py", 'revision: str = "m1"\ndown_revision = None\n'),
    ]
    branch_files = [
        *main_files,
        ("b.py", 'revision: str = "m2"\ndown_revision: str = "m1"\n'),
    ]
    main_graph = build_graph(main_files)
    branch_graph = build_graph(branch_files)
    main_head = next(iter(find_heads(main_graph)))
    branch_head = next(iter(find_heads(branch_graph)))
    assert main_head == "m1"
    assert branch_head == "m2"
    assert main_head in ancestors(branch_head, branch_graph)


@pytest.mark.parametrize(
    "ref",
    [
        "--output=/tmp/x",
        "origin/main;rm -rf /",
        "HEAD~1$(whoami)",
        "../main",
        "-c",
    ],
)
def test_reject_unsafe_git_refs(ref: str) -> None:
    with pytest.raises(ValueError):
        _validate_git_ref(ref)


def test_accept_safe_git_refs() -> None:
    assert _validate_git_ref("origin/main") == "origin/main"
    assert _validate_git_ref("HEAD") == "HEAD"
    assert _validate_git_ref("refs/heads/main") == "refs/heads/main"


@pytest.mark.parametrize(
    "path",
    [
        "backend/alembic/versions/../config.py",
        "backend/secrets.py",
        "backend/alembic/versions/x.py:foo",
        "-evil.py",
    ],
)
def test_reject_unsafe_versions_paths(path: str) -> None:
    with pytest.raises(ValueError):
        _validate_versions_path(path)


def test_worktree_lists_and_reads_existing_versions() -> None:
    paths = list_version_paths_worktree()
    assert paths
    assert all(p.startswith("backend/alembic/versions/") for p in paths)
    body = file_at_worktree(paths[0])
    assert "revision" in body


def _patch_check_sides(
    monkeypatch: pytest.MonkeyPatch,
    *,
    main: dict[str, str],
    head: dict[str, str],
) -> None:
    """Stub git/worktree readers so check() exercises pure graph logic."""

    def list_base(ref: str) -> list[str]:
        assert ref == "origin/main"
        return sorted(main)

    def file_base(ref: str, path: str) -> str:
        assert ref == "origin/main"
        return main[path]

    def list_head() -> list[str]:
        return sorted(head)

    def file_head(path: str) -> str:
        return head[path]

    monkeypatch.setattr(
        "scripts.check_migrations_align_with_main.list_version_paths",
        list_base,
    )
    monkeypatch.setattr(
        "scripts.check_migrations_align_with_main.file_at_ref",
        file_base,
    )
    monkeypatch.setattr(
        "scripts.check_migrations_align_with_main._default_head_reader",
        lambda: (list_head(), file_head),
    )


def test_check_linear_extend_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {A: 'revision = "m1"\ndown_revision = None\n'}
    head = {
        **main,
        B: 'revision = "m2"\ndown_revision = "m1"\n',
    }
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 0


def test_check_same_head_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {A: 'revision = "m1"\ndown_revision = None\n'}
    _patch_check_sides(monkeypatch, main=main, head=main)
    assert check("origin/main") == 0


def test_check_rejects_rewritten_baseline(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {A: 'revision = "m1"\ndown_revision = None\n'}
    head = {A: 'revision = "m1"\ndown_revision = None\n# tweaked\n'}
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 1


def test_check_rejects_missing_baseline(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {
        A: 'revision = "m1"\ndown_revision = None\n',
        B: 'revision = "m2"\ndown_revision = "m1"\n',
    }
    head = {A: 'revision = "m1"\ndown_revision = None\n'}
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 1


def test_check_rejects_fork(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {
        A: 'revision = "m1"\ndown_revision = None\n',
        B: 'revision = "m2"\ndown_revision = "m1"\n',
    }
    head = {
        A: 'revision = "m1"\ndown_revision = None\n',
        B: 'revision = "m2"\ndown_revision = "m1"\n',
        C: 'revision = "fork"\ndown_revision = "m1"\n',
    }
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 1


def test_check_rejects_duplicate_revision_id(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {A: 'revision = "m1"\ndown_revision = None\n'}
    head = {
        **main,
        B: 'revision = "m1"\ndown_revision = None\n',
    }
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 1


def test_check_rejects_ghost_merge_parent(monkeypatch: pytest.MonkeyPatch) -> None:
    main = {A: 'revision = "m1"\ndown_revision = None\n'}
    head = {
        **main,
        B: 'revision = "m2"\ndown_revision = ("m1", "ghost")\n',
    }
    _patch_check_sides(monkeypatch, main=main, head=head)
    assert check("origin/main") == 1


def test_default_head_reader_uses_index_under_pre_commit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from scripts import check_migrations_align_with_main as mod

    calls: list[str] = []

    def fake_index() -> list[str]:
        calls.append("index")
        return [A]

    def fake_worktree() -> list[str]:
        calls.append("worktree")
        return [A]

    monkeypatch.setenv("PRE_COMMIT", "1")
    monkeypatch.setattr(mod, "list_version_paths_index", fake_index)
    monkeypatch.setattr(mod, "list_version_paths_worktree", fake_worktree)
    monkeypatch.setattr(mod, "file_at_index", lambda path: "index-body")
    monkeypatch.setattr(mod, "file_at_worktree", lambda path: "wt-body")

    paths, reader = mod._default_head_reader()
    assert paths == [A]
    assert reader(A) == "index-body"
    assert calls == ["index"]


def test_default_head_reader_uses_worktree_outside_pre_commit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from scripts import check_migrations_align_with_main as mod

    monkeypatch.delenv("PRE_COMMIT", raising=False)
    monkeypatch.setattr(mod, "list_version_paths_index", lambda: [A])
    monkeypatch.setattr(mod, "list_version_paths_worktree", lambda: [B])
    monkeypatch.setattr(mod, "file_at_index", lambda path: "index-body")
    monkeypatch.setattr(mod, "file_at_worktree", lambda path: "wt-body")

    paths, reader = mod._default_head_reader()
    assert paths == [B]
    assert reader(B) == "wt-body"
