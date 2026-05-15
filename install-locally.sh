#!/usr/bin/env bash
# Interactive installer for skills in this repo.
#
# Lists every directory at the repo root that contains a SKILL.md, lets you
# pick one or more with arrow keys, then installs them globally via
# `npx skills add <repo> --skill <name> -g --copy --yes`.
#
# Usage:
#   sh install-locally.sh                # interactive copy install (TTY only)
#   sh install-locally.sh okk burn-them-all
#                                        # non-interactive: install named skills
#   sh install-locally.sh --all          # non-interactive: install every skill
#   sh install-locally.sh --symlink      # symlink instead of copy
#   sh install-locally.sh --dry-run      # print the install command, do not run
#
# Implementation lives in scripts/install-locally.mjs (Node >= 18).

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
exec node "$DIR/scripts/install-locally.mjs" "$@"
