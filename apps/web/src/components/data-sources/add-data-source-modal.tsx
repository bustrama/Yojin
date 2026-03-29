import { useState } from 'react';

import {
  useAddDataSource,
  useAddVaultSecret,
  useCheckCliCommands,
  useListVaultSecrets,
  useListDataSources,
} from '../../api/hooks';
import type { DataSourceInput, DataSourceType } from '../../api/types';
import Badge from '../common/badge';
import Button from '../common/button';
import Modal from '../common/modal';

interface AddDataSourceModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Known data source catalog
// ---------------------------------------------------------------------------

interface CatalogEntry {
  id: string;
  name: string;
  type: DataSourceType;
  capabilities: string[];
  description: string;
  secretRef?: string;
  baseUrl?: string;
  command?: string;
  args?: string[];
}

const CATALOG: CatalogEntry[] = [
  {
    id: 'nimble-cli',
    name: 'Nimble',
    type: 'CLI',
    capabilities: ['web-scrape', 'social', 'search'],
    command: 'nimble',
    secretRef: 'NIMBLE_API_KEY',
    description: 'Web scraping and data collection',
  },
  {
    id: 'curl-rss',
    name: 'RSS/Atom Feeds',
    type: 'CLI',
    capabilities: ['news'],
    command: 'curl',
    args: ['-s'],
    description: 'Fetch RSS/Atom feeds via curl — no API key needed',
  },
  {
    id: 'exa-search',
    name: 'Exa Search',
    type: 'API',
    capabilities: ['web-search', 'news'],
    secretRef: 'EXA_API_KEY',
    baseUrl: 'https://api.exa.ai',
    description: 'Neural web search — find semantically similar content',
  },
];

function getMissingReason(entry: CatalogEntry, availableCommands: Set<string>, vaultKeys: Set<string>): string {
  const parts: string[] = [];
  if (entry.type === 'CLI' && entry.command && !availableCommands.has(entry.command)) {
    parts.push(`${entry.command} not installed`);
  }
  if (entry.secretRef && !vaultKeys.has(entry.secretRef)) {
    parts.push('API key needed');
  }
  return parts.join(' · ') || 'Setup required';
}

// ---------------------------------------------------------------------------
// Smart paste auto-detection
// ---------------------------------------------------------------------------

const MCP_PREFIXES = ['npx', 'node', 'python', 'python3', 'uvx', 'deno'];

interface DetectedSource {
  type: DataSourceType;
  name: string;
  id: string;
  baseUrl: string;
  command: string;
  args: string;
  label: string; // human-readable detection label
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function nameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    // strip leading "api." and trailing TLD
    return host
      .replace(/^api\./, '')
      .split('.')[0]
      .replace(/^./, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

function detectSource(raw: string): DetectedSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // JSON config — parse and fill everything
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const t = (obj.type as string)?.toUpperCase();
      const type: DataSourceType = t === 'CLI' ? 'CLI' : t === 'MCP' ? 'MCP' : 'API';
      return {
        type,
        name: (obj.name as string) ?? '',
        id: (obj.id as string) ?? slugify((obj.name as string) ?? ''),
        baseUrl: (obj.baseUrl as string) ?? '',
        command: (obj.command as string) ?? (obj.serverCommand as string) ?? '',
        args: Array.isArray(obj.args) ? (obj.args as string[]).join(' ') : '',
        label: 'Parsed from JSON',
      };
    } catch {
      return null;
    }
  }

  // URL → API source
  if (/^https?:\/\//i.test(trimmed)) {
    const n = nameFromUrl(trimmed);
    return {
      type: 'API',
      name: n,
      id: slugify(n),
      baseUrl: trimmed,
      command: '',
      args: '',
      label: 'REST API',
    };
  }

  // MCP server command
  const firstWord = trimmed.split(/\s+/)[0];
  if (MCP_PREFIXES.includes(firstWord) || trimmed.includes('@modelcontextprotocol')) {
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const rest = parts.slice(1).join(' ');
    // derive name from the package name if present
    const pkg = parts.find((p) => p.startsWith('@') || p.includes('/')) ?? cmd;
    const n =
      pkg
        .split('/')
        .pop()
        ?.replace(/^server-/, '') ?? cmd;
    return {
      type: 'MCP',
      name: n.replace(/^./, (c) => c.toUpperCase()),
      id: slugify(n),
      baseUrl: '',
      command: cmd,
      args: rest,
      label: 'MCP server',
    };
  }

  // Fallback → CLI command
  const parts = trimmed.split(/\s+/);
  return {
    type: 'CLI',
    name: parts[0].replace(/^./, (c) => c.toUpperCase()),
    id: slugify(parts[0]),
    baseUrl: '',
    command: parts[0],
    args: parts.slice(1).join(' '),
    label: 'CLI tool',
  };
}

