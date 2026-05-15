---
name: burn-them-all
description: Reclaim disk space by triaging caches and stale artifacts on the user's machine. Use ONLY when the user explicitly types the slash command /burn-them-all. Do not invoke from ambient phrasing like "disk is full", "clean up space", "磁盘满了", "清缓存", or any other free-form request — those must be handled with normal tools, never by loading this skill.
disable-model-invocation: true
---

# burn-them-all

Use this skill **only** when the user explicitly types `/burn-them-all`. Never load it from ambient mentions of full disks, cleanup, or freeing space — those requests must be handled without this skill.

The objective is to reclaim space **predictably**: never delete anything that costs the user real work to rebuild, and always quantify the trade-off before destructive actions.

## Hard Rules

- Never delete identity / credential stores (SSH keys, GPG keys, cloud-CLI tokens, password manager databases, browser password vaults, kubeconfigs, signing certificates).
- Never delete `.git` of any repository, even if the working tree looks abandoned.
- Never silently mix tiers — items in the 🟡 / 🔴 tiers must be called out and confirmed before execution.
- Never auto-purge `node_modules` (or equivalent build state) of an **actively developed** project without explicit confirmation, even though it is recoverable. Recovery time is the user's, not yours.
- Never blindly retry on `Operation not permitted` / `Permission denied`. Diagnose the cause (sandbox protection, SIP/TCC, root-owned files, running process holding the file) and surface the right next step.
- Never claim "X G freed" before backgrounded deletes finish and snapshot reclamation catches up. Wait or warn.

## Workflow

### 1. Baseline

Snapshot real disk pressure first. Capture the **data volume's** free space (not just "/") and remember the starting number for the final accounting.

### 2. Survey

Walk down from the largest candidate roots to identify the heavy hitters before touching anything. Always sort descending by size and only inspect a handful at each level.

Cover at least:

- Package-manager / language toolchain caches (JS, Python, Go, Rust, JVM, Ruby, native).
- Compiler / linker / type-checker incremental caches.
- Build outputs of monorepos and individual projects (install state, intermediate dirs, recycle bins from package tooling).
- Browser data — split between **caches** and **user state** (login, drafts, offline data).
- IDE data — split between **caches/index** and **user state** (workspace history, settings, chat history).
- Application updater download caches.
- Mobile / desktop simulators and device support files.
- Container / virtualization platform residue (images, volumes, VM disks).
- Logs (system + per-app).
- Trash / recycle bin.
- Stale projects in scratch / playground areas.
- Installed applications that are no longer used.
- Repository housekeeping (`.git` directories with many packs / loose objects, merged local branches, dangling worktrees, stale LFS objects).

### 3. Classify Each Candidate Into a Risk Tier

| Tier | Meaning | Default action |
|---|---|---|
| 🟢 Pure regenerable cache | App / tool will silently rebuild on next use; no user-visible loss. | Execute after presenting the list, on a single confirmation. |
| 🟡 Mild side-effect | User notices something: re-login on some sites, lost workspace history, slower first launch, re-download on next build. | Confirm each item or batch individually. |
| 🔴 User data | Real loss: chat history, drafts, downloads, source, active build state, databases. | Never auto-delete. Only on explicit per-item instruction. |

Examples (categories, not paths):

- 🟢 — Package manager download caches; toolchain build cache; type-checker incremental cache; browser HTTP cache and PWA service-worker cache; updater download caches; simulator devices; abandoned scratch directories with no recent git activity; emptied recycle bin.
- 🟡 — Browser local/session storage and IndexedDB; IDE workspace state; container platform images/volumes/VM disks; `node_modules` / equivalent install state of an **actively developed** project (recoverable but costs install time).
- 🔴 — Chat history, agent transcripts, mail stores, downloaded files, source repositories, active databases, anything under credential/identity directories.

### 4. Detect "Active" vs "Abandoned" Projects

For project directories, use **VCS history**, not filesystem mtime — dependency installs touch mtime even on abandoned repos.

- Latest commit within ~3 months → assume active.
- Latest commit older than ~6 months and no current branch work → strong abandoned signal.
- Empty / never-committed scratch dirs → always safe to remove.

For active projects, only ever clean install state (and only with confirmation), never source.

### 5. Prefer Native Cleanup Verbs

