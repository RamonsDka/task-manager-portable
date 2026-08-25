// scripts/assemble.mjs — Concatenate modules into single drop-in HTML (no bundler)
// Reads modules in order per 07-assemble.md, replaces island with example state, injects classic scripts + bootstrap.

import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const skeletonPath = path.join(projectRoot, 'modules', '01-skeleton.html');
const corePath = path.join(projectRoot, 'modules', '02-core.js');
const hudPath = path.join(projectRoot, 'modules', '03-header-hud.js');
const phasesPath = path.join(projectRoot, 'modules', '04-phases.js');
const panelsPath = path.join(projectRoot, 'modules', '05-panels.js');
const todoHelpPath = path.join(projectRoot, 'modules', '06-todo-help.js');
const outPath = path.join(projectRoot, 'drop-in-task-manager.html');
const distPath = path.join(projectRoot, 'dist-share', 'drop-in-task-manager.html');
const portablePath = path.join(projectRoot, 'Task-Manager-Portable.html');

// Example state — full dashboard as user requested "Todo como tu dashboard" (v1 completa)
// Spanish labels, all panels enabled, sample phases/tasks to showcase full UI.
const exampleState = {
  schemaVersion: '1.0',
  meta: {
    projectName: 'Mi Proyecto Demo',
    version: '1.0.0',
    branch: 'main',
    commit: 'a1b2c3d',
    syncStatus: 'Sincronizado',
    description: 'Gestor de tareas drop-in — actualizado por IA orquestadora',
    labels: {
      es: {
        overallProgress: 'Progreso Global',
        filterAll: 'Todas',
        filterActive: 'Activas',
        todoTitle: 'Tareas Rápidas',
        helpTitle: 'Ayuda — Cómo usar este archivo',
        headerSubtitle: 'Proyecto gestionado con Drop-In Task Manager',
      }
    },
    features: { git: true, tree: true, codegraph: true, help: true }
    ,history: [
      { timestamp: '2026-08-18T09:00:00Z', completed: 4, total: 14 },
      { timestamp: '2026-08-19T09:00:00Z', completed: 6, total: 14 },
      { timestamp: '2026-08-20T09:00:00Z', completed: 8, total: 14 },
      { timestamp: '2026-08-21T09:00:00Z', completed: 9, total: 14 }
    ]
  },
  phases: [
    {
      id: 'phase-1',
      number: 1,
      title: 'Planificación y Diseño',
      status: 'completed',
      target: 'Semana 1',
      lead: 'Ana — Arquitectura',
      tasks: [
        { id: 'T1-01', title: 'Definir esquema de datos y contratos', status: 'completed', tag: 'Backend', note: 'Esquema validado con equipo. Incluye validación de tipos.', owner: 'Ana', commit: 'a1b2c3d' },
        { id: 'T1-02', title: 'Diseñar tokens y layout base', status: 'completed', tag: 'Design', note: 'Tokens verbatim del prototipo, dark theme.', owner: 'Luis', commit: 'b2c3d4e' },
        { id: 'T1-03', title: 'Mapear fases y dependencias', status: 'completed', tag: 'PM', note: 'Dependencias: 1.x → 2.x → 3.x → 4,5,6 → 7', owner: 'Maya', commit: 'c3d4e5f' },
      ]
    },
    {
      id: 'phase-2',
      number: 2,
      title: 'Núcleo y Métricas',
      status: 'completed',
      target: 'Semana 2',
      lead: 'Carlos — Core',
      tasks: [
        { id: 'T2-01', title: 'Implementar parse/validate/derive', status: 'completed', tag: 'Core', note: 'Maneja 0/0 → 0, sin NaN, escapa </script>', owner: 'Carlos', commit: 'd4e5f6a' },
        { id: 'T2-02', title: 'Header y HUD con métricas derivadas', status: 'completed', tag: 'Frontend', note: 'Progreso global 68% → dinámico, sin hardcode.', owner: 'Elena', commit: 'e5f6a7b' },
      ]
    },
    {
      id: 'phase-3',
      number: 3,
      title: 'Fases, Tareas y Filtros',
      status: 'in-progress',
      target: 'Semana 3',
      lead: 'Sofía — UI',
      tasks: [
        { id: 'T3-01', title: 'Acordeón colapsable + toggle aislado', status: 'completed', tag: 'UI', note: 'Click en cabecera no afecta otras fases.', owner: 'Sofía', commit: 'f6a7b8c' },
        { id: 'T3-02', title: 'Filtro Todas / Activas', status: 'completed', tag: 'UI', note: 'Oculta completadas, contadores intactos. Guarda preferencia en localStorage.', owner: 'Sofía', commit: 'a7b8c9d' },
        { id: 'T3-03', title: 'Barra de progreso por fase (2/4 → 50%)', status: 'in-progress', tag: 'UI', note: 'Calculado dinámicamente, vacío → 0%', owner: 'Sofía', commit: '' },
        { id: 'T3-04', title: 'Prueba de escape <script>alert(1)</script>', status: 'pending', tag: 'Security', note: 'Texto hostil con </script> debe sobrevivir round-trip vía \\u003c/script\\u003e', owner: 'Sec', commit: '', risk: 'high', blockedReason: 'Awaiting security review' },
      ]
    },
    {
      id: 'phase-4',
      number: 4,
      title: 'Paneles Opcionales',
      status: 'in-progress',
      target: 'Semana 4',
      lead: 'DevOps',
      tasks: [
        { id: 'T4-01', title: 'Panel Git (flag-gated)', status: 'completed', tag: 'Git', note: 'Muestra rama y commits verbatim, sin fetch.', owner: 'DevOps', commit: 'b8c9d0e' },
        { id: 'T4-02', title: 'Árbol de proyecto con indentación', status: 'in-progress', tag: 'Tree', note: 'Profundidad 0→0px, 1→14px, 2→28px', owner: 'DevOps', commit: '', risk: 'med' },
        { id: 'T4-03', title: 'Codegraph SVG + leyenda', status: 'blocked', tag: 'Graph', note: 'Nodos y aristas, SVG 320px mínimo', owner: 'DevOps', commit: '', blockedReason: 'Waiting for graph source data' },
      ]
    },
    {
      id: 'phase-5',
      number: 5,
      title: 'Ayuda y Documentación',
      status: 'pending',
      target: 'Semana 5',
      lead: 'Docs',
      tasks: [
        { id: 'T5-01', title: 'Todo scratchpad con prioridades P0/P1/P2', status: 'pending', tag: 'Docs', note: 'P0 rojo, P1 verde, P2 ámbar, done tachado.', owner: 'Docs', commit: '' },
        { id: 'T5-02', title: 'Panel Ayuda con instrucciones para IA', status: 'pending', tag: 'Docs', note: 'Bloque AI-instructions con island-only, schemaVersion, escape.', owner: 'Docs', commit: '' },
      ]
    },
  ],
  todos: [
    { id: 'td-1', text: 'Revisar tokens verbatim vs prototipo', priority: 'P0', done: false },
    { id: 'td-2', text: 'Verificar file:// sin servidor', priority: 'P1', done: true },
    { id: 'td-3', text: 'Probar hostile note con </script>', priority: 'P1', done: false },
    { id: 'td-4', text: 'Documentar guía para vibe-coder', priority: 'P2', done: false },
  ],
  git: {
    branch: 'main',
    commits: [
      { hash: 'a1b2c3d4e5f6', message: 'feat: esqueleto base + tokens' },
      { hash: 'b2c3d4e5f6a7', message: 'feat: core parse/validate/derive' },
      { hash: 'c3d4e5f6a7b8', message: 'feat: header + HUD dinámico' },
      { hash: 'd4e5f6a7b8c9', message: 'feat: fases y filtros' },
    ],
    syncStatus: 'Sincronizado'
  },
  tree: [
    { name: 'drop-in-task-manager.html', depth: 0, type: 'file' },
    { name: 'modules/', depth: 0, type: 'dir' },
    { name: '01-skeleton.html', depth: 1, type: 'file' },
    { name: '02-core.js', depth: 1, type: 'file' },
    { name: '03-header-hud.js', depth: 1, type: 'file' },
    { name: '04-phases.js', depth: 1, type: 'file' },
    { name: '05-panels.js', depth: 1, type: 'file' },
    { name: '06-todo-help.js', depth: 1, type: 'file' },
    { name: 'tests/', depth: 0, type: 'dir' },
    { name: 'openspec/', depth: 0, type: 'dir' },
  ],
  codegraph: {
    nodes: [
      { id: 'skeleton', label: 'Skeleton' },
      { id: 'core', label: 'Core', files: ['modules/02-core.js'], taskIds: ['T2-01'], details: 'Parsea y valida el estado.' },
      { id: 'hud', label: 'HUD' },
      { id: 'phases', label: 'Phases' },
      { id: 'panels', label: 'Panels' },
      { id: 'help', label: 'Help' },
    ],
    edges: [
      { from: 'skeleton', to: 'core' },
      { from: 'core', to: 'hud' },
      { from: 'core', to: 'phases' },
      { from: 'core', to: 'panels', label: 'usa', details: 'Panels consume los helpers de Core.' },
      { from: 'core', to: 'help' },
      { from: 'phases', to: 'panels' },
    ]
  }
};

