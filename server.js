const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const errorHandler = require('./src/middleware/errorHandler');

// Initialize configuration
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// HTTP Request logging
app.use(morgan('dev'));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/tasks', require('./src/routes/tasks'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/profile', require('./src/routes/profile'));

// Catch-all route to serve the Landing Page for unknown routes
app.get('*', (req, res, next) => {
  // If it's an API request that didn't match, send 404
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      error: 'API endpoint not found.'
    });
  }
  // Otherwise, serve static landing page
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
