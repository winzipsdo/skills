---
name: okk
description: Create a review-ready branch from current local changes, commit them with contextual messages, push to remote, and create or return a merge request link. Use when the user types /okk or asks to quickly submit current changes to a remote branch and MR without further confirmation.
disable-model-invocation: true
---

# okk

Use this skill when the user types `/okk`.

## Goal

Turn the current working tree changes into a pushed remote branch and an MR link with minimal interaction.

## Hard Rules

- Do not ask for confirmation before committing, pushing, or creating the MR.
- Do not continue if there are no local changes. Make a light joke and stop.
- Do not hide rebase conflicts, commit failures, push failures, or MR creation failures.
- Never use destructive git commands such as `git reset --hard`, `git checkout --`, or force push.
- Do not commit likely secrets such as `.env`, credential files, private keys, or tokens. Stop and warn the user if they are part of the changes.

## Workflow

1. Inspect the repository state.
   - Run `git status --porcelain=v1 --branch`.
   - If there are no changed or untracked files, stop with a short joke.
   - Review `git diff`, `git diff --staged`, and relevant untracked file names before deciding the commit message and branch name.

2. Sync with the remote.
   - Run `git fetch --all --prune`.
   - Prefer `rebase` over merge.
   - If the current branch is `master` or `main`, check whether `origin/master` or `origin/main` has updates and try to rebase onto it automatically.
   - If the current branch is not `master` or `main` and has an upstream, try `git rebase @{u}` when the upstream moved.
   - If rebase conflicts occur, stop and tell the user what needs manual resolution.

3. Choose the submission branch.
   - If the current branch is `master` or `main`, create a new branch for the submission.
   - If the current branch is not `master` or `main`, stay on the current branch and push it directly.
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

4. Stage and commit.
   - Stage only relevant files for the current changes.
   - Generate the commit message from the diff and file context.
   - Keep the subject under 72 characters.
   - If commitlint rejects the message, rewrite it and retry the commit.
   - Use a heredoc for `git commit -m` so multiline messages are preserved.

5. Push.
   - Push directly with `git push -u origin HEAD`.
   - Do not ask before pushing.

6. Create the MR.
   - Create the MR when the available repository tooling supports it.
   - If MR creation succeeds, return the MR link as a Markdown hyperlink.
   - If MR creation is not available or fails, return a Markdown hyperlink to the MR creation page for the pushed branch.
   - Always make the link clickable with descriptive English text, such as `[Open MR](...)` or `[Create MR](...)`.

## Output

Keep the final response concise:

- Branch used
- Commit title
- Push status
- Markdown hyperlink for the MR or MR creation page
- Any unresolved issue, only if something failed
