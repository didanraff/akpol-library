import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { createLibraryApp } from './src/server/app.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const { app, runMaintenanceTick } = createLibraryApp();

  // Periodic background due-date monitor & automated reporting scheduler (every 30s)
  const schedulerInterval = setInterval(() => {
    runMaintenanceTick().catch((err) => {
      console.error('Background scheduler error:', err);
    });
  }, 30_000);
  schedulerInterval.unref();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Akpol Library server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
