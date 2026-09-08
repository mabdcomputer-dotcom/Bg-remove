import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // Initialize Gemini AI client server-side
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // 1. Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  // 2. AI Studio Assistant & Backdrop Recommendation Endpoint
  app.post('/api/ai/recommend-backdrop', async (req, res) => {
    try {
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API is not configured on the server.',
        });
      }

      const { photoType = 'portrait', purpose = 'passport' } = req.body;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Recommend the best background colors, lighting settings, and official passport/visa standards for a ${photoType} photo meant for "${purpose}".
Provide a concise JSON object with:
- "recommendedColor": hex code (e.g. "#00a3e0" for BD passport cyan, "#004c8c" for deep blue, or "#ffffff" for US/white visa)
- "colorName": name in English and Bengali
- "reason": 1-2 sentence why this color matches official standards
- "cropPreset": "7:9" or "1:1" or "3:4"
- "tips": 2 short tips for portrait lighting or dress contrast`,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      res.json(JSON.parse(text));
    } catch (err: any) {
      console.error('Gemini error:', err);
      res.status(500).json({ error: err.message || 'Failed to generate recommendation' });
    }
  });

  // Vite middleware for dev or static serving for prod
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Photo Background Remover server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
