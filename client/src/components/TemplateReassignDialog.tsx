import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BlockTemplate, PlacedBlock, GOLDEN_RULE_BUCKETS } from '@/state/types';
import { resolveTemplateForImportedTitle, TemplateCandidate } from '@/lib/templateMatcher';
import { findSimilarBlocks, applyToAllSimilarTitles } from '@/lib/assignmentPersistence';
import { ArrowRight } from 'lucide-react';

interface TemplateReassignDialogProps {
  open: boolean;
  onClose: () => void;
  block: PlacedBlock;
  templates: BlockTemplate[];
  allBlocks: PlacedBlock[];
  onAssign: (blockId: string, templateId: string | null, countsOverride?: boolean) => void;
  onAssignMultiple: (blockIds: string[], templateId: string | null) => void;
}

export function TemplateReassignDialog({
  open,
  onClose,
  block,
  templates,
  allBlocks,
  onAssign,
  onAssignMultiple,
}: TemplateReassignDialogProps) {
  const UNASSIGNED_VALUE = '__UNASSIGNED__';
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);
  const [countsOverride, setCountsOverride] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<TemplateCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const currentTemplate = templates.find(t => t.id === block.templateId);

  const getDisplayTitle = (b: PlacedBlock): string => {
    if (b.titleOverride) return b.titleOverride;
    const template = templates.find(t => t.id === b.templateId);
    return template?.title || 'Untitled';
  };

  const title = getDisplayTitle(block);

  const getSimilarBlockCount = (targetTemplateId: string | null): number => {
    if (!targetTemplateId || targetTemplateId === UNASSIGNED_VALUE) return 0;
    const blocksForHelper = allBlocks.map(b => ({
      id: b.id,
      displayTitle: getDisplayTitle(b),
      templateId: b.templateId,
    }));
    const matchingIds = findSimilarBlocks(blocksForHelper, title, targetTemplateId);
    return matchingIds.filter(id => id !== block.id).length;
  };
  
  const similarBlockCount = selectedTemplateId ? getSimilarBlockCount(selectedTemplateId) : 0;

  useEffect(() => {
    if (open) {
      const result = resolveTemplateForImportedTitle(title, templates);
      setCandidates(result.candidates.slice(0, 5));
      setSelectedTemplateId(null);
      setCountsOverride(null);
      setApplyToAll(false);
      setSearchQuery('');
    }
  }, [open, title, templates]);

  const filteredTemplates = useMemo(() => {
    const base = templates.filter(t => t.id !== 'UNASSIGNED');
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(t => 
      t.title.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      (t.matchKeywords || []).some(k => k.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  const handleConfirm = () => {
    if (!selectedTemplateId) return;

    const blocksForHelper = allBlocks.map(b => ({
      id: b.id,
      displayTitle: getDisplayTitle(b),
      templateId: b.templateId,
    }));
    
    const isUnassigned = selectedTemplateId === UNASSIGNED_VALUE;
    const assignTemplateId = isUnassigned ? null : selectedTemplateId;
    const matchingIds = isUnassigned ? [] : applyToAllSimilarTitles(blocksForHelper, title, selectedTemplateId);
    
    if (applyToAll && matchingIds.length > 0) {
      const allIdsSet = new Set([block.id, ...matchingIds]);
      onAssignMultiple(Array.from(allIdsSet), assignTemplateId);
    } else {
      const override = isUnassigned ? false : (countsOverride === null ? undefined : countsOverride);
      onAssign(block.id, assignTemplateId, override);
    }

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-500 mb-1">Block Title</p>
            <p className="font-medium">{title}</p>
            {currentTemplate && (
              <p className="text-sm text-gray-600 mt-1">
                Currently: <span className="font-medium">{currentTemplate.title}</span>
              </p>
            )}
            {!currentTemplate && block.templateId === null && (
              <p className="text-sm text-orange-600 mt-1 font-medium">Currently: Unassigned</p>
            )}
          </div>

          {candidates.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Suggested Templates</p>
              <div className="space-y-1">
                {candidates.map((candidate) => {
                  const bucket = GOLDEN_RULE_BUCKETS.find(b => b.id === candidate.bucketId);
                  const template = templates.find(t => t.id === candidate.templateId);
                  const isArchived = !!template?.isArchived;
                  return (
                    <button
                      key={candidate.templateId}
                      onClick={() => setSelectedTemplateId(candidate.templateId)}
                      disabled={isArchived}
                      className={`w-full text-left p-2 rounded border transition-colors ${
                        selectedTemplateId === candidate.templateId
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                      data-testid={`suggestion-${candidate.templateId}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: template?.colorHex || '#6B7280' }}
                          />
                          <span className="font-medium text-sm">{candidate.templateTitle}</span>
                          {isArchived && (
                            <span className="text-[10px] text-amber-600">Archived</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            {Math.round(candidate.score * 100)}%
                          </span>
                          {selectedTemplateId === candidate.templateId && (
                            <span className="text-[10px] text-blue-600">Selected</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{candidate.matchReason}</p>
                      {bucket && (
                        <p className="text-xs text-gray-400 mt-0.5">Bucket: {bucket.label}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">All Templates</p>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full px-2 py-1 border rounded text-xs mb-2"
              data-testid="template-search"
            />
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded p-2">
              <button
                onClick={() => setSelectedTemplateId(UNASSIGNED_VALUE)}
                className={`w-full text-left p-2 rounded transition-colors ${
                  selectedTemplateId === UNASSIGNED_VALUE
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
                data-testid="template-option-unassigned"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-400" />
                    <span className="text-sm">Unassigned</span>
                  </div>
                  {selectedTemplateId === UNASSIGNED_VALUE && (
                    <span className="text-[10px] text-blue-600">Selected</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 ml-5">Does not count toward Golden Rule</p>
              </button>
              {filteredTemplates.map((template) => {
                const bucket = GOLDEN_RULE_BUCKETS.find(b => b.id === template.goldenRuleBucketId);
                return (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    disabled={template.isArchived}
                    className={`w-full text-left p-2 rounded transition-colors ${
                      selectedTemplateId === template.id
                        ? 'bg-blue-50'
                        : 'hover:bg-gray-50'
                    } ${template.isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                    data-testid={`template-option-${template.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: template.colorHex }}
                        />
                        <span className="text-sm">{template.title}</span>
                      </div>
                      {selectedTemplateId === template.id && (
                        <span className="text-[10px] text-blue-600">Selected</span>
                      )}
                    </div>
                    {bucket && (
                      <p className="text-xs text-gray-400 ml-5">{bucket.label}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedTemplateId && (
            <div className="p-2 border rounded bg-gray-50">
              <p className="text-sm font-medium mb-1">Assignment Options</p>
              {(() => {
                if (selectedTemplateId === UNASSIGNED_VALUE) {
                  return (
                    <p className="text-xs text-gray-600">
                      Unassigned blocks do not count toward Golden Rule totals.
                    </p>
                  );
                }
                const t = templates.find(tt => tt.id === selectedTemplateId);
                if (!t) return null;
                return (
                  <div className="text-sm">
                    {t.countsTowardGoldenRule ? (
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={countsOverride ?? true} onChange={(e) => setCountsOverride(e.target.checked)} />
                        <span>Counts toward Golden Rule</span>
                      </label>
                    ) : (
                      <p className="text-xs text-gray-600">This template does not count toward Golden Rule totals.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {similarBlockCount > 0 && (
            <label className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Apply to all similar titles
                </p>
                <p className="text-xs text-yellow-700">
                  Found {similarBlockCount} other block{similarBlockCount > 1 ? 's' : ''} with the same title
                </p>
              </div>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedTemplateId}
            data-testid="confirm-reassign-button"
          >
            <ArrowRight className="w-4 h-4 mr-1" />
            {applyToAll ? `Assign ${similarBlockCount + 1} Blocks` : 'Assign Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
