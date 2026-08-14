// TaskFlow API Fetcher Utility

const API_BASE = '/api';

const api = {
  // Store authentication details in localStorage
  setToken: (token) => {
    localStorage.setItem('taskflow_token', token);
  },

  getToken: () => {
    return localStorage.getItem('taskflow_token');
  },

  clearToken: () => {
    localStorage.removeItem('taskflow_token');
    localStorage.removeItem('taskflow_user');
  },

  setUser: (user) => {
    localStorage.setItem('taskflow_user', JSON.stringify(user));
  },

  getUser: () => {
    const userStr = localStorage.getItem('taskflow_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('taskflow_token');
  },

  // Base request handler
  request: async (endpoint, options = {}) => {
    const url = `${API_BASE}${endpoint}`;
    
    // Inject headers
    options.headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = api.getToken();
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) {
        // If 401 Unauthorized, automatically clear token and redirect to login
        if (response.status === 401) {
          api.clearToken();
          // Avoid infinite redirect loop if we are already on login or register pages
          const path = window.location.pathname;
          if (!path.includes('login.html') && !path.includes('register.html') && !path.includes('index.html') && path !== '/') {
            window.location.href = '/login.html';
          }
        }
        
        throw new Error(result.error || `HTTP error! Status: ${response.status}`);
      }

      return result;
    } catch (err) {
      console.error(`API request failed on ${endpoint}:`, err.message);
      throw err;
    }
  },

  // HTTP wrappers
  get: (endpoint) => api.request(endpoint, { method: 'GET' }),
  
  post: (endpoint, body) => api.request(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  
  put: (endpoint, body) => api.request(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  
  patch: (endpoint, body = {}) => api.request(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(body)
  }),
  
  delete: (endpoint) => api.request(endpoint, { method: 'DELETE' })
};

// Check authentication status on protected pages immediately before DOM loads
(function checkAuthBeforeRender() {
  const path = window.location.pathname;
  const isAuthPage = path.includes('login.html') || path.includes('register.html') || path.includes('index.html') || path === '/';
  
  if (!isAuthPage && !api.isAuthenticated()) {
    window.location.href = '/login.html';
  }
})();
