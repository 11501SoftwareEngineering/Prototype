.DEFAULT_GOAL := help

.PHONY: help setup lock dev fix check test \
	db-prod db-prod-down db-dev db-dev-down \
	db-revision db-upgrade db-downgrade db-current db-heads \
	db-migration-check openapi-export openapi-site

help:
	@echo "App: setup, lock, dev, fix, check, test"
	@echo "Docs: openapi-export, openapi-site [OUT=dir] [PORT=8080]"
	@echo "Docker: db-dev, db-dev-down, db-prod, db-prod-down"
	@echo 'Migrations: db-revision message="...", db-upgrade, db-downgrade, db-current, db-heads'
	@echo "CI gate: db-migration-check (Alembic chain vs origin/main)"
	@echo ""
	@echo "From repo root: make -C backend db-upgrade"
	@echo "                make -C backend db-migration-check"

setup:
	uv sync --locked
	uv run pre-commit install --config ../.pre-commit-config.yaml

lock:
	uv lock

dev:
	uv run --locked fastapi dev app/main.py

fix:
	uv run --locked ruff check --fix .
	uv run --locked ruff format .

check:
	uv run --locked ruff check .
	uv run --locked ruff format --check .
	$(MAKE) db-migration-check
	uv run --locked pytest tests/api tests/unit tests/migration_check -q

test:
	uv run --locked pytest tests/api tests/unit -q

db-prod:
	docker-compose -f ../devops/prod/docker-compose.db.yml up

db-prod-down:
	docker-compose -f ../devops/prod/docker-compose.db.yml down

db-dev:
	docker-compose -f ../devops/dev/docker-compose.db.yml up

db-dev-down:
	docker-compose -f ../devops/dev/docker-compose.db.yml down

# UTF-8-safe wrapper: Alembic 1.20 reads alembic.ini with encoding="locale".
ALEMBIC := uv run --locked python scripts/run_alembic.py

db-revision:
	@test -n "$(message)" || { echo 'Usage: make db-revision message="description"' >&2; exit 2; }
	$(ALEMBIC) revision --autogenerate -m "$(message)"

db-upgrade:
	$(ALEMBIC) upgrade head

db-downgrade:
	$(ALEMBIC) downgrade -1

db-current:
	$(ALEMBIC) current

db-heads:
	$(ALEMBIC) heads

db-migration-check:
	git fetch origin main
	uv run --locked scripts/check_migrations_align_with_main.py --base origin/main

# OUT defaults to ../docs/openapi (export → …/openapi.json).
# openapi-site: files stay in OUT; default preview mounts them at /docs/ via a temp site root.
openapi-export:
	PYTHONPATH=. uv run --locked python scripts/export_openapi.py \
		-o "$(or $(OUT),../docs/openapi/openapi.json)"

openapi-site:
	@set -euo pipefail; \
	out="$(or $(OUT),../docs/openapi)"; \
	PYTHONPATH=. uv run --locked python scripts/build_api_docs_site.py --out "$$out"; \
	if [ -z "$(OUT)" ]; then \
	  site="$$(mktemp -d "./openapi-site.XXXXXX")"; \
	  ln -s "$$(cd "$$out" && pwd -P)" "$$site/docs"; \
	  echo "Open http://127.0.0.1:$(or $(PORT),8080)/docs/  (Ctrl+C to stop)"; \
	  trap 'rm -rf "$$site"' EXIT; \
	  cd "$$site" && python3 -m http.server "$(or $(PORT),8080)"; \
	else \
	  echo "Open http://127.0.0.1:$(or $(PORT),8080)/  (Ctrl+C to stop)"; \
	  cd "$$out" && python3 -m http.server "$(or $(PORT),8080)"; \
	fi
