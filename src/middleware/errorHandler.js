// Centralized Express Error Handler
const errorHandler = (err, req, res, next) => {
  // Log error stack locally for development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error Handler Caught:', err);
  } else {
    console.error(`Error: ${err.message}`);
  }

  // Default error code and message
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle specific database errors
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    statusCode = 400;
    // Format unique constraint message for emails
    if (err.message.includes('users.email')) {
      message = 'An account with this email address already exists.';
    } else {
      message = 'A unique constraint violation occurred.';
    }
  }

  // Handle SQLite constraint check errors
  if (err.message && err.message.includes('CHECK constraint failed')) {
    statusCode = 400;
    message = 'Invalid data provided. Please check the categories, priority, and status fields.';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // Send uniform JSON response
  res.status(statusCode).json({
    success: false,
    error: message
  });
};

module.exports = errorHandler;
