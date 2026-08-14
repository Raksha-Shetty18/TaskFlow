const db = require('../config/database');

// Helper to format tags string to array
const formatTaskTags = (task) => {
  if (!task) return null;
  task.tags = task.tags ? task.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  return task;
};

// GET /api/tasks (Retrieves all tasks for user with dynamic search, filter, and sort)
const getTasks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { search, status, priority, category, dueDate, sort } = req.query;

    let sql = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [userId];

    // 1. Dynamic Search (title, description, category, tags)
    if (search && search.trim() !== '') {
      const searchWildcard = `%${search.trim()}%`;
      sql += ' AND (title LIKE ? OR description LIKE ? OR category LIKE ? OR tags LIKE ?)';
      params.push(searchWildcard, searchWildcard, searchWildcard, searchWildcard);
    }

    // 2. Dynamic Filtering
    if (status && status !== 'All') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority && priority !== 'All') {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (dueDate && dueDate !== 'All') {
      if (dueDate === 'Today') {
        sql += " AND due_date = date('now', 'localtime')";
      } else if (dueDate === 'Tomorrow') {
        sql += " AND due_date = date('now', '+1 day', 'localtime')";
      } else if (dueDate === 'This Week') {
        sql += " AND due_date BETWEEN date('now', 'localtime') AND date('now', '+7 days', 'localtime')";
      } else if (dueDate === 'Overdue') {
        sql += " AND due_date < date('now', 'localtime') AND status NOT IN ('Completed', 'Cancelled')";
      }
    }

    // 3. Dynamic Sorting
    let orderBy = 'ORDER BY created_at DESC'; // default sort (Newest)
    if (sort) {
      switch (sort) {
        case 'Oldest':
          orderBy = 'ORDER BY created_at ASC';
          break;
        case 'Due Date':
          orderBy = 'ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC';
          break;
        case 'Priority':
          orderBy = `ORDER BY CASE priority 
            WHEN 'Urgent' THEN 1 
            WHEN 'High' THEN 2 
            WHEN 'Medium' THEN 3 
            WHEN 'Low' THEN 4 
            END ASC, created_at DESC`;
          break;
        case 'Alphabetical':
          orderBy = 'ORDER BY title COLLATE NOCASE ASC';
          break;
        case 'Recently Updated':
          orderBy = 'ORDER BY updated_at DESC';
          break;
        case 'Newest':
        default:
          orderBy = 'ORDER BY created_at DESC';
          break;
      }
    }

    sql += ` ${orderBy}`;

    const tasks = await db.all(sql, params);
    
    // Format tags for all tasks
    const formattedTasks = tasks.map(formatTaskTags);

    res.status(200).json({
      success: true,
      data: formattedTasks
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tasks/:id (Retrieve single task details, including nested subtasks)
const getTaskById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const sql = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';
    const task = await db.get(sql, [taskId, userId]);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    // Format tags
    formatTaskTags(task);

    // Fetch associated subtasks checklist
    const subtasks = await db.all(
      'SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC',
      [taskId]
    );
    task.subtasks = subtasks;

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/tasks (Create a new task)
const createTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, description, category, priority, status, due_date, tags } = req.body;

    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Task title is required.'
      });
    }

    const validCategories = ['College', 'Work', 'Personal', 'Project', 'Learning', 'Other'];
    const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

    const chosenCategory = category || 'Other';
    const chosenPriority = priority || 'Medium';
    const chosenStatus = status || 'Pending';

    if (!validCategories.includes(chosenCategory)) {
      return res.status(400).json({ success: false, error: 'Invalid category choice.' });
    }
    if (!validPriorities.includes(chosenPriority)) {
      return res.status(400).json({ success: false, error: 'Invalid priority choice.' });
    }
    if (!validStatuses.includes(chosenStatus)) {
      return res.status(400).json({ success: false, error: 'Invalid status choice.' });
    }

    // Format empty string due_date to null
    const formattedDueDate = due_date && due_date.trim() !== '' ? due_date.trim() : null;

    // Format tags array or string to comma-separated values
    let formattedTags = null;
    if (tags) {
      if (Array.isArray(tags)) {
        formattedTags = tags.map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
      } else if (typeof tags === 'string') {
        formattedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
      }
    }

    const completedAt = chosenStatus === 'Completed' ? new Date().toISOString() : null;

    const sql = `
      INSERT INTO tasks (user_id, title, description, category, priority, status, due_date, tags, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      userId,
      title.trim(),
      description ? description.trim() : null,
      chosenCategory,
      chosenPriority,
      chosenStatus,
      formattedDueDate,
      formattedTags,
      completedAt
    ];

    const result = await db.run(sql, params);

    // Retrieve and return the created task
    const createdTask = await db.get('SELECT * FROM tasks WHERE id = ?', [result.id]);
    formatTaskTags(createdTask);

    res.status(201).json({
      success: true,
      message: 'Task created successfully.',
      data: createdTask
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/tasks/:id (Update task)
const updateTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { title, description, category, priority, status, due_date, tags } = req.body;

    // Check if task exists and belongs to the user
    const checkSql = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';
    const existingTask = await db.get(checkSql, [taskId, userId]);

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Task title is required.'
      });
    }

    const validCategories = ['College', 'Work', 'Personal', 'Project', 'Learning', 'Other'];
    const validPriorities = ['Low', 'Medium', 'High', 'Urgent'];
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];

    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ success: false, error: 'Invalid category choice.' });
    }
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ success: false, error: 'Invalid priority choice.' });
    }
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status choice.' });
    }

    // Manage completed_at timestamp
    let completedAt = existingTask.completed_at;
    if (status === 'Completed' && existingTask.status !== 'Completed') {
      completedAt = new Date().toISOString();
    } else if (status !== 'Completed') {
      completedAt = null;
    }

    const formattedDueDate = due_date && due_date.trim() !== '' ? due_date.trim() : null;

    // Format tags
    let formattedTags = null;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        formattedTags = tags.map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
      } else if (typeof tags === 'string') {
        formattedTags = tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(',');
      }
    } else {
      formattedTags = existingTask.tags;
    }

    const updateSql = `
      UPDATE tasks 
      SET title = ?, 
          description = ?, 
          category = ?, 
          priority = ?, 
          status = ?, 
          due_date = ?, 
          tags = ?,
          completed_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `;
    const params = [
      title.trim(),
      description ? description.trim() : null,
      category || existingTask.category,
      priority || existingTask.priority,
      status || existingTask.status,
      formattedDueDate,
      formattedTags,
      completedAt,
      taskId,
      userId
    ];

    await db.run(updateSql, params);

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    formatTaskTags(updatedTask);

    res.status(200).json({
      success: true,
      message: 'Task updated successfully.',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/tasks/:id/complete (Toggle task completion)
const toggleCompleteTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const checkSql = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';
    const task = await db.get(checkSql, [taskId, userId]);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    let newStatus, completedAt;
    if (task.status === 'Completed') {
      newStatus = 'Pending';
      completedAt = null;
    } else {
      newStatus = 'Completed';
      completedAt = new Date().toISOString();
    }

    const updateSql = `
      UPDATE tasks
      SET status = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `;
    await db.run(updateSql, [newStatus, completedAt, taskId, userId]);

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    formatTaskTags(updatedTask);

    res.status(200).json({
      success: true,
      message: newStatus === 'Completed' ? 'Task marked as completed.' : 'Task marked as pending.',
      data: updatedTask
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id (Delete task)
const deleteTask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;

    const checkSql = 'SELECT * FROM tasks WHERE id = ? AND user_id = ?';
    const task = await db.get(checkSql, [taskId, userId]);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    const deleteSql = 'DELETE FROM tasks WHERE id = ? AND user_id = ?';
    await db.run(deleteSql, [taskId, userId]);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// --- SUBTASKS CRUD METHODS ---

// Helper to verify task ownership before allowing subtask mutation
const verifyTaskOwnership = async (taskId, userId) => {
  const task = await db.get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [taskId, userId]);
  return !!task;
};

// POST /api/tasks/:id/subtasks (Create subtask checklist item)
const addSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { title } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Subtask title is required.'
      });
    }

    // Verify task belongs to user
    const ownsTask = await verifyTaskOwnership(taskId, userId);
    if (!ownsTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    const sql = 'INSERT INTO subtasks (task_id, title) VALUES (?, ?)';
    const result = await db.run(sql, [taskId, title.trim()]);

    const createdSubtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [result.id]);

    res.status(201).json({
      success: true,
      message: 'Subtask added successfully.',
      data: createdSubtask
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/tasks/:id/subtasks/:subtaskId (Update subtask checked/title status)
const updateSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const subtaskId = req.params.subtaskId;
    const { title, is_completed } = req.body;

    // Verify task belongs to user
    const ownsTask = await verifyTaskOwnership(taskId, userId);
    if (!ownsTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    // Fetch existing subtask
    const subtask = await db.get('SELECT * FROM subtasks WHERE id = ? AND task_id = ?', [subtaskId, taskId]);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        error: 'Subtask not found.'
      });
    }

    const newTitle = title !== undefined ? title.trim() : subtask.title;
    const newCompleted = is_completed !== undefined ? (is_completed ? 1 : 0) : subtask.is_completed;

    if (newTitle === '') {
      return res.status(400).json({
        success: false,
        error: 'Subtask title cannot be empty.'
      });
    }

    const sql = 'UPDATE subtasks SET title = ?, is_completed = ? WHERE id = ? AND task_id = ?';
    await db.run(sql, [newTitle, newCompleted, subtaskId, taskId]);

    const updatedSubtask = await db.get('SELECT * FROM subtasks WHERE id = ?', [subtaskId]);

    res.status(200).json({
      success: true,
      message: 'Subtask updated successfully.',
      data: updatedSubtask
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/tasks/:id/subtasks/:subtaskId (Delete subtask)
const deleteSubtask = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const subtaskId = req.params.subtaskId;

    // Verify task belongs to user
    const ownsTask = await verifyTaskOwnership(taskId, userId);
    if (!ownsTask) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied.'
      });
    }

    // Check subtask exists
    const subtask = await db.get('SELECT id FROM subtasks WHERE id = ? AND task_id = ?', [subtaskId, taskId]);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        error: 'Subtask not found.'
      });
    }

    const sql = 'DELETE FROM subtasks WHERE id = ? AND task_id = ?';
    await db.run(sql, [subtaskId, taskId]);

    res.status(200).json({
      success: true,
      message: 'Subtask deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleCompleteTask,
  deleteTask,
  addSubtask,
  updateSubtask,
  deleteSubtask
};
