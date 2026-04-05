import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { useSkill, useExportSkill, useDeleteSkill } from '../../api/hooks/index.js';
import { formatStyle } from './types.js';
import type { SkillCategory } from './types.js';
import type { BadgeVariant } from '../common/badge.js';
import Modal from '../common/modal.js';
import Button from '../common/button.js';
import Badge from '../common/badge.js';
import Spinner from '../common/spinner.js';
import SkillEditorModal from './skill-editor-modal.js';

interface SkillDetailModalProps {
  open: boolean;
  skillId: string;
  onClose: () => void;
}

const categoryVariant: Record<SkillCategory, BadgeVariant> = {
  RISK: 'error',
  PORTFOLIO: 'warning',
  MARKET: 'market',
  RESEARCH: 'success',
};

export default function SkillDetailModal({ open, skillId, onClose }: SkillDetailModalProps) {
  const [result] = useSkill(skillId);
  const exportSkill = useExportSkill();
  const [, deleteSkill] = useDeleteSkill();
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const skill = result.data?.skill;

  async function handleCopy() {
    setCopying(true);
    setError(null);
    try {
      const res = await exportSkill({ id: skillId });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      if (res.data?.exportSkill) {
        await navigator.clipboard.writeText(res.data.exportSkill);
      }
    } finally {
      setCopying(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await exportSkill({ id: skillId });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      if (res.data?.exportSkill) {
        const blob = new Blob([res.data.exportSkill], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${skill?.name ?? 'skill'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await deleteSkill({ id: skillId });
      if (res.error) {
        setError(res.error.message);
        return;
      }
      if (res.data?.deleteSkill) {
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={skill?.name ?? 'Skill Details'} maxWidth="max-w-2xl">
      {result.fetching ? (
        <div className="flex items-center justify-center py-12">
          <Spinner label="Loading skill…" />
        </div>
      ) : !skill ? (
        <p className="py-8 text-center text-text-muted">Skill not found.</p>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div>
            <p className="text-sm text-text-secondary">{skill.description}</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={categoryVariant[skill.category]}>{skill.category}</Badge>
              <Badge variant="neutral">{formatStyle(skill.style)}</Badge>
            </div>
          </div>

          {/* Triggers */}
          {skill.triggers.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Triggers</h3>
              <div className="space-y-1.5">
                {skill.triggers.map((trigger, i) => (
                  <div key={i} className="rounded-lg bg-bg-tertiary px-3 py-2 text-sm">
                    <span className="font-medium text-text-primary">{trigger.type}</span>
                    <span className="ml-2 text-text-secondary">{trigger.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required Capabilities */}
          {skill.requires.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                Required Capabilities
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skill.requires.map((cap) => (
                  <Badge key={cap} variant="accent" size="sm">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Content */}
          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">Strategy</h3>
            <div className="max-h-[300px] overflow-y-auto rounded-lg bg-bg-tertiary p-4 prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{skill.content}</ReactMarkdown>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" loading={copying} onClick={handleCopy}>
                Copy Markdown
              </Button>
              <Button variant="secondary" size="sm" loading={downloading} onClick={handleDownload}>
                Download .md
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditorKey((k) => k + 1);
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            </div>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-lg px-3 py-2 text-error text-sm">{error}</div>
          )}

          <SkillEditorModal key={editorKey} open={editing} skill={skill} onClose={() => setEditing(false)} />
        </div>
      )}
    </Modal>
  );
}

export type { SkillDetailModalProps };
