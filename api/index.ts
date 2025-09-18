// Vercel serverless function entry point
import { createApp } from '../server/createApp';
import { registerRoutes } from '../server/routes';

const app = createApp();
await registerRoutes(app);

export default app;