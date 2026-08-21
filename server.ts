import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import rateLimit from "express-rate-limit";

const app = express();
app.set("trust proxy", 1);
const PORT = 3000;

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;

if (getApps().length === 0) {
  initializeApp({
    projectId: projectId || undefined,
  });
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing token" });
    return;
  }
  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    res.status(401).json({ error: "Unauthorized: empty token" });
    return;
  }
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.error("[requireAuth] Token verification failed:", err?.message || err);
    res.status(401).json({ 
      error: "Unauthorized: invalid token", 
      details: err?.message || "Token verification failed on server" 
    });
  }
}

const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
  validate: { xForwardedForHeader: false },
});

app.use(express.json({ limit: "10mb" }));

// Lazy GoogleGenAI client initialization helper
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// System instructions for Austin Batam project tracking console
const SYSTEM_INSTRUCTION = `You are the AI Project Intelligence Assistant for Austin Batam (Industrial Equipment & Steel Fabrication Contractor).
Your role is to analyze project schedules, budget hours compliance, worker productivity (welders, fitters, machinists), materials inventory, field issues (Focus 24 problem reports), and QC inspection requests.
Provide concise, professional, actionable, and structured operational advice.
Format your responses using clean Markdown with bold bullet points, risk ratings (CRITICAL, WARNING, SAFE), and concrete recommendations.`;

// ---------------------------------------------------------------------------
// API ROUTES
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Endpoint: AI Center Chat Q&A
app.post("/api/gemini/chat", geminiLimiter, requireAuth, async (req, res) => {
  try {
    const { prompt, context } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required." });
      return;
    }

    const ai = getGeminiClient();

    const fullPrompt = `Context Data from Austin Batam System:
${JSON.stringify(context || {}, null, 2)}

User Question:
${prompt}

Instructions: Analyze the system context above and give a direct, highly accurate, site-operational answer addressing the user's question. Reference specific project names, client names, employee names, material stock numbers, or work orders where appropriate.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: fullPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });

    const replyText = response.text || "Unable to generate AI analysis at this time.";

    res.json({ text: replyText });
  } catch (err: any) {
    console.error("Gemini Chat API Error:", err);
    res.status(500).json({
      error: "Gemini API error",
      details: err?.message || String(err),
    });
  }
});

// Endpoint: AI Project Risk & Timeline Analysis
app.post("/api/gemini/analyze-project", geminiLimiter, requireAuth, async (req, res) => {
  try {
    const { project, timesheets, problemReports, materials } = req.body;

    if (!project) {
      res.status(400).json({ error: "Project data is required." });
      return;
    }

    const ai = getGeminiClient();

    const prompt = `Analyze this project for Austin Batam operational risks:
Project Details: ${JSON.stringify(project)}
Related Timesheet Logs: ${JSON.stringify(timesheets || [])}
Open Problem Reports: ${JSON.stringify(problemReports || [])}
Materials Inventory Status: ${JSON.stringify(materials || [])}

Perform an AI Audit covering:
1. Schedule & Completion Risk Assessment
2. Budgeted Hours vs Logged Hours Compliance
3. On-Site Bottlenecks & Critical Field Concerns
4. 3 Actionable Recommendations for Site Managers`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    res.json({ analysis: response.text || "No analysis generated." });
  } catch (err: any) {
    console.error("Gemini Project Audit Error:", err);
    res.status(500).json({
      error: "Gemini API error",
      details: err?.message || String(err),
    });
  }
});

// Endpoint: Executive Site Daily Report AI Generator
app.post("/api/gemini/generate-report", geminiLimiter, requireAuth, async (req, res) => {
  try {
    const { date, summaryData } = req.body;

    const ai = getGeminiClient();

    const prompt = `Generate an Executive Site Daily Operations Summary for date ${date || "Today"}.
Summary Metrics: ${JSON.stringify(summaryData || {})}

Include:
- Executive Summary
- Key Accomplishments & Assemblies Progress
- Workforce Efficiency & Manpower Allocation
- Critical Risks & Outstanding Field Issues
- Key Objectives for Next Shift`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.3,
      },
    });

    res.json({ report: response.text || "Report generation failed." });
  } catch (err: any) {
    console.error("Gemini Report Generation Error:", err);
    res.status(500).json({
      error: "Gemini API error",
      details: err?.message || String(err),
    });
  }
});

// ---------------------------------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ---------------------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
