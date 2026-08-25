// @ts-nocheck
// modules/03-header-hud.js — Header + HUD renderers (PR3, classic script)
// Depends on TMCore (parse/derive/escape). Pure DOM updates, no fetch.
// English code, Spanish UI via meta.labels.es fallback.

(function (global) {
  'use strict';

  function getCore() {
    return (typeof window !== 'undefined' && window.TMCore) || (typeof globalThis !== 'undefined' && globalThis.TMCore) || (typeof global !== 'undefined' && global.TMCore) || null;
  }

  function esc(str) {
    var c = getCore();
    return c ? c.escapeHtml(str) : String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function finiteNumber(value, fallback) { value = Number(value); return isFinite(value) ? value : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finiteNumber(value, min))); }
  function svgNumber(value) { return String(Math.round(clamp(value, -100000, 100000) * 100) / 100); }
  function resolveInsights(state, metrics, core, supplied) {
    return supplied || (core && state && typeof core.deriveInsights === 'function' ? core.deriveInsights(state) : {
      metrics: metrics, tasks: [], dimensions: { owner: {}, tag: {} }, blockers: { total: 0 }, history: [],
      forecast: { available: false, label: 'Forecast unavailable', reason: 'No history data' }
    });
  }
  function renderStatusSvg(insights) {
    var d = insights && insights.metrics && insights.metrics.distribution || {};
    var values = [
      ['Completed', d.completed, 'var(--accent-green)'], ['In progress', d['in-progress'] != null ? d['in-progress'] : d.inprogress, 'var(--accent-blue)'],
      ['Pending', d.pending, 'var(--accent-amber)'], ['Blocked', d.blocked, 'var(--accent-red)']
    ];
    var total = values.reduce(function (sum, item) { return sum + Math.max(0, finiteNumber(item[1], 0)); }, 0), cursor = 0;
    var html = '<svg class="insight-status-chart" width="240" height="18" viewBox="0 0 240 18" role="img" aria-labelledby="insight-status-title"><title id="insight-status-title">Task status composition</title>';
    values.forEach(function (item) {
      var value = Math.max(0, finiteNumber(item[1], 0)), segment = total ? clamp(value / total * 240, 0, 240 - cursor) : 0;
      html += '<rect x="' + svgNumber(cursor) + '" y="0" width="' + svgNumber(segment) + '" height="18" fill="' + item[2] + '"><title>' + esc(item[0] + ': ' + Math.round(value)) + '</title></rect>';
      cursor = clamp(cursor + segment, 0, 240);
    });
    return html + '</svg>';
  }
  function renderTrend(insights) {
    var history = insights && Array.isArray(insights.history) ? insights.history : [];
    if (!history.length) return '';
    var points = history.map(function (point, index) {
      var total = Math.max(0, finiteNumber(point && point.total, 0)), done = clamp(point && point.completed, 0, total);
      return svgNumber(history.length === 1 ? 0 : 240 * index / (history.length - 1)) + ',' + svgNumber(44 - (total ? done / total * 44 : 0));
    });
    var last = history[history.length - 1] || {}, forecast = insights.forecast || {};
    var text = forecast.available && forecast.range ? forecast.label + ' — ' + Math.round(forecast.range.min) + '–' + Math.round(forecast.range.max) + ' sessions' : (forecast.label || 'Forecast unavailable') + ' — ' + (forecast.reason || 'Insufficient trend data');
    return '<div class="insight-trend"><svg class="insight-trend-chart" width="240" height="44" viewBox="0 0 240 44" role="img" aria-labelledby="insight-trend-title"><title id="insight-trend-title">Bounded completion trend</title><polyline points="' + points.join(' ') + '" fill="none" stroke="var(--accent-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg><div class="insight-trend-copy">History: ' + history.length + ' points · latest ' + Math.round(finiteNumber(last.completed, 0)) + '/' + Math.round(Math.max(0, finiteNumber(last.total, 0))) + '</div><div class="insight-forecast">' + esc(text) + '</div></div>';
  }
  function renderDimensionLines(map) {
    var keys = Object.keys(map || {});
    var lines = keys.length ? keys.map(function (key) { var bucket = map[key] || {}; return '<span class="insight-dimension-line"><strong>' + esc(key) + '</strong> ' + Math.round(finiteNumber(bucket.completed, 0)) + '/' + Math.round(Math.max(0, finiteNumber(bucket.total, 0))) + '</span>'; }).join('') : '<span class="insight-empty">No task data</span>';
    return '<div class="insight-dimension-list">' + lines + '</div>';
  }
  function riskCount(insights, level) {
    return (insights && Array.isArray(insights.tasks) ? insights.tasks : []).filter(function (task) { return task && task.risk === level; }).length;
  }

  function optionalDataCoverage(state) {
    var available = 0;
    if (state && state.git && (state.git.branch || state.git.syncStatus || (Array.isArray(state.git.commits) && state.git.commits.length))) available++;
    if (state && Array.isArray(state.tree) && state.tree.length) available++;
    if (state && state.codegraph && ((Array.isArray(state.codegraph.nodes) && state.codegraph.nodes.length) || (Array.isArray(state.codegraph.edges) && state.codegraph.edges.length))) available++;
    return available;
  }

  function detailSection(label, items) {
    return { label: label, items: (items || []).filter(Boolean) };
  }

  function buildMetricDetailModels(state, metrics, insights, context) {
    var phases = state && Array.isArray(state.phases) ? state.phases : [];
    var git = state && state.git || {};
    var tree = state && Array.isArray(state.tree) ? state.tree : [];
    var graph = state && state.codegraph || {};
    var graphNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    var graphEdges = Array.isArray(graph.edges) ? graph.edges : [];
    var riskTasks = context.riskTasks;
    var distribution = metrics.distribution || {};
    var remaining = Math.max(0, context.total - context.completed);
    var missingCoverage = [];
    if (!(git.branch || git.syncStatus || (Array.isArray(git.commits) && git.commits.length))) missingCoverage.push({ field: 'git.commits', guidance: 'Añade branch, syncStatus o commits al objeto git.' });
    if (!tree.length) missingCoverage.push({ field: 'tree', guidance: 'Añade elementos al arreglo tree.' });
    if (!graphNodes.length && !graphEdges.length) missingCoverage.push({ field: 'codegraph.nodes', guidance: 'Añade nodos o relaciones al objeto codegraph.' });
    var ownerLines = Object.keys(insights.dimensions && insights.dimensions.owner || {}).map(function (owner) { var bucket = insights.dimensions.owner[owner]; return owner + ': ' + bucket.completed + '/' + bucket.total; });
    var tagLines = Object.keys(insights.dimensions && insights.dimensions.tag || {}).map(function (tag) { var bucket = insights.dimensions.tag[tag]; return tag + ': ' + bucket.completed + '/' + bucket.total; });
    return {
      'metric-overview-risk': {
        title: 'Riesgos y bloqueos', value: riskTasks.length + (riskTasks.length === 1 ? ' requiere atención' : ' requieren atención'),
        summary: riskTasks.length ? 'Estas tareas necesitan revisión antes de continuar con normalidad.' : 'No hay bloqueos ni riesgos críticos informados.',
        sections: [detailSection('Tareas relacionadas', riskTasks.map(function (task) { return (task.id || 'Tarea') + ' · ' + (task.blockedReason || task.title || 'Requiere atención'); }))],
        missing: [], targetView: 'view-phases'
      },
      'metric-overall-card': {
        title: context.overallLabel, value: context.overallPct + '%', summary: context.completed + ' de ' + context.total + ' tareas completadas.',
        sections: [detailSection('Desglose', [context.completed + ' completadas', remaining + ' restantes', phases.length + ' fases registradas'])], missing: [], targetView: 'view-phases'
      },
      'metric-current-focus': {
        title: 'Fase Actual', value: context.focusPhase ? (context.focusPhase.title || 'Fase sin título') : 'Sin fase',
        summary: context.focusPhase ? context.focusPct + '% completado' : 'No existe una fase que pueda seleccionarse como foco actual.',
        sections: [detailSection('Contexto', context.focusPhase ? [context.focusPhase.target ? 'Objetivo: ' + context.focusPhase.target : 'Objetivo no informado', context.focusPhase.lead ? 'Responsable: ' + context.focusPhase.lead : 'Responsable no informado', (Array.isArray(context.focusPhase.tasks) ? context.focusPhase.tasks.length : 0) + ' tareas'] : [])],
        missing: context.focusPhase ? [] : [{ field: 'phases', guidance: 'Añade al menos una fase al arreglo phases.' }], targetView: 'view-phases'
      },
      'metric-distribution': {
        title: 'Distribución', value: context.total + ' tareas', summary: 'Composición actual del trabajo por estado.',
        sections: [detailSection('Estados', [context.done + ' hechas', context.inprog + ' activas', context.pending + ' pendientes', context.blocked + ' bloqueadas'])], missing: [], targetView: 'view-kanban'
      },
      'metric-git': {
        title: 'Git', value: (git.branch || state && state.meta && state.meta.branch || 'Sin rama'), summary: git.syncStatus || state && state.meta && state.meta.syncStatus || 'Estado de sincronización no informado.',
        sections: [detailSection('Snapshot', [Array.isArray(git.commits) ? git.commits.length + ' commits visibles' : 'Commits no informados', state && state.meta && state.meta.commit ? 'Commit actual: ' + String(state.meta.commit).substring(0, 7) : 'Commit actual no informado'])],
        missing: !(git.branch || git.syncStatus || (Array.isArray(git.commits) && git.commits.length)) ? [{ field: 'git', guidance: 'Añade branch, syncStatus o commits al objeto git.' }] : [], targetView: 'view-git'
      },
      'metric-phase-coverage': {
        title: 'Cobertura de fases', value: context.completedPhases + ' de ' + phases.length + ' fases', summary: (phases.length ? Math.round(context.completedPhases / phases.length * 100) : 0) + '% de las fases están cerradas.',
        sections: [detailSection('Fases', phases.map(function (phase) { return (phase.title || phase.id || 'Fase') + ' · ' + (phase.status || 'pending'); }))],
        missing: phases.length ? [] : [{ field: 'phases', guidance: 'Añade fases para calcular la cobertura.' }], targetView: 'view-phases'
      },
      'metric-active-workload': {
        title: 'Carga activa', value: context.activeWorkload + ' tareas', summary: context.inprog + ' en progreso · ' + context.blocked + (context.blocked === 1 ? ' bloqueada' : ' bloqueadas'),
        sections: [detailSection('Trabajo activo', (insights.tasks || []).filter(function (task) { return task.status === 'in-progress' || task.status === 'blocked'; }).map(function (task) { return (task.id || 'Tarea') + ' · ' + (task.title || 'Sin título') + ' · ' + task.status; }))],
        missing: [], targetView: 'view-kanban'
      },
      'metric-data-coverage': {
        title: 'Cobertura informativa', value: context.coverage + ' de 3 fuentes', summary: 'La interfaz solo muestra datos presentes; no se inventa información ausente.',
        sections: [detailSection('Fuentes disponibles', [(git.branch || git.syncStatus || (Array.isArray(git.commits) && git.commits.length)) ? 'Git disponible' : '', tree.length ? 'Tree disponible' : '', (graphNodes.length || graphEdges.length) ? 'Codegraph disponible' : ''])],
        missing: missingCoverage, targetView: null
      },
      'metric-insights': {
        title: 'Insights', value: context.total + ' tareas analizadas', summary: 'Resumen derivado de estado, riesgos, responsables, etiquetas e historial disponible.',
        sections: [detailSection('Riesgo', ['Bloqueos: ' + Math.max(0, finiteNumber(insights.blockers && insights.blockers.total, 0)), 'Riesgo alto: ' + riskCount(insights, 'high'), 'Riesgo medio: ' + riskCount(insights, 'med')]), detailSection('Responsables', ownerLines), detailSection('Etiquetas', tagLines), detailSection('Historial', insights.history && insights.history.length ? [insights.history.length + ' puntos disponibles', insights.forecast && insights.forecast.label || 'Pronóstico no disponible'] : [])],
        missing: insights.history && insights.history.length ? [] : [{ field: 'meta.history', guidance: 'Añade historial acotado para mostrar tendencia y pronóstico.' }], targetView: null
      }
    };
  }

  function decorateMetricCards(hud) {
    if (!hud) return;
    hud.querySelectorAll(':scope > .metric-card').forEach(function (card) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-haspopup', 'dialog');
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('data-metric-detail', card.id);
      var affordance = card.querySelector('.metric-details-affordance');
      if (!affordance) {
        affordance = card.ownerDocument.createElement('span');
        affordance.className = 'metric-details-affordance';
        affordance.textContent = 'Detalles';
        card.appendChild(affordance);
      }
    });
  }

  function renderOverviewDetail(dialog, model) {
    var content = dialog.querySelector('#overview-detail-content');
    dialog.querySelector('#overview-detail-title').textContent = model.title;
    dialog.querySelector('#overview-detail-value').textContent = model.value;
    dialog.querySelector('#overview-detail-summary').textContent = model.summary;
    content.innerHTML = model.sections.map(function (section) {
      if (!section.items.length) return '';
      return '<section class="overview-detail-section"><h3>' + esc(section.label) + '</h3><ul>' + section.items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul></section>';
    }).join('') + (model.missing.length ? '<section class="overview-detail-missing"><h3>Información no disponible</h3><p>No se inventa información ausente.</p><ul>' + model.missing.map(function (item) { return '<li><code>' + esc(item.field) + '</code> — ' + esc(item.guidance) + '</li>'; }).join('') + '</ul></section>' : '');
    var viewButton = dialog.querySelector('[data-overview-view-section]');
    viewButton.hidden = !model.targetView;
    viewButton.setAttribute('data-target-view', model.targetView || '');
  }

  function closeOverviewDetailDialog(doc) {
    var dialog = doc && doc.getElementById('overview-detail-dialog');
    if (!dialog) return;
    if (dialog.close) dialog.close();
    dialog.dataset.open = 'false';
    if (dialog._trigger) {
      dialog._trigger.setAttribute('aria-expanded', 'false');
      if (dialog._trigger.focus) dialog._trigger.focus();
    }
  }

  function bindOverviewDetails(doc, hud) {
    var dialog = doc.getElementById('overview-detail-dialog');
    if (!dialog || !hud) return;
    function open(card) {
      var model = hud._metricDetails && hud._metricDetails[card.id];
      if (!model) return;
      renderOverviewDetail(dialog, model);
      dialog._trigger = card;
      dialog.dataset.open = 'true';
      card.setAttribute('aria-expanded', 'true');
      if (dialog.showModal) dialog.showModal();
      (dialog.querySelector('[data-overview-close]') || dialog).focus();
    }
    if (hud.getAttribute('data-metric-details-bound') !== '1') {
      hud.setAttribute('data-metric-details-bound', '1');
      hud.addEventListener('click', function (event) { var card = event.target.closest && event.target.closest('[data-metric-detail]'); if (card && hud.contains(card)) open(card); });
      hud.addEventListener('keydown', function (event) { var card = event.target.closest && event.target.closest('[data-metric-detail]'); if (card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); open(card); } });
    }
    if (dialog.getAttribute('data-overview-dialog-bound') !== '1') {
      dialog.setAttribute('data-overview-dialog-bound', '1');
      dialog.querySelector('[data-overview-close]').addEventListener('click', function () { closeOverviewDetailDialog(doc); });
      dialog.querySelector('[data-overview-view-section]').addEventListener('click', function () { var target = this.getAttribute('data-target-view'); closeOverviewDetailDialog(doc); var tab = doc.querySelector('.tab-btn[data-target-view="' + target + '"]'); if (tab) tab.click(); });
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeOverviewDetailDialog(doc); });
      dialog.addEventListener('keydown', function (event) {
        if (event.key !== 'Tab' || dialog.dataset.open !== 'true') return;
        var focusables = Array.prototype.slice.call(dialog.querySelectorAll('button, [href], [tabindex]')).filter(function (item) { return !item.hidden && !item.disabled && item.getAttribute('tabindex') !== '-1'; });
        if (!focusables.length) return;
        event.preventDefault();
        var index = focusables.indexOf(doc.activeElement);
        var next = event.shiftKey ? (index <= 0 ? focusables.length - 1 : index - 1) : (index === -1 || index === focusables.length - 1 ? 0 : index + 1);
        focusables[next].focus();
      });
    }
  }

  function label(key, state, fallback) {
    if (state && state.meta && state.meta.labels && state.meta.labels.es && typeof state.meta.labels.es[key] === 'string' && state.meta.labels.es[key]) {
      return state.meta.labels.es[key];
    }
    return fallback;
  }

  /**
   * Render header panel from state.
   * Updates #project-title, #project-subtitle, header-meta badges.
   * @param {object} state
   * @param {Document} doc
   */
  function renderHeader(state, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !state || !state.meta) return;
    var meta = state.meta;

    // Title: projectName + version badge
    var titleEl = doc.getElementById('project-title');
    if (titleEl) {
      var nameRaw = meta.projectName || 'Proyecto';
      var versionRaw = meta.version || '';
      var spans = titleEl.querySelectorAll('span');
      if (spans.length >= 2) {
        spans[0].textContent = nameRaw;
        spans[1].textContent = versionRaw ? 'v' + versionRaw.replace(/^v/, '') : '';
        spans[1].style.display = versionRaw ? '' : 'none';
      } else {
        titleEl.innerHTML = '<span>' + esc(nameRaw) + '</span> ' + (versionRaw ? '<span class="badge">v' + esc(versionRaw.replace(/^v/, '')) + '</span>' : '');
      }
    }

    // Subtitle: use meta.description or fallback
    var subtitleEl = doc.getElementById('project-subtitle');
    if (subtitleEl) {
      var subtitle = meta.description || label('headerSubtitle', state, 'Obsidian Technical Cockpit — sincronizado con orquestador IA');
      subtitleEl.textContent = subtitle;
    }

    // Header meta: branch · commit and sync status
    var headerMeta = doc.querySelector('.header-meta');
    if (headerMeta) {
      var branchRaw = meta.branch || (state.git && state.git.branch) || '';
      var commitRaw = meta.commit || (state.git && state.git.commits && state.git.commits[0] && state.git.commits[0].hash) || '';
      commitRaw = commitRaw ? commitRaw.substring(0, 7) : '';
      var syncRaw = meta.syncStatus || (state.git && state.git.syncStatus) || '';

      var badges = headerMeta.querySelectorAll('.badge');
      if (badges.length >= 1) {
        var branchCommitText = '';
        if (branchRaw || commitRaw) {
          branchCommitText = (branchRaw ? branchRaw : '—') + (commitRaw ? ' · ' + commitRaw : '');
        } else {
          branchCommitText = '—';
        }
        var firstBadge = badges[0];
        var dot = firstBadge.querySelector('.badge-dot');
        if (dot) {
          var toRemove = [];
          firstBadge.childNodes.forEach(function (n) {
            if (n !== dot && n.nodeType === 3) toRemove.push(n);
          });
          toRemove.forEach(function (n) { firstBadge.removeChild(n); });
          firstBadge.appendChild(doc.createTextNode(' ' + branchCommitText));
        } else {
          firstBadge.textContent = branchCommitText;
        }
      }
      if (badges.length >= 2) {
        var syncBadge = badges[1];
        var syncText = syncRaw ? syncRaw : '—';
        var dot2 = syncBadge.querySelector('.badge-dot');
        if (dot2) {
          var removes = [];
          syncBadge.childNodes.forEach(function (n) { if (n !== dot2 && n.nodeType === 3) removes.push(n); });
          removes.forEach(function (n) { syncBadge.removeChild(n); });
          syncBadge.appendChild(doc.createTextNode(' ' + syncText));
        } else {
          syncBadge.textContent = syncText;
        }
      }
    }
  }

  /**
   * Render HUD metrics. Pure derived from state+metrics, updates #metrics-overview.
   * Overwrites legacy hardcoded 68% etc.
   * @param {object} state
   * @param {{overallPct:number,total:number,completed:number,distribution:object,perPhase:Array}} metrics
   * @param {Document} doc
   * @param {object} suppliedInsights
   */
  function renderHud(state, metrics, doc, suppliedInsights) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    var core = getCore();
    if (!metrics && core && state) {
      metrics = core.deriveMetrics(state);
    }
    if (!metrics) metrics = { overallPct: 0, total: 0, completed: 0, distribution: { completed: 0, pending: 0, inprogress: 0, blocked: 0 }, perPhase: [] };
    var insights = resolveInsights(state, metrics, core, suppliedInsights);

    var overallLabel = label('overallProgress', state, 'Progreso Global');
    var hud = doc.getElementById('metrics-overview');
    if (!hud) hud = doc.querySelector('.metrics-grid');
    if (!hud) return;

    var total = Math.max(0, Math.round(finiteNumber(metrics.total, 0)));
    var completed = clamp(Math.round(finiteNumber(metrics.completed, 0)), 0, total);
    var overallPct = clamp(Math.round(finiteNumber(metrics.overallPct, 0)), 0, 100);
    var dist = metrics.distribution || { completed: 0, pending: 0, inprogress: 0, blocked: 0 };
    var pending = dist.pending || 0;
    var inprog = dist.inprogress || dist['in-progress'] || 0;
    var blocked = dist.blocked || 0;
    var done = dist.completed || 0;
    var riskTasks = (insights && Array.isArray(insights.tasks) ? insights.tasks : []).filter(function (task) {
      return task && (task.risk === 'high' || task.status === 'blocked');
    });
    var blockerSummary = riskTasks.map(function (task) {
      return esc((task.id || 'Task') + ': ' + (task.blockedReason || task.title || 'Requires attention'));
    }).join(' · ');

    // Determine current focus phase: first in-progress, else first pending, else last completed, else placeholder
    var focusTitle = 'Sin fase';
    var focusPhase = null;
    var focusPct = 0;
    if (state && Array.isArray(state.phases) && state.phases.length) {
      for (var i = 0; i < state.phases.length; i++) {
        if (state.phases[i].status === 'in-progress') { focusPhase = state.phases[i]; break; }
      }
      if (!focusPhase) {
        for (var j = 0; j < state.phases.length; j++) {
          if (state.phases[j].status === 'pending') { focusPhase = state.phases[j]; break; }
        }
      }
      if (!focusPhase) focusPhase = state.phases[state.phases.length - 1];
      if (focusPhase) {
        focusTitle = esc(focusPhase.title || ('Fase ' + (focusPhase.number || '')));
        var matchedPer = metrics.perPhase.find(function(p){ return p.id === focusPhase.id; });
        focusPct = matchedPer ? clamp(matchedPer.pct, 0, 100) : 0;
      }
    }

    var gitBranch = esc((state && state.meta && state.meta.branch) || (state && state.git && state.git.branch) || '—');
    var statusOverallBadge = overallPct === 100 ? 'Completado' : overallPct > 0 ? 'En Progreso' : 'Pendiente';
    var statusOverallClass = overallPct === 100 ? 'badge-completed' : overallPct > 0 ? 'badge-inprogress' : 'badge-pending';
    var phases = state && Array.isArray(state.phases) ? state.phases : [];
    var completedPhases = phases.filter(function (phase) { return phase && phase.status === 'completed'; }).length;
    var activeWorkload = inprog + blocked;
    var coverage = optionalDataCoverage(state);

    var html = ''
      + '<div class="metric-card accent-amber" id="metric-overview-risk">'
      + '<div class="panel-title">Riesgos y bloqueos</div>'
      + '<div style="font-size:20px;font-weight:700;color:#fff;">' + riskTasks.length + (riskTasks.length === 1 ? ' requiere atención' : ' requieren atención') + '</div>'
      + '<div style="font-size:11.5px;color:' + (riskTasks.length ? 'var(--accent-red)' : 'var(--accent-green)') + ';">' + (riskTasks.length ? blockerSummary : '✓ Sin bloqueos ni riesgos críticos') + '</div>'
      + '</div>'
      + '<div class="metric-card accent-blue" id="metric-overall-card">'
      + '<div class="panel-title metric-title-row">'
      + '<span>' + esc(overallLabel) + '</span>'
      + '<span class="badge ' + statusOverallClass + '">' + statusOverallBadge + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;">'
      + '<div style="font-size:28px;font-weight:700;color:#fff;font-family:var(--font-mono);letter-spacing:-0.02em;" id="overall-progress-num">' + overallPct + '%</div>'
      + '<div style="font-size:12px;color:var(--text-tertiary);"><span id="stat-completed-count">' + completed + '</span> de <span id="stat-total-count">' + total + '</span> tareas</div>'
      + '</div>'
      + '<div class="progress-track"><div id="overall-progress-bar" class="progress-bar inprogress" style="width:' + overallPct + '%;"></div></div>'
      + '<div style="font-size:11.5px;color:var(--text-tertiary);display:flex;justify-content:space-between;">'
      + '<span>' + completed + ' completadas</span>'
      + '<span>' + (total - completed) + ' restantes</span>'
      + '</div>'
      + '</div>'

      + '<div class="metric-card accent-purple" id="metric-current-focus">'
      + '<div class="panel-title metric-title-row">'
      + '<span>Fase Actual</span>'
      + (focusPhase && focusPhase.target ? '<span class="badge badge-tag">' + esc(focusPhase.target) + '</span>' : '')
      + '</div>'
      + '<div style="font-size:16px;font-weight:600;color:#fff;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" id="current-focus-title">' + focusTitle + '</div>'
      + '<div class="progress-track"><div style="width:' + focusPct + '%;height:100%;background:var(--accent-purple);border-radius:4px;transition:width 0.35s;"></div></div>'
      + '<div style="font-size:11.5px;color:var(--text-tertiary);display:flex;justify-content:space-between;">'
      + '<span>' + (focusPhase && focusPhase.lead ? 'Lead: ' + esc(focusPhase.lead) : 'Sprint activo') + '</span>'
      + '<span style="font-family:var(--font-mono);">' + focusPct + '%</span>'
      + '</div>'
      + '</div>'

      + '<div class="metric-card accent-green" id="metric-distribution">'
      + '<div class="panel-title">Distribución</div>'
      + '<div class="distribution-badges">'
      + '<span class="badge badge-completed"><span class="badge-dot completed"></span> ' + done + ' Hechas</span>'
      + '<span class="badge badge-inprogress"><span class="badge-dot inprogress"></span> ' + inprog + ' Activas</span>'
      + '<span class="badge badge-pending"><span class="badge-dot pending"></span> ' + pending + ' Pendientes</span>'
      + '<span class="badge badge-blocked"><span class="badge-dot blocked"></span> ' + blocked + ' Bloqueadas</span>'
      + '</div>'
      + (blocked > 0 ? '<div class="distribution-risk-warning" style="font-size:11.5px;color:var(--accent-red);margin-top:4px;display:flex;align-items:center;gap:4px;"><span class="badge-dot blocked"></span> ' + blocked + ' bloqueada(s) requiere(n) atención</div>' : '<div style="font-size:11.5px;color:var(--accent-green);margin-top:4px;">✓ Sin bloqueos activos</div>')
      + '</div>'

      + '<div class="metric-card accent-amber" id="metric-git">'
      + '<div class="panel-title metric-title-row">'
      + '<span>Git</span>'
      + '<span class="badge badge-tag" style="color:var(--accent-amber);border-color:rgba(210,153,34,0.3);">' + ((state && state.git && state.git.syncStatus) || 'Synced') + '</span>'
      + '</div>'
      + '<div style="font-size:13px;color:#fff;font-family:var(--font-mono);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">branch: ' + esc(gitBranch) + '</div>'
      + '<div style="font-size:11.5px;color:var(--text-tertiary);margin-top:2px;">' + total + ' tareas totales · ' + phases.length + ' fases</div>'
      + '</div>'

      + '<div class="metric-card accent-green" id="metric-phase-coverage">'
      + '<div class="panel-title">Cobertura de fases</div>'
      + '<div class="metric-summary-value">' + completedPhases + ' de ' + phases.length + ' fases</div>'
      + '<div class="metric-summary-copy">' + (phases.length ? Math.round(completedPhases / phases.length * 100) : 0) + '% cerradas · ' + Math.max(0, phases.length - completedPhases) + ' por completar</div>'
      + '</div>'

      + '<div class="metric-card accent-blue" id="metric-active-workload">'
      + '<div class="panel-title">Carga activa</div>'
      + '<div class="metric-summary-value">' + activeWorkload + ' tareas</div>'
      + '<div class="metric-summary-copy">' + inprog + ' en progreso · ' + blocked + ' bloqueadas</div>'
      + '</div>'

      + '<div class="metric-card accent-purple" id="metric-data-coverage">'
      + '<div class="panel-title">Cobertura informativa</div>'
      + '<div class="metric-summary-value">' + coverage + ' de 3 fuentes</div>'
      + '<div class="metric-summary-copy">Git · árbol · Codegraph según datos disponibles</div>'
      + '</div>'

      + '<div class="metric-card accent-blue metric-insights-band" id="metric-insights">'
      + '<div class="panel-title" style="grid-column:1 / -1;">Insights</div>'
      + '<div class="insight-band-grid">'
      + '<div class="insight-band-region insight-status-region"><span class="insight-region-label">Status composition</span>' + renderStatusSvg(insights) + '</div>'
      + '<div class="insight-band-region insight-risk-region"><span class="insight-region-label">Risk & blockers</span><div class="insight-risk-values"><span>Blockers: ' + Math.round(Math.max(0, finiteNumber(insights.blockers && insights.blockers.total, 0))) + '</span><span>High risk: ' + riskCount(insights, 'high') + '</span><span>Med risk: ' + riskCount(insights, 'med') + '</span></div></div>'
      + '<div class="insight-band-region insight-owners"><span class="insight-region-label">Owners</span>' + renderDimensionLines(insights.dimensions && insights.dimensions.owner) + '</div>'
      + '<div class="insight-band-region insight-tags"><span class="insight-region-label">Tags</span>' + renderDimensionLines(insights.dimensions && insights.dimensions.tag) + '</div>'
      + '<div class="insight-band-region insight-trend-region"><span class="insight-region-label">Bounded trend</span>' + renderTrend(insights) + '</div>'
      + '</div>'
      + '</div>';

    hud.innerHTML = html;
    hud._metricDetails = buildMetricDetailModels(state, metrics, insights, { overallLabel: overallLabel, total: total, completed: completed, overallPct: overallPct, pending: pending, inprog: inprog, blocked: blocked, done: done, riskTasks: riskTasks, focusPhase: focusPhase, focusPct: focusPct, completedPhases: completedPhases, activeWorkload: activeWorkload, coverage: coverage });
    decorateMetricCards(hud);
    bindOverviewDetails(doc, hud);
  }

  /**
   * Setup Navigation Tabs & Global Search events
   * @param {Document} doc
   */
  function setupNavTabs(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;

    var tabButtons = doc.querySelectorAll('.tab-btn[data-target-view]');
    var core = getCore();
    var storage = core && typeof core.storageForDocument === 'function' ? core.storageForDocument(doc) : null;
    var store = core && typeof core.createUiPreferenceStore === 'function' ? core.createUiPreferenceStore(storage) : null;
    var preferences = store ? store.load() : null;
    function isEditable(target) {
      return !!(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(target.tagName) !== -1));
    }
    function activateView(targetId) {
      var targetButton = Array.prototype.find.call(tabButtons, function (button) { return button.getAttribute('data-target-view') === targetId; });
      if (!targetButton) return;
      tabButtons.forEach(function (b) {
        var active = b === targetButton;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      doc.querySelectorAll('.view-container').forEach(function (view) {
        var active = view.id === targetId;
        view.hidden = !active;
        view.style.display = active ? 'flex' : 'none';
      });
      var hud = doc.getElementById('metrics-overview');
      if (hud) { var overview = targetId === 'view-overview'; hud.hidden = !overview; hud.style.display = overview ? '' : 'none'; }
      if (store && preferences) { preferences.activeView = targetId.replace(/^view-/, ''); preferences = store.save(preferences); }
    }
    var initialTarget = doc.querySelector('.tab-btn.active[data-target-view]');
    var initialOverview = !initialTarget || initialTarget.getAttribute('data-target-view') === 'view-overview';
    var initialHud = doc.getElementById('metrics-overview');
    if (initialHud) {
      initialHud.hidden = !initialOverview;
      initialHud.style.display = initialOverview ? '' : 'none';
    }
    tabButtons.forEach(function (btn) {
      if (btn.getAttribute('data-tab-bound') === '1') return;
      btn.setAttribute('data-tab-bound', '1');

      btn.addEventListener('click', function () {
        activateView(btn.getAttribute('data-target-view'));
      });
    });

    // Global search input
    var searchInput = doc.getElementById('global-search-input');
    if (searchInput && searchInput.getAttribute('data-search-bound') !== '1') {
      searchInput.setAttribute('data-search-bound', '1');
      searchInput.addEventListener('input', function () {
        var query = searchInput.value.trim().toLowerCase();
        var phaseApi = (typeof window !== 'undefined' && window.TMPhases) || (typeof globalThis !== 'undefined' && globalThis.TMPhases);
        if (phaseApi && typeof phaseApi.setFilter === 'function') phaseApi.setFilter({ text: query }, doc);
        else doc.querySelectorAll('.task-item').forEach(function (item) {
          item.style.display = !query || item.textContent.toLowerCase().indexOf(query) !== -1 ? '' : 'none';
        });
      });
    }

    // Keyboard shortcuts: 1-7 for tabs
    if (doc.documentElement.getAttribute('data-tm-keyboard-bound') !== '1') {
      doc.documentElement.setAttribute('data-tm-keyboard-bound', '1');
      doc.addEventListener('keydown', function (e) {
        if (isEditable(e.target)) return;
        var num = parseInt(e.key, 10);
        if (num >= 1 && num <= 7) {
          var targetBtn = tabButtons[num - 1];
          if (targetBtn) activateView(targetBtn.getAttribute('data-target-view'));
        } else if (e.key === 'e' || e.key === 'E') {
          var expandBtn = doc.getElementById('btn-expand-all');
          if (expandBtn) expandBtn.click();
        } else if (e.key === '/') {
          e.preventDefault();
          if (searchInput) searchInput.focus();
        }
      });
    }
  }

  /**
   * Combined render for convenience
   * @param {object} state
   * @param {Document} doc
   */
  function renderAll(state, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc || !state) return;
    var core = getCore();
    var context = core && typeof core.createBootstrapContext === 'function' ? core.createBootstrapContext(doc, state) : null;
    var immutableState = context && context.state || state;
    var metrics = core ? core.deriveMetrics(immutableState) : null;
    var insights = context && context.viewModels || (core && typeof core.deriveInsights === 'function' ? core.deriveInsights(immutableState) : null);
    renderHeader(immutableState, doc);
    renderHud(immutableState, metrics, doc, insights);
    setupNavTabs(doc);
    return context;
  }

  var TMHeaderHud = {
    renderHeader: renderHeader,
    renderHud: renderHud,
    closeOverviewDetailDialog: closeOverviewDetailDialog,
    setupNavTabs: setupNavTabs,
    activateView: function (targetId, doc) { setupNavTabs(doc); var button = doc.querySelector('.tab-btn[data-target-view="' + targetId + '"]'); if (button) button.click(); },
    renderAll: renderAll
  };

  try { if (typeof window !== 'undefined') window.TMHeaderHud = TMHeaderHud; } catch (_) {}
  try { if (typeof globalThis !== 'undefined') globalThis.TMHeaderHud = TMHeaderHud; } catch (_) {}
  try { if (typeof global !== 'undefined') global.TMHeaderHud = TMHeaderHud; } catch (_) {}
  try { if (typeof module !== 'undefined' && module.exports) module.exports = TMHeaderHud; } catch (_) {}

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this);
