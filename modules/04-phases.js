// @ts-nocheck
// modules/04-phases.js — Phases accordion, tasks, filters & Kanban view (PR4, classic script)
// Depends on TMCore. Classic script, no fetch/import.
// English code, Spanish UI via esc + phase/task data.

(function (global) {
  'use strict';

  function getCore() {
    return (typeof window !== 'undefined' && window.TMCore) || (typeof globalThis !== 'undefined' && globalThis.TMCore) || (typeof global !== 'undefined' && global.TMCore) || null;
  }
  function esc(s) {
    var c = getCore();
    return c ? c.escapeHtml(s) : String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function normalizeStatus(s) {
    var c = getCore();
    if (c && c._normalizeStatus) return c._normalizeStatus(s);
    if (s === 'completed' || s === 'in-progress' || s === 'pending' || s === 'blocked') return s;
    return 'pending';
  }
  function statusBadgeClass(status) {
    var n = normalizeStatus(status);
    if (n === 'completed') return 'badge-completed';
    if (n === 'in-progress') return 'badge-inprogress';
    if (n === 'blocked') return 'badge-blocked';
    return 'badge-pending';
  }
  function statusDotClass(status) {
    var n = normalizeStatus(status);
    if (n === 'completed') return 'completed';
    if (n === 'in-progress') return 'inprogress';
    if (n === 'blocked') return 'blocked';
    return 'pending';
  }
  function statusLabel(status) {
    var n = normalizeStatus(status);
    if (n === 'completed') return 'Completado';
    if (n === 'in-progress') return 'En Progreso';
    if (n === 'blocked') return 'Bloqueado';
    return 'Pendiente';
  }

  function filterDefaults() {
    return { text: '', status: 'all', owner: '', tag: '', phase: '' };
  }

  function taskKey(record) {
    return String(record.phaseId || '') + '::' + String(record.id || '');
  }

  function taskRecordFromElement(el) {
    return {
      id: el.getAttribute('data-task-id') || '',
      title: el.getAttribute('data-task-title') || '',
      note: el.getAttribute('data-task-note') || '',
      status: el.getAttribute('data-status') || 'pending',
      owner: el.getAttribute('data-owner') || 'Unassigned',
      tag: el.getAttribute('data-tag') || 'Untagged',
      phaseId: el.getAttribute('data-phase-id') || '',
      phaseTitle: el.getAttribute('data-phase-title') || ''
    };
  }

  function filterOptions(state) {
    var owners = Object.create(null);
    var tags = Object.create(null);
    var phases = Object.create(null);
    var source = state && Array.isArray(state.phases) ? state.phases : [];
    source.forEach(function (phase, phaseIndex) {
      var phaseId = String(phase && phase.id || ('phase-' + phaseIndex));
      phases[phaseId] = String(phase && phase.title || ('Phase ' + (phaseIndex + 1)));
      (Array.isArray(phase && phase.tasks) ? phase.tasks : []).forEach(function (task) {
        owners[String(task && task.owner || '').trim() || 'Unassigned'] = true;
        tags[String(task && task.tag || '').trim() || 'Untagged'] = true;
      });
    });
    return { owners: Object.keys(owners).sort(), tags: Object.keys(tags).sort(), phases: phases };
  }

  function setOptions(select, values, selected) {
    if (!select) return;
    var html = '<option value="">All</option>';
    values.forEach(function (value) {
      var label = typeof value === 'object' ? value.label : value;
      var optionValue = typeof value === 'object' ? value.value : value;
      html += '<option value="' + esc(optionValue) + '">' + esc(label) + '</option>';
    });
    select.innerHTML = html;
    select.value = selected || '';
  }

  function setupFilterControls(doc, state) {
    var current = doc.__tmFilterState || filterDefaults();
    var options = filterOptions(state);
    setOptions(doc.getElementById('task-filter-owner'), options.owners, current.owner);
    setOptions(doc.getElementById('task-filter-tag'), options.tags, current.tag);
    setOptions(doc.getElementById('task-filter-phase'), Object.keys(options.phases).sort().map(function (id) {
      return { value: id, label: options.phases[id] };
    }), current.phase);

    var bindings = [
      ['task-filter-text', 'text', 'input'],
      ['task-filter-status', 'status', 'change'],
      ['task-filter-owner', 'owner', 'change'],
      ['task-filter-tag', 'tag', 'change'],
      ['task-filter-phase', 'phase', 'change']
    ];
    bindings.forEach(function (binding) {
      var control = doc.getElementById(binding[0]);
      if (!control || control.getAttribute('data-filter-bound') === '1') return;
      control.setAttribute('data-filter-bound', '1');
      control.addEventListener(binding[2], function () {
        var next = {};
        next[binding[1]] = control.value;
        setFilter(next, doc);
      });
    });
    var reset = doc.getElementById('task-filter-reset');
    if (reset && reset.getAttribute('data-filter-bound') !== '1') {
      reset.setAttribute('data-filter-bound', '1');
      reset.addEventListener('click', function () { setFilter(filterDefaults(), doc); });
    }
  }

  /**
   * Render Kanban Board into #kanban-board-mount
   */
  function collectTasks(state) {
    var phases = (state && Array.isArray(state.phases)) ? state.phases : [];
    var allTasks = [];
    phases.forEach(function (phase, pIdx) {
      var tasks = Array.isArray(phase.tasks) ? phase.tasks : [];
      tasks.forEach(function (task) {
        allTasks.push({ task: task, phaseId: phase.id || ('phase-' + (pIdx + 1)), phaseTitle: phase.title || ('Fase ' + (pIdx + 1)), phaseNumber: phase.number != null ? phase.number : (pIdx + 1) });
      });
    });
    return allTasks;
  }

  function kanbanHtml(state, compact) {
    var allTasks = collectTasks(state);
    var columns = [
      { key: 'pending', label: 'Pendiente', badgeClass: 'badge-pending', dotClass: 'pending', accent: 'var(--accent-amber)' },
      { key: 'in-progress', label: 'En Progreso', badgeClass: 'badge-inprogress', dotClass: 'inprogress', accent: 'var(--accent-blue)' },
      { key: 'blocked', label: 'Bloqueado', badgeClass: 'badge-blocked', dotClass: 'blocked', accent: 'var(--accent-red)' },
      { key: 'completed', label: 'Completado', badgeClass: 'badge-completed', dotClass: 'completed', accent: 'var(--accent-green)' }
    ];
    var html = '';
    columns.forEach(function (col) {
      var colTasks = allTasks.filter(function (item) { return normalizeStatus(item.task.status) === col.key; });
      html += '<div class="kanban-column' + (compact ? ' kanban-column-compact' : '') + '" style="border-top:3px solid ' + col.accent + ';">'
        + '<div class="kanban-column-header"><span class="kanban-column-title"><span class="badge-dot ' + col.dotClass + '"></span> ' + col.label + '</span><span class="badge ' + col.badgeClass + '">' + colTasks.length + '</span></div>'
        + '<div class="kanban-cards-list">';
      if (!colTasks.length) html += '<div class="kanban-empty">Sin tareas</div>';
      colTasks.forEach(function (item) {
        var t = item.task || {}, note = esc(t.note || ''), tag = esc(t.tag || ''), owner = esc(t.owner || '');
        html += '<div class="task-item status-' + (col.key === 'in-progress' ? 'inprogress' : col.key) + '" data-task-id="' + esc(t.id || 'T') + '" data-status="' + normalizeStatus(t.status) + '" data-task-title="' + esc(t.title || 'Tarea') + '" data-task-note="' + note + '" data-owner="' + esc(t.owner || 'Unassigned') + '" data-tag="' + tag + '" data-phase-id="' + esc(item.phaseId) + '" data-phase-title="' + esc(item.phaseTitle) + '">'
          + '<div class="kanban-task-meta"><span class="badge-tag">Fase ' + item.phaseNumber + '</span>' + (tag ? '<span class="badge-tag">' + tag + '</span>' : '') + '</div>'
          + '<div class="kanban-task-title"><span class="task-id">' + esc(t.id || 'T') + '</span> ' + esc(t.title || 'Tarea') + '</div>'
          + (!compact && note ? '<div class="kanban-task-note">' + note + '</div>' : '')
          + '<div class="kanban-task-footer"><span>Responsable: ' + (owner || '—') + '</span></div>'
          + '</div>';
      });
      html += '</div></div>';
    });
    return { html: html, total: allTasks.length };
  }

  function renderKanban(state, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    var mount = doc.getElementById('kanban-board-mount');
    if (!mount) return;

    var result = kanbanHtml(state, false);

    var totalCounter = doc.getElementById('kanban-total-counter');
    if (totalCounter) totalCounter.textContent = result.total + ' tareas en flujo';
    mount.innerHTML = result.html;
    applyFilter(doc);
  }

  function renderOverview(state, metrics, doc) {
    var kanbanMount = doc.getElementById('overview-kanban-mount');
    var phasesMount = doc.getElementById('overview-phases-mount');
    if (kanbanMount) kanbanMount.innerHTML = kanbanHtml(state, true).html;
    if (!phasesMount) return;
    var phases = state && Array.isArray(state.phases) ? state.phases : [];
    phasesMount.innerHTML = phases.map(function (phase, index) {
      var per = metrics && metrics.perPhase && metrics.perPhase.filter(function (item) { return item.id === phase.id; })[0];
      var pct = per ? per.pct : 0, tasks = Array.isArray(phase.tasks) ? phase.tasks : [];
      return '<article class="overview-phase-row"><div class="overview-phase-heading"><span class="phase-number">FASE ' + String(phase.number != null ? phase.number : index + 1).padStart(2, '0') + '</span><div><strong>' + esc(phase.title || 'Fase') + '</strong><span>' + tasks.length + ' tareas · ' + (phase.lead ? 'Responsable: ' + esc(phase.lead) : 'Sin responsable') + '</span></div><span class="badge ' + statusBadgeClass(phase.status) + '">' + statusLabel(phase.status) + '</span></div><div class="progress-track"><div class="progress-bar ' + (normalizeStatus(phase.status) === 'completed' ? 'completed' : 'inprogress') + '" style="width:' + pct + '%;"></div></div><div class="overview-phase-tasks">' + tasks.map(function (task) { return '<span><span class="badge-dot ' + statusDotClass(task.status) + '"></span>' + esc(task.id || 'Tarea') + ' · ' + esc(task.title || 'Sin título') + '</span>'; }).join('') + '</div></article>';
    }).join('') || '<div class="optional-empty">Sin fases definidas</div>';
  }

  function renderPhases(state, metrics, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    var core = getCore();
    if (!metrics && core && state) metrics = core.deriveMetrics(state);
    if (!metrics) metrics = { overallPct: 0, total: 0, completed: 0, perPhase: [] };

    var container = doc.getElementById('phases-list');
    if (!container) return;

    var phases = (state && Array.isArray(state.phases)) ? state.phases : [];

    if (phases.length === 0) {
      container.innerHTML = '<div style="color:#8b949e;font-size:13px;padding:12px;text-align:center;">Sin fases definidas — la IA creará las fases aquí</div>';
      attachEvents(doc, state, metrics);
      setupFilterControls(doc, state);
      renderKanban(state, doc);
      renderOverview(state, metrics, doc);
      applyFilter(doc);
      return;
    }

    var html = '';
    for (var i = 0; i < phases.length; i++) {
      var phase = phases[i];
      var phaseId = esc(phase.id || ('phase-' + (i+1)));
      var phaseNumber = phase.number != null ? phase.number : (i+1);
      var phaseNumberStr = 'PHASE ' + String(phaseNumber).padStart(2, '0');
      var title = esc(phase.title || ('Fase ' + phaseNumber));
      var status = normalizeStatus(phase.status);
      var badgeCls = statusBadgeClass(status);
      var dotCls = statusDotClass(status);
      var badgeLabel = statusLabel(status);

      var per = null;
      for (var k = 0; k < metrics.perPhase.length; k++) {
        if (metrics.perPhase[k].id === phase.id) { per = metrics.perPhase[k]; break; }
      }
      if (!per && metrics.perPhase[i]) per = metrics.perPhase[i];
      var pct = per ? per.pct : 0;
      var total = per ? per.total : (Array.isArray(phase.tasks) ? phase.tasks.length : 0);
      var completed = per ? per.completed : 0;

      var target = esc(phase.target || '');
      var lead = esc(phase.lead || '');

      html += '<div class="phase-card" id="phase-' + esc(String(phase.number || i+1)) + '" data-phase-id="' + phaseId + '" data-status="' + esc(status) + '">'
        + '<button type=\"button\" class=\"phase-header\" aria-expanded=\"true\">'
        + '<div class=\"phase-header-left\">'
        + '<span class=\"phase-toggle-icon\"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"6 9 12 15 18 9\"></polyline></svg></span>'
        + '<span class=\"phase-number\">' + esc(phaseNumberStr) + '</span>'
        + '<span class=\"phase-title-text\">' + title + '</span>'
        + '</div>'
        + '<div class=\"phase-header-right\">'
        + '<span class=\"badge ' + badgeCls + ' phase-status-badge\"><span class=\"badge-dot ' + dotCls + '\"></span> ' + esc(badgeLabel) + '</span>'
        + '<div class=\"phase-progress-info\"><div class=\"progress-track\"><div class=\"progress-bar ' + (status === 'completed' ? 'completed' : status === 'in-progress' ? 'inprogress' : status === 'blocked' ? 'blocked' : 'pending') + ' phase-bar\" style=\"width:' + pct + '%;\"></div></div><span class=\"phase-progress-pct\">' + pct + '%</span></div>'
        + '</div>'
        + '</button>'
        + '<div class=\"phase-tasks-wrapper\">'
        + '<div class=\"phase-meta-bar\"><span>' + (target ? 'Objetivo: ' + target + ' · ' : '') + (lead ? 'Responsable: ' + lead : '') + '</span><span class=\"phase-task-counter\">' + completed + ' / ' + total + ' tareas</span></div>';

      var tasks = Array.isArray(phase.tasks) ? phase.tasks : [];
      if (tasks.length === 0) {
        html += '<div style=\"color:#8b949e;font-size:13px;padding:8px;text-align:center;\">Sin tareas en esta fase — 0%</div>';
      } else {
        for (var j = 0; j < tasks.length; j++) {
          var task = tasks[j] || {};
          var tId = esc(task.id || ('T' + (j+1)));
          var tTitle = esc(task.title || 'Tarea sin título');
          var tStatus = normalizeStatus(task.status);
          var tBadgeCls = statusBadgeClass(tStatus);
          var tDotCls = statusDotClass(tStatus);
          var tBadgeLabel = statusLabel(tStatus);
          var tag = esc(task.tag || '');
          var note = esc(task.note || '');
          var owner = esc(task.owner || '');
          var commit = esc(task.commit || '');
          var itemStatusClass = tStatus === 'in-progress' ? 'status-inprogress' : 'status-' + tStatus;
          var taskItemCls = 'task-item ' + itemStatusClass;

          html += '<div class=\"' + taskItemCls + '\" data-task-id=\"' + tId + '\" data-status=\"' + tStatus + '\" data-task-title=\"' + esc(task.title || '') + '\" data-task-note=\"' + note + '\" data-owner=\"' + esc(task.owner || 'Unassigned') + '\" data-tag=\"' + tag + '\" data-phase-id=\"' + phaseId + '\" data-phase-title=\"' + title + '\">'
            + '<div class=\"task-main-row\">'
            + '<div class=\"task-checkbox-wrap\">'
            + '<span class=\"task-title\"><span class=\"task-id\">' + tId + '</span> ' + tTitle + '</span>'
            + '</div>'
            + '<div class=\"task-badges\">'
            + (tag ? '<span class=\"badge-tag\">' + tag + '</span>' : '')
            + '<span class=\"badge ' + tBadgeCls + '\"><span class=\"badge-dot ' + tDotCls + '\"></span> ' + tBadgeLabel + '</span>'
            + '</div>'
            + '</div>'
            + (note ? renderNote(task.note) : '')
            + '<div class=\"task-footer-row\"><span class=\"task-owner-pill\">👤 ' + (owner || '—') + '</span><span>' + (commit ? 'commit <code>' + commit.substring(0,7) + '</code>' : '') + '</span></div>'
            + '</div>';
        }
      }

      html += '</div></div>';
    }

    container.innerHTML = html;

    attachEvents(doc, state, metrics);
    setupFilterControls(doc, state);
    applyFilterFromStorage(doc);
    renderKanban(state, doc);
    renderOverview(state, metrics, doc);
    applyFilter(doc);
  }

  function attachEvents(doc, state, metrics) {
    // Stable mount delegates dynamic accordion and preview events once.
    var container = doc.getElementById('phases-list');
    if (container && container.getAttribute('data-phases-bound') !== '1') {
      container.setAttribute('data-phases-bound', '1');
      container.addEventListener('click', function (event) {
        var noteToggle = event.target.closest('[data-note-toggle]');
        if (noteToggle) {
          var task = noteToggle.closest('.task-item');
          var preview = task && task.querySelector('[data-note-preview]');
          if (!preview) return;
          var expanded = noteToggle.getAttribute('aria-expanded') === 'true';
          preview.textContent = expanded ? preview.getAttribute('data-note-preview-text') : preview.getAttribute('data-note-full');
          noteToggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
          noteToggle.textContent = expanded ? 'Ver nota completa' : 'Ocultar nota';
          return;
        }
        var btn = event.target.closest('.phase-header');
        if (!btn || !container.contains(btn)) return;
        var card = btn.closest('.phase-card');
        if (!card) return;
        var isCollapsed = card.classList.contains('collapsed');
        if (isCollapsed) {
          card.classList.remove('collapsed');
          btn.setAttribute('aria-expanded', 'true');
        } else {
          card.classList.add('collapsed');
          btn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Expand All button
    var expandBtn = doc.getElementById('btn-expand-all');
    if (expandBtn && expandBtn.getAttribute('data-phases-bound') !== '1') {
      expandBtn.setAttribute('data-phases-bound', '1');
      expandBtn.addEventListener('click', function () {
        var cards = doc.querySelectorAll('.phase-card');
        var anyCollapsed = false;
        cards.forEach(function (c) { if (c.classList.contains('collapsed')) anyCollapsed = true; });
        cards.forEach(function (c) {
          if (anyCollapsed) {
            c.classList.remove('collapsed');
            var b = c.querySelector('.phase-header');
            if (b) b.setAttribute('aria-expanded', 'true');
          } else {
            c.classList.add('collapsed');
            var b2 = c.querySelector('.phase-header');
            if (b2) b2.setAttribute('aria-expanded', 'false');
          }
        });
        expandBtn.textContent = anyCollapsed ? 'Collapse All' : 'Expand All';
      });
    }

    // Filter buttons
    var btnAll = doc.getElementById('btn-filter-all');
    var btnActive = doc.getElementById('btn-filter-active');
    if (btnAll && btnAll.getAttribute('data-phases-bound') !== '1') {
      btnAll.setAttribute('data-phases-bound', '1');
      btnAll.addEventListener('click', function () {
        setFilter({ status: 'all' }, doc);
      });
    }
    if (btnActive && btnActive.getAttribute('data-phases-bound') !== '1') {
      btnActive.setAttribute('data-phases-bound', '1');
      btnActive.addEventListener('click', function () {
        setFilter({ status: 'active' }, doc);
      });
    }

    var current = doc.__tmFilterState || { status: getStoredFilter(doc) };
    updateFilterButtons(doc, current.status);
  }

  function preferenceStore(doc) {
    var core = getCore();
    var storage = core && typeof core.storageForDocument === 'function' ? core.storageForDocument(doc) : null;
    return core && core.createUiPreferenceStore ? core.createUiPreferenceStore(storage) : null;
  }

  function getStoredFilter(doc) {
    var store = preferenceStore(doc);
    return store ? store.load().filters.status : 'all';
  }

  function setStoredFilter(filter, doc) {
    var store = preferenceStore(doc);
    if (!store) return;
    var preferences = store.load();
    preferences.filters = Object.assign({}, preferences.filters, filter);
    store.save(preferences);
  }

  function updateFilterButtons(doc, filter) {
    var btnAll = doc.getElementById('btn-filter-all');
    var btnActive = doc.getElementById('btn-filter-active');
    if (btnAll) btnAll.classList.toggle('active', filter === 'all');
    if (btnActive) btnActive.classList.toggle('active', filter === 'active');
  }

  function setFilter(filter, doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    var next = doc.__tmFilterState || filterDefaults();
    if (typeof filter === 'string') next = Object.assign(next, { status: filter });
    else next = Object.assign(next, filter || {});
    if (!next.status) next.status = 'all';
    doc.__tmFilterState = next;
    setStoredFilter(next, doc);
    updateFilterButtons(doc, next.status);
    var controls = {
      text: doc.getElementById('task-filter-text'),
      status: doc.getElementById('task-filter-status'),
      owner: doc.getElementById('task-filter-owner'),
      tag: doc.getElementById('task-filter-tag'),
      phase: doc.getElementById('task-filter-phase')
    };
    Object.keys(controls).forEach(function (key) { if (controls[key]) controls[key].value = next[key] || ''; });
    applyFilter(doc);
  }

  function applyFilterFromStorage(doc) {
    var f = getStoredFilter(doc);
    setFilter(f, doc);
  }

  function applyFilter(doc) {
    var current = doc.__tmFilterState || filterDefaults();
    var core = getCore();
    var visible = Object.create(null);
    var total = Object.create(null);
    var dedicated = doc.getElementById('view-phases');
    var kanban = doc.getElementById('view-kanban');
    var items = [];
    if (dedicated) items = items.concat(Array.prototype.slice.call(dedicated.querySelectorAll('.task-item')));
    if (kanban) items = items.concat(Array.prototype.slice.call(kanban.querySelectorAll('.task-item')));
    items.forEach(function (el) {
      var record = taskRecordFromElement(el);
      var key = taskKey(record);
      var matches = core && typeof core.matchesTask === 'function' ? core.matchesTask(record, current) : true;
      total[key] = true;
      if (matches) visible[key] = true;
      el.style.display = matches ? '' : 'none';
      if (matches) el.removeAttribute('data-filter-hidden');
      else el.setAttribute('data-filter-hidden', '1');
    });
    var totalCount = Object.keys(total).length;
    var visibleCount = Object.keys(visible).length;
    var counter = doc.getElementById('filter-result-count');
    if (counter) counter.textContent = visibleCount + ' / ' + totalCount + ' visible';
    var empty = doc.getElementById('filter-empty-state');
    if (empty) empty.hidden = !(totalCount > 0 && visibleCount === 0);
  }

  function renderNote(rawNote) {
    var lines = String(rawNote == null ? '' : rawNote).split('\n');
    var preview = lines.slice(0, 3).join('\n');
    return '<p class="task-note" data-note-preview data-note-lines="3" data-note-full="' + esc(rawNote) + '" data-note-preview-text="' + esc(preview) + '">' + esc(preview) + '</p>'
      + (lines.length > 3 ? '<button type="button" class="btn btn-secondary btn-sm" data-note-toggle aria-expanded="false" aria-label="Expand full task note">Ver nota completa</button>' : '');
  }

  var TMPhases = {
    renderPhases: renderPhases,
    renderKanban: renderKanban,
    setFilter: setFilter,
    getStoredFilter: getStoredFilter,
    getFilterState: function (doc) { return Object.assign(filterDefaults(), doc && doc.__tmFilterState || {}); },
    applyFilter: applyFilter
  };

  try { if (typeof window !== 'undefined') window.TMPhases = TMPhases; } catch (_) {}
  try { if (typeof globalThis !== 'undefined') globalThis.TMPhases = TMPhases; } catch (_) {}
  try { if (typeof global !== 'undefined') global.TMPhases = TMPhases; } catch (_) {}
  try { if (typeof module !== 'undefined' && module.exports) module.exports = TMPhases; } catch (_) {}

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this);
