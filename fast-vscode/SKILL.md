---
name: fast-vscode
description: Trim VSCode for fast cold start and quiet usage by patching `settings.json`: disable built-in AI features (chat, inline suggest, NL search), telemetry/experiments, and state-restore (hot exit, window restore, view state). Slash-only — invoke via `/fast-vscode`. Apply when treating VSCode as a lightweight viewer rather than a primary IDE.
disable-model-invocation: true
---

# fast-vscode

Patch the user `settings.json` on macOS:

```
~/Library/Application Support/Code/User/settings.json
```

The file is JSONC (`//` and `/* */` comments are legal). Standard `JSON.parse` / `python -m json.tool` will reject it — that is **not** a real syntax error, don't waste turns on it.

## Settings to apply

Merge the three groups below. If a key already exists with a different value, **overwrite and call out the change**. Do not touch unrelated settings or stale AI-extension config (`marscode.*`, `codeverse.*`, `cline.*`, `chat.instructionsFilesLocations`, `github.copilot.*`); mention them at the end as inert dead config the user can clean up later.

### Group A — built-in AI

```json
{
  "chat.disableAIFeatures": true,
  "editor.inlineSuggest.enabled": false,
  "workbench.settings.enableNaturalLanguageSearch": false,
  "workbench.commandPalette.experimental.suggestCommands": false
}
```

`chat.disableAIFeatures` is the master switch and already covers `chat.*`, `inlineChat.*`, `chat.commandCenter.*`. Don't add those individually.

### Group B — telemetry & experiments

```json
{
  "telemetry.telemetryLevel": "off",
  "workbench.enableExperiments": false
}
```

### Group C — state-restore (cold start)

```json
{
  "files.hotExit": "off",
  "workbench.editor.restoreViewState": false,
  "window.restoreWindows": "none"
}
```

Tradeoffs to surface:

- `files.hotExit: "off"` — eliminates the **"Discarding backups is taking a bit longer..."** dialog. Cost: unsaved edits are lost on close.
- `window.restoreWindows: "none"` — opens an empty window. Use `"one"` if the user wants to keep one project across restarts.

## After applying

Tell the user to reload: `Cmd+Shift+P` → `Developer: Reload Window`.

## Out of scope

- Third-party AI extensions (Copilot, Cursor Tab, Cody, Continue, Tabnine, Codeium, IntelliCode) — disable from the Extensions panel.
- Per-use VSCode profiles (`code --profile "Diff Only"`) — mention verbally if the user wants more aggressive trim, but not part of this patch.
- Disk cleanup of `Backups/` or `workspaceStorage/` — hygiene, not startup tuning.
