$(document).ready(function () {
    // App state
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

    function init() {
        loadTheme();
        loadSampleTasks();
        bindEvents();
        updateStats();
        updateUI();
    }

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        showNotification(`Switched to ${newTheme} mode`, 'info');

    }

    function loadSampleTasks() {
        // Convert existing sample tasks to task objects and add proper data attributes
        $('.task-item').each(function (index) {
            const $item = $(this);
            const taskText = $item.find('.task-text').text();
            const priorityClass = $item.find('.priority-badge').attr('class');
            let priority = 'medium';

            if (priorityClass && priorityClass.includes('priority-high')) priority = 'high';
            else if (priorityClass && priorityClass.includes('priority-low')) priority = 'low';


            const taskId = Date.now() + index;
            const task = {
                id: taskId,
                text: taskText,
                priority: priority,
                completed: false,
                timestamp: Date.now(),
                dueDate: null
            };

            tasks.push(task);
            $item.attr('data-task-id', taskId);
        });
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
                            <span class="priority-badge priority-${task.priority}">${priorityLabels[task.priority]}</span>
                        </div>
                    </div>
                </div>
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

    function toggleTask(taskId) {
        const task = tasks.find(t => t.id == taskId);
        if (task) {
            task.completed = !task.completed;

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
        // Add removing animation
        $taskElement.addClass('removing');

        // Remove from tasks array after animation
        setTimeout(() => {
            tasks = tasks.filter(t => t.id != taskId);
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

    // Add notification styles dynamically
    const notificationCSS = `
        <style>
            .notification {
                position: fixed;
                top: 20px;
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
            
            .notification-success {
                background: var(--success-color, #48bb78);
            }
            
            .notification-info {
                background: var(--primary-color, #667eea);
            }
            
            .notification-warning {
                background: var(--warning-color, #ed8936);
            }
            
            .notification-error {
                background: var(--danger-color, #f56565);
            }
            
            @media (max-width: 640px) {
                .notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    transform: translateY(-100%);
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

    // Welcome message for new features
    setTimeout(() => {
        showNotification('Welcome to TaskMaster Pro! Try the new dark mode toggle! 🌙', 'info');
    }, 1000);
});