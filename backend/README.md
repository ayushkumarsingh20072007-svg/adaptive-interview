# InterviewIQ — Backend API Service

Express & TypeScript API backend powering adaptive questions, live answer evaluation, candidate session management, and Gemini AI synthesis.

---

## 🚀 Quick Start for Backend Developers

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Google Gemini API key:
```env
PORT=5000
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a candidate or recruiter account
- `POST /api/auth/login` — Sign in with email and password
- `POST /api/auth/logout` — Clear session cookie
- `GET /api/auth/me` — Get currently logged-in user profile
- `POST /api/auth/demo-login` — Quick sign-in as demo candidate/recruiter

### 🤖 Interview Engine (`/api/interview`)
- `POST /api/interview/generate-question` — Generate initial question tailored to candidate role & seniority
- `POST /api/interview/evaluate-answer` — Evaluate candidate's answer with Gemini AI rubric
- `POST /api/interview/next-question` — Adaptive branching question based on past score & gaps
- `POST /api/interview/generate-report` — Synthesize evidence-backed final report

### 🩺 Health Check
- `GET /api/health` — Check server status & Gemini configuration