When a tool ships its own cleanup command, use it before reaching for `rm -rf` — they handle permissions, locks, and integrity correctly.

Reach for the native verb when cleaning: language package caches, container platforms, mobile dev toolchains, browser profile maintenance, OS package managers, build orchestrators of monorepos. Fall back to direct deletion only when no native verb exists, or when the user is decommissioning the tool entirely.

### 6. Present Then Execute

For each round:

1. Show a single ranked table: **Item · Size · Tier · One-line note**.
2. Group the proposed commands by tier; put 🟢 in one block.
3. Wait for confirmation. On "执行" / "go" / equivalent, run the 🟢 block; treat 🟡 / 🔴 items as separately gated.
4. Stream progress for long-running deletes; do not declare success until the process exits.
5. Recheck disk space after the batch and report the **net delta**.
6. Loop to the next round only if there's more worth doing.

### 7. Repository Housekeeping

When `.git` directories themselves are heavy, remember that the goal is small, **safe**, no-side-effect maintenance — not history rewriting.

- **Diagnose first** with `git count-objects -vH`. The numbers that matter: `packs` (>1 means repacking helps), `count` and `size` (loose objects waiting to be packed), `prune-packable` (objects already in pack but kept loose).
- **Run `git gc --prune=now`** when there are multiple packs or non-trivial loose objects. Safe and usually ~10–25 % saving on busy repos. The `--prune=now` form respects reflog protection — only objects unreachable *and* outside reflog are dropped.
- **Skip `--aggressive`**: the cost (full delta recomputation, often hours on big repos) rarely justifies the marginal extra saving.
- **Skip already-compact repos**: 1 pack and 0 loose means there is nothing to do; don't waste user's time running gc anyway.
- **Delete merged local branches** with `git branch --merged <main> | grep -vE '^\*|<main>$|main$|master$' | xargs -n 1 git branch -d`. Use `-d` (lowercase) — refuses to delete unmerged branches, so it cannot lose work. Refuse to use `-D` for cleanup.
- **Prune worktrees** with `git worktree prune` after listing with `git worktree list` and confirming entries are stale.
- **`git lfs prune`** when the repo uses Git LFS and old large objects accumulate.
- **Never** delete `.git/logs/` (reflog) by hand — it's the last line of defense for recovering accidental resets / rebases.
- **Never** rewrite history (`filter-repo`, `filter-branch`, BFG) for cleanup purposes. That changes commit hashes and breaks every other clone.
- **Treat abandoned repos** as a single decision: either keep the whole thing (and don't bother optimizing `.git`, gc gain is small), or remove the repo entirely. Don't half-optimize a repo the user is also considering deleting.

### 8. Diagnose Failures, Don't Loop

When deletion fails:

- `Permission denied` on app bundles → likely root-owned (installed via system installer); needs `sudo`.
- `Operation not permitted` on app sandbox containers → OS-level protection (e.g. macOS App Sandbox + TCC); explain that even `sudo` won't help and offer the right escape hatch (Full Disk Access for the terminal, OS-native uninstaller, or "leave it, the residue is tiny").
- `Directory not empty` after a clean → a process is recreating files; identify the holder process and offer "quit it first" rather than fighting it.
- "Deleted but disk didn't shrink" → snapshot / trash retention on the filesystem; surface that explicitly instead of repeating deletes.

### 9. Final Accounting

When the user signals stop, summarize:

- Starting free space → current free space → cumulative reclaimed.
- Items deferred and **why** (e.g. running app, sandbox, user-data tier).
- Outstanding manual steps the user can do later (with one-line instructions, not a wall of commands).

## Interaction Style

- Quantify everything. No "this can be cleaned up" without a number.
- One ranked table per round, not scattered prose.
- Surface trade-offs, not just savings: "frees 6 G, you'll be logged out of some sites" beats "frees 6 G".
- When the user says a class of thing is unwanted (e.g. "I don't use X anymore"), expand to **all** residue of that thing — app bundle, app support data, caches, preferences, host-specific plists, HTTP storages — not just the obvious folder.
- After a destructive action the user later flags as undesired, **remember it for the rest of the session** and avoid the same class of action without explicit reconfirmation.

## Output

Keep responses tight. For each round:

- Ranked table of candidates.
- Command block, grouped by tier.
- Disk delta after execution.
- One-line note on anything deferred.
