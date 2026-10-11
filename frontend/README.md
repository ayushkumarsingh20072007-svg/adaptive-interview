# InterviewIQ — Frontend Application

Next.js 16 & React web application providing an adaptive AI technical interview experience, candidate calibration, live interview workspace, and scorecard analytics.

---

## 🚀 Quick Start for Frontend Developers

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Optionally specify backend API URL (defaults to Next.js routes or local backend):
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Key Frontend Directories

- `src/app/` — Application pages (landing, `/setup`, `/dashboard`, `/interview/[id]`, `/report/[id]`, `/login`, `/signup`)
- `src/components/interview/` — Live interview workspace and interactive question responder
- `src/components/report/` — Comprehensive evaluation report views
- `src/components/layout/` — Navbar and footer with responsive auth indicators
- `src/components/ui/` — Design system primitives (buttons, modals, badges, cards, progress bars)
- `src/lib/` — Auth context, AI client, local session storage, and data contracts
