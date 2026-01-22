import { BlockTemplate, GOLDEN_RULE_BUCKETS, GoldenRuleBucketId } from '@/state/types';
import { matchTitleToTemplateViaAlias } from './titleAliases';
import { getPersistedTemplateId } from './assignmentPersistence';

export interface TemplateMatchResult {
  templateId: string | null;
  bucketId: GoldenRuleBucketId | null;
  matchedBy: 'exact' | 'alias' | 'keyword' | 'fuzzy' | 'none';
  confidence: number;
  candidates: TemplateCandidate[];
  aliasUsed?: string;
}

export interface TemplateCandidate {
  templateId: string;
  templateTitle: string;
  bucketId: GoldenRuleBucketId | null;
  score: number;
  matchReason: string;
}

const BUCKET_KEYWORDS: Record<GoldenRuleBucketId, string[]> = {
  'INTRO_PREAPP': ['intro', 'introduction', 'pre-apprenticeship', 'preapprenticeship', 'pre apprenticeship', 'orientation', 'welcome'],
  'PD_PRINCIPLES': ['professional development', 'pd', 'professionalism', 'workplace behavior', 'soft skills'],
  'GRIT_GROWTH': ['grit', 'growth mindset', 'mindset', 'perseverance', 'resilience'],
  'SUCCESSFUL_APPRENTICE': ['successful apprentice', 'success', 'apprentice success', 'how to be'],
  'ELEVATOR_PITCH': ['elevator pitch', 'pitch', 'self introduction', 'personal pitch', '30 second'],
  'RESUMES': ['resume', 'résumé', 'cv', 'curriculum vitae', 'resume writing', 'intro to resume'],
  'INTERVIEWS': ['interview', 'interviews', 'mock interview', 'interview skills', 'interview prep', 'group interview'],
  'APPLY_APPRENTICESHIPS': ['apply', 'application', 'job search', 'apprenticeship application', 'applying'],
  'FINANCIAL_ED': ['financial', 'finance', 'money', 'budget', 'banking', 'credit', 'financial education', 'financial literacy'],
  'EMOTIONAL_INTEL': ['emotional intelligence', 'emotions', 'eq', 'self awareness', 'empathy'],
  'RISE_UP': ['rise up', 'advocacy', 'bystander', 'intervention', 'harassment'],
  'WORKERS_COMP': ['workers comp', 'compensation', 'unemployment', 'insurance', 'ui', 'workers rights'],
  'PORTFOLIO': ['portfolio', 'apprenticeship portfolio', 'work samples'],
  'CAREER_PLAN': ['career plan', 'career planning', 'individual career', 'icp', 'career path'],
  'APP_PREP': ['application prep', 'app prep', 'preparation'],
  'MATH': ['math', 'mathematics', 'math lab', 'math class', 'pace math', 'trp math'],
  'ACE_INSTRUCTION': ['ace instruction', 'ace class'],
  'ACES': ['aces', 'ace', 'adverse childhood', 'trauma'],
  'SHOP_INTRO': ['shop intro', 'shop introduction', 'intro to shop', 'workshop intro', 'shop orientation', 'shop safety'],
  'CONSTRUCTION_TRADES': ['construction trades', 'trades', 'intro to construction', 'construction intro', 'trade overview'],
  'TRADE_AWARENESS': ['trade awareness', 'poster project', 'trade research', 'trade exploration'],
  'LABOR_HISTORY': ['labor history', 'union history', 'labor movement', 'unions'],
  'HAND_TOOLS': ['hand tools', 'hand tool', 'basic tools', 'tool identification'],
  'POWER_TOOLS': ['power tools', 'power tool', 'electric tools', 'tool safety'],
  'MATERIALS': ['materials', 'material knowledge', 'construction materials', 'building materials'],
  'MEASURING_TAPE': ['measuring tape', 'measurement', 'measuring', 'tape measure', 'fractions', 'reading tape'],
  'SKILLS_PROJECT': ['skills project', 'hands on project', 'build project', 'capstone'],
  'SCAFFOLDING': ['scaffolding', 'scaffold', 'intro to scaffolding'],
  'LADDER_SAFETY': ['ladder', 'ladder safety', 'fall protection'],
  'CLEAN_ENERGY': ['clean energy', 'renewable', 'solar', 'green energy', 'sustainability'],
  'APPRENTICE_TOURS': ['apprenticeship tour', 'apprentice tour', 'training center', 'jatc', 'tour'],
  'WORKSITE_TOURS': ['worksite tour', 'job site', 'jobsite', 'field trip', 'site visit'],
  'SPEAKER_PRESENTATIONS': ['speaker', 'presentation', 'guest speaker', 'industry speaker', 'panel'],
  'OSHA_10': ['osha', 'osha 10', 'osha10', 'safety training', 'osha certification'],
  'FORKLIFT': ['forklift', 'fork lift', 'forklift certification', 'forklift training'],
  'FLAGGER': ['flagger', 'flagging', 'traffic control', 'flagger certification'],
  'PHYSICAL_FITNESS': ['physical fitness', 'fitness', 'exercise', 'workout', 'pt', 'stretching', 'warm up'],
  'NUTRITION': ['nutrition', 'healthy eating', 'diet', 'food', 'meal prep'],
};

