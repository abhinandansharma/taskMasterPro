$(document).ready(function () {
    // App state
    const STORAGE_KEY = 'taskmaster.tasks';
    let tasks = [];
    let currentFilter = 'all';
    let searchQuery = '';

    // Cache DOM elements
    const $taskList = $('#task-list');
    const $newTaskInput = $('#new-task-input');
    const $addTaskBtn = $('#add-task-btn');
    const $prioritySelect = $('#priority-select');
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
    init();
    const pomodoro = initPomodoro();

    function init() {
        loadTheme();
        $('#today-label').text(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }));
        const saved = loadSavedTasks();
        if (saved) {
            tasks = saved;
            $taskList.empty();
            tasks.forEach((task) => $taskList.append(createTaskElement(task)));
        } else {
            loadSampleTasks();
            $taskList.empty();
            tasks.forEach((task) => $taskList.append(createTaskElement(task)));
            saveTasks();
        }
        bindEvents();
        updateStats();
        applyFilters();
    }

    function loadSavedTasks() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            return null;
        }
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
            ['Write the release notes', 'high'],
            ['Review the open pull requests', 'medium'],
            ['Book the dentist', 'low'],
        ];
        tasks = samples.map(([text, priority], index) => ({
            id: Date.now() + index,
            text,
            priority,
            completed: false,
            timestamp: Date.now(),
            dueDate: null,
        }));
    }

    function bindEvents() {
        // Theme toggle
        $themeToggle.on('click', toggleTheme);

        // Add task on Enter key or button click
        $newTaskInput.on('keypress', function (e) {
            if (e.which === 13 && $(this).val().trim() !== '') {
                addTask($(this).val().trim(), $prioritySelect.val());
                $(this).val('');
            }
        });

        $addTaskBtn.on('click', function () {
            const taskText = $newTaskInput.val().trim();
            if (taskText !== '') {
                addTask(taskText, $prioritySelect.val());
                $newTaskInput.val('');
            }
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

        // Focus input when clicking add button
        $addTaskBtn.on('click', function () {
            $newTaskInput.focus();
        });
    }

    function addTask(text, priority = 'medium') {
        const task = {
            id: Date.now(),
            text: text,
            priority: priority,
            completed: false,
            timestamp: Date.now(),
            dueDate: null
        };

        tasks.unshift(task); // Add to beginning of array
        saveTasks();

        const $taskElement = createTaskElement(task);
        $taskElement.addClass('adding');

        if ($taskList.children().length === 0) {
            $taskList.append($taskElement);
        } else {
            $taskList.prepend($taskElement);
        }

        updateStats();
        applyFilters();

        // Show success feedback
        showNotification('Task added successfully!', 'success');
    }

    function createTaskElement(task) {
        const priorityLabels = {
            high: 'High Priority',
            medium: 'Medium Priority',
            low: 'Low Priority'
        };

        return $(`
            <li class="task-item ${task.completed ? 'completed' : ''}" role="listitem" data-task-id="${task.id}">
                <div class="task-content">
                    <button class="task-checkbox ${task.completed ? 'checked' : ''}" aria-label="Mark as complete">
                        <svg class="check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20,6 9,17 4,12"></polyline>
                        </svg>
                    </button>
                    <div class="task-details">
                        <span class="task-text">${escapeHtml(task.text)}</span>
                        <div class="task-meta">
                            ${task.pomodoros ? `<span class="pomo-badge" title="Focus sessions on this task"><b>${task.pomodoros}</b> focus</span>` : ''}
                            <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
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

    function startEdit($item) {
        if ($item.hasClass('editing')) return;
        const taskId = $item.data('task-id');
        const task = tasks.find(t => t.id == taskId);
        if (!task) return;
        const $text = $item.find('.task-text');
        const $input = $('<input type="text" class="task-edit" aria-label="Edit task">').val(task.text);
        $item.addClass('editing');
        $text.replaceWith($input);
        $input.focus().select();

        const finish = (commit) => {
            const value = $input.val().trim();
            if (commit && value && value !== task.text) {
                task.text = value;
                saveTasks();
                showNotification('Task updated', 'success');
            }
            const $newText = $('<span class="task-text"></span>').text(task.text);
            $input.replaceWith($newText);
            $item.removeClass('editing');
            applyFilters();
        };
        $input.on('keydown', function (e) {
            if (e.key === 'Enter') finish(true);
            if (e.key === 'Escape') finish(false);
        });
        $input.on('blur', () => finish(true));
    }

    function toggleTask(taskId) {
        const task = tasks.find(t => t.id == taskId);
        if (task) {
            task.completed = !task.completed;
            saveTasks();

            const $taskItem = $(`.task-item[data-task-id="${taskId}"]`);
            const $checkbox = $taskItem.find('.task-checkbox');

            if (task.completed) {
                $taskItem.addClass('completed');
                $checkbox.addClass('checked');
                showNotification('Task completed! 🎉', 'success');
            } else {
                $taskItem.removeClass('completed');
                $checkbox.removeClass('checked');
                showNotification('Task marked as active', 'info');
            }

            updateStats();
            applyFilters();
        }
    }

    function deleteTask(taskId, $taskElement) {
        try { const k = 'taskmaster.pomodoro'; const st = JSON.parse(localStorage.getItem(k) || 'null'); if (st && st.taskId == taskId) { st.taskId = null; localStorage.setItem(k, JSON.stringify(st)); if (typeof pomodoro !== 'undefined') pomodoro.refresh(); } } catch (_) { /* ignore */ }
        // Add removing animation
        $taskElement.addClass('removing');

        // Remove from tasks array after animation
        setTimeout(() => {
            tasks = tasks.filter(t => t.id != taskId);
            saveTasks();
            $taskElement.remove();
            updateStats();
            applyFilters();
            showNotification('Task deleted', 'info');
        }, 300);
    }

    function setFilter(filter) {
        currentFilter = filter;

        // Update active filter button
        $filterBtns.removeClass('active');
        $(`.filter-btn[data-filter="${filter}"]`).addClass('active');

        // Apply filters
        applyFilters();
    }

    function applyFilters() {
        let visibleCount = 0;
        let searchResults = 0;

        $('.task-item').each(function () {
            const $item = $(this);
            const taskId = $item.data('task-id');
            const task = tasks.find(t => t.id == taskId);

            if (!task) return;

            let shouldShow = false;

            // Apply priority/status filter
            switch (currentFilter) {
                case 'all':
                    shouldShow = true;
                    break;
                case 'active':
                    shouldShow = !task.completed;
                    break;
                case 'completed':
                    shouldShow = task.completed;
                    break;
                case 'high':
                    shouldShow = task.priority === 'high';
                    break;
            }

            // Apply search filter
            if (shouldShow && searchQuery) {
                const taskText = task.text.toLowerCase();
                shouldShow = taskText.includes(searchQuery);

                if (shouldShow) {
                    searchResults++;
                    // Highlight search terms
                    highlightSearchTerms($item, searchQuery);
                } else {
                    removeHighlight($item);
                }
            } else if (shouldShow) {
                removeHighlight($item);
                searchResults++;
            }

            if (shouldShow) {
                $item.removeClass('hidden').show();
                visibleCount++;
            } else {
                $item.addClass('hidden').hide();
            }
        });

        updateUI(visibleCount, searchResults);
    }

    function highlightSearchTerms($item, query) {
        const $taskText = $item.find('.task-text');
        const text = $taskText.text();
        const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
        const highlighted = text.replace(regex, '<span class="search-highlight">$1</span>');
        $taskText.html(highlighted);
    }

    function removeHighlight($item) {
        const $taskText = $item.find('.task-text');
        const task = tasks.find(t => t.id == $item.data('task-id'));
        if (task) {
            $taskText.html(escapeHtml(task.text));
        }
    }

    function escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function clearCompletedTasks() {
        const completedTasks = $('.task-item.completed');

        if (completedTasks.length === 0) {
            showNotification('No completed tasks to clear', 'info');
            return;
        }

        // Add removing animation to all completed tasks
        completedTasks.addClass('removing');

        // Remove completed tasks after animation
        setTimeout(() => {
            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            completedTasks.remove();
            updateStats();
            applyFilters();
            showNotification(`Cleared ${completedTasks.length} completed task(s)`, 'success');
        }, 300);
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
        $('[data-count="all"]').text(total);
        $('[data-count="active"]').text(active);
        $('[data-count="completed"]').text(completed);
        $('[data-count="high"]').text(high);
        $('#list-count').text(total === 1 ? '1 task' : `${total} tasks`);

        // Update clear completed button state
        $clearCompletedBtn.prop('disabled', completed === 0);
    }

    function updateUI(visibleCount, searchResults) {
        const hasSearch = searchQuery.length > 0;
        const hasResults = visibleCount > 0;

        if (hasSearch && !hasResults) {
            // Show no search results
            $noSearchResults.fadeIn(300);
            $emptyState.hide();
            $taskList.hide();
        } else if (!hasResults && !hasSearch) {
            // Show empty state
            $emptyState.fadeIn(300);
            $noSearchResults.hide();
            $taskList.hide();

            // Update empty state message based on filter
            updateEmptyStateMessage();
        } else {
            // Show task list
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
                $emptyTitle.text('No active tasks!');
                $emptyText.text('All your tasks are completed. Great job!');
                break;
            case 'completed':
                $emptyTitle.text('No completed tasks!');
                $emptyText.text('Complete some tasks to see them here.');
                break;
            case 'high':
                $emptyTitle.text('No high priority tasks!');
                $emptyText.text('You have no urgent tasks at the moment.');
                break;
            default:
                $emptyTitle.text('All caught up!');
                $emptyText.text('You have no tasks remaining. Great job!');
        }
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications
        $('.notification').remove();

        const $notification = $(`
            <div class="notification notification-${type}">
                ${escapeHtml(message)}
            </div>
        `);

        $('body').append($notification);

        // Show notification with animation
        setTimeout(() => {
            $notification.addClass('show');
        }, 100);

        // Hide notification after 3 seconds
        setTimeout(() => {
            $notification.removeClass('show');
            setTimeout(() => {
                $notification.remove();
            }, 300);
        }, 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /* ---------- Focus timer (Pomodoro) ---------- */
    function initPomodoro() {
        const KEY = 'taskmaster.pomodoro';
        const DURATION = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
        const LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
        const today = () => new Date().toISOString().slice(0, 10);
        const $root = $('#pomodoro');
        const $time = $('#pomo-time');
        const $start = $('#pomo-start');
        const $task = $('#pomo-task');
        const $today = $('#pomo-today');
        const $dots = $('#pomo-dots i');
        const baseTitle = document.title;
        let timer = null;

        let state = {
            mode: 'focus', remaining: DURATION.focus, running: false, endAt: null,
            cycle: 0, sessions: 0, day: today(), taskId: null
        };
        try {
            const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
            if (saved && typeof saved === 'object') state = Object.assign(state, saved);
        } catch (_) { /* ignore */ }
        if (state.day !== today()) { state.day = today(); state.sessions = 0; state.cycle = 0; }
        if (state.running && state.endAt) {
            state.remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
            if (state.remaining === 0) { state.running = false; state.endAt = null; complete(true); }
        }

        function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* ignore */ } }
        function fmt(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
        function linkedTask() { return state.taskId ? tasks.find(t => t.id == state.taskId) : null; }

        function render() {
            $time.text(fmt(state.remaining));
            $root.toggleClass('running', state.running).toggleClass('break', state.mode !== 'focus');
            $('.pomo-mode').removeClass('active').filter(`[data-mode="${state.mode}"]`).addClass('active');
            $start.text(state.running ? 'Pause' : (state.remaining === DURATION[state.mode] ? 'Start' : 'Resume'));
            $dots.each(function (i) { $(this).toggleClass('done', i < state.cycle); });
            $today.html(state.sessions ? `<b>${state.sessions}</b> ${state.sessions === 1 ? 'session' : 'sessions'} today` : '');
            const t = linkedTask();
            if (t) $task.html(`${state.mode === 'focus' ? 'Focusing on' : 'Next up'} <b>${escapeHtml(t.text)}</b>`);
            else $task.text(state.mode === 'focus' ? 'No task linked. Use the target on a task to focus on it.' : 'Step away from the screen for a bit.');
            $('.task-item').removeClass('focused');
            if (t) $(`.task-item[data-task-id="${t.id}"]`).addClass('focused');
            document.title = state.running ? `${fmt(state.remaining)} · ${LABEL[state.mode]} — ${baseTitle}` : baseTitle;
        }

        function tick() {
            state.remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
            if (state.remaining === 0) { stopTimer(); complete(false); return; }
            render();
        }
        function startTimer() {
            state.running = true;
            state.endAt = Date.now() + state.remaining * 1000;
            clearInterval(timer); timer = setInterval(tick, 250);
            save(); render();
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
                    $(`.task-item[data-task-id="${t.id}"]`).replaceWith(createTaskElement(t));
                    applyFilters();
                }
                const next = state.cycle === 0 ? 'long' : 'short';
                if (!silent) { chime(); showNotification(`Focus session done. Time for a ${LABEL[next].toLowerCase()}.`, 'success'); }
                setMode(next);
            } else {
                if (!silent) { chime(); showNotification('Break over. Ready to focus?', 'info'); }
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

        $start.on('click', () => (state.running ? stopTimer() : startTimer()));
        $('#pomo-reset').on('click', () => setMode(state.mode));
        $('.pomo-mode').on('click', function () { setMode($(this).data('mode')); });
        $(document).on('keydown', (e) => {
            if (e.key === ' ' && !$(e.target).is('input, select, textarea, button') && !$root.is(':hidden')) { e.preventDefault(); $start.trigger('click'); }
        });
        document.addEventListener('visibilitychange', () => { if (!document.hidden && state.running) tick(); });

        if (state.running) { timer = setInterval(tick, 250); }
        render();

        return {
            focusTask(taskId) {
                const t = tasks.find(x => x.id == taskId);
                if (!t) return;
                if (state.taskId == taskId && state.mode === 'focus') { state.taskId = null; save(); render(); return; }
                state.taskId = t.id;
                if (state.mode !== 'focus') setMode('focus');
                if (!state.running) startTimer(); else { save(); render(); }
                showNotification(`Focusing on “${t.text.length > 40 ? t.text.slice(0, 40) + '…' : t.text}”`, 'info');
            },
            refresh: render,
        };
    }

    // Add notification styles dynamically
    const notificationCSS = `
        <style>
            .notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                font-size: 14px;
                z-index: 1000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification { background: var(--paper); color: var(--ink); border-radius: 999px; font-size: 13px; padding: 10px 16px; }
            [data-theme="dark"] .notification { background: var(--ink); color: var(--paper); }
            .notification-success { background: var(--lime); color: var(--ink); }
            .notification-error { background: var(--sand); color: var(--ink); }
            
            @media (max-width: 640px) {
                .notification {
                    top: 10px;
                    bottom: auto;
                    right: 10px;
                    left: auto;
                    transform: translateY(-120%);
                }
                
                .notification.show {
                    transform: translateY(0);
                }
            }
        </style>
    `;

    $('head').append(notificationCSS);

    // Auto-focus input on page load
    setTimeout(() => {
        $newTaskInput.focus();
    }, 500);


});