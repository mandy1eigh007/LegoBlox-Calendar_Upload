import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { suggestSchedule } from "../predictive/solver";

type ToPlaceItem = { templateId: string | null; durationMinutes: number; count?: number };
type PartnerSlot = { id: string; date: string; startMinutes: number; durationMinutes: number; title?: string };
type PartnerResponse = {
  id: string;
  slotId: string;
  name: string;
  org: string;
  email: string;
  phone: string;
  notes: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt: string;
};
type PartnerRequest = {
  id: string;
  planId: string;
  planName: string;
  code: string;
  createdAt: string;
  slots: PartnerSlot[];
  responses: PartnerResponse[];
};

const PARTNER_AVAILABILITY_PATH = './server/data/partner-availability.json';

function loadPartnerAvailability(): Record<string, PartnerRequest> {
  const fs = require('fs');
  if (!fs.existsSync(PARTNER_AVAILABILITY_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(PARTNER_AVAILABILITY_PATH, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function savePartnerAvailability(data: Record<string, PartnerRequest>) {
  const fs = require('fs');
  const dir = './server/data';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PARTNER_AVAILABILITY_PATH, JSON.stringify(data, null, 2), 'utf8');
}

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
      const { toPlace, week, existingBlocks, dayStartMinutes, dayEndMinutes, slotMinutes, templateTitlesById, activeDays } = req.body as {
        toPlace: ToPlaceItem[];
        week?: number;
        existingBlocks?: any[];
        dayStartMinutes?: number;
        dayEndMinutes?: number;
        slotMinutes?: number;
        templateTitlesById?: Record<string, string>;
        activeDays?: string[];
      };

      const wk = week || 1;
      const ds = dayStartMinutes || 390;
      const de = dayEndMinutes || 930;
      const sm = slotMinutes || 15;

      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const allowedDays = Array.isArray(activeDays)
        ? activeDays.map(day => dayOrder.indexOf(day)).filter(idx => idx >= 0)
        : undefined;

      const result = suggestSchedule(
        toPlace || [],
        undefined,
        existingBlocks || [],
        wk,
        ds,
        de,
        sm,
        templateTitlesById,
        allowedDays
      );
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

  app.post('/api/partner-availability', async (req, res) => {
    try {
      const { planId, planName, code, slots } = req.body as {
        planId: string;
        planName: string;
        code: string;
        slots: PartnerSlot[];
      };
      if (!planId || !code || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ message: 'invalid payload' });
      }

      const store = loadPartnerAvailability();
      const id = `pa_${Date.now().toString(36)}`;
      const createdAt = new Date().toISOString();
      store[id] = {
        id,
        planId,
        planName: planName || '',
        code,
        createdAt,
        slots,
        responses: [],
      };
      savePartnerAvailability(store);
      res.json({ id, createdAt });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'partner availability error' });
    }
  });

  app.get('/api/partner-availability/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const code = (req.query.code as string) || '';
      const store = loadPartnerAvailability();
      const request = store[id];
      if (!request) return res.status(404).json({ message: 'not found' });
      if (request.code !== code) return res.status(403).json({ message: 'invalid code' });
      res.json({
        id: request.id,
        planName: request.planName,
        createdAt: request.createdAt,
        slots: request.slots,
      });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'partner availability error' });
    }
  });

  app.post('/api/partner-availability/:id/respond', async (req, res) => {
    try {
      const id = req.params.id;
      const { code, slotId, name, org, email, phone, notes } = req.body as {
        code: string;
        slotId: string;
        name: string;
        org: string;
        email: string;
        phone: string;
        notes: string;
      };
      if (!code || !slotId || !name || !org || !email || !phone) {
        return res.status(400).json({ message: 'missing fields' });
      }
      const store = loadPartnerAvailability();
      const request = store[id];
      if (!request) return res.status(404).json({ message: 'not found' });
      if (request.code !== code) return res.status(403).json({ message: 'invalid code' });

      const response: PartnerResponse = {
        id: `resp_${Date.now().toString(36)}`,
        slotId,
        name,
        org,
        email,
        phone,
        notes: notes || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      request.responses.push(response);
      savePartnerAvailability(store);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'partner availability error' });
    }
  });

  app.get('/api/partner-availability/:id/responses', async (req, res) => {
    try {
      const id = req.params.id;
      const code = (req.query.code as string) || '';
      const store = loadPartnerAvailability();
      const request = store[id];
      if (!request) return res.status(404).json({ message: 'not found' });
      if (request.code !== code) return res.status(403).json({ message: 'invalid code' });
      res.json({ responses: request.responses, slots: request.slots, planId: request.planId, planName: request.planName });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'partner availability error' });
    }
  });

  app.post('/api/partner-availability/:id/approve', async (req, res) => {
    try {
      const id = req.params.id;
      const { code, responseId } = req.body as { code: string; responseId: string };
      if (!code || !responseId) return res.status(400).json({ message: 'missing fields' });
      const store = loadPartnerAvailability();
      const request = store[id];
      if (!request) return res.status(404).json({ message: 'not found' });
      if (request.code !== code) return res.status(403).json({ message: 'invalid code' });

      const response = request.responses.find(r => r.id === responseId);
      if (!response) return res.status(404).json({ message: 'response not found' });
      response.status = 'approved';
      savePartnerAvailability(store);
      res.json({ ok: true, response, slot: request.slots.find(s => s.id === response.slotId) });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'partner availability error' });
    }
  });

  // Publish a plan: client sends plan + templates, server stores by slug
  app.post('/api/plans/:planId/publish', async (req, res) => {
    try {
      const planId = req.params.planId;
      const body = req.body;
      if (!body || !body.plan) return res.status(400).json({ message: 'missing plan payload' });

      const plan = body.plan;
      const templates = Array.isArray(body.templates) ? body.templates : [];
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

      store[slug] = { plan, templates, updatedAt: new Date().toISOString() };
      fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');

      res.json({ slug });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'publish error' });
    }
  });

  app.post('/api/plans/:planId/unpublish', async (req, res) => {
    try {
      const planId = req.params.planId;
      const body = req.body || {};
      const slug = body.publicId || planId;

      const filePath = './server/data/published.json';
      const fs = require('fs');
      if (!fs.existsSync(filePath)) return res.json({ removed: false });

      let store: Record<string, any> = {};
      try { store = JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}'); } catch (e) { store = {}; }

      if (store[slug]) {
        delete store[slug];
        fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8');
        return res.json({ removed: true });
      }

      return res.json({ removed: false });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'unpublish error' });
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
      const entry = store[slug];
      if (entry?.plan) {
        return res.json({ plan: entry.plan, templates: entry.templates || [] });
      }
      // Backward compatibility: entry is the plan itself
      return res.json({ plan: entry, templates: [] });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || 'error' });
    }
  });

  return httpServer;
}