const COMMON_SYNONYMS: Record<string, string[]> = {
  'intro': ['introduction', 'intro to', 'beginning', 'basics', 'fundamentals'],
  'resume': ['résumé', 'cv', 'curriculum vitae'],
  'interview': ['interviews', 'interviewing'],
  'tour': ['tours', 'visit', 'field trip'],
  'tool': ['tools'],
  'safety': ['safe', 'protection'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(' ').filter(w => w.length > 1);
}

function stem(word: string): string {
  return word
    .replace(/ing$/, '')
    .replace(/tion$/, '')
    .replace(/s$/, '')
    .replace(/ed$/, '');
}

function expandSynonyms(tokens: string[]): string[] {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, synonyms] of Object.entries(COMMON_SYNONYMS)) {
      if (token === key || synonyms.includes(token)) {
        expanded.add(key);
        synonyms.forEach(s => expanded.add(s));
      }
    }
  }
  return Array.from(expanded);
}

function scoreBucketMatch(inputTokens: string[], bucketId: GoldenRuleBucketId): number {
  const keywords = BUCKET_KEYWORDS[bucketId] || [];
  const inputText = inputTokens.join(' ');
  const stemmedInput = inputTokens.map(stem);
  
  let maxScore = 0;
  
  for (const keyword of keywords) {
    const keywordTokens = tokenize(keyword);
    const stemmedKeyword = keywordTokens.map(stem);
    
    if (inputText.includes(keyword)) {
      maxScore = Math.max(maxScore, 0.95);
      continue;
    }
    
    let matchingTokens = 0;
    for (const kt of stemmedKeyword) {
      if (stemmedInput.some(it => it === kt || it.includes(kt) || kt.includes(it))) {
        matchingTokens++;
      }
    }
    
    if (matchingTokens > 0) {
      const tokenScore = (matchingTokens / keywordTokens.length) * 0.8;
      maxScore = Math.max(maxScore, tokenScore);
    }
  }
  
  return maxScore;
}

function scoreTemplateMatch(inputTitle: string, template: BlockTemplate): number {
  const inputNorm = normalizeText(inputTitle);
  const templateNorm = normalizeText(template.title);
  
  if (inputNorm === templateNorm) return 1.0;
  
  if (inputNorm.includes(templateNorm) || templateNorm.includes(inputNorm)) {
    return 0.9;
  }
  
  const inputTokens = expandSynonyms(tokenize(inputTitle));
  const templateTokens = tokenize(template.title);
  const stemmedInput = inputTokens.map(stem);
  const stemmedTemplate = templateTokens.map(stem);
  
  let matchCount = 0;
  for (const st of stemmedTemplate) {
    if (stemmedInput.some(si => si === st || si.includes(st) || st.includes(si))) {
      matchCount++;
    }
  }
  
  const overlapScore = matchCount / Math.max(stemmedTemplate.length, 1);
  
  let keywordBonus = 0;
  if (template.matchKeywords && template.matchKeywords.length > 0) {
    const inputLower = inputNorm.toLowerCase();
    for (const keyword of template.matchKeywords) {
      if (inputLower.includes(keyword.toLowerCase())) {
        keywordBonus = Math.max(keywordBonus, 0.85);
        break;
      }
    }
    if (keywordBonus === 0) {
      let keywordMatches = 0;
      for (const keyword of template.matchKeywords) {
        const keywordStemmed = stem(keyword);
        if (stemmedInput.some(si => si.includes(keywordStemmed) || keywordStemmed.includes(si))) {
          keywordMatches++;
        }
      }
      if (keywordMatches > 0) {
        keywordBonus = (keywordMatches / template.matchKeywords.length) * 0.6;
      }
    }
  }
  
  let bucketBonus = 0;
  if (template.goldenRuleBucketId) {
    bucketBonus = scoreBucketMatch(inputTokens, template.goldenRuleBucketId) * 0.3;
  }
  
  return Math.min(Math.max(overlapScore * 0.7, keywordBonus) + bucketBonus, 1.0);
}

export function findBestBucketMatch(title: string): { bucketId: GoldenRuleBucketId; score: number } | null {
  const tokens = expandSynonyms(tokenize(title));
  
  let bestMatch: { bucketId: GoldenRuleBucketId; score: number } | null = null;
  
  for (const bucket of GOLDEN_RULE_BUCKETS) {
    const score = scoreBucketMatch(tokens, bucket.id);
    if (score > 0.3 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { bucketId: bucket.id, score };
    }
  }
  
  return bestMatch;
}

