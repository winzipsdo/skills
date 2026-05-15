# Agent Skills

A personal collection of agent skills for Cursor and Claude Code.

Install with the [`skills`](https://www.npmjs.com/package/skills) CLI (auto-symlinks into `~/.cursor/skills/`, `~/.claude/skills/`, etc.).

## Local development install

To test in-progress edits to skills in this repo without pushing to the remote first, use the interactive installer:

```bash
sh install-locally.sh             # type to fuzzy-filter, space to toggle, enter to install
sh install-locally.sh --symlink   # symlink the global copy back into this repo (live edits)
sh install-locally.sh --dry-run   # print the npx command, do not execute
```

Controls: type to fuzzy-filter (queries are space-free), `↑/↓` move, `space` toggle current, `ctrl-a` toggle all filtered, `enter` confirm, `esc`/`ctrl-c` quit. Selections persist across query changes — the top status line shows `N/M match · K selected`. Lists every top-level directory that contains a `SKILL.md`, then runs `npx skills add <this-repo> --skill <name> -g --copy --yes` for each selection. Implementation: `scripts/install-locally.mjs` (Node ≥ 18, no dependencies).

## Development workflow

- **okk** `Slash Only` — Create or reuse a submission branch for local changes, write a contextual commit message, push to remote, and return an MR link or MR creation link.

  ```sh
  npx skills@latest add https://github.com/winzipsdo/skills.git --skill okk -g
  ```

## System maintenance

- **burn-them-all** `Slash Only` — Reclaim disk space by triaging caches and stale artifacts into 🟢 / 🟡 / 🔴 risk tiers, preferring native cleanup verbs, and never silently touching user data or actively-developed projects.

  ```sh
  npx skills@latest add https://github.com/winzipsdo/skills.git --skill burn-them-all -g
  ```

## Editor setup

- **fast-vscode** `Slash Only` — Trim VSCode for fast cold start and quiet usage by patching `settings.json`: disable built-in AI (chat, inline suggest, NL search), telemetry/experiments, and state-restore (hot exit, window restore, view state).

  ```sh
  npx skills@latest add https://github.com/winzipsdo/skills.git --skill fast-vscode -g
  ```
