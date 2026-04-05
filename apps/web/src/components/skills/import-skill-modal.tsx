import { useState } from 'react';

import { useImportSkill } from '../../api/hooks/index.js';
import Button from '../common/button.js';
import Modal from '../common/modal.js';
import Tabs from '../common/tabs.js';

interface ImportSkillModalProps {
  open: boolean;
  onClose: () => void;
}

const tabs = [
  { label: 'From URL', value: 'url' },
  { label: 'Paste Markdown', value: 'paste' },
];

export default function ImportSkillModal({ open, onClose }: ImportSkillModalProps) {
  const [tab, setTab] = useState<'url' | 'paste'>('url');
  const [url, setUrl] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, importSkill] = useImportSkill();

  const handleClose = () => {
    setUrl('');
    setMarkdown('');
    setError(null);
    setLoading(false);
    onClose();
  };

  const handleImportFromUrl = async () => {
    if (!url.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const content = await response.text();
      const result = await importSkill({ markdown: content });
      if (result.error) throw new Error(result.error.message);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromPaste = async () => {
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
        <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v as 'url' | 'paste')} size="sm" />

        {tab === 'url' ? (
          <div className="space-y-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://raw.githubusercontent.com/..."
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-light focus:outline-none"
            />
            <Button
              variant="primary"
              loading={loading}
              disabled={!url.trim()}
              onClick={handleImportFromUrl}
              className="w-full"
            >
              Fetch & Import
            </Button>
          </div>
        ) : (
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
              onClick={handleImportFromPaste}
              className="w-full"
            >
              Import
            </Button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{error}</div>
        )}
      </div>
    </Modal>
  );
}
