#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"

docker_args=(
  --user "$(id -u):$(id -g)"
  --volume "${repo_root}:${repo_root}:ro"
)

if [[ "${git_common_dir}" != "${repo_root}/"* ]]; then
  docker_args+=(--volume "${git_common_dir}:${git_common_dir}:ro")
fi

docker run --rm "${docker_args[@]}" \
  --workdir "${repo_root}" \
  ghcr.io/gitleaks/gitleaks:v8.29.1@sha256:aa036a2f4bdfe3cc3c55fa4326308efabb4a6be498c883c864fd1d0d5585438a \
  git --pre-commit --redact --staged --verbose
