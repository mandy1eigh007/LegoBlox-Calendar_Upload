import { 
  Plan, 
  BlockTemplate, 
  GOLDEN_RULE_BUCKETS,
  GoldenRuleBucketId,
} from '@/state/types';

export interface BucketTotal {
  id: GoldenRuleBucketId;
  label: string;
  scheduled: number;
  budget: number;
  difference: number;
  status: 'under' | 'on-target' | 'over';
  met: boolean;
  isFlexible?: boolean;
}

export interface GoldenRuleSummary {
  buckets: BucketTotal[];
  unassignedMinutes: number;
  unassignedCount: number;
}

export function calculateGoldenRuleTotals(
  plan: Plan,
  templates: BlockTemplate[]
): BucketTotal[] {
  const totals: Record<string, number> = {};
  
  for (const bucket of GOLDEN_RULE_BUCKETS) {
    totals[bucket.id] = 0;
  }
  
  for (const block of plan.blocks) {
    if (block.templateId === null) continue;
    if (!block.countsTowardGoldenRule) continue;
    
    const bucketId = block.goldenRuleBucketId;
    if (bucketId && totals[bucketId] !== undefined) {
      totals[bucketId] += block.durationMinutes;
      continue;
    }
    
    const template = templates.find(t => t.id === block.templateId);
    if (template?.countsTowardGoldenRule && template.goldenRuleBucketId) {
      totals[template.goldenRuleBucketId] += block.durationMinutes;
    }
  }
  
  return GOLDEN_RULE_BUCKETS.map(bucket => {
    const scheduled = totals[bucket.id];
    const isFlexible = !!bucket.isFlexible;
    const budget = isFlexible ? scheduled : bucket.budgetMinutes;
    const difference = isFlexible ? 0 : scheduled - bucket.budgetMinutes;
    
    let status: 'under' | 'on-target' | 'over';
    if (isFlexible) {
      status = 'on-target';
    } else if (difference < -15) {
      status = 'under';
    } else if (difference > 15) {
      status = 'over';
    } else {
      status = 'on-target';
    }
    
    return { 
      id: bucket.id,
      label: bucket.label, 
      scheduled, 
      budget, 
      difference, 
      status,
      met: isFlexible ? false : scheduled >= bucket.budgetMinutes,
      isFlexible,
    };
  });
}

export function calculateGoldenRuleSummary(
  plan: Plan,
  templates: BlockTemplate[]
): GoldenRuleSummary {
  const buckets = calculateGoldenRuleTotals(plan, templates);
  
  const unassignedBlocks = plan.blocks.filter(b => b.templateId === null);
  const unassignedMinutes = unassignedBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);
  
  return {
    buckets,
    unassignedMinutes,
    unassignedCount: unassignedBlocks.length,
  };
}

export function getBucketById(id: GoldenRuleBucketId) {
  return GOLDEN_RULE_BUCKETS.find(b => b.id === id);
}
