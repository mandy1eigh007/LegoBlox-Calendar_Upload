export interface Resource {
  id: string;
  name: string;
  type: 'room' | 'shop' | 'offsite' | 'other';
}

export interface ResourceConfig {
  resources: Resource[];
  version: number;
}

const STORAGE_KEY = 'cohort-schedule-resources';

const DEFAULT_RESOURCES: Resource[] = [
  { id: 'CLASSROOM_1', name: 'Classroom 1', type: 'room' },
  { id: 'CLASSROOM_2', name: 'Classroom 2', type: 'room' },
  { id: 'SHOP', name: 'Shop', type: 'shop' },
  { id: 'OFFSITE', name: 'Offsite', type: 'offsite' },
  { id: 'ANY', name: 'Any / Flexible', type: 'other' },
];

export function loadResources(): ResourceConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load resources, using defaults');
  }
  return { resources: DEFAULT_RESOURCES, version: 1 };
}

export function saveResources(config: ResourceConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function addResource(resource: Resource): void {
  const config = loadResources();
  const existingIndex = config.resources.findIndex(r => r.id === resource.id);
  
  if (existingIndex >= 0) {
    config.resources[existingIndex] = resource;
  } else {
    config.resources.push(resource);
  }
  
  saveResources(config);
}

export function removeResource(resourceId: string): void {
  const config = loadResources();
  config.resources = config.resources.filter(r => r.id !== resourceId);
  saveResources(config);
}

export function parseResourceCSV(csvContent: string): Resource[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  const resources: Resource[] = [];
  
  const headerLine = lines[0]?.toLowerCase();
  if (!headerLine?.includes('resource_id') && !headerLine?.includes('resourceid')) {
    return [];
  }
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    if (parts.length >= 2) {
      const id = parts[0];
      const name = parts[1];
      const type = (parts[2] as Resource['type']) || 'other';
      
      if (id && name) {
        resources.push({ id, name, type });
      }
    }
  }
  
  return resources;
}

export function importResourceCSV(csvContent: string): number {
  const newResources = parseResourceCSV(csvContent);
  if (newResources.length === 0) return 0;
  
  const config = loadResources();
  
  for (const resource of newResources) {
    const existingIndex = config.resources.findIndex(r => r.id === resource.id);
    
    if (existingIndex >= 0) {
      config.resources[existingIndex] = resource;
    } else {
      config.resources.push(resource);
    }
  }
  
  saveResources(config);
  return newResources.length;
}

export function exportResourceCSV(): string {
  const config = loadResources();
  const lines = ['resource_id,name,type'];
  
  for (const resource of config.resources) {
    lines.push(`"${resource.id}","${resource.name}","${resource.type}"`);
  }
  
  return lines.join('\n');
}

export interface SlotOccupancy {
  date: string;
  slot: number;
  resourceId: string;
  eventId: string;
  planId: string;
}

export function detectResourceCollisions(
  occupancyA: SlotOccupancy[],
  occupancyB: SlotOccupancy[]
): { dateSlot: string; resourceId: string; eventIdA: string; eventIdB: string }[] {
  const collisions: { dateSlot: string; resourceId: string; eventIdA: string; eventIdB: string }[] = [];
  
  const mapA = new Map<string, SlotOccupancy>();
  for (const occ of occupancyA) {
    const key = `${occ.date}-${occ.slot}-${occ.resourceId}`;
    mapA.set(key, occ);
  }
  
  for (const occ of occupancyB) {
    if (occ.resourceId === 'ANY' || occ.resourceId === '') continue;
    
    const key = `${occ.date}-${occ.slot}-${occ.resourceId}`;
    const conflicting = mapA.get(key);
    
    if (conflicting && conflicting.resourceId !== 'ANY') {
      collisions.push({
        dateSlot: `${occ.date} slot ${occ.slot}`,
        resourceId: occ.resourceId,
        eventIdA: conflicting.eventId,
        eventIdB: occ.eventId,
      });
    }
  }
  
  return collisions;
}

export function suggestAlternativeResource(
  date: string,
  slot: number,
  duration: number,
  preferredResource: string,
  allowedResources: string[],
  occupiedSlots: Map<string, Set<number>>
): string | null {
  for (const resourceId of allowedResources) {
    if (resourceId === preferredResource) continue;
    
    const occupiedForResource = occupiedSlots.get(resourceId) || new Set();
    let available = true;
    
    for (let s = slot; s < slot + duration; s++) {
      if (occupiedForResource.has(s)) {
        available = false;
        break;
      }
    }
    
    if (available) return resourceId;
  }
  
  return null;
}
