import express from "express";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Dynamic import to avoid path issues
const { registerRoutes } = await import('../server/routes.ts');
await registerRoutes(app);

export default app;