function escapeIslandJson(state) {
  const json = JSON.stringify(state);
  return json.replace(/<\/script>/gi, '\\u003c/script\\u003e');
}

function escapeScriptContent(js) {
  // Escape closing script tag inside JS to avoid breaking HTML <script> inlining
  // HTML parser ends <script> on literal </script> even inside JS strings/comments
  return js.replace(/<\/script>/gi, '<\\/script>');
}

function build() {
  const skeleton = readFileSync(skeletonPath, 'utf-8');
  const coreJs = escapeScriptContent(readFileSync(corePath, 'utf-8'));
  const hudJs = escapeScriptContent(readFileSync(hudPath, 'utf-8'));
  const phasesJs = escapeScriptContent(readFileSync(phasesPath, 'utf-8'));
  const panelsJs = escapeScriptContent(readFileSync(panelsPath, 'utf-8'));
  const todoHelpJs = escapeScriptContent(readFileSync(todoHelpPath, 'utf-8'));

  // Escape island
  const islandJson = escapeIslandJson(exampleState);

  // Replace island content in skeleton (keep script tag, replace inner JSON)
  const islandRegex = /<script[^>]*id="tm-state"[^>]*>[\s\S]*?<\/script>/;
  const newIsland = `<script type="application/json" id="tm-state">${islandJson}</script>`;
  let html = skeleton.replace(islandRegex, newIsland);

  // Inject modules as classic scripts before </body>
  // Ensure we have exactly one </body>
  const scriptsBlock = `
<!-- MODULES: classic scripts, no bundler, file:// compatible -->
<script>
// ${'modules/02-core.js'} — inlined
${coreJs}
</script>
<script>
// ${'modules/03-header-hud.js'} — inlined
${hudJs}
</script>
<script>
// ${'modules/04-phases.js'} — inlined
${phasesJs}
</script>
<script>
// ${'modules/05-panels.js'} — inlined
${panelsJs}
</script>
<script>
// ${'modules/06-todo-help.js'} — inlined
${todoHelpJs}
</script>
<script>
// Bootstrap — single init on DOMContentLoaded, never white-screen
document.addEventListener('DOMContentLoaded', function() {
  try {
    var core = window.TMCore;
    var banner = document.getElementById('tm-error-banner');
    var result = null;
    try {
      result = core.getStateFromDocument(document);
    } catch (e) {
      result = { error: (e && e.message) ? e.message : String(e), validation: { ok: false, errors: [String(e)], warnings: [] } };
    }
    if (result && result.error) {
      if (banner) {
        banner.textContent = '⚠️ Error en JSON del Task Manager: ' + result.error + ' — Revisa el bloque #tm-state. El dashboard sigue visible.';
        banner.hidden = false;
        banner.style.display = 'block';
        banner.removeAttribute('hidden');
      }
      // Try to still render with state if available (partial), else fallback to minimal
      var state = result.state || null;
      if (state) {
        try {
          var metrics = core.deriveMetrics(state);
          if (window.TMHeaderHud) window.TMHeaderHud.renderAll(state, document);
          if (window.TMPhases) window.TMPhases.renderPhases(state, metrics, document);
          if (window.TMPanel) window.TMPanel.renderAllPanels(state, document);
          if (window.TMTodoHelp) window.TMTodoHelp.renderAllTodoHelp(state, document, result.validation);
        } catch (e2) { console.error('Render after error failed', e2); }
      }
      if (!state && window.TMTodoHelp) {
        try { window.TMTodoHelp.renderAllTodoHelp(null, document, result.validation); } catch (e3) { console.error('Help fallback render failed', e3); }
      }
      return;
    }
    // Success path
    if (banner) { banner.hidden = true; banner.style.display = 'none'; banner.setAttribute('hidden',''); }
    var state = result.state;
    var metrics = core.deriveMetrics(state);
    if (window.TMHeaderHud) window.TMHeaderHud.renderAll(state, document);
    if (window.TMPhases) window.TMPhases.renderPhases(state, metrics, document);
    if (window.TMPanel) window.TMPanel.renderAllPanels(state, document);
    if (window.TMTodoHelp) window.TMTodoHelp.renderAllTodoHelp(state, document, result.validation);
    // Expose for debugging
    window.__TM_STATE__ = state;
    window.__TM_METRICS__ = metrics;
  } catch (e) {
    console.error('Bootstrap failed', e);
    var b = document.getElementById('tm-error-banner');
    if (b) { b.textContent = 'Error crítico: ' + (e.message || String(e)); b.hidden = false; b.style.display = 'block'; b.removeAttribute('hidden'); }
  }
});
</script>
</body>`;

  if (html.includes('</body>')) {
    html = html.replace('</body>', scriptsBlock);
  } else {
    html += scriptsBlock + '\n</html>';
  }

  // Add header comment — avoid literal <script> inside comment to keep island scan clean
  const headerComment = `<!--
  Drop-In Task Manager — Single-file, file:// compatible, zero runtime deps
  Generated deterministically by scripts/assemble.mjs
  Source modules: 01-skeleton.html + 02-core.js + 03-header-hud.js + 04-phases.js + 05-panels.js + 06-todo-help.js
  Island: script#tm-state (type=application/json) — AI edits ONLY this block
  Docs: openspec/changes/drop-in-task-manager/ + Help tab (?)
  Tokens: verbatim from project-tracking-dashboard/index.html
-->
`;
  html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + headerComment);

  mkdirSync(path.dirname(distPath), { recursive: true });
  writeFileSync(outPath, html, 'utf-8');
  writeFileSync(distPath, html, 'utf-8');
  writeFileSync(portablePath, html, 'utf-8');

  const stats = statSync(outPath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log(`✅ Assembled root + dist + portable HTML — ${stats.size} bytes (${sizeKB} KB)`);
  console.log(`   Modules: 01-skeleton + 02-core + 03-header-hud + 04-phases + 05-panels + 06-todo-help + bootstrap`);
  console.log(`   Island: exampleState (${exampleState.phases.length} phases, ${exampleState.phases.reduce((a,p)=>a+p.tasks.length,0)} tasks, ${exampleState.todos.length} todos)`);
  console.log(`   Features: git=${exampleState.meta.features.git} tree=${exampleState.meta.features.tree} codegraph=${exampleState.meta.features.codegraph}`);
  console.log('   Size is measured by scan-portability; no hard byte ceiling is applied.');

  // Quick file:// sanity: check no <script src=
  if (html.includes('<script src=')) {
    console.error('❌ Found <script src= — violates file:// portability');
    process.exitCode = 1;
  }
  if (html.includes('fetch(') && !html.includes('no fetch')) {
    // Allow "no fetch" in comments/help but not actual fetch( call outside comments? Simplified check: look for fetch( in script blocks (we already excluded comments)
    // For now, just warn if fetch( appears in script tags
    const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    let hasFetch = false;
    for (const block of scriptBlocks) {
      if (block.includes('id="tm-state"')) continue; // island is JSON, ignore
      const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const withoutComments = inner.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/fetch\s*\(/.test(withoutComments)) hasFetch = true;
    }
    if (hasFetch) {
      console.error('❌ Found fetch( in script — violates file://');
      process.exitCode = 1;
    }
  }
  console.log('✅ Assembly complete — open via file:// double-click to verify');
}

build();
