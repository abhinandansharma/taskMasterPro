$(document).ready(function () {
    // App state
    const STORAGE_KEY = 'taskmaster.tasks';
    const SOUND_KEY = 'taskmaster.sound';
    let tasks = [];
    let currentFilter = 'all';
    let searchQuery = '';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cache DOM elements
    const $taskList = $('#task-list');
    const $newTaskInput = $('#new-task-input');
    const $addTaskBtn = $('#add-task-btn');
    const $prioritySelect = $('#priority-select');
    const $dueInput = $('#due-input');
    const $searchInput = $('#search-input');
    const $clearSearchBtn = $('#clear-search');
    const $emptyState = $('#empty-state');
    const $noSearchResults = $('#no-search-results');
    const $filterBtns = $('.filter-btn');
    const $clearCompletedBtn = $('#clear-completed');
    const $themeToggle = $('#theme-toggle');

    // Statistics elements
    const $totalTasks = $('#total-tasks');
    const $activeTasks = $('#active-tasks');
    const $completedTasks = $('#completed-tasks');
    const $progressFill = $('#progress-fill');
    const $progressText = $('#progress-text');

    // Initialize app
    let pomodoro = null;
    init();
    pomodoro = initPomodoro();
    initSound();
    initBackup();
    initShortcuts();
    registerServiceWorker();

    function init() {
        loadTheme();
        $('#today-label').text(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }));
        const saved = loadSavedTasks();
        if (saved) {
            tasks = saved;
        } else {
            loadSampleTasks();
            saveTasks();
        }
        bindEvents();
        updateStats();
        renderList();
    }

    function loadSavedTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter(isTask) : null;
        } catch (e) {
            return null;
        }
    }

    function isTask(t) {
        return !!t && typeof t === 'object' && typeof t.text === 'string' && t.text.trim() !== '';
    }

    function saveTasks() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { /* storage unavailable */ }
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        $('#theme-toggle .theme-label').text(savedTheme === 'dark' ? 'Dark' : 'Light');
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        $('#theme-toggle .theme-label').text(newTheme === 'dark' ? 'Dark' : 'Light');
    }

    function loadSampleTasks() {
        const samples = [
            ['Write the release notes', 'high', isoToday()],
            ['Review the open pull requests', 'medium', null],
            ['Book the dentist', 'low', isoDaysFromNow(3)],
        ];
        tasks = samples.map(([text, priority, dueDate], index) => ({
            id: Date.now() + index,
            text,
            priority,
            completed: false,
            timestamp: Date.now(),
            dueDate,
        }));
    }

    /* ---------- dates (all local, stored as YYYY-MM-DD) ---------- */
    function pad2(n) { return String(n).padStart(2, '0'); }
    function isoOf(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
    function isoToday() { return isoOf(new Date()); }
    function isoDaysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return isoOf(d); }
    function parseIso(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    }
    function daysUntil(iso) {
        const d = parseIso(iso);
        if (!d) return null;
        const t = new Date(); t.setHours(0, 0, 0, 0);
        return Math.round((d - t) / 86400000);
    }
    function dueInfo(task) {
        const days = daysUntil(task.dueDate);
        if (days === null) return null;
        const d = parseIso(task.dueDate);
        const sameYear = d.getFullYear() === new Date().getFullYear();
        const short = d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
        const withDay = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
        if (task.completed) return { label: short, cls: '' };
        if (days < 0) return { label: `Overdue · ${short}`, cls: 'due-over' };
        if (days === 0) return { label: 'Today', cls: 'due-today' };
        if (days === 1) return { label: 'Tomorrow', cls: '' };
        if (days < 7) return { label: withDay, cls: '' };
        return { label: short, cls: '' };
    }
    function isDueNow(task) {
        const days = daysUntil(task.dueDate);
        return !task.completed && days !== null && days <= 0;
    }

    function bindEvents() {
        // Theme toggle
        $themeToggle.on('click', toggleTheme);

        // Add task on Enter key or button click
        $newTaskInput.on('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); submitNewTask(); }
        });
        $dueInput.on('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); submitNewTask(); }
        });

        $addTaskBtn.on('click', function () {
            submitNewTask();
            $newTaskInput.focus();
        });

        // Search functionality
        $searchInput.on('input', function () {
            searchQuery = $(this).val().toLowerCase();
            if (searchQuery) {
                $clearSearchBtn.show();
            } else {
                $clearSearchBtn.hide();
            }
            applyFilters();
        });

        $clearSearchBtn.on('click', function () {
            $searchInput.val('');
            searchQuery = '';
            $(this).hide();
            applyFilters();
            $searchInput.focus();
        });

        // Toggle task completion
        $taskList.on('click', '.task-checkbox', function (e) {
            e.stopPropagation();
            const taskId = $(this).closest('.task-item').data('task-id');
            toggleTask(taskId);
        });

        // Delete task
        $taskList.on('click', '.delete-btn', function (e) {
            e.stopPropagation();
            const $taskItem = $(this).closest('.task-item');
            const taskId = $taskItem.data('task-id');
            deleteTask(taskId, $taskItem);
        });

        // Edit a task by double-clicking its text
        $taskList.on('dblclick', '.task-text', function () {
            startEdit($(this).closest('.task-item'));
        });
        $taskList.on('click', '.focus-btn', function (e) {
            e.stopPropagation();
            pomodoro.focusTask($(this).closest('.task-item').data('task-id'));
        });

        $taskList.on('click', '.edit-btn', function (e) {
            e.stopPropagation();
            startEdit($(this).closest('.task-item'));
        });

        // Escape clears the search box
        $searchInput.on('keydown', function (e) {
            if (e.key === 'Escape') { $clearSearchBtn.trigger('click'); }
        });

        // Filter tasks
        $filterBtns.on('click', function () {
            const filter = $(this).data('filter');
            setFilter(filter);
        });

        // Clear completed tasks
        $clearCompletedBtn.on('click', function () {
            clearCompletedTasks();
        });
    }

    function submitNewTask() {
        const text = $newTaskInput.val().trim();
        if (text === '') return;
        addTask(text, $prioritySelect.val(), $dueInput.val() || null);
        $newTaskInput.val('');
        $dueInput.val('');
    }

    function addTask(text, priority = 'medium', dueDate = null) {
        const task = {
            id: Date.now(),
            text: text,
            priority: priority,
            completed: false,
            timestamp: Date.now(),
            dueDate: parseIso(dueDate) ? dueDate : null
        };

        tasks.unshift(task); // Add to beginning of array
        saveTasks();
        updateStats();
        renderList();
        $(`.task-item[data-task-id="${task.id}"]`).addClass('adding');

        showNotification('Task added', 'success');
    }

    /* ---------- list rendering: active tasks first, completed ones grouped underneath ---------- */
    function orderedTasks() {
        const active = tasks.filter(t => !t.completed);
        const done = tasks.filter(t => t.completed).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
        return active.concat(done);
    }

    function itemPositions() {
        const map = new Map();
        $taskList.children('.task-item:visible').each(function () {
            map.set(String($(this).data('task-id')), this.getBoundingClientRect().top);
        });
        return map;
    }

    /** FLIP: after a re-render, rows that moved slide from their old place to the new one. */
    function animateMoves(before) {
        if (!before || reduceMotion) return;
        const moved = [];
        $taskList.children('.task-item:visible').each(function () {
            const prev = before.get(String($(this).data('task-id')));
            if (prev === undefined) return;
            const delta = prev - this.getBoundingClientRect().top;
            if (Math.abs(delta) < 1) return;
            this.style.transition = 'none';
            this.style.transform = `translateY(${delta}px)`;
            moved.push(this);
        });
        if (!moved.length) return;
        void $taskList[0].offsetHeight; // commit the start positions
        moved.forEach((el) => {
            el.style.transition = 'transform 0.35s cubic-bezier(0.19, 1, 0.22, 1)';
            el.style.transform = '';
            el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true });
        });
    }

    function renderList({ animate = false } = {}) {
        const before = animate ? itemPositions() : null;
        $taskList.empty();
        let dividerAdded = false;
        orderedTasks().forEach((task) => {
            if (task.completed && !dividerAdded) {
                $taskList.append('<li class="task-group" role="presentation"><span>Completed</span><b class="count"></b></li>');
                dividerAdded = true;
            }
            $taskList.append(createTaskElement(task));
        });
        applyFilters();
        animateMoves(before);
        if (pomodoro) pomodoro.refresh();
    }

    function createTaskElement(task) {
        const priorityLabels = {
            high: 'High Priority',
            medium: 'Medium Priority',
            low: 'Low Priority'
        };
        const due = dueInfo(task);

        return $(`
            <li class="task-item ${task.completed ? 'completed' : ''}" role="listitem" data-task-id="${task.id}">
                <div class="task-content">
                    <button class="task-checkbox ${task.completed ? 'checked' : ''}" aria-label="${task.completed ? 'Mark as active' : 'Mark as complete'}" aria-pressed="${task.completed ? 'true' : 'false'}">
                        <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                    </button>
                    <div class="task-details">
                        <span class="task-text">${escapeHtml(task.text)}</span>
                        <div class="task-meta">
                            ${task.pomodoros ? `<span class="pomo-badge" title="Focus sessions on this task"><b>${task.pomodoros}</b> focus</span>` : ''}
                            ${due ? `<span class="due-badge ${due.cls}">${escapeHtml(due.label)}</span>` : ''}
                            <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority] || 'Medium Priority'}</span>
                        </div>
                    </div>
                </div>
                <button class="focus-btn" aria-label="Focus on this task">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>
                </button>
                <button class="edit-btn" aria-label="Edit task">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                </button>
                <button class="delete-btn" aria-label="Delete task">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>
            </li>
        `);
    }

    /* ---------- inline editing: text, priority and due date ---------- */
    function startEdit($item) {
        if ($item.hasClass('editing')) return;
        $('.task-item.editing').each(function () { const f = $(this).data('finishEdit'); if (f) f(true); });
        const taskId = $item.data('task-id');
        const task = tasks.find(t => t.id == taskId);
        if (!task) return;
        const $details = $item.find('.task-details');
        const $form = $(`
            <div class="task-edit-form">
                <input type="text" class="task-edit" aria-label="Task text">
                <div class="task-edit-row">
                    <label class="edit-field"><span>Priority</span>
                        <select class="edit-priority" aria-label="Priority">
                            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                        </select></label>
                    <label class="edit-field"><span>Due</span><input type="date" class="edit-due" aria-label="Due date"></label>
                    <button type="button" class="pill pill-sm edit-clear-due"${task.dueDate ? '' : ' hidden'}>No date</button>
                    <button type="button" class="pill pill-sm pill-solid-list edit-save">Save</button>
                    <span class="edit-hint">Enter saves, Esc cancels</span>
                </div>
            </div>
        `);
        $form.find('.task-edit').val(task.text);
        $form.find('.edit-priority').val(task.priority);
        $form.find('.edit-due').val(task.dueDate || '');
        $item.addClass('editing');
        $details.hide().after($form);
        $form.find('.task-edit').focus().select();

        let done = false;
        const finish = (commit) => {
            if (done) return;
            done = true;
            const value = $form.find('.task-edit').val().trim();
            const priority = $form.find('.edit-priority').val();
            const dueDate = $form.find('.edit-due').val() || null;
            let changed = false;
            if (commit && value && value !== task.text) { task.text = value; changed = true; }
            if (commit && priority !== task.priority) { task.priority = priority; changed = true; }
            if (commit && dueDate !== (task.dueDate || null)) { task.dueDate = dueDate; changed = true; }
            if (changed) { saveTasks(); updateStats(); showNotification('Task updated', 'success'); }
            $item.removeData('finishEdit').removeClass('editing');
            renderList();
        };
        $item.data('finishEdit', finish);
        $form.on('keydown', function (e) {
            if (e.key === 'Enter' && !$(e.target).is('select')) { e.preventDefault(); finish(true); }
            if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        $form.find('.edit-save').on('click', () => finish(true));
        $form.find('.edit-clear-due').on('click', function () { $form.find('.edit-due').val(''); $(this).prop('hidden', true); $form.find('.task-edit').focus(); });
        $form.find('.edit-due').on('input change', function () { $form.find('.edit-clear-due').prop('hidden', !$(this).val()); });
        // leaving the form entirely commits it
        $form.on('focusout', function () {
            setTimeout(() => { if (!done && !$form[0].contains(document.activeElement)) finish(true); }, 0);
        });
    }

    function toggleTask(taskId) {
        const task = tasks.find(t => t.id == taskId);
        if (!task) return;
        task.completed = !task.completed;
        task.completedAt = task.completed ? Date.now() : null;
        saveTasks();

        const $taskItem = $(`.task-item[data-task-id="${taskId}"]`);
        $taskItem.toggleClass('completed', task.completed);
        $taskItem.find('.task-checkbox').toggleClass('checked', task.completed);
        updateStats();
        showNotification(task.completed ? 'Task completed' : 'Task marked as active', task.completed ? 'success' : 'info');

        // let the tick land, then move the row into (or out of) the completed group
        setTimeout(() => renderList({ animate: true }), reduceMotion ? 0 : 220);
    }

    /* ---------- removing tasks, with undo ---------- */
    function removeTasks(ids, $elements, message) {
        const idSet = new Set(ids.map(String));
        const removed = tasks.map((t, index) => ({ t, index })).filter(({ t }) => idSet.has(String(t.id)));
        if (!removed.length) return;
        $elements.addClass('removing');
        pomodoro.unlinkIf((id) => idSet.has(String(id)));
        setTimeout(() => {
            const before = itemPositions();
            tasks = tasks.filter(t => !idSet.has(String(t.id)));
            saveTasks();
            updateStats();
            renderList();
            animateMoves(before);
            showNotification(message, 'info', {
                action: 'Undo',
                onAction() {
                    removed.forEach(({ t, index }) => tasks.splice(Math.min(index, tasks.length), 0, t));
                    saveTasks();
                    updateStats();
                    renderList({ animate: true });
                    showNotification(removed.length === 1 ? 'Task restored' : `${removed.length} tasks restored`, 'success');
                },
            });
        }, reduceMotion ? 0 : 300);
    }

    function deleteTask(taskId, $taskElement) {
        removeTasks([taskId], $taskElement, 'Task deleted');
    }

    function clearCompletedTasks() {
        const done = tasks.filter(t => t.completed);
        if (done.length === 0) {
            showNotification('No completed tasks to clear', 'info');
            return;
        }
        removeTasks(done.map(t => t.id), $('.task-item.completed'), `Cleared ${done.length} completed ${done.length === 1 ? 'task' : 'tasks'}`);
    }

    function setFilter(filter) {
        currentFilter = filter;

        // Update active filter button
        $filterBtns.removeClass('active').attr('aria-selected', 'false');
        $(`.filter-btn[data-filter="${filter}"]`).addClass('active').attr('aria-selected', 'true');

        // Apply filters
        applyFilters();
    }

    function matchesFilter(task) {
        switch (currentFilter) {
            case 'active': return !task.completed;
            case 'completed': return task.completed;
            case 'high': return task.priority === 'high';
            case 'due': return isDueNow(task);
            default: return true;
        }
    }

    function applyFilters() {
        let visibleCount = 0;
        let visibleCompleted = 0;

        $('.task-item').each(function () {
            const $item = $(this);
            const taskId = $item.data('task-id');
            const task = tasks.find(t => t.id == taskId);

            if (!task) return;

            let shouldShow = matchesFilter(task);

            // Apply search filter
            if (shouldShow && searchQuery) {
                shouldShow = task.text.toLowerCase().includes(searchQuery);
                if (shouldShow) highlightSearchTerms($item, searchQuery); else removeHighlight($item);
            } else if (shouldShow) {
                removeHighlight($item);
            }

            if (shouldShow) {
                $item.removeClass('hidden').show();
                visibleCount++;
                if (task.completed) visibleCompleted++;
            } else {
                $item.addClass('hidden').hide();
            }
        });

        // the "Completed" divider only makes sense when both groups can show
        const showDivider = currentFilter !== 'completed' && currentFilter !== 'active' && visibleCompleted > 0;
        $('.task-group').toggle(showDivider).find('.count').text(visibleCompleted);

        updateUI(visibleCount);
    }

    function highlightSearchTerms($item, query) {
        const $taskText = $item.find('.task-text');
        const task = tasks.find(t => t.id == $item.data('task-id'));
        const text = task ? task.text : $taskText.text();
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        const highlighted = escapeHtml(text).replace(regex, '<span class="search-highlight">$1</span>');
        $taskText.html(highlighted);
    }

    function removeHighlight($item) {
        const $taskText = $item.find('.task-text');
        const task = tasks.find(t => t.id == $item.data('task-id'));
        if (task && $taskText.find('.search-highlight').length) {
            $taskText.html(escapeHtml(task.text));
        }
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function updateStats() {
        const total = tasks.length;
        const active = tasks.filter(t => !t.completed).length;
        const completed = tasks.filter(t => t.completed).length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        $totalTasks.text(total);
        $activeTasks.text(active);
        $completedTasks.text(completed);
        $progressFill.css('width', `${progress}%`);
        $progressText.text(`${progress}% Complete`);
        $('#big-percent').html(`${progress}<small>%</small>`);
        const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0) + '%';
        $('#bar-total').css('width', total > 0 ? '100%' : '0%');
        $('#bar-active').css('width', pct(active));
        $('#bar-completed').css('width', pct(completed));
        const high = tasks.filter(t => t.priority === 'high').length;
        const due = tasks.filter(isDueNow).length;
        $('[data-count="all"]').text(total);
        $('[data-count="active"]').text(active);
        $('[data-count="completed"]').text(completed);
        $('[data-count="high"]').text(high);
        $('[data-count="due"]').text(due);
        $('#list-count').text(total === 1 ? '1 task' : `${total} tasks`);

        // Update clear completed button state
        $clearCompletedBtn.prop('disabled', completed === 0);
    }

    function updateUI(visibleCount) {
        const hasSearch = searchQuery.length > 0;
        const hasResults = visibleCount > 0;

        if (hasSearch && !hasResults) {
            $noSearchResults.show();
            $emptyState.hide();
            $taskList.hide();
        } else if (!hasResults && !hasSearch) {
            $emptyState.show();
            $noSearchResults.hide();
            $taskList.hide();
            updateEmptyStateMessage();
        } else {
            $emptyState.hide();
            $noSearchResults.hide();
            $taskList.show();
        }
    }

    function updateEmptyStateMessage() {
        const $emptyTitle = $emptyState.find('h3');
        const $emptyText = $emptyState.find('p');

        switch (currentFilter) {
            case 'active':
                $emptyTitle.text('No active tasks');
                $emptyText.text('Everything is done. Add something new above.');
                break;
            case 'completed':
                $emptyTitle.text('Nothing completed yet');
                $emptyText.text('Tick a task and it will show up here.');
                break;
            case 'high':
                $emptyTitle.text('No high priority tasks');
                $emptyText.text('Nothing urgent right now.');
                break;
            case 'due':
                $emptyTitle.text('Nothing due today');
                $emptyText.text('No overdue tasks either. Enjoy the slack.');
                break;
            default:
                $emptyTitle.text('Nothing here yet');
                $emptyText.text('Add a task above to get started.');
        }
    }

    /* ---------- toasts ---------- */
    let toastTimer = null;
    function showNotification(message, type = 'info', { action, onAction } = {}) {
        $('.notification').remove();
        clearTimeout(toastTimer);

        const $notification = $(`<div class="notification notification-${type}" role="status"><span></span></div>`);
        $notification.find('span').text(message);
        const hide = () => {
            $notification.removeClass('show');
            setTimeout(() => $notification.remove(), 300);
        };
        if (action) {
            const $btn = $('<button type="button" class="toast-action"></button>').text(action);
            $btn.on('click', () => { clearTimeout(toastTimer); hide(); if (onAction) onAction(); });
            $notification.append($btn);
        }
        $('body').append($notification);
        requestAnimationFrame(() => requestAnimationFrame(() => $notification.addClass('show')));
        toastTimer = setTimeout(hide, action ? 6000 : 2600);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /* ---------- backup: export and import as JSON ---------- */
    function initBackup() {
        const $file = $('#import-file');
        $('#export-btn').on('click', function () {
            const payload = { app: 'TaskMaster Pro', exportedAt: new Date().toISOString(), tasks };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `taskmaster-${isoToday()}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            showNotification(`Exported ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`, 'success');
        });
        $('#import-btn').on('click', () => $file.trigger('click'));
        $file.on('change', function () {
            const file = this.files && this.files[0];
            this.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => importTasks(reader.result);
            reader.readAsText(file);
        });
    }

    function importTasks(json) {
        try {
            const parsed = JSON.parse(json);
            const incoming = (Array.isArray(parsed) ? parsed : parsed && parsed.tasks) || [];
            const existing = new Set(tasks.map(t => String(t.id)));
            const fresh = incoming.filter(isTask)
                .filter(t => !existing.has(String(t.id))) // already here: skip
                .map((t, i) => ({
                    id: t.id === undefined ? Date.now() + i : t.id,
                    text: String(t.text).trim(),
                    priority: ['low', 'medium', 'high'].includes(t.priority) ? t.priority : 'medium',
                    completed: !!t.completed,
                    completedAt: t.completed ? (t.completedAt || Date.now()) : null,
                    timestamp: t.timestamp || Date.now(),
                    dueDate: parseIso(t.dueDate) ? t.dueDate : null,
                    pomodoros: t.pomodoros || 0,
                }));
            if (!fresh.length) { showNotification('Nothing new to import', 'info'); return; }
            tasks = fresh.concat(tasks);
            saveTasks(); updateStats(); renderList();
            showNotification(`Imported ${fresh.length} ${fresh.length === 1 ? 'task' : 'tasks'}`, 'success');
        } catch (_) {
            showNotification('That file is not a TaskMaster export', 'error');
        }
    }

    /* ---------- keyboard shortcuts ---------- */
    function initShortcuts() {
        $(document).on('keydown', function (e) {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const $t = $(e.target);
            if ($t.is('input, select, textarea, button, [contenteditable]')) return;
            if (e.key === '/') { e.preventDefault(); $searchInput.focus(); }
            else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); $newTaskInput.focus(); }
        });
    }

    /* ---------- focus sound (ambiently) ---------- */
    function initSound() {
        const $select = $('#sound-select');
        const $volume = $('#sound-volume');
        if (!$select.length) return;
        const sound = window.TMSound;
        if (!sound) { $('.pomo-sound').hide(); return; }
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(SOUND_KEY) || '{}') || {}; } catch (_) { /* ignore */ }
        const id = sound.ids.includes(saved.id) ? saved.id : 'off';
        const vol = typeof saved.volume === 'number' ? saved.volume : 0.6;
        $select.val(id);
        $volume.val(vol);
        sound.setVolume(vol);
        sound.select(id, { preview: false });
        const persist = () => { try { localStorage.setItem(SOUND_KEY, JSON.stringify({ id: $select.val(), volume: Number($volume.val()) })); } catch (_) { /* ignore */ } };
        $select.on('change', function () { sound.select($(this).val()); persist(); });
        $volume.on('input', function () { sound.setVolume($(this).val()); persist(); });
        pomodoro.refresh();
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
        const register = () => navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
        if (document.readyState === 'complete') register(); else window.addEventListener('load', register);
    }

    /* ---------- Focus timer (Pomodoro) ---------- */
    function initPomodoro() {
        const KEY = 'taskmaster.pomodoro';
        const DURATION = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
        const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
        const $root = $('#pomodoro');
        const $time = $('#pomo-time');
        const $start = $('#pomo-start');
        const $task = $('#pomo-task');
        const $today = $('#pomo-today');
        const $dots = $('#pomo-dots i');
        const baseTitle = document.title;
        let timer = null;
        let soundRunning = null;

        let state = {
            mode: 'focus', remaining: DURATION.focus, running: false, endAt: null,
            cycle: 0, sessions: 0, day: isoToday(), taskId: null
        };
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved && typeof saved === 'object') state = Object.assign(state, saved);
        } catch (_) { /* ignore */ }
        if (!DURATION[state.mode]) state.mode = 'focus';
        if (state.day !== isoToday()) { state.day = isoToday(); state.sessions = 0; state.cycle = 0; }
        if (state.running && state.endAt) {
            state.remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
            if (state.remaining === 0) { state.running = false; state.endAt = null; complete(true); }
        } else if (state.running) {
            state.running = false;
        }
        state.remaining = Math.min(Math.max(0, state.remaining | 0), DURATION[state.mode]);

        function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ } }
        function fmt(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
        function linkedTask() { return state.taskId ? tasks.find(t => t.id == state.taskId) : null; }

        function render() {
            $time.text(fmt(state.remaining));
            $root.toggleClass('running', state.running).toggleClass('break', state.mode !== 'focus');
            $('.pomo-mode').removeClass('active').attr('aria-selected', 'false').filter(`[data-mode="${state.mode}"]`).addClass('active').attr('aria-selected', 'true');
            $start.text(state.running ? 'Pause' : (state.remaining === DURATION[state.mode] ? 'Start' : 'Resume'));
            $dots.each(function (i) { $(this).toggleClass('done', i < state.cycle); });
            $today.html(state.sessions ? `<b>${state.sessions}</b> ${state.sessions === 1 ? 'session' : 'sessions'} today` : '');
            const t = linkedTask();
            if (t && t.completed && state.mode === 'focus') $task.html(`Done: <b>${escapeHtml(t.text)}</b>. Pick the next task.`);
            else if (t) $task.html(`${state.mode === 'focus' ? 'Focusing on' : 'Next up'} <b>${escapeHtml(t.text)}</b>`);
            else $task.text(state.mode === 'focus' ? 'No task linked. Use the target on a task to focus on it.' : 'Step away from the screen for a bit.');
            $('.task-item').removeClass('focused');
            if (t) $(`.task-item[data-task-id="${t.id}"]`).addClass('focused');
            document.title = state.running ? `${fmt(state.remaining)} · ${LABEL[state.mode]} — ${baseTitle}` : baseTitle;
            const focusRunning = state.running && state.mode === 'focus';
            if (focusRunning !== soundRunning) { soundRunning = focusRunning; if (window.TMSound) window.TMSound.setRunning(focusRunning); }
        }

        function tick() {
            if (!state.running || !state.endAt) return;
            state.remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
            if (state.remaining === 0) { stopTimer(); complete(false); return; }
            render();
        }
        function startTimer() {
            if (state.remaining <= 0) state.remaining = DURATION[state.mode];
            state.running = true;
            state.endAt = Date.now() + state.remaining * 1000;
            clearInterval(timer); timer = setInterval(tick, 250);
            save(); render();
            askForNotifications();
        }
        function stopTimer() { state.running = false; state.endAt = null; clearInterval(timer); timer = null; save(); render(); }
        function setMode(mode, keepTask = true) {
            clearInterval(timer); timer = null;
            state.mode = mode; state.remaining = DURATION[mode]; state.running = false; state.endAt = null;
            if (!keepTask) state.taskId = null;
            save(); render();
        }
        function complete(silent) {
            if (state.mode === 'focus') {
                state.sessions += 1;
                state.cycle = (state.cycle + 1) % 4;
                const t = linkedTask();
                if (t) {
                    t.pomodoros = (t.pomodoros || 0) + 1;
                    saveTasks();
                    if (!silent) renderList();
                }
                const next = state.cycle === 0 ? 'long' : 'short';
                if (!silent) {
                    chime();
                    showNotification(`Focus session done. Time for a ${LABEL[next].toLowerCase()}.`, 'success');
                    notify('Focus session done', t ? `${t.text} · ${LABEL[next]} next` : `${LABEL[next]} next`);
                }
                setMode(next);
            } else {
                if (!silent) { chime(); showNotification('Break over. Ready to focus?', 'info'); notify('Break over', 'Ready to focus?'); }
                setMode('focus');
            }
        }
        function chime() {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                [0, 0.18].forEach((delay, i) => {
                    const o = ctx.createOscillator(), g = ctx.createGain();
                    o.type = 'sine'; o.frequency.value = i ? 880 : 660;
                    g.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
                    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
                    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.5);
                    o.connect(g).connect(ctx.destination);
                    o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.55);
                });
                setTimeout(() => ctx.close(), 1200);
            } catch (_) { /* no audio */ }
        }
        // System notifications so the end of a session is noticed from another tab
        function askForNotifications() {
            if (!('Notification' in window) || Notification.permission !== 'default') return;
            try { Notification.requestPermission(); } catch (_) { /* ignore */ }
        }
        function notify(title, body) {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            if (document.visibilityState === 'visible' && document.hasFocus()) return;
            try { new Notification(title, { body, icon: 'assets/icons/icon-192.png', tag: 'taskmaster-timer' }); } catch (_) { /* ignore */ }
        }

        $start.on('click', () => (state.running ? stopTimer() : startTimer()));
        $('#pomo-reset').on('click', () => setMode(state.mode));
        // after a mouse click, drop focus so Space toggles the timer instead of re-clicking the button
        $root.on('click', 'button', function (e) { if (e.originalEvent && e.originalEvent.detail > 0) this.blur(); });
        $('.pomo-mode').on('click', function () {
            const mode = $(this).data('mode');
            if (mode === state.mode) return; // clicking the current tab must not reset a running session
            setMode(mode);
        });
        $(document).on('keydown', (e) => {
            if (e.key === ' ' && !$(e.target).is('input, select, textarea, button, a, [contenteditable]') && !$root.is(':hidden')) { e.preventDefault(); $start.trigger('click'); }
        });
        document.addEventListener('visibilitychange', () => { if (!document.hidden && state.running) tick(); });

        if (state.running) { timer = setInterval(tick, 250); }
        render();

        return {
            focusTask(taskId) {
                const t = tasks.find(x => x.id == taskId);
                if (!t) return;
                if (state.taskId == taskId && state.mode === 'focus') {
                    state.taskId = null; save(); render();
                    showNotification('Task unlinked from the timer', 'info');
                    return;
                }
                state.taskId = t.id;
                if (state.mode !== 'focus') setMode('focus');
                if (!state.running) startTimer(); else { save(); render(); }
                showNotification(`Focusing on “${t.text.length > 40 ? t.text.slice(0, 40) + '…' : t.text}”`, 'info');
            },
            unlinkIf(predicate) {
                if (state.taskId != null && predicate(state.taskId)) { state.taskId = null; save(); render(); }
            },
            refresh: render,
        };
    }

    // Auto-focus input on page load
    setTimeout(() => {
        $newTaskInput.focus();
    }, 500);
});
