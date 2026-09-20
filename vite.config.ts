import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function geminiExtractorPlugin(): Plugin {
  return {
    name: 'gemini-extractor-middleware',
    configureServer(server) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (
          (url === '/api/extract-letter' || url === '/.netlify/functions/extract-letter') &&
          req.method === 'POST'
        ) {
          try {
            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { extractLetterFromDocument } = await import('./server/geminiExtractor');
                const payload = JSON.parse(body);
                const result = await extractLetterFromDocument(payload);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = result.success ? 200 : 500;
                res.end(JSON.stringify(result));
              } catch (parseOrExecErr: any) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    success: false,
                    error: parseOrExecErr.message || 'Gagal memproses dokumen.',
                  })
                );
              }
            });
          } catch (err: any) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiExtractorPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
