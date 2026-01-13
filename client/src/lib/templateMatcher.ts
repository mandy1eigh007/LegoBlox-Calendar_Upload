import { BlockTemplate } from '@/state/types';

export interface TemplateMatchResult {
  templateId: string | null;
  matchedBy: 'exact' | 'alias' | 'fuzzy' | 'none';
  confidence: number;
}

function normalizeTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function calculateSimilarity(a: string, b: string): number {
  const aNorm = normalizeTitle(a);
  const bNorm = normalizeTitle(b);
  
  if (aNorm === bNorm) return 1;
  
  const aWords = aNorm.split(' ');
  const bWords = bNorm.split(' ');
  
  let matchingWords = 0;
  for (const word of aWords) {
    if (bWords.includes(word)) matchingWords++;
  }
  
  const maxWords = Math.max(aWords.length, bWords.length);
  return matchingWords / maxWords;
}

export function resolveTemplateForImportedTitle(
  title: string,
  templates: BlockTemplate[]
): TemplateMatchResult {
  if (!title || templates.length === 0) {
    return { templateId: null, matchedBy: 'none', confidence: 0 };
  }
  
  const normalizedInput = normalizeTitle(title);
  
  for (const template of templates) {
    if (normalizeTitle(template.title) === normalizedInput) {
      return { templateId: template.id, matchedBy: 'exact', confidence: 1 };
    }
  }
  
  let bestMatch: { template: BlockTemplate; score: number } | null = null;
  
  for (const template of templates) {
    const score = calculateSimilarity(title, template.title);
    if (score >= 0.88 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { template, score };
    }
  }
  
  if (bestMatch) {
    const similarMatches = templates.filter(t => 
      calculateSimilarity(title, t.title) >= 0.85
    );
    
    if (similarMatches.length === 1) {
      return { templateId: bestMatch.template.id, matchedBy: 'fuzzy', confidence: bestMatch.score };
    }
  }
  
  return { templateId: null, matchedBy: 'none', confidence: 0 };
}

export function getUnassignedBlocks(blocks: { templateId: string | null }[]): number {
  return blocks.filter(b => b.templateId === null).length;
}
