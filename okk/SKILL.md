---
name: okk
description: Submit current local changes with minimal interaction while honoring explicit user instructions and repository guidance first. Use when the user types /okk or asks to quickly commit, push, or create an MR for current changes without further confirmation.
disable-model-invocation: true
---

# okk

Use this skill when the user types `/okk`.

## Goal

Turn the current working tree changes into the submission shape preferred by the user and repository guidance, with minimal interaction.

Default behavior is to commit, push, and create or return an MR link. However, repository guidance or the user's request may prefer direct submission to `master`/`main`, a specific branch, or no MR.

## Preference Precedence

Apply submission preferences in this order:

1. Explicit instructions in the current user request.
2. Repository or project guidance, such as `CLAUDE.md`, `AGENTS.md`, `.cursor/rules`, or equivalent local docs.
3. This skill's default workflow.

Do not treat `/okk` alone as an explicit request for an MR when repository guidance says not to create a feature branch or MR unless explicitly requested.

## Hard Rules

- Do not ask for confirmation before committing, pushing, or creating an MR when the selected workflow calls for those actions.
- Do not continue if there are no local changes. Make a light joke and stop.
- Do not hide rebase conflicts, commit failures, push failures, or MR creation failures.
- Never use destructive git commands such as `git reset --hard`, `git checkout --`, or force push.
- Do not commit likely secrets such as `.env`, credential files, private keys, or tokens. Stop and warn the user if they are part of the changes.

## Workflow

1. Load submission preferences.
   - Read relevant local guidance before deciding the branch, push target, or MR behavior.
   - Prefer guidance from files already loaded into context, then check common local guidance files if needed.
   - If guidance conflicts with this skill's default MR workflow, follow the higher-precedence guidance.

2. Inspect the repository state.
   - Run `git status --porcelain=v1 --branch`.
   - If there are no changed or untracked files, stop with a short joke.
   - Review `git diff`, `git diff --staged`, and relevant untracked file names before deciding the commit message and branch name.

3. Sync with the remote.
   - Run `git fetch --all --prune`.
   - Prefer `rebase` over merge.
   - If the current branch is `master` or `main`, check whether `origin/master` or `origin/main` has updates and try to rebase onto it automatically.
   - If the current branch is not `master` or `main` and has an upstream, try `git rebase @{u}` when the upstream moved.
   - If rebase conflicts occur, stop and tell the user what needs manual resolution.

4. Choose the submission branch.
   - If user or repository guidance prefers direct submission to `master` or `main`, switch to that branch only when it can be done without destructive commands or overwriting unrelated work; rebase it onto its upstream before committing.
   - If guidance says not to create a feature branch or MR unless explicitly requested, do not create a new branch or MR for `/okk` alone.
   - Otherwise, if the current branch is `master` or `main`, create a new branch for the submission.
   - Otherwise, if the current branch is not `master` or `main`, stay on the current branch and push it directly.
   - Only create a new branch from a non-`master`/`main` branch when the user explicitly asks for that in the `/okk` request.
   - When creating a branch, use a conventional, short, lowercase branch name based on the change:
     - `feat/<short-topic>` for new behavior
     - `fix/<short-topic>` for bug fixes
     - `docs/<short-topic>` for documentation
     - `test/<short-topic>` for tests
     - `refactor/<short-topic>` for refactors
     - `chore/<short-topic>` for maintenance
   - Do not include dates or timestamps in new branch names.
   - Use hyphen-separated words, no spaces, and avoid user or company names unless already present in the repo context.
   - Before creating a branch, check both local and remote branch names. If the name exists remotely, append a short semantic suffix or short hash-like suffix, for example `fix/login-state-2`.

5. Stage and commit.
   - Stage only relevant files for the current changes.
   - Generate the commit message from the diff and file context.
   - Keep the subject under 72 characters.
   - If commitlint rejects the message, rewrite it and retry the commit.
   - Use a heredoc for `git commit -m` so multiline messages are preserved.

6. Push.
   - Push to the branch selected by user or repository guidance.
   - If no direct-push guidance applies, push with `git push -u origin HEAD`.
   - When the MR workflow is selected and the remote is a GitLab host (e.g., `code.byted.org`, `gitlab.com`), additionally pass `-o merge_request.description=<text>` so that subsequent pushes refresh the existing MR description in place. Synthesize the description from the branch's commits since its base, e.g. `git log <upstream-base>..HEAD --format="- %s%n%n%b"`; keep it concise. On the first push (before the MR exists) GitLab silently ignores the option, which is fine. Skip this option for non-GitLab hosts (e.g., GitHub) since they do not support it.
   - Run the push as `git push ... 2>&1` and **capture the full stdout+stderr** so that server-side `remote:` hint URLs (MR/PR creation links) are available to step 7.
   - Do not ask before pushing.

7. Create the MR only when selected. Use server-provided URLs only — never hand-build them.
   - Skip MR creation entirely when user or repository guidance prefers direct push with no MR. In that case do not fabricate any MR link.
   - Otherwise, resolve the link in this order:
     1. **Server hint**: scan the captured push output for `remote:` lines containing an `https://...` URL and use that URL verbatim — do not strip or rewrite it.
     2. **Repository CLI**: if a repo-aware tool (e.g. `glab`, `gh`) is available and creating an MR is appropriate, use it and take whichever URL the tool returns.
   - If neither source returns a URL, do not guess and do not assemble one from the remote host. Report the branch and commit SHA in plain text and tell the user no link was returned by the server or CLI.
   - Always render returned links as Markdown, e.g., `[Open MR](...)` / `[Create MR](...)`.

## URL Rule

Never hand-build commit, MR/PR, tree, or blob URLs from the remote host name. Only emit URLs that came back from `git push` output, a repo-aware CLI, or another tool's response. If no such URL exists, return the branch and SHA in plain text and stop — do not guess a path style for any host.

## Output

Keep the final response concise:

- Branch used
- Commit title
- Push status
- Markdown hyperlink for the MR or MR creation page, when MR workflow was selected
- Any unresolved issue, only if something failed
