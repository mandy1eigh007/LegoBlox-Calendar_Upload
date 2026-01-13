const STORAGE_KEY = 'cohort-schedule-manual-assignments';

export interface ManualAssignment {
  normalizedTitle: string;
  templateId: string;
  assignedAt: number;
}

export interface AssignmentStore {
  assignments: Record<string, ManualAssignment>;
  version: number;
}

function normalizeForStorage(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function loadAssignments(): AssignmentStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    console.warn('Failed to load manual assignments');
  }
  return { assignments: {}, version: 1 };
}

export function saveAssignments(store: AssignmentStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function recordAssignment(title: string, templateId: string): void {
  const store = loadAssignments();
  const normalizedTitle = normalizeForStorage(title);
  
  store.assignments[normalizedTitle] = {
    normalizedTitle,
    templateId,
    assignedAt: Date.now(),
  };
  
  saveAssignments(store);
}

export function getPersistedTemplateId(title: string): string | null {
  const store = loadAssignments();
  const normalizedTitle = normalizeForStorage(title);
  return store.assignments[normalizedTitle]?.templateId || null;
}

export function clearAssignment(title: string): void {
  const store = loadAssignments();
  const normalizedTitle = normalizeForStorage(title);
  delete store.assignments[normalizedTitle];
  saveAssignments(store);
}

export function getAssignmentCount(): number {
  const store = loadAssignments();
  return Object.keys(store.assignments).length;
}

export function exportAssignmentsCSV(): string {
  const store = loadAssignments();
  const lines = ['normalized_title,template_id,assigned_at'];
  
  for (const assignment of Object.values(store.assignments)) {
    lines.push(`"${assignment.normalizedTitle}","${assignment.templateId}","${new Date(assignment.assignedAt).toISOString()}"`);
  }
  
  return lines.join('\n');
}

export function findSimilarBlocks(
  blocks: { id: string; displayTitle: string; templateId: string | null }[],
  sourceTitle: string,
  targetTemplateId: string
): string[] {
  const normalizedSource = normalizeForStorage(sourceTitle);
  const matchingIds: string[] = [];
  
  for (const block of blocks) {
    const normalizedBlock = normalizeForStorage(block.displayTitle);
    if (normalizedBlock === normalizedSource && block.templateId !== targetTemplateId) {
      matchingIds.push(block.id);
    }
  }
  
  return matchingIds;
}

export function applyToAllSimilarTitles(
  blocks: { id: string; displayTitle: string; templateId: string | null }[],
  sourceTitle: string,
  targetTemplateId: string
): string[] {
  const matchingIds = findSimilarBlocks(blocks, sourceTitle, targetTemplateId);
  recordAssignment(sourceTitle, targetTemplateId);
  return matchingIds;
}
