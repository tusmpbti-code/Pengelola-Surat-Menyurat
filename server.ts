import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  extractLetterFromDocument,
  checkGeminiConfigured,
  ExtractionRequest,
} from './server/geminiExtractor';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable generous payload limits for base64 scanned documents & high-res camera photos
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 1. Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. AI engine configuration & readiness status endpoint
  app.get('/api/ai-status', (_req, res) => {
    const status = checkGeminiConfigured();
    res.json({
      ...status,
      activeModel: 'gemini-3.8-flash',
      promptVersion: 'v1.0-sipas-bti',
    });
  });

  // 3. Document AI Extraction endpoint (handles both standard and Netlify fallback paths)
  const handleExtractLetter: express.RequestHandler = async (req, res) => {
    try {
      const payload = req.body as ExtractionRequest;
      if (!payload || !payload.fileBase64) {
        res.status(400).json({
          success: false,
          error: 'Berkas dokumen belum dipilih atau data berkas tidak terbaca.',
        });
        return;
      }

      console.log(
        `[Server] Processing letter extraction for: "${payload.fileName || 'dokumen'}" (${payload.mimeType || 'unknown'})`
      );

      const result = await extractLetterFromDocument(payload);

      // Return 200 with result payload so client gets clean structured JSON
      res.status(200).json(result);
    } catch (err: any) {
      console.error('[Server] Unexpected error in /api/extract-letter:', err);
      res.status(200).json({
        success: false,
        error:
          err?.message ||
          'Terjadi kendala saat memproses dokumen di server. Silakan gunakan Input Manual.',
        modelName: 'gemini-3.8-flash',
        promptVersion: 'v1.0-sipas-bti',
      });
    }
  };

  app.post('/api/extract-letter', handleExtractLetter);
  app.post('/.netlify/functions/extract-letter', handleExtractLetter);

  // 4. Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[Server Error]:', err);
      if (err?.type === 'entity.too.large') {
        res.status(413).json({
          success: false,
          error:
            'Ukuran berkas melebihi batas server (maksimal 50 MB). Silakan gunakan gambar atau PDF yang lebih kecil.',
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: err?.message || 'Terjadi kesalahan internal pada server.',
      });
    }
  );

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] SIPAS BTI Full-stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
