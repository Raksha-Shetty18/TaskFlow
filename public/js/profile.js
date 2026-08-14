// TaskFlow User Profile Page Controller

document.addEventListener('DOMContentLoaded', () => {
  // Render sidebar
  utils.renderSidebar('profile');

  // DOM Elements
  const profileContent = document.getElementById('profile-content');
  const profileCard = document.getElementById('profile-card');
  const securityCard = document.getElementById('security-card');

  const profileForm = document.getElementById('profile-form');
  const securityForm = document.getElementById('security-form');

  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');

  const currentPasswordInput = document.getElementById('current-password');
  const newPasswordInput = document.getElementById('new-password');
  const confirmNewPasswordInput = document.getElementById('confirm-new-password');

  let currentProfileData = null;

  // 1. Fetch Profile Data
  async function loadProfile() {
    try {
      utils.showLoading(profileContent);
      const res = await api.get('/profile');
      
      if (res.success) {
        currentProfileData = res.data;
        nameInput.value = currentProfileData.name;
        emailInput.value = currentProfileData.email;
      }
    } catch (err) {
      utils.showError('Could not fetch user profile details.');
    } finally {
      utils.hideLoading(profileContent);
    }
  }

  // 2. Handle Contact Info Form Submission
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name || !email) {
      utils.showError('Name and email cannot be empty.');
      return;
    }

    try {
      utils.showLoading(profileCard);
      const res = await api.put('/profile', { name, email });

      if (res.success) {
        // Update user state in localStorage
        const user = api.getUser() || {};
        user.name = res.data.name;
        user.email = res.data.email;
        api.setUser(user);

        // Re-render sidebar to display updated details instantly
        utils.renderSidebar('profile');
        
        utils.showSuccess('Your contact details have been updated successfully.');
        currentProfileData = res.data;
      }
    } catch (err) {
      utils.showError(err.message || 'Failed to update profile settings.');
    } finally {
      utils.hideLoading(profileCard);
    }
  });

  // 3. Handle Password Upgrades Submission
  securityForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmNewPassword = confirmNewPasswordInput.value;

    if (newPassword.length < 8) {
      utils.showError('New password must be at least 8 characters long.', 'Weak Password');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      utils.showError('Confirm password does not match new password.', 'Password Mismatch');
      return;
    }

    try {
      utils.showLoading(securityCard);

      // Use COALESCE in SQL by passing existing name and email with the password fields
      const res = await api.put('/profile', {
        name: currentProfileData.name,
        email: currentProfileData.email,
        currentPassword,
        newPassword
      });

      if (res.success) {
        utils.showSuccess('Your security password has been changed successfully.', 'Security Alert');
        securityForm.reset();
      }
    } catch (err) {
      utils.showError(err.message || 'Failed to update password. Verify current password.');
    } finally {
      utils.hideLoading(securityCard);
    }
  });

  // Execute initial load
  loadProfile();
});
