const bcrypt = require('bcryptjs');
const db = require('../config/database');

// GET /api/profile (Fetch user profile data)
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sql = 'SELECT id, name, email, created_at FROM users WHERE id = ?';
    const user = await db.get(sql, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User profile not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile (Update user profile or password)
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, email, currentPassword, newPassword } = req.body;

    // 1. Fetch current user from database
    const userSql = 'SELECT * FROM users WHERE id = ?';
    const user = await db.get(userSql, [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    // 2. Validate basic updates
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required.'
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName === '' || trimmedEmail === '') {
      return res.status(400).json({
        success: false,
        error: 'Name and email cannot be empty.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    let updatedPasswordHash = null;

    // 3. Handle Password Change (if requested)
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Both current password and new password are required to change your password.'
        });
      }

      // Check current password correctness
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect.'
        });
      }

      // Validate new password length
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 8 characters long.'
        });
      }

      // Hash the new password
      updatedPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    // 4. Perform Update
    // SQLite COALESCE evaluates parameters from left to right and returns the first non-null value.
    const updateSql = `
      UPDATE users
      SET name = ?, 
          email = ?, 
          password_hash = COALESCE(?, password_hash), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    await db.run(updateSql, [trimmedName, trimmedEmail, updatedPasswordHash, userId]);

    // Fetch and return the updated user (excluding password)
    const updatedUser = await db.get('SELECT id, name, email, created_at FROM users WHERE id = ?', [userId]);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedUser
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile
};
