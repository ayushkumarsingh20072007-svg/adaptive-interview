# InterviewIQ — Adaptive Technical Interview Simulation Platform

An intelligent, full-stack AI-driven technical interview platform built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, and **Google Gemini API**.

---

## 🚀 Key Features

- **Live Adaptive Technical Interviews**: Dynamic multi-branch questioning tailored to candidate target role, seniority level, and focus area.
- **Real-Time Gemini AI Evaluation**: Rubric-based scoring on technical correctness, conceptual depth, trade-off awareness, and communication clarity.
- **Resume Ingestion & Verification**: Drag-and-drop resume upload (.pdf, .docx, .txt) with an in-browser preview modal to ensure the right resume is submitted before starting.
- **Comprehensive Scorecards & Reports**: Detailed evidence-backed analytics with direct quote citations, competency radar breakdowns, and customized study roadmaps.
- **Recruiter Pipeline**: Dedicated recruiter dashboard tab with status management (Shortlisted, Under Review, Pending, Rejected) and candidate filtering.
- **Authentication & Multi-Session**: Secure candidate and recruiter portal with PBKDF2 password hashing, HTTP-only session cookies, and quick logout across all views.

---

## 👥 Getting Started (Team Guide)

### 1. Clone the Repository
```bash
git clone https://github.com/ayushkumarsingh20072007-svg/adaptive-interview.git
cd adaptive-interview
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Copy the template environment file:
```bash
cp .env.example .env.local
```
Then open `.env.local` and insert your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(You can obtain a free key from [Google AI Studio](https://aistudio.google.com/app/apikey)).*

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Accounts for Quick Testing

You can use these pre-configured accounts or sign up for a new account on the `/signup` page:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Recruiter** | `recruiter@interviewiq.ai` | `Password123` |
| **Candidate** | `candidate@interviewiq.ai` | `Password123` |

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Vanilla Design System
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Icons**: Lucide React
- **Security**: PBKDF2 salted hash password verification & HTTP-only cookies

---

## 📁 Project Architecture

```
interview/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Login, Register, Logout, Me endpoints
│   │   │   └── interview/     # Generate Question, Evaluate Answer, Next Question
│   │   ├── dashboard/         # Command center, history, analytics, recruiter pipeline
│   │   ├── interview/[id]/    # Live interview simulation workspace
│   │   ├── login/             # Candidate & Recruiter sign-in
│   │   ├── signup/            # Account registration
│   │   ├── setup/             # Interview calibration & resume verification
│   │   └── report/[id]/       # Comprehensive audit scorecard
│   ├── components/
│   │   ├── interview/         # Live question workspace & editor
│   │   ├── layout/            # Navbar, footer
│   │   ├── report/            # Evaluation report view
│   │   └── ui/                # Reusable UI primitives (modal, badge, button, card)
│   └── lib/
│       ├── ai-client.ts       # Frontend client for AI routes
│       ├── auth-context.tsx   # React auth context & hook
│       ├── gemini.ts          # Server-side Gemini API client
│       ├── mock-data.ts       # Curated question banks & demo reports
│       ├── storage.ts         # Local session persistence
│       └── types.ts           # Core TypeScript data contracts
```
