import { 
  Plan, 
  BlockTemplate, 
  GoldenRuleKey,
  GOLDEN_RULE_BUDGETS,
} from '@/state/types';

export interface TopicTotal {
  key: GoldenRuleKey;
  label: string;
  scheduled: number;
  budget: number;
  difference: number;
  status: 'under' | 'on-target' | 'over';
}

export function calculateTopicTotals(
  plan: Plan,
  templates: BlockTemplate[]
): TopicTotal[] {
  const totals: Record<GoldenRuleKey, number> = {} as Record<GoldenRuleKey, number>;
  
  for (const budget of GOLDEN_RULE_BUDGETS) {
    totals[budget.key] = 0;
  }
  
  for (const block of plan.blocks) {
    const template = templates.find(t => t.id === block.templateId);
    if (template && template.goldenRuleKey) {
      totals[template.goldenRuleKey] += block.durationMin;
    }
  }
  
  return GOLDEN_RULE_BUDGETS.map(budget => {
    const scheduled = totals[budget.key];
    const difference = scheduled - budget.budgetMinutes;
    
    let status: 'under' | 'on-target' | 'over';
    if (difference < -15) {
      status = 'under';
    } else if (difference > 15) {
      status = 'over';
    } else {
      status = 'on-target';
    }
    
    return { 
      key: budget.key,
      label: budget.label, 
      scheduled, 
      budget: budget.budgetMinutes, 
      difference, 
      status 
    };
  });
}

export interface GoldenRuleCheck {
  allowed: boolean;
  warning: boolean;
  message: string;
  exceedBy: number;
}

export function checkGoldenRuleLimit(
  plan: Plan,
  templates: BlockTemplate[],
  templateId: string,
  newDuration: number,
  existingBlockId?: string
): GoldenRuleCheck {
  const template = templates.find(t => t.id === templateId);
  if (!template || !template.goldenRuleKey) {
    return { allowed: true, warning: false, message: '', exceedBy: 0 };
  }
  
  const budgetItem = GOLDEN_RULE_BUDGETS.find(b => b.key === template.goldenRuleKey);
  if (!budgetItem) {
    return { allowed: true, warning: false, message: '', exceedBy: 0 };
  }
  
  let currentTotal = 0;
  for (const block of plan.blocks) {
    if (existingBlockId && block.id === existingBlockId) continue;
    const blockTemplate = templates.find(t => t.id === block.templateId);
    if (blockTemplate && blockTemplate.goldenRuleKey === template.goldenRuleKey) {
      currentTotal += block.durationMin;
    }
  }
  
  const newTotal = currentTotal + newDuration;
  const exceedBy = newTotal - budgetItem.budgetMinutes;
  
  if (exceedBy <= 15) {
    return { allowed: true, warning: false, message: '', exceedBy: 0 };
  }
  
  if (exceedBy <= 60) {
    return {
      allowed: true,
      warning: true,
      message: `This will exceed Golden Rule hours for "${budgetItem.label}" by ${exceedBy} minutes. Confirm?`,
      exceedBy,
    };
  }
  
  return {
    allowed: false,
    warning: false,
    message: `Not allowed. This exceeds Golden Rule hours for "${budgetItem.label}" by ${exceedBy} minutes.`,
    exceedBy,
  };
}
