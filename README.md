# Adaptive InterviewIQ — Architecture & Quick Start Guide

InterviewIQ is an adaptive AI technical interviewing platform featuring dynamic question generation, live voice and code evaluation, integrity & proctoring monitoring, and evidence-backed candidate scorecards for recruiters.

---

## 🏛️ System Architecture

The project has established **Next.js App Router (Port 3000) + Prisma (SQLite)** as its **canonical production architecture**:

```
adaptive-interview/
├── frontend/             # 🚀 CANONICAL FULL-STACK APPLICATION (Port 3000)
│   ├── src/
│   │   ├── app/          # Pages & Server API Routes (Next.js 16 App Router)
│   │   │   ├── api/auth/          # Canonical Authentication (PBKDF2-SHA512 + SQLite)
│   │   │   ├── api/interview/     # Canonical Interview & Adaptive Engine
│   │   │   └── api/ai-assistant/  # AI Coach Endpoint
│   │   ├── components/   # Interactive Workspace, Voice & Proctoring UI
│   │   └── lib/          # Prisma client, Gemini client, & persistence services
│   ├── prisma/           # Canonical SQLite Database Schema (schema.prisma)
│   └── package.json
│
├── backend/              # 📦 PARALLEL / LEGACY SERVICE (Port 5000)
│   │                     # Note: Preserved for modular backend reference;
│   │                     # actual frontend application traffic is served directly
│   │                     # by the Next.js API routes above.
│   ├── src/
│   │   ├── routes/       # Express route handlers
│   │   ├── services/     # Flat-file JSON auth & Gemini service
│   │   └── server.ts     # Express server entry point
│   └── package.json
│
├── package.json          # Root monorepo workspace scripts
└── README.md             # This architecture documentation
```

### Why Next.js App Router + Prisma SQLite is Canonical
1. **Single Source of Truth:** All user accounts, active interview sessions, answer evaluations, integrity events, and recruiter reviews are stored in Prisma SQLite (`frontend/prisma/dev.db`).
2. **Unified Route Protection:** Server-side route guarding and HTTP-only cookie validation are enforced via Next.js proxy middleware (`frontend/src/proxy.ts`).
3. **Direct Server-Side Gemini Integration:** All Gemini AI calls are handled securely server-side inside Next.js API routes without exposing API keys to the browser.
4. **Current Status of `backend/`:** The Express backend (`backend/src/server.ts`, port 5000) is maintained as a parallel standalone implementation for decoupled microservice reference. It is **not** deleted and remains runnable via `npm run dev:backend`.

---

## ⚡ Quick Start (Canonical Application)

### 1. Install Dependencies
From the repository root:
```bash
npm run install:all
```
*(Or navigate to `frontend/` and run `npm install`).*

### 2. Configure Environment
Set up the frontend environment (`frontend/.env.local`):
```bash
# In frontend/.env.local:
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL="file:./dev.db"
```
*(Get a Google Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)).*

### 3. Start Application
```bash
# Starts canonical Next.js application on http://localhost:3000
npm run dev
# or
npm run dev:frontend
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🛠️ Monorepo Workspace Commands

| Command | Target | Description |
| :--- | :--- | :--- |
| `npm run dev` | Frontend (`:3000`) | Launches the canonical Next.js fullstack application |
| `npm run dev:frontend` | Frontend (`:3000`) | Explicit command to run the canonical Next.js app |
| `npm run dev:backend` | Backend (`:5000`) | Runs the parallel Express API service (legacy/reference) |
| `npm run build:frontend` | Frontend | Builds the production Next.js bundle |
| `npm run build:backend` | Backend | Compiles the Express TypeScript service to `dist/` |

---

## 🧪 Built-in Demo Test Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **Recruiter** | `recruiter@interviewiq.ai` | `Password123` |
| **Candidate** | `alex.rivera@example.com` | `Password123` |
| **Candidate (Backend)** | `liam.chen@example.com` | `Password123` |
| **Candidate (Frontend)** | `maya.patel@example.com` | `Password123` |
