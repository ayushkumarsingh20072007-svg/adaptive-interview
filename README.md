# Adaptive InterviewIQ — Monorepo (Frontend & Backend)

Welcome to the **Adaptive InterviewIQ** repository! The codebase is cleanly separated into dedicated **`frontend/`** and **`backend/`** directories so all 5 team members can collaborate without code collisions or merge conflicts.

```
adaptive-interview/
├── frontend/             # 🎨 Frontend Web App (Next.js 16, React, Tailwind CSS)
│   ├── src/
│   │   ├── app/          # Pages (Landing, Setup, Dashboard, Interview, Report, Auth)
│   │   ├── components/   # UI & Workspace components
│   │   └── lib/          # Client state, storage & API client
│   ├── public/           # Static assets & icons
│   ├── .env.example      # Frontend environment template
│   └── package.json
│
├── backend/              # ⚙️ Backend API Service (Express, TypeScript, Gemini AI)
│   ├── src/
│   │   ├── routes/       # Auth & Interview endpoints
│   │   ├── services/     # Gemini AI client & PBKDF2 auth service
│   │   ├── types/        # TypeScript data contracts
│   │   └── server.ts     # Express server entry point
│   ├── .env.example      # Backend environment template
│   └── package.json
│
├── package.json          # Root workspace scripts
└── README.md             # This guide
```

---

## 👥 Team Workflows

### 🎨 1. Frontend Team (Next.js & UI)
If you are developing the user interface, interview simulation workspace, or scorecards:
```bash
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local

# Run frontend dev server (runs on http://localhost:3000)
npm run dev
```

### ⚙️ 2. Backend Team (APIs, Auth & Gemini AI)
If you are working on the Gemini AI prompts, interview engine, evaluation rubrics, or authentication:
```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run backend API server (runs on http://localhost:5000)
npm run dev
```

---

## ⚡ Root Quick Commands

From the project root, you can also run convenient workspace commands:

| Command | Action |
| :--- | :--- |
| `npm run dev:frontend` | Starts the Next.js frontend on `http://localhost:3000` |
| `npm run dev:backend` | Starts the Express backend API on `http://localhost:5000` |
| `npm run build:frontend` | Builds production bundle for frontend |
| `npm run build:backend` | Compiles backend TypeScript to `/dist` |

---

## 🔑 Environment Setup for Team

1. **Backend (`backend/.env`)**:
   ```env
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
2. **Frontend (`frontend/.env.local`)**:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
*(Get your free Google Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)).*

---

## 🧪 Demo Test Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Recruiter** | `recruiter@interviewiq.ai` | `Password123` |
| **Candidate** | `candidate@interviewiq.ai` | `Password123` |
