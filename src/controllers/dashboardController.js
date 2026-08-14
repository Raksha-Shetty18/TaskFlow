const db = require('../config/database');

// GET /api/dashboard
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Run queries concurrently for fast dashboard response times
    const [
      totalTasksCount,
      pendingTasksCount,
      inProgressTasksCount,
      completedTasksCount,
      cancelledTasksCount,
      overdueTasksCount,
      completedThisWeekCount,
      completedThisMonthCount,
      todayTasks,
      upcomingTasks,
      recentlyCreatedTasks,
      overdueTasks
    ] = await Promise.all([
      db.get('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?', [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Pending'", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'In Progress'", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Completed'", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Cancelled'", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND due_date < date('now', 'localtime') AND status NOT IN ('Completed', 'Cancelled')", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Completed' AND completed_at >= date('now', '-7 days', 'localtime')", [userId]),
      db.get("SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Completed' AND completed_at >= date('now', '-30 days', 'localtime')", [userId]),
      db.all("SELECT * FROM tasks WHERE user_id = ? AND due_date = date('now', 'localtime') AND status NOT IN ('Completed', 'Cancelled') ORDER BY created_at DESC", [userId]),
      db.all("SELECT * FROM tasks WHERE user_id = ? AND due_date > date('now', 'localtime') AND status NOT IN ('Completed', 'Cancelled') ORDER BY due_date ASC LIMIT 5", [userId]),
      db.all("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 5", [userId]),
      db.all("SELECT * FROM tasks WHERE user_id = ? AND due_date < date('now', 'localtime') AND status NOT IN ('Completed', 'Cancelled') ORDER BY due_date ASC", [userId])
    ]);

    const total = totalTasksCount.count || 0;
    const completed = completedTasksCount.count || 0;
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          total,
          pending: pendingTasksCount.count || 0,
          inProgress: inProgressTasksCount.count || 0,
          completed,
          cancelled: cancelledTasksCount.count || 0,
          overdue: overdueTasksCount.count || 0,
          completionPercentage,
          completedThisWeek: completedThisWeekCount.count || 0,
          completedThisMonth: completedThisMonthCount.count || 0
        },
        lists: {
          today: todayTasks,
          upcoming: upcomingTasks,
          recentlyCreated: recentlyCreatedTasks,
          overdue: overdueTasks
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats
};
