import express from "express";
import { registerRoutes } from '../server/routes';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

registerRoutes(app);

export default app;
