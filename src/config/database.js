const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.DATABASE_URL;
const isPostgres = !!dbUrl;

let pool = null;
let sqliteDb = null;

if (isPostgres) {
  console.log('Connecting to PostgreSQL database online...');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false // Required for Neon serverless connections
    }
  });

  // Verify connection and create tables
  pool.connect((err, client, release) => {
    if (err) {
      console.error('Error connecting to PostgreSQL:', err.stack);
      process.exit(1);
    }
    console.log('Connected to PostgreSQL successfully.');
    release();
    initializePostgresTables();
  });
} else {
  const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './taskflow.db');
  console.log(`Connecting to SQLite database at: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
      process.exit(1);
    }
    console.log('Connected to the SQLite database.');
    
    // Enable foreign keys
    sqliteDb.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) {
        console.error('Failed to enable foreign keys pragma:', err.message);
      } else {
        console.log('Foreign key support enabled.');
      }
    });

    initializeSqliteTables();
  });
}

// Translate SQLite query parameter placeholders (?) and date functions to PostgreSQL equivalents
function translateQuery(sql) {
  let translated = sql;
  
  if (isPostgres) {
    // 1. Replace ? placeholders with $1, $2, $3...
    let paramIndex = 1;
    translated = translated.replace(/\?/g, () => `$${paramIndex++}`);
    
    // 2. Replace SQLite date functions with PostgreSQL
    translated = translated.replace(/date\('now',\s*'localtime'\)/gi, 'CURRENT_DATE');
    translated = translated.replace(/date\('now',\s*'-7 days',\s*'localtime'\)/gi, "(CURRENT_DATE - INTERVAL '7 days')");
    translated = translated.replace(/date\('now',\s*'-30 days',\s*'localtime'\)/gi, "(CURRENT_DATE - INTERVAL '30 days')");
  }
  
  return translated;
}

// Reusable promise-based query functions
const dbRun = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        let translated = translateQuery(sql);
        const isInsert = sql.trim().toLowerCase().startsWith('insert');
        
        // Postgres needs RETURNING id to capture insertion index
        if (isInsert && !translated.toLowerCase().includes('returning')) {
          translated += ' RETURNING id';
        }
        
        const res = await pool.query(translated, params);
        resolve({
          id: isInsert && res.rows[0] ? res.rows[0].id : null,
          changes: res.rowCount
        });
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }
};

const dbGet = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const translated = translateQuery(sql);
        const res = await pool.query(translated, params);
        resolve(res.rows[0] || null);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
};

const dbAll = (sql, params = []) => {
  if (isPostgres) {
    return new Promise(async (resolve, reject) => {
      try {
        const translated = translateQuery(sql);
        const res = await pool.query(translated, params);
        resolve(res.rows);
      } catch (err) {
        reject(err);
      }
    });
  } else {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
};

// SQLite specific schema creation
function initializeSqliteTables() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createTasksTable = `
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL CHECK(category IN ('College', 'Work', 'Personal', 'Project', 'Learning', 'Other')),
      priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
      status TEXT NOT NULL CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
      due_date TEXT,
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  const createSubtasksTable = `
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0 CHECK(is_completed IN (0, 1)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `;

  const createTasksUserIdx = `CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);`;
  const createTasksStatusIdx = `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`;
  const createTasksDueDateIdx = `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);`;
  const createSubtasksTaskIdx = `CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);`;

  sqliteDb.serialize(() => {
    sqliteDb.run(createUsersTable);
    sqliteDb.run(createTasksTable);
    // Migration: add tags column if missing
    sqliteDb.run('ALTER TABLE tasks ADD COLUMN tags TEXT;', () => {});
    sqliteDb.run(createSubtasksTable);
    sqliteDb.run(createTasksUserIdx);
    sqliteDb.run(createTasksStatusIdx);
    sqliteDb.run(createTasksDueDateIdx);
    sqliteDb.run(createSubtasksTaskIdx);
  });
}

// PostgreSQL specific schema creation
async function initializePostgresTables() {
  try {
    // 1. Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50) NOT NULL CHECK(category IN ('College', 'Work', 'Personal', 'Project', 'Learning', 'Other')),
        priority VARCHAR(50) NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
        status VARCHAR(50) NOT NULL CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
        due_date VARCHAR(50),
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);

    // 3. Subtasks table (storing completeness status as integer 0/1 to align with SQL codebase logic)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subtasks (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        is_completed INTEGER DEFAULT 0 CHECK(is_completed IN (0, 1)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);');

    console.log('PostgreSQL database tables and indexes initialized successfully.');
  } catch (err) {
    console.error('Error creating PostgreSQL schemas:', err);
  }
}

module.exports = {
  db: isPostgres ? pool : sqliteDb,
  run: dbRun,
  get: dbGet,
  all: dbAll
};
