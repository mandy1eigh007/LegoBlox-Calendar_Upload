import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { suggestSchedule } from "../predictive/solver";

type ToPlaceItem = { templateId: string | null; durationMinutes: number; count?: number };

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  app.post('/api/predictive/solve', async (req, res) => {
    try {
      const { toPlace, week, existingBlocks, dayStartMinutes, dayEndMinutes, slotMinutes } = req.body as {
        toPlace: ToPlaceItem[];
        week?: number;
        existingBlocks?: any[];
        dayStartMinutes?: number;
        dayEndMinutes?: number;
        slotMinutes?: number;
      };

      const wk = week || 1;
      const ds = dayStartMinutes || 390;
      const de = dayEndMinutes || 930;
      const sm = slotMinutes || 15;

      const result = suggestSchedule(toPlace || [], undefined, existingBlocks || [], wk, ds, de, sm);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'predictive error' });
    }
  });

  app.get('/api/predictive/models', async (_req, res) => {
    try {
      const modelsPath = './predictive/template-models.json';
      if (!require('fs').existsSync(modelsPath)) {
        return res.status(404).json({ message: 'models not found' });
      }
      const raw = require('fs').readFileSync(modelsPath, 'utf8');
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'error' });
    }
  });

  return httpServer;
}
