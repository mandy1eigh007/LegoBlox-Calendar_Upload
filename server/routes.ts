import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fs from "fs";
import path from "path";

const PUBLISHED_FILE = path.join(__dirname, "../server/data/published.json");

// Ensure the data directory and file exist
function ensurePublishedFile() {
  const dir = path.dirname(PUBLISHED_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(PUBLISHED_FILE)) {
    fs.writeFileSync(PUBLISHED_FILE, "{}");
  }
}

// Read published plans from disk
function readPublishedPlans(): Record<string, any> {
  ensurePublishedFile();
  try {
    const content = fs.readFileSync(PUBLISHED_FILE, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading published.json:", error);
    return {};
  }
}

// Write published plans to disk
function writePublishedPlans(data: Record<string, any>) {
  ensurePublishedFile();
  try {
    fs.writeFileSync(PUBLISHED_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing published.json:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Publish a plan (store server-side for cross-device access)
  app.post("/api/plans/:planId/publish", (req, res) => {
    try {
      const { planId } = req.params;
      const planData = req.body;
      
      if (!planData || !planData.slug) {
        return res.status(400).json({ error: "Plan data and slug required" });
      }
      
      const published = readPublishedPlans();
      const slug = planData.slug;
      
      // Store or update the published plan
      published[slug] = {
        planId,
        plan: planData.plan,
        publishedAt: new Date().toISOString(),
      };
      
      writePublishedPlans(published);
      
      res.json({ slug, success: true });
    } catch (error) {
      console.error("Error publishing plan:", error);
      res.status(500).json({ error: "Failed to publish plan" });
    }
  });
  
  // Get a published plan by slug
  app.get("/api/published/:slug", (req, res) => {
    try {
      const { slug } = req.params;
      const published = readPublishedPlans();
      
      if (!published[slug]) {
        return res.status(404).json({ error: "Published plan not found" });
      }
      
      res.json(published[slug]);
    } catch (error) {
      console.error("Error fetching published plan:", error);
      res.status(500).json({ error: "Failed to fetch published plan" });
    }
  });
  
  // Unpublish a plan
  app.delete("/api/published/:slug", (req, res) => {
    try {
      const { slug } = req.params;
      const published = readPublishedPlans();
      
      if (!published[slug]) {
        return res.status(404).json({ error: "Published plan not found" });
      }
      
      delete published[slug];
      writePublishedPlans(published);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error unpublishing plan:", error);
      res.status(500).json({ error: "Failed to unpublish plan" });
    }
  });

  return httpServer;
}
