// TaskFlow Authentication Operations Handler

document.addEventListener('DOMContentLoaded', () => {
  // 1. Handle Login Form Submit
  const loginForm = document.getElementById('login-form');
  const loginCard = document.getElementById('login-card');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;

      if (!email || !password) {
        utils.showError('Please fill in all credentials fields.');
        return;
      }

      try {
        utils.showLoading(loginCard);
        
        const response = await api.post('/auth/login', { email, password });
        
        if (response.success) {
          // Store token and user data
          api.setToken(response.token);
          api.setUser(response.user);
          
          utils.showSuccess('Access granted. Entering workspace...', 'Welcome Back');
          
          // Wait briefly for user to read success message before redirecting
          setTimeout(() => {
            window.location.href = '/dashboard.html';
          }, 1000);
        }
      } catch (err) {
        utils.showError(err.message || 'Verification failed. Incorrect email or password.');
      } finally {
        utils.hideLoading(loginCard);
      }
    });
  }

  // 2. Handle Registration Form Submit
  const registerForm = document.getElementById('register-form');
  const registerCard = document.getElementById('register-card');

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      // Basic length validation
      if (password.length < 8) {
        utils.showError('Password must be at least 8 characters long.', 'Weak Password');
        return;
      }

      if (password !== confirmPassword) {
        utils.showError('Passwords do not match. Please verify.', 'Mismatch');
        return;
      }

      try {
        utils.showLoading(registerCard);

        const response = await api.post('/auth/register', {
          name,
          email,
          password,
          confirmPassword
        });

        if (response.success) {
          utils.showSuccess(response.message || 'Registration completed successfully!', 'Success');
          
          // Redirect to login page
          setTimeout(() => {
            window.location.href = '/login.html';
          }, 1500);
        }
      } catch (err) {
        utils.showError(err.message || 'An error occurred during registration.');
      } finally {
        utils.hideLoading(registerCard);
      }
    });
  }
});
