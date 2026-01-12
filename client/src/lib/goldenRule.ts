import { 
  Plan, 
  BlockTemplate, 
  GoldenRuleTopic, 
  GOLDEN_RULE_BUDGETS,
  GOLDEN_RULE_TOPICS 
} from '@/state/types';

export interface TopicTotal {
  topic: GoldenRuleTopic;
  scheduled: number;
  budget: number;
  difference: number;
  status: 'under' | 'on-target' | 'over';
}

export function calculateTopicTotals(
  plan: Plan,
  templates: BlockTemplate[]
): TopicTotal[] {
  const totals: Record<GoldenRuleTopic, number> = {} as Record<GoldenRuleTopic, number>;
  
  for (const topic of GOLDEN_RULE_TOPICS) {
    totals[topic] = 0;
  }
  
  for (const block of plan.blocks) {
    const template = templates.find(t => t.id === block.templateId);
    if (template) {
      totals[template.goldenRuleTopic] += block.durationMin;
    }
  }
  
  return GOLDEN_RULE_TOPICS.map(topic => {
    const scheduled = totals[topic];
    const budget = GOLDEN_RULE_BUDGETS[topic];
    const difference = scheduled - budget;
    
    let status: 'under' | 'on-target' | 'over';
    if (difference < -15) {
      status = 'under';
    } else if (difference > 15) {
      status = 'over';
    } else {
      status = 'on-target';
    }
    
    return { topic, scheduled, budget, difference, status };
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
  if (!template) {
    return { allowed: false, warning: false, message: 'Template not found', exceedBy: 0 };
  }
  
  const topic = template.goldenRuleTopic;
  const budget = GOLDEN_RULE_BUDGETS[topic];
  
  let currentTotal = 0;
  for (const block of plan.blocks) {
    if (existingBlockId && block.id === existingBlockId) continue;
    const blockTemplate = templates.find(t => t.id === block.templateId);
    if (blockTemplate && blockTemplate.goldenRuleTopic === topic) {
      currentTotal += block.durationMin;
    }
  }
  
  const newTotal = currentTotal + newDuration;
  const exceedBy = newTotal - budget;
  
  if (exceedBy <= 15) {
    return { allowed: true, warning: false, message: '', exceedBy: 0 };
  }
  
  if (exceedBy <= 60) {
    return {
      allowed: true,
      warning: true,
      message: `This will exceed Golden Rule hours for "${topic}" by ${exceedBy} minutes. Confirm?`,
      exceedBy,
    };
  }
  
  return {
    allowed: false,
    warning: false,
    message: `Not allowed. This exceeds Golden Rule hours for "${topic}" by ${exceedBy} minutes.`,
    exceedBy,
  };
}
