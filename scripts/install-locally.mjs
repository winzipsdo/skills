#!/usr/bin/env node
/**
 * Installs one or more skills from this local repo into the global agent
 * directories (`~/.cursor/skills`, `~/.claude/skills`, etc.) via
 * `npx skills add <repo> --skill <name> -g --copy --yes`.
 *
 * Two modes:
 *   - Interactive (TTY, no skill names given): fzf-style picker.
 *   - Non-interactive: pass skill names as positional args, or `--all`.
 *
 * Interactive controls:
 *   type             fuzzy filter (subsequence match against skill name;
 *                    space is reserved for toggle, so queries are space-free)
 *   ↑ / ↓            move cursor within the filtered list
 *   space            toggle current (auto-advances like fzf's tab)
 *   ctrl-a           toggle all currently filtered items
 *   backspace        delete one query char
 *   ctrl-u           clear query
 *   enter            confirm and install
 *   esc / ctrl-c     quit without installing
 *
 * Non-interactive examples:
 *   sh install-locally.sh okk
 *   sh install-locally.sh okk burn-them-all --symlink
 *   sh install-locally.sh --all --dry-run
 *
 * Flags:
 *   --all       install every skill found under the repo root (skips picker).
 *   --symlink   install via symlink instead of --copy (default: --copy
 *               so edits to the source repo do not affect the installed
 *               copy until you re-run this script).
 *   --dry-run   print the install commands without executing them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const KNOWN_FLAGS = new Set(['--symlink', '--dry-run', '--all']);
const useSymlink = argv.includes('--symlink');
const dryRun = argv.includes('--dry-run');
const installAll = argv.includes('--all');
const positional = argv.filter((a) => !a.startsWith('-'));
const unknownFlags = argv.filter((a) => a.startsWith('-') && !KNOWN_FLAGS.has(a));
if (unknownFlags.length) {
  console.error(`Unknown flag(s): ${unknownFlags.join(' ')}`);
  process.exit(2);
}

function listSkills() {
  return fs
    .readdirSync(REPO_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'scripts' && d.name !== 'log')
    .filter((d) => fs.existsSync(path.join(REPO_ROOT, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
}

function readDescription(skillName) {
  const p = path.join(REPO_ROOT, skillName, 'SKILL.md');
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return '';
  const desc = m[1].match(/^description:\s*(.+)$/m);
  if (!desc) return '';
  return desc[1].replace(/^["']|["']$/g, '').trim();
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

/** Subsequence match: every char of `q` appears in `s` in order. */
function fuzzyMatch(s, q) {
  if (!q) return true;
  const a = s.toLowerCase();
  const b = q.toLowerCase();
  let i = 0;
  for (const c of a) {
    if (c === b[i]) i++;
    if (i === b.length) return true;
  }
  return false;
}

