import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "./routes/auth";
import interviewRoutes from "./routes/interview";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Middleware
app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/interview", interviewRoutes);

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "InterviewIQ Backend API",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 [InterviewIQ Backend] running on http://localhost:${PORT}`);
  console.log(`🌐 [CORS] Allowed frontend origin: ${FRONTEND_URL}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn(`⚠️ [Warning] GEMINI_API_KEY is not set in backend environment.`);
  }
});
