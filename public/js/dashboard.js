// TaskFlow Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar
  utils.renderSidebar('dashboard');

  const user = api.getUser();
  if (user) {
    document.getElementById('welcome-title').textContent = `Welcome, ${user.name}!`;
  }

  // DOM Elements
  const dashboardContent = document.getElementById('dashboard-content');
  const taskDialog = document.getElementById('task-dialog');
  const taskForm = document.getElementById('task-form');
  const dialogTitle = document.getElementById('dialog-title');
  const taskDialogClose = document.getElementById('task-dialog-close');
  const taskDialogCancel = document.getElementById('task-dialog-cancel');
  const addTaskBtn = document.getElementById('add-task-btn');

  // Subtask UI Elements
  const subtasksContainer = document.getElementById('dialog-subtasks-container');
  const subtaskList = document.getElementById('dialog-subtask-list');
  const newSubtaskInput = document.getElementById('new-subtask-title');
  const addSubtaskBtn = document.getElementById('add-subtask-btn');
  let activeTaskIdForSubtasks = null;

  // Icon dictionaries for premium rendering
  const catIcons = {
    College: '🎓',
    Work: '💼',
    Personal: '🏠',
    Project: '🚀',
    Learning: '📚',
    Other: '🏷️'
  };

  const prioIcons = {
    Low: '🔹',
    Medium: '🔸',
    High: '⚡',
    Urgent: '🚩'
  };

  // Start Real-Time Clock
  function startClock() {
    const clockEl = document.getElementById('live-datetime');
    if (!clockEl) return;

    const update = () => {
      const now = new Date();
      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      clockEl.textContent = `${day}, ${dateStr} — ${timeStr}`;
    };
    update();
    setInterval(update, 1000);
  }

  // Load Dashboard Data
  async function loadDashboard() {
    try {
      utils.showLoading(dashboardContent);
      const res = await api.get('/dashboard');
      
      if (res.success) {
        updateStats(res.data.statistics);
        renderLists(res.data.lists);
      }
    } catch (err) {
      utils.showError('Could not load workspace statistics.');
    } finally {
      utils.hideLoading(dashboardContent);
    }
  }

  // Populate Statistics Cards
  function updateStats(stats) {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-in-progress').textContent = stats.inProgress;
    document.getElementById('stat-completed').textContent = stats.completed;
    document.getElementById('stat-overdue').textContent = stats.overdue;

    // Update Radial Progress Circle conic-gradient
    const percent = stats.completionPercentage || 0;
    const circle = document.getElementById('stat-completion-circle');
    const valText = document.getElementById('stat-completion-val');

    if (valText) valText.textContent = `${percent}%`;
    if (circle) {
      circle.style.background = `conic-gradient(
        var(--color-completed) 0% ${percent}%,
        var(--border-color) ${percent}% 100%
      )`;
    }

    // Productivity metrics
    document.getElementById('prod-rate').textContent = `${percent}%`;
    document.getElementById('prod-week').textContent = stats.completedThisWeek;
    document.getElementById('prod-month').textContent = stats.completedThisMonth;
  }

  // Populate and render lists
  function renderLists(lists) {
    // 1. Today's Tasks
    const todayList = document.getElementById('today-tasks-list');
    document.getElementById('today-tasks-count').textContent = `${lists.today.length} tasks`;
    renderTaskList(todayList, lists.today, 'No tasks due today. Enjoy your day!');

    // 2. Overdue Tasks
    const overdueList = document.getElementById('overdue-tasks-list');
    renderTaskList(overdueList, lists.overdue, 'No overdue tasks. Excellent job!');

    // 3. Upcoming Deadlines
    const upcomingList = document.getElementById('upcoming-tasks-list');
    renderTaskList(upcomingList, lists.upcoming, 'No upcoming deadlines.');

    // 4. Recently Created
    const recentList = document.getElementById('recent-tasks-list');
    renderTaskList(recentList, lists.recentlyCreated, 'No tasks created yet.');
  }

  // Generic Task Rendering
  function renderTaskList(container, tasks, emptyMessage) {
    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.9rem;">
          ${emptyMessage}
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'Completed';
      const isCancelled = task.status === 'Cancelled';
      const dueLabel = utils.getDueDateLabel(task.due_date, task.status);
      const dueClass = dueLabel.class ? 'class="' + dueLabel.class + '"' : '';

      // Format tag pills
      const tagsHTML = task.tags && task.tags.length > 0
        ? `<div class="task-tags-container">` + task.tags.map(t => `<span class="task-tag">${escapeHTML(t)}</span>`).join('') + `</div>`
        : '';

      return `
        <div class="task-row-item ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-checkbox-container">
            <input type="checkbox" class="task-checkbox toggle-complete-btn" ${isCompleted ? 'checked' : ''} ${isCancelled ? 'disabled' : ''}>
          </div>
          <div class="task-content-block">
            <span class="task-row-title edit-task-trigger" style="cursor: pointer;" title="Edit Task">${escapeHTML(task.title)}</span>
            <span class="task-row-desc">${escapeHTML(task.description || 'No description')}</span>
            ${tagsHTML}
          </div>
          <div class="task-meta-block">
            <span class="badge badge-${task.category.toLowerCase()}">${catIcons[task.category] || '🏷️'} ${task.category}</span>
            <span class="badge badge-${task.priority.toLowerCase()}">${prioIcons[task.priority] || '🔸'} ${task.priority}</span>
            <span class="task-date"><span ${dueClass}>${dueLabel.text}</span></span>
          </div>
          <div class="task-actions">
            <button class="btn btn-text edit-task-trigger" title="Edit">✏️</button>
            <button class="btn btn-text delete-task-btn" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach Handlers
    // A. Toggle Completion checkbox
    container.querySelectorAll('.toggle-complete-btn').forEach(box => {
      box.addEventListener('change', async (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        try {
          utils.showLoading(dashboardContent);
          const res = await api.patch(`/tasks/${id}/complete`);
          if (res.success) {
            utils.showSuccess(res.message);
            loadDashboard();
          }
        } catch (err) {
          utils.showError('Could not update task status.');
          e.target.checked = !e.target.checked; // Revert checkbox UI
        } finally {
          utils.hideLoading(dashboardContent);
        }
      });
    });

    // B. Edit Trigger (click title or pen icon)
    container.querySelectorAll('.edit-task-trigger').forEach(trigger => {
      trigger.addEventListener('click', async (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        openEditDialog(id);
      });
    });

    // C. Delete Action
    container.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        if (confirm('Are you sure you want to permanently delete this task?')) {
          try {
            utils.showLoading(dashboardContent);
            const res = await api.delete(`/tasks/${id}`);
            if (res.success) {
              utils.showSuccess(res.message);
              loadDashboard();
            }
          } catch (err) {
            utils.showError('Could not delete the task.');
          } finally {
            utils.hideLoading(dashboardContent);
          }
        }
      });
    });
  }

  // Render Subtasks list inside Dialog modal
  function renderDialogSubtasks(subtasks, taskId) {
    activeTaskIdForSubtasks = taskId;
    subtasksContainer.style.display = 'block'; // Show editor
    newSubtaskInput.value = '';

    if (!subtasks || subtasks.length === 0) {
      subtaskList.innerHTML = `
        <li style="text-align: center; padding: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
          No checklist items yet.
        </li>
      `;
      return;
    }

    subtaskList.innerHTML = subtasks.map(item => {
      const isChecked = item.is_completed === 1;
      return `
        <li class="subtask-item ${isChecked ? 'completed' : ''}" data-subtask-id="${item.id}">
          <div class="subtask-item-left">
            <input type="checkbox" class="subtask-checkbox" ${isChecked ? 'checked' : ''}>
            <span class="subtask-item-title">${escapeHTML(item.title)}</span>
          </div>
          <button type="button" class="subtask-delete-btn" title="Delete item">&times;</button>
        </li>
      `;
    }).join('');

    // Attach subtask checkbox handlers
    subtaskList.querySelectorAll('.subtask-checkbox').forEach(box => {
      box.addEventListener('change', async (e) => {
        const item = e.target.closest('.subtask-item');
        const subtaskId = item.dataset.subtaskId;
        const checked = e.target.checked;
        try {
          await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, {
            is_completed: checked
          });
          item.classList.toggle('completed', checked);
        } catch (err) {
          utils.showError('Could not update checklist item.');
          e.target.checked = !checked;
        }
      });
    });

    // Attach subtask delete handlers
    subtaskList.querySelectorAll('.subtask-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const item = e.target.closest('.subtask-item');
        const subtaskId = item.dataset.subtaskId;
        try {
          const res = await api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
          if (res.success) {
            item.remove();
            if (subtaskList.children.length === 0) {
              subtaskList.innerHTML = `
                <li style="text-align: center; padding: 0.5rem; color: var(--text-muted); font-size: 0.85rem;">
                  No checklist items yet.
                </li>
              `;
            }
          }
        } catch (err) {
          utils.showError('Could not delete checklist item.');
        }
      });
    });
  }

  // Handle Add Subtask click
  if (addSubtaskBtn) {
    addSubtaskBtn.addEventListener('click', async () => {
      const title = newSubtaskInput.value.trim();
      if (!title || !activeTaskIdForSubtasks) return;

      try {
        utils.showLoading(subtaskList);
        const res = await api.post(`/tasks/${activeTaskIdForSubtasks}/subtasks`, { title });
        
        if (res.success) {
          newSubtaskInput.value = '';
          // Refresh task subtasks list
          const taskDetails = await api.get(`/tasks/${activeTaskIdForSubtasks}`);
          if (taskDetails.success) {
            renderDialogSubtasks(taskDetails.data.subtasks, activeTaskIdForSubtasks);
          }
        }
      } catch (err) {
        utils.showError('Could not add checklist item.');
      } finally {
        utils.hideLoading(subtaskList);
      }
    });
  }

  // Dialog Handling
  function openCreateDialog() {
    dialogTitle.textContent = 'Create Task';
    taskForm.reset();
    document.getElementById('task-id').value = '';
    
    // Hide subtasks container on create mode
    subtasksContainer.style.display = 'none';
    activeTaskIdForSubtasks = null;

    // Default values
    document.getElementById('task-category').value = 'Other';
    document.getElementById('task-priority').value = 'Medium';
    document.getElementById('task-status').value = 'Pending';
    document.getElementById('task-due-date').value = '';
    document.getElementById('task-tags').value = '';
    
    taskDialog.classList.add('open');
  }

  async function openEditDialog(id) {
    try {
      utils.showLoading(dashboardContent);
      const res = await api.get(`/tasks/${id}`);
      
      if (res.success) {
        const task = res.data;
        dialogTitle.textContent = 'Edit Task';
        
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-category').value = task.category;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-status').value = task.status;
        document.getElementById('task-due-date').value = task.due_date || '';
        document.getElementById('task-tags').value = task.tags ? task.tags.join(', ') : '';
        
        // Render subtasks list
        renderDialogSubtasks(task.subtasks, task.id);

        taskDialog.classList.add('open');
      }
    } catch (err) {
      utils.showError('Failed to retrieve task details.');
    } finally {
      utils.hideLoading(dashboardContent);
    }
  }

  function closeDialog() {
    taskDialog.classList.remove('open');
  }

  // Event Listeners for dialog
  addTaskBtn.addEventListener('click', openCreateDialog);
  taskDialogClose.addEventListener('click', closeDialog);
  taskDialogCancel.addEventListener('click', closeDialog);

  // Close dialog on clicking overlay background
  taskDialog.addEventListener('click', (e) => {
    if (e.target === taskDialog) closeDialog();
  });

  // Handle Form Submission (Create or Edit)
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('task-id').value;
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const category = document.getElementById('task-category').value;
    const priority = document.getElementById('task-priority').value;
    const status = document.getElementById('task-status').value;
    const due_date = document.getElementById('task-due-date').value;
    const tags = document.getElementById('task-tags').value.trim();

    const payload = { title, description, category, priority, status, due_date, tags };

    try {
      utils.showLoading(taskDialog.querySelector('.dialog-container'));
      
      let res;
      if (id) {
        // Edit Mode
        res = await api.put(`/tasks/${id}`, payload);
      } else {
        // Create Mode
        res = await api.post('/tasks', payload);
      }

      if (res.success) {
        utils.showSuccess(res.message);
        closeDialog();
        loadDashboard();
      }
    } catch (err) {
      utils.showError(err.message || 'Failed to save the task.');
    } finally {
      utils.hideLoading(taskDialog.querySelector('.dialog-container'));
    }
  });

  // Helper function to escape HTML to prevent XSS
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  startClock();
  loadDashboard();
});
