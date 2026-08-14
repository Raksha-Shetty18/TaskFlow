// TaskFlow Tasks List & CRUD Manager

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar
  utils.renderSidebar('tasks');

  // DOM Elements
  const tasksContent = document.getElementById('tasks-content');
  const tasksListContainer = document.getElementById('tasks-list');
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

  // Filter elements
  const searchInput = document.getElementById('search-input');
  const filterStatus = document.getElementById('filter-status');
  const filterPriority = document.getElementById('filter-priority');
  const filterCategory = document.getElementById('filter-category');
  const filterDueDate = document.getElementById('filter-due-date');
  const sortSelect = document.getElementById('sort-select');

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

  // Search Debouncer
  let searchDebounceTimer;

  // 1. Fetch & Render Tasks
  async function loadTasks() {
    try {
      utils.showLoading(tasksContent);

      const searchVal = searchInput.value.trim();
      const statusVal = filterStatus.value;
      const priorityVal = filterPriority.value;
      const categoryVal = filterCategory.value;
      const dueDateVal = filterDueDate.value;
      const sortVal = sortSelect.value;

      // Construct URL parameters
      const params = new URLSearchParams();
      if (searchVal !== '') params.append('search', searchVal);
      if (statusVal !== 'All') params.append('status', statusVal);
      if (priorityVal !== 'All') params.append('priority', priorityVal);
      if (categoryVal !== 'All') params.append('category', categoryVal);
      if (dueDateVal !== 'All') params.append('dueDate', dueDateVal);
      params.append('sort', sortVal);

      const res = await api.get(`/tasks?${params.toString()}`);

      if (res.success) {
        renderTasks(res.data);
      }
    } catch (err) {
      utils.showError('Could not fetch task list.');
    } finally {
      utils.hideLoading(tasksContent);
    }
  }

  // 2. Render tasks array to DOM
  function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      tasksListContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <h4>No tasks found</h4>
          <p>Create a task to kickstart your day or try adjusting your filter options.</p>
          <button class="btn btn-primary" id="empty-state-add-btn">+ Add Task</button>
        </div>
      `;

      // Wire up button inside empty state
      const emptyBtn = document.getElementById('empty-state-add-btn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', openCreateDialog);
      }
      return;
    }

    tasksListContainer.innerHTML = tasks.map(task => {
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

    // Attach row event listeners
    // A. Completion toggle
    tasksListContainer.querySelectorAll('.toggle-complete-btn').forEach(box => {
      box.addEventListener('change', async (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        try {
          utils.showLoading(tasksContent);
          const res = await api.patch(`/tasks/${id}/complete`);
          if (res.success) {
            utils.showSuccess(res.message);
            loadTasks();
          }
        } catch (err) {
          utils.showError('Could not toggle task status.');
          e.target.checked = !e.target.checked; // Revert checkbox
        } finally {
          utils.hideLoading(tasksContent);
        }
      });
    });

    // B. Edit task trigger
    tasksListContainer.querySelectorAll('.edit-task-trigger').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        openEditDialog(id);
      });
    });

    // C. Delete task action
    tasksListContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const row = e.target.closest('.task-row-item');
        const id = row.dataset.id;
        if (confirm('Are you sure you want to permanently delete this task?')) {
          try {
            utils.showLoading(tasksContent);
            const res = await api.delete(`/tasks/${id}`);
            if (res.success) {
              utils.showSuccess(res.message);
              loadTasks();
            }
          } catch (err) {
            utils.showError('Failed to delete this task.');
          } finally {
            utils.hideLoading(tasksContent);
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

  // 3. Dialog Modal Controllers
  function openCreateDialog() {
    dialogTitle.textContent = 'Create Task';
    taskForm.reset();
    document.getElementById('task-id').value = '';
    
    // Hide subtasks container on create mode
    subtasksContainer.style.display = 'none';
    activeTaskIdForSubtasks = null;

    // Set default fields
    document.getElementById('task-category').value = 'Other';
    document.getElementById('task-priority').value = 'Medium';
    document.getElementById('task-status').value = 'Pending';
    document.getElementById('task-due-date').value = '';
    document.getElementById('task-tags').value = '';
    
    taskDialog.classList.add('open');
  }

  async function openEditDialog(id) {
    try {
      utils.showLoading(tasksContent);
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
      utils.showError('Could not fetch task specifications.');
    } finally {
      utils.hideLoading(tasksContent);
    }
  }

  function closeDialog() {
    taskDialog.classList.remove('open');
  }

  // Bind dialog controllers
  addTaskBtn.addEventListener('click', openCreateDialog);
  taskDialogClose.addEventListener('click', closeDialog);
  taskDialogCancel.addEventListener('click', closeDialog);
  
  taskDialog.addEventListener('click', (e) => {
    if (e.target === taskDialog) closeDialog();
  });

  // Handle Create/Edit submit
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
        res = await api.put(`/tasks/${id}`, payload);
      } else {
        res = await api.post('/tasks', payload);
      }

      if (res.success) {
        utils.showSuccess(res.message);
        closeDialog();
        loadTasks();
      }
    } catch (err) {
      utils.showError(err.message || 'Could not save task parameters.');
    } finally {
      utils.hideLoading(taskDialog.querySelector('.dialog-container'));
    }
  });

  // 4. Bind Filter / Search triggers
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      loadTasks();
    }, 300);
  });

  filterStatus.addEventListener('change', loadTasks);
  filterPriority.addEventListener('change', loadTasks);
  filterCategory.addEventListener('change', loadTasks);
  filterDueDate.addEventListener('change', loadTasks);
  sortSelect.addEventListener('change', loadTasks);

  // Helper escape function
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial load execution
  loadTasks();
});
