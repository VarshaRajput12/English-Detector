import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors()); // dev: allow all origins
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY || "";
if (!API_KEY) console.warn("GEMINI_API_KEY not set in .env");

// --- Move API routes BEFORE static/catch-all to avoid them being shadowed ---
app.post("/api/analyze-language", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "missing text" });
    }

    const prompt = `
      You are given a transcript. Count how many words are English words and compute the percent of words that are English.
      Return ONLY a JSON object with a single key "percent" whose value is a number (0-100). No extra text.

      Transcript:
      """${text.replace(/\"\"\"/g, '"')}"""
      `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
    console.log("🧠 Gemini request URL:", url);
    console.log("🔑 API key prefix:", API_KEY?.slice(0, 10));

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: { temperature: 0 },
    };

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": `${API_KEY}` },
      body: JSON.stringify(body),
    });

    console.log("🧠 Gemini response status:", r.status);
    if (!r.ok) {
      const err = await r.text();
      console.error("Gemini error:", err);
      return res.status(502).json({ error: "upstream_error", details: err });
    }

    const json = await r.json();
    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("🧠 Gemini response text (truncated):", String(textOut).slice(0, 500));

    const m =
      textOut.match(/"percent"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      textOut.match(/([0-9]+(?:\.[0-9]+)?)\s*%/) ||
      textOut.match(/([0-9]+(?:\.[0-9]+)?)/);

    if (!m) return res.status(500).json({ error: "could_not_parse", raw: textOut });

    let percent = parseFloat(m[1]);
    percent = Math.max(0, Math.min(100, percent));
    res.json({ percent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error", details: String(err) });
  }
});

// Serve frontend build (after API routes)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "dist"))); // Vite build folder

// Use middleware fallback instead of wildcard routes that break path-to-regexp
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server (ESM) listening on ${PORT}`);
});