async function pick(skills) {
  const tty = process.stdin.isTTY ? process.stdin : null;
  if (!tty) {
    console.error(
      'install-locally: stdin is not a TTY. Either run interactively in a terminal, or pass skill names non-interactively:',
    );
    console.error('  $ sh install-locally.sh <skill> [<skill>...]');
    console.error('  $ sh install-locally.sh --all');
    console.error(`Available skills: ${skills.join(', ')}`);
    process.exit(2);
  }

  const items = skills.map((name) => ({ name, desc: readDescription(name), checked: false }));
  let query = '';
  let cursor = 0; // index into the *filtered* list

  const out = process.stdout;
  const term = {
    hideCursor: () => out.write('\x1b[?25l'),
    showCursor: () => out.write('\x1b[?25h'),
    clear: (n) => {
      for (let i = 0; i < n; i++) out.write('\x1b[1A\x1b[2K');
      out.write('\r');
    },
  };

  const cols = () => process.stdout.columns || 100;
  const filtered = () => items.filter((it) => fuzzyMatch(it.name, query));

  const ANSI_RE = /\x1b\[[0-9;]*m/g;
  const visibleLen = (s) => s.replace(ANSI_RE, '').length;
  const physicalRows = (line, width) => Math.max(1, Math.ceil(visibleLen(line) / width));

  const render = () => {
    const visible = filtered();
    if (cursor >= visible.length) cursor = Math.max(0, visible.length - 1);

    const checkedCount = items.filter((it) => it.checked).length;
    const lines = [];
    lines.push(`\x1b[1mSelect skills to install globally\x1b[0m  \x1b[2m(type to filter · ↑↓ move · space toggle · ⌃a toggle-all · enter confirm · esc quit)\x1b[0m`);
    lines.push(`\x1b[36m❯\x1b[0m ${query}\x1b[7m \x1b[0m  \x1b[2m${visible.length}/${items.length} match · ${checkedCount} selected\x1b[0m`);

    if (visible.length === 0) {
      lines.push('  \x1b[2m(no matches)\x1b[0m');
    } else {
      visible.forEach((it, i) => {
        const cur = i === cursor ? '\x1b[36m›\x1b[0m' : ' ';
        const box = it.checked ? '\x1b[32m●\x1b[0m' : '\x1b[2m○\x1b[0m';
        const name = i === cursor ? `\x1b[1m${it.name}\x1b[0m` : it.name;
        const head = `${cur} ${box} ${name}`;
        const visibleHeadLen = `  ${it.checked ? '●' : '○'} ${it.name}`.length;
        const room = Math.max(20, cols() - visibleHeadLen - 4);
        const desc = it.desc ? `  \x1b[2m${truncate(it.desc.replace(/\s+/g, ' '), room)}\x1b[0m` : '';
        lines.push(head + desc);
      });
    }
    out.write(lines.join('\n') + '\n');
    const w = cols();
    return lines.reduce((acc, l) => acc + physicalRows(l, w), 0);
  };

  return new Promise((resolve) => {
    let lastLines = render();
    term.hideCursor();
    tty.setRawMode(true);
    tty.resume();
    tty.setEncoding('utf8');

    const cleanup = () => {
      tty.setRawMode(false);
      tty.pause();
      term.showCursor();
    };

    const redraw = () => {
      term.clear(lastLines);
      lastLines = render();
    };

    tty.on('data', (key) => {
      // Quit
      if (key === '\u0003' /* ctrl-c */ || key === '\u001b' /* esc */) {
        cleanup();
        term.clear(lastLines);
        out.write('Aborted.\n');
        process.exit(130);
      }
      // Confirm
      if (key === '\r' || key === '\n') {
        const picked = items.filter((it) => it.checked).map((it) => it.name);
        cleanup();
        term.clear(lastLines);
        resolve(picked);
        return;
      }
      // Navigation
      const visible = filtered();
      if (key === '\u001b[A') {
        if (visible.length) cursor = (cursor - 1 + visible.length) % visible.length;
      } else if (key === '\u001b[B') {
        if (visible.length) cursor = (cursor + 1) % visible.length;
      } else if (key === ' ' /* space: toggle */) {
        if (visible.length) {
          const it = visible[cursor];
          it.checked = !it.checked;
          // Auto-advance so repeated space ticks down the list.
          cursor = (cursor + 1) % visible.length;
        }
      } else if (key === '\u0001' /* ctrl-a */) {
        const allOn = visible.length > 0 && visible.every((it) => it.checked);
        visible.forEach((it) => (it.checked = !allOn));
      } else if (key === '\u0015' /* ctrl-u */) {
        if (query.length === 0) return;
        query = '';
        cursor = 0;
      } else if (key === '\u007f' || key === '\b') /* backspace */ {
        if (query.length === 0) return;
        query = query.slice(0, -1);
        cursor = 0;
      } else if (key.length === 1 && key > ' ' && key <= '~') {
        // Printable chars (except space, which is reserved for toggle) extend the query.
        query += key;
        cursor = 0;
      } else {
        return;
      }
      redraw();
    });
  });
}

function install(picked) {
  const args = ['skills@latest', 'add', REPO_ROOT, '-g', '--yes'];
  if (!useSymlink) args.push('--copy');
  for (const name of picked) {
    args.push('--skill', name);
  }
  const cmd = ['npx', ...args];
  console.log(`\x1b[2m$ ${cmd.join(' ')}\x1b[0m`);
  if (dryRun) return 0;
  const r = spawnSync('npx', args, { stdio: 'inherit' });
  return r.status ?? 1;
}

function runInstall(picked) {
  console.log(`Installing ${picked.length} skill(s) globally${useSymlink ? ' (symlink)' : ' (copy)'}${dryRun ? ' [dry-run]' : ''}:`);
  picked.forEach((n) => console.log(`  • ${n}`));
  console.log('');
  process.exit(install(picked));
}

function resolvePresetSelection(allSkills) {
  if (installAll) return allSkills;
  if (positional.length === 0) return null;

  const known = new Set(allSkills);
  const missing = positional.filter((n) => !known.has(n));
  if (missing.length) {
    console.error(`Unknown skill name(s): ${missing.join(', ')}`);
    console.error(`Available skills: ${allSkills.join(', ')}`);
    process.exit(2);
  }
  return Array.from(new Set(positional));
}

function main() {
  const skills = listSkills();
  if (skills.length === 0) {
    console.error(`No skills with SKILL.md found under ${REPO_ROOT}`);
    process.exit(1);
  }

  const preset = resolvePresetSelection(skills);
  if (preset) {
    runInstall(preset);
    return;
  }

  pick(skills).then((picked) => {
    if (picked.length === 0) {
      console.error('Nothing selected.');
      process.exit(0);
    }
    runInstall(picked);
  });
}

main();
