# 🌌 TaskFlow — Premium Workspace & Task Organizer

TaskFlow is a premium, modern, and production-grade **Task Management Web Application** designed with a mesmerizing glassmorphic UI. It features a hybrid database engine (Local SQLite / Production PostgreSQL), subtask checklists, calendar monthly views, tag classifications, and stateless JWT authorization.

🚀 **Live Cloud Deployment**: [https://task-management-workspace.vercel.app](https://task-management-workspace.vercel.app)

💻 **GitHub Repository**: [https://github.com/Raksha-Shetty18/TaskFlow](https://github.com/Raksha-Shetty18/TaskFlow)

---

## ✨ Key Features & UX Capabilities

### 🎨 Visual & Motion Design
* **Glassmorphic UI**: Translucent frosted-glass panels (`backdrop-filter: blur(16px)`) with crisp light-refracting edge borders.
* **Ambient Shifting Background**: A mesmerizing 4-color mesh gradient background that moves dynamically in a continuous 20-second loop.
* **Floating Blur Blobs**: Orbiting ambient vector blobs that slide and scale behind user layout panels for an immersive backdrop.
* **Explicit Light/Dark Theme Switcher**: Explicit sidebar selector (`🌓`) persisted to `localStorage` to avoid flash-on-load anomalies.
* **Radial conic progress ring**: A CSS conic-gradient progress indicator that dynamically updates completion percentages inside the stats grid.
* **Running Clock Widget**: A real-time ticking date-time clock in the dashboard header banner.

### ⚙️ Workspace Functions
* **Subtasks Checklist**: Add nested, modular checklists to any task with real-time progress calculations and cascading database deletions.
* **Monthly Calendar Grid**: A visually interactive monthly calendar view plotting priority-colored task bubbles on their respective due dates.
* **Tags/Labels System**: Classify tasks with multiple tags (e.g. `audit`, `finance`, `urgent`) and search through tags dynamically.
* **Category & Priority Emoji Badges**: Automatic visual icon attachments (e.g., `🎓 College`, `💼 Work`, `🚩 Urgent`, `⚡ High`).
* **Advanced Filters & Sorts**: Live search and filter tasks by category, priority, status, or due date, and sort them chronologically or alphabetically.

---

## 🛠️ Technology Stack

* **Frontend**: Pure HTML5, Vanilla CSS3 (Custom design system, zero frameworks), Modular ES6 JS (async/await Fetch).
* **Backend**: Node.js, Express.js (Modular routes, JWT authentication, and centralized error handling middleware).
* **Databases**: 
  - **SQLite**: Fast, zero-configuration database for local offline development.
  - **PostgreSQL**: Cloud-ready enterprise database for production deployments.
* **Hosting**: Vercel (Serverless Node.js function routes).

---

## 📐 Architecture: Hybrid Database Engine

TaskFlow features a hybrid database connection layer that automatically switches engines based on the active environment:

```
                  ┌───────────────────────────┐
                  │   Process Startup (.env)  │
                  └─────────────┬─────────────┘
                                │
                      Is DATABASE_URL set?
                                │
                     ┌──────────┴──────────┐
                    Yes                    No
                     ▼                     ▼
        ┌───────────────────────┐   ┌───────────────┐
        │ PostgreSQL (Neon/pg)  │   │ SQLite (File) │
        └───────────────────────┘   └───────────────┘
```

### Dynamic Query Translator
Because SQLite and PostgreSQL have different syntaxes, TaskFlow implements a dynamic query translator in [`src/config/database.js`](file:///c:/Users/Raksha/OneDrive/Desktop/Projects/Task_Management/src/config/database.js):
* **Parameters**: Automatically binds parameters from SQLite `?` notation to PostgreSQL `$1`, `$2` bindings.
* **Date Math**: Maps SQLite date modifiers `date('now', 'localtime')` to SQL standard `CURRENT_DATE`.
* **Insertions**: Intercepts `INSERT` queries on PostgreSQL, appending `RETURNING id` to return the index identically to SQLite's `lastID` callback.

---

## 🔌 API Endpoints Reference

### Authentication (Public)
* `POST /api/auth/register` — Creates a user account.
* `POST /api/auth/login` — Returns a signed JSON Web Token (JWT).

### Task Routing (Protected)
* `GET /api/tasks` — Retrieves tasks. Supports queries: `?search=val&status=val&priority=val&category=val&dueDate=val&sort=val`.
* `POST /api/tasks` — Creates a task.
* `GET /api/tasks/:id` — Retrieves a task (includes nested checklist subtasks).
* `PUT /api/tasks/:id` — Edits all attributes of a task.
* `DELETE /api/tasks/:id` — Cascades delete of the task and its subtasks.

### Subtasks Checklist Routing (Protected)
* `POST /api/tasks/:id/subtasks` — Adds a subtask checklist item.
* `PUT /api/tasks/:id/subtasks/:subtaskId` — Toggles subtask completion (`is_completed` 0/1).
* `DELETE /api/tasks/:id/subtasks/:subtaskId` — Deletes a subtask item.

### Dashboard & Profile (Protected)
* `GET /api/dashboard` — Aggregates count statistics, overdue task warnings, and focus schedules.
* `GET /api/profile` — Retrieves profile stats.
* `PUT /api/profile` — Updates name, email, and password credentials.

---

## ⚙️ Installation & Setup Guide

### 1. Clone & Install
```bash
git clone https://github.com/Raksha-Shetty18/TaskFlow.git
cd TaskFlow
npm install
```

### 2. Environment Configurations
Create a `.env` file in the root directory (based on `.env.example`):
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_here
DB_PATH=./taskflow.db
NODE_ENV=development

# To connect to online Neon PostgreSQL in dev mode, paste your connection string below:
# DATABASE_URL=postgresql://neondb_owner:***@ep-***.aws.neon.tech/neondb?sslmode=require
```

### 3. Run the Application

#### Local Development (Auto-Reloading SQLite)
```bash
npm run dev
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

#### Test Database Connections
To verify E2E SQL schemas and transactions:
```bash
node scratch/verify_api.js
```

---

## 🛡️ Security Best Practices
* **SQL Injection Protection**: All SQL inputs use parameterized queries.
* **Secure Hashing**: Multi-round `bcryptjs` encryption for stored user password hashes.
* **Server-side Authorization**: Route protection verified using signed, verified JWT payloads.
* **Ownership Verification**: Modifying endpoints filter queries explicitly by both target ID and authenticated user ID (`WHERE id = ? AND user_id = ?`).
* **HTML Escaping**: Client-side outputs sanitize inputs against Cross-Site Scripting (XSS).

---

## 👤 Author
Developed by [Raksha Shetty](https://github.com/Raksha-Shetty18) as a premium full-stack developer portfolio project.
