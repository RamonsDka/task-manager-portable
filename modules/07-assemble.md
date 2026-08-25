# Assembly & file:// Checklist — drop-in-task-manager.html

## Concat Order (classic scripts, no bundler)
1. `modules/01-skeleton.html` — head, :root tokens verbatim, chrome shells, empty tm-state island (no logic scripts)
2. `modules/02-core.js` — parseIsland, validateState, escapeHtml, isEnabled, deriveMetrics, banner hook
3. `modules/03-header-hud.js` — renderHeader, renderHud
4. `modules/04-phases.js` — renderPhases, accordion events, All/Active filter (view-pref localStorage only)
5. `modules/05-panels.js` — renderGit, renderTree, renderCodegraph behind isEnabled + try/catch containment
6. `modules/06-todo-help.js` — renderTodo, help tab, label resolver (meta.labels.es fallback)
7. `scripts/assemble.mjs` — simple string concat in above order → `drop-in-task-manager.html` (single file), replaces island escaping.

Manual concat command:
```bash
node scripts/assemble.mjs
# reads modules in order, writes drop-in-task-manager.html at project root
```

## Size Budget
- Target ≤80KB, limit ≤150KB (tasks.md 8.2 scan enforces)
- Current skeleton: ~12KB style + ~8KB html = ~20KB; remaining modules budget ~60KB

## file:// Verification Checklist (per module + final)
Run after each module and final assemble. Tick all:

- [ ] Double-click final `drop-in-task-manager.html` opens via `file://` with no server
- [ ] DevTools Console: zero errors, zero warnings
- [ ] DevTools Network: zero requests (no fetch, XHR, import, remote src/href)
- [ ] View Source: exactly one `<script type="application/json" id="tm-state">`, no `<script src=`, no `fetch(` / `XMLHttpRequest` / `import` outside comments
- [ ] Island JSON valid (`JSON.parse` succeeds), `schemaVersion: "1.0"`, no raw `</script>` inside island (must be `\u003c/script\u003e`)
- [ ] Chrome shells visible: header, 4 HUD cards, dashboard-layout grid (main+side), todo, phases, git/tree/codegraph shells, help tab, hidden error banner
- [ ] Dark theme: `var(--bg-canvas)` background (#0b0e14), tokens match prototype verbatim
- [ ] Spanish labels via `meta.labels.es` fallback works; code/comments remain English
- [ ] Banner behavior: truncated JSON → dismissible banner, never white-screen; hostile `</script>` in task note round-trips
- [ ] Flag gate: with `features.git/tree/codegraph:false` panels hidden or show `sin datos` placeholder; with `true` but empty → `sin datos`; with data → renders verbatim snapshot
- [ ] Help tab: copy-anywhere instructions, AI update protocol, schema summary visible
- [ ] No localStorage of task state (only view prefs allowed per spec)
- [ ] Size check: `drop-in-task-manager.html` ≤150KB (target ≤80KB)

## Portability Scan (automated 8.2)
`scripts/scan-portability.mjs` must exit 0:
- No `fetch(`, `XMLHttpRequest`, `import(`, `import ... from`, `export` outside HTML comments
- No `<script src=`, no `href="http`, no `src="http`
- No raw `</script>` inside island JSON
- File size ≤150KB, no test code inside artifact

## Rollback
Delete `drop-in-task-manager.html`; revert `modules/` and `tests/` slice. Stateless, no migration.

## Notes
- Skeleton PR1 verified this file exists and checklist drafted (2.3)
- Core+ later PRs must re-run this checklist after each concat
