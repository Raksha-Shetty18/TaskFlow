// TaskFlow Common Utilities & Notification System

// 0. Auto-initialize Theme immediately to prevent layout flash
(function initTheme() {
  const savedTheme = localStorage.getItem('taskflow_theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
  } else {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
  }
})();

const utils = {
  // 1. Toast Notification System
  toast: (title, message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on type
    let icon = '✓';
    if (type === 'error') icon = '✕';
    if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger CSS slide-in
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      utils.dismissToast(toast);
    }, 4000);

    // Close button click handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(dismissTimer);
      utils.dismissToast(toast);
    });
  },

  dismissToast: (toastElement) => {
    toastElement.classList.remove('show');
    toastElement.addEventListener('transitionend', () => {
      toastElement.remove();
    });
  },

  // Helpers for success/error shortcuts
  showSuccess: (message, title = 'Success') => utils.toast(title, message, 'success'),
  showError: (message, title = 'Error') => utils.toast(title, message, 'error'),
  showInfo: (message, title = 'Information') => utils.toast(title, message, 'info'),

  // 2. Loading State Managers
  showLoading: (containerElement) => {
    if (!containerElement) return;
    
    if (containerElement.querySelector('.loading-spinner-container')) return;

    const originalPos = window.getComputedStyle(containerElement).position;
    if (originalPos !== 'relative' && originalPos !== 'absolute' && originalPos !== 'fixed') {
      containerElement.style.position = 'relative';
    }

    const overlay = document.createElement('div');
    overlay.className = 'loading-spinner-container';
    overlay.innerHTML = '<div class="spinner"></div>';
    containerElement.appendChild(overlay);

    setTimeout(() => {
      overlay.classList.add('show');
    }, 10);
  },

  hideLoading: (containerElement) => {
    if (!containerElement) return;
    const overlay = containerElement.querySelector('.loading-spinner-container');
    if (overlay) {
      overlay.classList.remove('show');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
      });
    }
  },

  // 3. Date Formatting Utilities
  formatDate: (dateString) => {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  },

  getDueDateLabel: (dateString, taskStatus) => {
    if (!dateString) return { text: 'No due date', class: '' };
    
    const [year, month, day] = dateString.split('-').map(Number);
    const dueDate = new Date(year, month - 1, day);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const differenceMs = dueDate.getTime() - today.getTime();
    const differenceDays = Math.ceil(differenceMs / (1000 * 60 * 60 * 24));

    if (taskStatus === 'Completed' || taskStatus === 'Cancelled') {
      return { text: utils.formatDate(dateString), class: '' };
    }

    if (differenceDays < 0) {
      return { text: `Overdue (${utils.formatDate(dateString)})`, class: 'overdue' };
    } else if (differenceDays === 0) {
      return { text: 'Due Today', class: 'overdue' };
    } else if (differenceDays === 1) {
      return { text: 'Due Tomorrow', class: '' };
    } else {
      return { text: `Due ${utils.formatDate(dateString)}`, class: '' };
    }
  },

  // 4. Render Sidebar Navigation for Logged-In Layouts
  renderSidebar: (activePageId) => {
    const sidebarContainer = document.getElementById('sidebar-container');
    if (!sidebarContainer) return;

    const user = api.getUser();
    const name = user ? user.name : 'TaskFlow User';
    const email = user ? user.email : 'user@taskflow.com';

    sidebarContainer.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="logo-container">
            <div class="logo-icon">T</div>
            <span>TaskFlow</span>
          </div>
        </div>
        <ul class="sidebar-menu">
          <li class="sidebar-menu-item ${activePageId === 'dashboard' ? 'active' : ''}">
            <a href="dashboard.html" class="sidebar-menu-link">
              <span>📊</span> Dashboard
            </a>
          </li>
          <li class="sidebar-menu-item ${activePageId === 'tasks' ? 'active' : ''}">
            <a href="tasks.html" class="sidebar-menu-link">
              <span>📋</span> My Tasks
            </a>
          </li>
          <li class="sidebar-menu-item ${activePageId === 'calendar' ? 'active' : ''}">
            <a href="calendar.html" class="sidebar-menu-link">
              <span>📅</span> Calendar
            </a>
          </li>
          <li class="sidebar-menu-item ${activePageId === 'profile' ? 'active' : ''}">
            <a href="profile.html" class="sidebar-menu-link">
              <span>👤</span> My Profile
            </a>
          </li>
        </ul>
        <div class="sidebar-footer">
          <div class="user-info">
            <span class="user-name">${name}</span>
            <span class="user-email">${email}</span>
          </div>
          <div style="display: flex; gap: 0.25rem;">
            <button id="theme-toggle-btn" class="btn btn-icon" title="Toggle Theme" style="font-size: 0.95rem;">🌓</button>
            <button id="logout-btn" class="btn btn-icon" title="Logout" style="font-size: 0.95rem;">🚪</button>
          </div>
        </div>
      </div>
      
      <!-- Mobile Bottom Navigation Bar -->
      <nav class="mobile-bottom-nav">
        <a href="dashboard.html" class="mobile-bottom-nav-item ${activePageId === 'dashboard' ? 'active' : ''}">
          <span class="mobile-bottom-nav-icon">📊</span>
          <span>Dashboard</span>
        </a>
        <a href="tasks.html" class="mobile-bottom-nav-item ${activePageId === 'tasks' ? 'active' : ''}">
          <span class="mobile-bottom-nav-icon">📋</span>
          <span>Tasks</span>
        </a>
        <a href="calendar.html" class="mobile-bottom-nav-item ${activePageId === 'calendar' ? 'active' : ''}">
          <span class="mobile-bottom-nav-icon">📅</span>
          <span>Calendar</span>
        </a>
        <a href="profile.html" class="mobile-bottom-nav-item ${activePageId === 'profile' ? 'active' : ''}">
          <span class="mobile-bottom-nav-icon">👤</span>
          <span>Profile</span>
        </a>
      </nav>
    `;

    // Hook up logout button handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to log out?')) {
          try {
            await api.post('/auth/logout');
          } catch (e) {}
          api.clearToken();
          window.location.href = '/index.html';
        }
      });
    }

    // Hook up theme toggle button handler
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        if (html.classList.contains('dark-theme')) {
          html.classList.remove('dark-theme');
          html.classList.add('light-theme');
          localStorage.setItem('taskflow_theme', 'light');
        } else {
          html.classList.remove('light-theme');
          html.classList.add('dark-theme');
          localStorage.setItem('taskflow_theme', 'dark');
        }
      });
    }
  }
};