// ---------------------------------------------------------------------------
// Type badge colors
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<DataSourceType, string> = {
  API: 'bg-info/10 text-info',
  MCP: 'bg-accent-primary/10 text-accent-primary',
  CLI: 'bg-warning/10 text-warning',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = 'catalog' | 'paste' | 'confirm' | 'api-key';

export function AddDataSourceModal({ open, onClose }: AddDataSourceModalProps) {
  const [step, setStep] = useState<Step>('catalog');
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [detected, setDetected] = useState<DetectedSource | null>(null);

  // confirm-step editable fields
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<DataSourceType>('API');
  const [baseUrl, setBaseUrl] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [secretRefName, setSecretRefName] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [, addDataSource] = useAddDataSource();
  const [, addVaultSecret] = useAddVaultSecret();
  const [{ data: vaultData }, reexecuteVaultQuery] = useListVaultSecrets();
  const [{ data: dsData }] = useListDataSources();

  const cliCommands = CATALOG.filter((e): e is typeof e & { command: string } => e.type === 'CLI' && !!e.command).map(
    (e) => e.command,
  );
  const [{ data: cliData }] = useCheckCliCommands(cliCommands);
  const availableCommands = new Set((cliData?.checkCliCommands ?? []).filter((c) => c.available).map((c) => c.command));

  const vaultKeys = new Set((vaultData?.listVaultSecrets ?? []).map((s) => s.key));
  const existingIds = new Set((dsData?.listDataSources ?? []).map((ds) => ds.id));

  function reset() {
    setStep('catalog');
    setSelectedEntry(null);
    setPasteValue('');
    setDetected(null);
    setName('');
    setSourceType('API');
    setBaseUrl('');
    setCommand('');
    setArgs('');
    setApiKeyValue('');
    setSecretRefName('');
    setError(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Catalog → api-key step for entries that need a key
  function handleSetUp(entry: CatalogEntry) {
    if (entry.secretRef) {
      setSelectedEntry(entry);
      setApiKeyValue('');
      setError(null);
      setStep('api-key');
    } else {
      handleCatalogConnect(entry);
    }
  }

  // One-click connect for catalog entries that are ready
  async function handleCatalogConnect(entry: CatalogEntry) {
    setSaving(true);
    setError(null);
    const input: DataSourceInput = {
      id: entry.id,
      name: entry.name,
      type: entry.type,
      capabilities: entry.capabilities,
      baseUrl: entry.baseUrl,
      secretRef: entry.secretRef,
      command: entry.command,
      args: entry.args,
    };
    const result = await addDataSource({ input });
    if (result.error || !result.data?.addDataSource.success) {
      setError(result.data?.addDataSource.error ?? result.error?.message ?? 'Failed to add source');
      setSaving(false);
      return;
    }
    setSaving(false);
    handleClose();
  }

  // Save API key for catalog entry, then add the source
  async function handleSaveApiKey() {
    if (!selectedEntry?.secretRef || !apiKeyValue.trim()) return;

    setSaving(true);
    setError(null);

    const vaultResult = await addVaultSecret({ input: { key: selectedEntry.secretRef, value: apiKeyValue.trim() } });
    if (vaultResult.error || !vaultResult.data?.addVaultSecret.success) {
      setError(vaultResult.data?.addVaultSecret.error ?? vaultResult.error?.message ?? 'Failed to store API key');
      setSaving(false);
      return;
    }

    const input: DataSourceInput = {
      id: selectedEntry.id,
      name: selectedEntry.name,
      type: selectedEntry.type,
      capabilities: selectedEntry.capabilities,
      baseUrl: selectedEntry.baseUrl,
      secretRef: selectedEntry.secretRef,
    };
    const dsResult = await addDataSource({ input });
    if (dsResult.error || !dsResult.data?.addDataSource.success) {
      setError(dsResult.data?.addDataSource.error ?? dsResult.error?.message ?? 'Failed to add data source');
      setSaving(false);
      return;
    }

    reexecuteVaultQuery({ requestPolicy: 'network-only' });
    setSaving(false);
    handleClose();
  }

  // Smart paste → detect → move to confirm
  function handleDetect() {
    const result = detectSource(pasteValue);
    if (!result) {
      setError('Could not detect source type. Try a URL, command, or JSON config.');
      return;
    }
    setDetected(result);
    setName(result.name);
    setSourceType(result.type);
    setBaseUrl(result.baseUrl);
    setCommand(result.command);
    setArgs(result.args);
    setApiKeyValue('');
    setSecretRefName(result.type === 'API' ? `${slugify(result.name).toUpperCase().replace(/-/g, '_')}_API_KEY` : '');
    setError(null);
    setStep('confirm');
  }

  // Submit from confirm step
  async function handleConfirmSubmit() {
    setSaving(true);
    setError(null);

    const trimmedName = name.trim();
    const id = detected?.id || slugify(trimmedName);

    // If user entered an API key, store it in the vault first
    const keyRef = secretRefName.trim();
    if (apiKeyValue.trim() && keyRef) {
      const vaultResult = await addVaultSecret({ input: { key: keyRef, value: apiKeyValue.trim() } });
      if (vaultResult.error || !vaultResult.data?.addVaultSecret.success) {
        setError(vaultResult.data?.addVaultSecret.error ?? vaultResult.error?.message ?? 'Failed to store API key');
        setSaving(false);
        return;
      }
      reexecuteVaultQuery({ requestPolicy: 'network-only' });
    }

    const input: DataSourceInput = {
      id,
      name: trimmedName,
      type: sourceType,
      capabilities: sourceType === 'API' ? ['data'] : ['data'],
    };

    if (sourceType === 'API') {
      if (baseUrl.trim()) input.baseUrl = baseUrl.trim();
      if (keyRef && apiKeyValue.trim()) input.secretRef = keyRef;
    } else {
      if (command.trim()) input.command = command.trim();
      if (args.trim())
        input.args = args
          .split(' ')
          .map((a) => a.trim())
          .filter(Boolean);
    }

    const result = await addDataSource({ input });
    if (result.error || !result.data?.addDataSource.success) {
      setError(result.data?.addDataSource.error ?? result.error?.message ?? 'Failed to add data source');
      setSaving(false);
      return;
    }

    setSaving(false);
    handleClose();
  }

  // Partition catalog
  const isReady = (e: CatalogEntry): boolean => {
    const cliOk = e.type !== 'CLI' || (e.command != null && availableCommands.has(e.command));
    const keyOk = !e.secretRef || vaultKeys.has(e.secretRef);
    return cliOk && keyOk;
  };
  const notConnected = CATALOG.filter((e) => !existingIds.has(e.id));
  const available = notConnected.filter(isReady);
  const rest = notConnected.filter((e) => !isReady(e));

  return (
    <Modal open={open} onClose={handleClose} title="Add Data Source">
      {/* ── Step 1: Catalog ── */}
      {step === 'catalog' && (
        <div className="space-y-4">
          {available.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                Ready to connect
              </p>
              <div className="space-y-2">
                {available.map((entry) => (
                  <CatalogButton
                    key={entry.id}
                    entry={entry}
                    hasKey
                    onClick={() => handleCatalogConnect(entry)}
                    disabled={saving}
                  />
                ))}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Needs setup</p>
              <div className="space-y-2">
                {rest.map((entry) => (
                  <CatalogButton
                    key={entry.id}
                    entry={entry}
                    hasKey={false}
                    reason={getMissingReason(entry, availableCommands, vaultKeys)}
                    onSetUp={() => handleSetUp(entry)}
                    onClick={() => handleSetUp(entry)}
                  />
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>}

          {/* Smart paste entry */}
          <button
            onClick={() => {
              setPasteValue('');
              setError(null);
              setStep('paste');
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-left hover:border-accent-primary hover:bg-accent-primary/5 transition-colors cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary text-text-muted shrink-0">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Add Custom Source</p>
              <p className="text-xs text-text-muted">Paste a URL, command, or JSON config</p>
            </div>
          </button>
        </div>
      )}

      {/* ── Step 2: Smart Paste ── */}
      {step === 'paste' && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setStep('catalog')}>
            &larr; Back
          </Button>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Paste a URL, command, or JSON config
            </label>
            <textarea
              value={pasteValue}
              onChange={(e) => {
                setPasteValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && pasteValue.trim()) {
                  e.preventDefault();
                  handleDetect();
                }
              }}
              placeholder={`https://api.example.com\nnpx @mcp/server-github\ncurl -s -L\n{"type":"API","name":"My Source","baseUrl":"..."}`}
              rows={3}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none resize-none"
              autoFocus
            />
          </div>

          <div className="flex items-start gap-4 text-2xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-info" />
              <span>URL = API</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-primary" />
              <span>npx/node/python = MCP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
              <span>Other = CLI</span>
            </div>
          </div>

          {error && <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleDetect} disabled={!pasteValue.trim()}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm detected source ── */}
      {step === 'confirm' && detected && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setStep('paste')}>
            &larr; Back
          </Button>

          {/* Detection badge */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-2xs font-medium ${TYPE_COLORS[sourceType]}`}
            >
              {sourceType}
            </span>
            <span className="text-xs text-text-muted">{detected.label}</span>
          </div>

          {/* Name (editable) */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
            />
          </div>

          {/* Type-specific fields */}
          {sourceType === 'API' && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              />
            </div>
          )}

          {(sourceType === 'CLI' || sourceType === 'MCP') && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  {sourceType === 'MCP' ? 'Server Command' : 'Command'}
                </label>
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                />
              </div>
              {args && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Arguments</label>
                  <input
                    type="text"
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          {/* Optional API key — inline, no separate step */}
          {sourceType === 'API' && (
            <div className="rounded-lg border border-border bg-bg-card p-3 space-y-2">
              <label className="block text-xs font-medium text-text-secondary">API Key (optional)</label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="Paste your API key"
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
              />
              {apiKeyValue.trim() && (
                <div>
                  <label className="block text-2xs text-text-muted mb-1">Vault key name</label>
                  <input
                    type="text"
                    value={secretRefName}
                    onChange={(e) => setSecretRefName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-bg-primary px-2 py-1 text-xs text-text-primary font-mono placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                  />
                </div>
              )}
              <p className="text-2xs text-text-muted">Stored in the encrypted vault. Never sent to the AI.</p>
            </div>
          )}

          {error && <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmSubmit} disabled={!name.trim() || saving} loading={saving}>
              {saving ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: API key for catalog entries ── */}
      {step === 'api-key' && selectedEntry && (
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setStep('catalog')}>
            &larr; Back
          </Button>

          <div className="rounded-xl border border-border bg-bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary shrink-0">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{selectedEntry.name}</p>
                <p className="text-xs text-text-muted">{selectedEntry.description}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">{selectedEntry.secretRef}</label>
              <input
                type="password"
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="Paste your API key here"
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
                autoFocus
              />
              <p className="text-2xs text-text-muted mt-1.5">Stored in the encrypted vault. Never sent to the AI.</p>
            </div>
          </div>

          {error && <p className="text-sm text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setStep('catalog')}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveApiKey} disabled={!apiKeyValue.trim() || saving} loading={saving}>
              {saving ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Catalog button
// ---------------------------------------------------------------------------

function CatalogButton({
  entry,
  hasKey,
  reason,
  onSetUp,
  onClick,
  disabled,
}: {
  entry: CatalogEntry;
  hasKey: boolean;
  reason?: string;
  onSetUp?: () => void;
  onClick: () => void;
  disabled?: boolean;
}) {
  const isCli = entry.type === 'CLI';

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border p-3 hover:border-accent-primary/50 transition-colors">
      <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
      >
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
            hasKey ? 'bg-success/10 text-success' : 'bg-bg-tertiary text-text-muted'
          }`}
        >
          {isCli ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
              />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{entry.name}</span>
            {hasKey && isCli && (
              <Badge variant="success" size="xs">
                Installed
              </Badge>
            )}
            {hasKey && !isCli && (
              <Badge variant="success" size="xs">
                Key ready
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">
            {reason ? <span className="text-warning">{reason}</span> : entry.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 shrink-0">
          {entry.capabilities.slice(0, 2).map((c) => (
            <Badge key={c} variant="neutral" size="xs">
              {c}
            </Badge>
          ))}
        </div>
      </button>
      {onSetUp && (
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onSetUp();
          }}
        >
          Set up
        </Button>
      )}
    </div>
  );
}
