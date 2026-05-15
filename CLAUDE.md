# Maintenance Notes

## Edit skills in this repo, not in user scope

When the user asks to modify a skill, first check whether a skill of the same name exists in this repository (a top-level directory containing `SKILL.md`). If it does, edit only the in-repo copy and do **not** touch the corresponding file under `~/.cursor/skills`, `~/.cursor/skills-cursor`, `~/.claude/skills`, or `~/.agents/skills`. The user-scope copies are installed artifacts and will be refreshed by `install-locally.sh`; editing them directly causes the two copies to drift.

Only edit a user-scope skill when no matching skill exists in this repository.

## Work directly on `main`

Do not create new branches in this repository. Commit changes directly on `main`. Only deviate if the user explicitly asks for a branch or PR.
