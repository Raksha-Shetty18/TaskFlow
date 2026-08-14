# TaskFlow — Plan. Prioritize. Complete.

TaskFlow is a modern, production-grade **Task Management Web Application** built as a full-stack developer portfolio project. It demonstrates secure JWT authentication, dynamic REST APIs, raw SQLite database interactions, and a premium responsive user interface with native light/dark mode support.

---

## 🚀 Key Features

* **Secure Authentication**: User signup and login utilizing `bcryptjs` password hashing and stateless JSON Web Tokens (JWT).
* **Workspace Dashboard**: Real-time aggregation of task progress, completion metrics, focus lists, overdue highlights, and upcoming deadlines.
* **Full Task CRUD**: Complete Create, Read, Update, and Delete operations for user tasks.
* **Advanced Filters & Search**: Search dynamically through task titles, descriptions, and categories. Filter results by status, priority level, category, or due date.
* **Custom Sorting**: Sort tasks by newest, oldest, alphabetical title, due date, priority hierarchy, or recently updated timestamps.
* **User Profile Center**: Edit contact information and update security credentials securely.
* **Resource Authorization**: Strict backend-level validation ensuring users can only read, write, toggle, or delete their own data.
* **Responsive Fluid Design**: Clean user experience across mobile, tablet, laptop, and desktop screen sizes using CSS Grid, Flexbox, and media queries.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, CSS3 (Vanilla design, no external utility frameworks), Vanilla JavaScript (Modular ES6 Fetch).
* **Backend**: Node.js, Express.js (REST APIs, routing, error handlers).
* **Security & Tokens**: `bcryptjs` for encryption, `jsonwebtoken` for secure stateless tokens.
* **Database**: **SQLite** (via the `sqlite3` driver).

---

## 📂 Database Design & Selection Rationale

### Why SQLite?
1. **Relational Consistency**: User accounts and tasks share a strict one-to-many relationship. A SQL-based database allows us to utilize foreign keys with cascading deletions (`ON DELETE CASCADE`), index constraints, and run fast, direct aggregation queries for dashboard analytics.
2. **Zero-Configuration Setup**: SQLite stores the database in a local file (`taskflow.db`). Anyone who clones this repository can immediately launch the project without configuring servers, local database engines, or Docker containers.
3. **Raw SQL Operations**: We use the native driver to execute raw parameterized SQL statements instead of hiding DB interactions behind heavy ORMs. This demonstrates strong SQL query design and optimization knowledge.

### Schema Blueprint

#### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Tasks Table
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('College', 'Work', 'Personal', 'Project', 'Learning', 'Other')),
  priority TEXT NOT NULL CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
  due_date TEXT, -- Store ISO 8601 string (YYYY-MM-DD)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
```

---

## 🔌 API Endpoints Reference

### Authentication Routing
* `POST /api/auth/register` — Registers a new user. Returns a confirmation message.
* `POST /api/auth/login` — Verifies email/password and returns a signed JWT.
* `POST /api/auth/logout` — Destroys local session cache references.

### Task Management Routing (Protected)
* `GET /api/tasks` — Retrieves user tasks. Supports query options: `?search=val&status=val&priority=val&category=val&dueDate=val&sort=val`.
* `GET /api/tasks/:id` — Retrieves a single task's specifications.
* `POST /api/tasks` — Creates a new task.
* `PUT /api/tasks/:id` — Edits all attributes of an existing task.
* `PATCH /api/tasks/:id/complete` — Toggles the status between Completed and Pending/In Progress.
* `DELETE /api/tasks/:id` — Permanently removes a task.

### Metrics Routing (Protected)
* `GET /api/dashboard` — Aggregates stats counts and focus lists.
* `GET /api/profile` — Retrieves the current user's profile details.
* `PUT /api/profile` — Updates user profile name/email and handles security password changes.

---

## ⚙️ Installation & Setup Guide

### Prerequisites
* [Node.js](https://nodejs.org) (v18.0.0 or higher)
* [npm](https://www.npmjs.com/)

### 1. Clone & Install
```bash
git clone https://github.com/your-username/taskflow.git
cd taskflow
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_here
DB_PATH=./taskflow.db
NODE_ENV=development
```

### 3. Run the Application

#### Development (Auto-Reloading)
```bash
npm run dev
```

#### Production (Standard Start)
```bash
npm start
```

Open your browser and navigate to `http://localhost:5000` to interact with TaskFlow!

---

## 🛡️ Security Best Practices Implemented

* **SQL Injection Prevention**: All SQL statements use parameterized queries (`?` bindings) to ensure inputs are treated strictly as data literals.
* **Credential Protection**: Passwords are encrypted on register using `bcryptjs` with 10 salt rounds and verified on login. Raw passwords are never persisted.
* **Server-side Authorization Middleware**: Route protection checks for signed JWTs.
* **Ownership Integrity**: Data modifications (update, delete, check detail) query with `WHERE id = ? AND user_id = ?` to verify the task belongs to the authenticated user.
* **Safe Error Handling**: Returns clean client-friendly JSON error messages. Raw database stack traces are suppressed in production mode.
* **Client-side Sanitization**: Vanilla JS encodes and escapes titles and descriptions on output to protect against Cross-Site Scripting (XSS).

---

## 👤 Author
Developed with ❤️ as a Full-Stack portfolio project.