export function resolveTemplateForImportedTitle(
  title: string,
  templates: BlockTemplate[],
  contextText?: string
): TemplateMatchResult {
  const matchText = [title, contextText].filter(Boolean).join(' ').trim();
  if (!matchText || templates.length === 0) {
    return { templateId: null, bucketId: null, matchedBy: 'none', confidence: 0, candidates: [] };
  }
  
  const persistedId = getPersistedTemplateId(title);
  if (persistedId) {
    const template = templates.find(t => t.id === persistedId);
    if (template) {
      return {
        templateId: template.id,
        bucketId: template.goldenRuleBucketId,
        matchedBy: 'exact',
        confidence: 1,
        candidates: [{
          templateId: template.id,
          templateTitle: template.title,
          bucketId: template.goldenRuleBucketId,
          score: 1,
          matchReason: 'Previously assigned by you'
        }]
      };
    }
  }
  
  const normalizedInput = normalizeText(matchText);
  
  for (const template of templates) {
    if (normalizeText(template.title) === normalizedInput) {
      return { 
        templateId: template.id, 
        bucketId: template.goldenRuleBucketId,
        matchedBy: 'exact', 
        confidence: 1,
        candidates: [{
          templateId: template.id,
          templateTitle: template.title,
          bucketId: template.goldenRuleBucketId,
          score: 1,
          matchReason: 'Exact title match'
        }]
      };
    }
  }
  
  const aliasMatch = matchTitleToTemplateViaAlias(matchText, templates);
  
  if (aliasMatch.templateId) {
    const template = templates.find(t => t.id === aliasMatch.templateId);
    if (template) {
      return {
        templateId: template.id,
        bucketId: template.goldenRuleBucketId,
        matchedBy: 'alias',
        confidence: aliasMatch.matchType === 'exact' ? 1 : aliasMatch.matchType === 'alias' ? 0.95 : 0.85,
        candidates: [{
          templateId: template.id,
          templateTitle: template.title,
          bucketId: template.goldenRuleBucketId,
          score: 0.95,
          matchReason: `Alias: "${aliasMatch.aliasUsed}"`
        }],
        aliasUsed: aliasMatch.aliasUsed
      };
    }
  }
  
  const candidates: TemplateCandidate[] = [];
  
  for (const template of templates) {
    const score = scoreTemplateMatch(matchText, template);
    if (score >= 0.4) {
      let matchReason = 'Similar title';
      if (score >= 0.9) matchReason = 'Very close match';
      else if (score >= 0.7) matchReason = 'Good keyword match';
      else if (score >= 0.5) matchReason = 'Partial match';
      
      candidates.push({
        templateId: template.id,
        templateTitle: template.title,
        bucketId: template.goldenRuleBucketId,
        score,
        matchReason
      });
    }
  }
  
  candidates.sort((a, b) => b.score - a.score);
  
  const topCandidates = candidates.slice(0, 5);
  
  if (topCandidates.length > 0) {
    const best = topCandidates[0];
    
    if (best.score >= 0.75) {
      const secondBest = topCandidates[1];
      if (!secondBest || best.score - secondBest.score >= 0.15) {
        return {
          templateId: best.templateId,
          bucketId: best.bucketId,
          matchedBy: best.score >= 0.9 ? 'keyword' : 'fuzzy',
          confidence: best.score,
          candidates: topCandidates
        };
      }
    }
    
    return {
      templateId: null,
      bucketId: null,
      matchedBy: 'none',
      confidence: best.score,
      candidates: topCandidates
    };
  }
  
  const bucketMatch = findBestBucketMatch(matchText);
  if (bucketMatch && bucketMatch.score >= 0.5) {
    const templatesForBucket = templates.filter(t => t.goldenRuleBucketId === bucketMatch.bucketId);
    if (templatesForBucket.length === 1) {
      return {
        templateId: templatesForBucket[0].id,
        bucketId: bucketMatch.bucketId,
        matchedBy: 'keyword',
        confidence: bucketMatch.score,
        candidates: [{
          templateId: templatesForBucket[0].id,
          templateTitle: templatesForBucket[0].title,
          bucketId: bucketMatch.bucketId,
          score: bucketMatch.score,
          matchReason: `Matched bucket: ${GOLDEN_RULE_BUCKETS.find(b => b.id === bucketMatch.bucketId)?.label}`
        }]
      };
    }
    
    if (templatesForBucket.length > 1) {
      return {
        templateId: null,
        bucketId: bucketMatch.bucketId,
        matchedBy: 'none',
        confidence: bucketMatch.score,
        candidates: templatesForBucket.map(t => ({
          templateId: t.id,
          templateTitle: t.title,
          bucketId: t.goldenRuleBucketId,
          score: bucketMatch.score * 0.8,
          matchReason: `Same category: ${GOLDEN_RULE_BUCKETS.find(b => b.id === bucketMatch.bucketId)?.label}`
        }))
      };
    }
  }
  
  return { templateId: null, bucketId: null, matchedBy: 'none', confidence: 0, candidates: [] };
}

export function getUnassignedBlocks(blocks: { templateId: string | null }[]): number {
  return blocks.filter(b => b.templateId === null).length;
}

export function getBucketLabel(bucketId: GoldenRuleBucketId): string {
  return GOLDEN_RULE_BUCKETS.find(b => b.id === bucketId)?.label || bucketId;
}
