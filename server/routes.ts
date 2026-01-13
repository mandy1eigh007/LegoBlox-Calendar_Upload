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

  // Publish a plan: client sends full plan JSON, server stores it by slug (use plan.publicId or generated)
  app.post('/api/plans/:planId/publish', async (req, res) => {
    try {
      const planId = req.params.planId;
      const body = req.body;
      if (!body || !body.plan) return res.status(400).json({ message: 'missing plan payload' });

      const plan = body.plan;
      // slug: prefer provided publicId, fallback to planId
      const slug = plan.publicId || planId;

      const dataDir = './server/data';
      const filePath = `${dataDir}/published.json`;
      const fs = require('fs');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

      let store: Record<string, any> = {};
      if (fs.existsSync(filePath)) {
        try { store = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}'); } catch (e) { store = {}; }
      }

      store[slug] = { plan, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');

      res.json({ slug });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'publish error' });
    }
  });

  app.get('/api/published/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const filePath = './server/data/published.json';
      const fs = require('fs');
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'not found' });
      const store = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}');
      if (!store[slug]) return res.status(404).json({ message: 'not found' });
      res.json(store[slug].plan);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'error' });
    }
  });

  return httpServer;
}
