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
    const difference = scheduled - bucket.budgetMinutes;
    
    let status: 'under' | 'on-target' | 'over';
    if (difference < -15) {
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
      budget: bucket.budgetMinutes, 
      difference, 
      status,
      met: scheduled >= bucket.budgetMinutes,
    };
  });
}

export function getBucketById(id: GoldenRuleBucketId) {
  return GOLDEN_RULE_BUCKETS.find(b => b.id === id);
}
