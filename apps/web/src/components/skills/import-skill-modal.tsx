import { useState } from 'react';

import { useImportSkill } from '../../api/hooks/index.js';
import Button from '../common/button.js';
import Modal from '../common/modal.js';

interface ImportSkillModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportSkillModal({ open, onClose }: ImportSkillModalProps) {
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, importSkill] = useImportSkill();

  const handleClose = () => {
    setMarkdown('');
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleImport = async () => {
    if (!markdown.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const result = await importSkill({ markdown });
      if (result.error) throw new Error(result.error.message);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import Strategy" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="space-y-3">
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Paste strategy markdown here..."
            rows={10}
            className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-light focus:outline-none"
          />
          <Button
            variant="primary"
            loading={loading}
            disabled={!markdown.trim()}
            onClick={handleImport}
            className="w-full"
          >
            Import
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
        )}
      </div>
    </Modal>
  );
}
