// TaskFlow Calendar Page Controller

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar
  utils.renderSidebar('calendar');

  // Calendar State
  const today = new Date();
  let currentMonth = today.getMonth(); // 0-11
  let currentYear = today.getFullYear();

  // DOM Elements
  const calendarContent = document.getElementById('calendar-content');
  const daysGrid = document.getElementById('calendar-days-grid');
  const monthYearHeader = document.getElementById('calendar-month-year');
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const todayBtn = document.getElementById('today-btn');

  // Dialog Elements
  const taskDialog = document.getElementById('task-dialog');
  const taskForm = document.getElementById('task-form');
  const dialogTitle = document.getElementById('dialog-title');
  const taskDialogClose = document.getElementById('task-dialog-close');
  const taskDialogCancel = document.getElementById('task-dialog-cancel');
  const subtasksContainer = document.getElementById('dialog-subtasks-container');
  const subtaskList = document.getElementById('dialog-subtask-list');
  const newSubtaskInput = document.getElementById('new-subtask-title');
  const addSubtaskBtn = document.getElementById('add-subtask-btn');
  let activeTaskIdForSubtasks = null;

  // Month names dictionary
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Priority icons mapping
  const prioIcons = {
    Low: '🔹',
    Medium: '🔸',
    High: '⚡',
    Urgent: '🚩'
  };

  // In-memory task list
  let userTasks = [];

  // 1. Fetch all tasks and render calendar
  async function loadCalendar() {
    try {
      utils.showLoading(calendarContent);
      
      // Fetch all tasks for the logged in user
      const res = await api.get('/tasks?sort=Due Date');
      if (res.success) {
        userTasks = res.data;
        renderCalendarGrid();
      }
    } catch (err) {
      utils.showError('Could not retrieve tasks for calendar plotting.');
    } finally {
      utils.hideLoading(calendarContent);
    }
  }

  // 2. Render Calendar Grid Layout
  function renderCalendarGrid() {
    // Set Header
    monthYearHeader.textContent = `${months[currentMonth]} ${currentYear}`;
    daysGrid.innerHTML = '';

    // First day of current month (0 = Sun, 1 = Mon, etc.)
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    // Number of days in current month
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Number of days in previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

    // 1. Render offset days from previous month
    for (let i = firstDayIndex; i > 0; i--) {
      const dayCell = document.createElement('div');
      dayCell.className = 'calendar-day empty';
      
      const dateNum = prevMonthDays - i + 1;
      dayCell.innerHTML = `<span class="calendar-date-num">${dateNum}</span>`;
      daysGrid.appendChild(dayCell);
    }

    // 2. Render current month days
    for (let day = 1; day <= totalDays; day++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'calendar-day';
      
      // Format current cell date string (YYYY-MM-DD)
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const cellDateString = `${currentYear}-${monthStr}-${dayStr}`;

      // Check if it is today
      const isTodayCell = 
        day === today.getDate() && 
        currentMonth === today.getMonth() && 
        currentYear === today.getFullYear();
      
      if (isTodayCell) {
        dayCell.classList.add('today');
      }

      // Create inner HTML structure
      dayCell.innerHTML = `
        <span class="calendar-date-num">${day}</span>
        <div class="calendar-task-list"></div>
      `;

      const listContainer = dayCell.querySelector('.calendar-task-list');

      // Filter and append tasks matching this cell due date
      const matchingTasks = userTasks.filter(task => task.due_date === cellDateString);
      
      matchingTasks.forEach(task => {
        const badge = document.createElement('div');
        const isCompleted = task.status === 'Completed';
        badge.className = `calendar-task-badge ${task.priority.toLowerCase()} ${isCompleted ? 'completed' : ''}`;
        badge.textContent = `${prioIcons[task.priority] || '🔸'} ${task.title}`;
        badge.title = `${task.title} (Priority: ${task.priority}, Status: ${task.status})`;
        badge.dataset.taskId = task.id;
        
        badge.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent trigger day click if we add day triggers later
          openEditDialog(task.id);
        });

        listContainer.appendChild(badge);
      });

      daysGrid.appendChild(dayCell);
    }

    // 3. Render remaining grid cells to fill a clean 35/42 grid layout
    const totalCellsFilled = firstDayIndex + totalDays;
    const remainingOffset = (7 - (totalCellsFilled % 7)) % 7;
    
    for (let day = 1; day <= remainingOffset; day++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'calendar-day empty';
      dayCell.innerHTML = `<span class="calendar-date-num">${day}</span>`;
      daysGrid.appendChild(dayCell);
    }
  }

  // Navigation Click Handlers
  prevBtn.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendarGrid();
  });

  nextBtn.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendarGrid();
  });

  todayBtn.addEventListener('click', () => {
    currentMonth = today.getMonth();
    currentYear = today.getFullYear();
    renderCalendarGrid();
  });

  // --- REUSABLE EDIT DIALOG WORKFLOWS (Mirrors dashboard/tasks) ---

  // Subtask renderer
  function renderDialogSubtasks(subtasks, taskId) {
    activeTaskIdForSubtasks = taskId;
    subtasksContainer.style.display = 'block';
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
          loadCalendar(); // Refresh calendar to show checklist changes if needed
        } catch (err) {
          utils.showError('Could not update checklist item.');
          e.target.checked = !checked;
        }
      });
    });

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
            loadCalendar();
          }
        } catch (err) {
          utils.showError('Could not delete checklist item.');
        }
      });
    });
  }

  // Add subtask
  if (addSubtaskBtn) {
    addSubtaskBtn.addEventListener('click', async () => {
      const title = newSubtaskInput.value.trim();
      if (!title || !activeTaskIdForSubtasks) return;

      try {
        utils.showLoading(subtaskList);
        const res = await api.post(`/tasks/${activeTaskIdForSubtasks}/subtasks`, { title });
        if (res.success) {
          newSubtaskInput.value = '';
          const taskDetails = await api.get(`/tasks/${activeTaskIdForSubtasks}`);
          if (taskDetails.success) {
            renderDialogSubtasks(taskDetails.data.subtasks, activeTaskIdForSubtasks);
          }
          loadCalendar();
        }
      } catch (err) {
        utils.showError('Could not add checklist item.');
      } finally {
        utils.hideLoading(subtaskList);
      }
    });
  }

  // Open Edit dialog
  async function openEditDialog(id) {
    try {
      utils.showLoading(calendarContent);
      const res = await api.get(`/tasks/${id}`);
      
      if (res.success) {
        const task = res.data;
        dialogTitle.textContent = 'Edit Task Details';
        
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-category').value = task.category;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-status').value = task.status;
        document.getElementById('task-due-date').value = task.due_date || '';
        document.getElementById('task-tags').value = task.tags ? task.tags.join(', ') : '';
        
        renderDialogSubtasks(task.subtasks, task.id);
        taskDialog.classList.add('open');
      }
    } catch (err) {
      utils.showError('Failed to retrieve task details.');
    } finally {
      utils.hideLoading(calendarContent);
    }
  }

  function closeDialog() {
    taskDialog.classList.remove('open');
  }

  taskDialogClose.addEventListener('click', closeDialog);
  taskDialogCancel.addEventListener('click', closeDialog);
  taskDialog.addEventListener('click', (e) => {
    if (e.target === taskDialog) closeDialog();
  });

  // Submit edit dialog form
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
      const res = await api.put(`/tasks/${id}`, payload);
      if (res.success) {
        utils.showSuccess(res.message);
        closeDialog();
        loadCalendar();
      }
    } catch (err) {
      utils.showError(err.message || 'Failed to update the task.');
    } finally {
      utils.hideLoading(taskDialog.querySelector('.dialog-container'));
    }
  });

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

  // Initial load
  loadCalendar();
});
