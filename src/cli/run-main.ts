/**
 * CLI main runner.
 */

import { spawn } from 'node:child_process';

import { startChat } from './chat.js';
import { setupToken } from './setup-token.js';
import { createDefaultProfiles } from '../agents/defaults.js';
import { AgentRegistry } from '../agents/registry.js';
import { ClaudeCodeProvider } from '../ai-providers/claude-code.js';
import { ProviderRouter } from '../ai-providers/router.js';
import { VercelAIProvider } from '../ai-providers/vercel-ai.js';
import { loadConfig } from '../config/config.js';
import { AgentRuntime } from '../core/agent-runtime.js';
import { EventLog } from '../core/event-log.js';
import { starterTools } from '../core/starter-tools.js';
import { ToolRegistry } from '../core/tool-registry.js';
import { Gateway } from '../gateway/server.js';
import { GuardRunner } from '../guards/guard-runner.js';
import { getPostureConfig } from '../guards/posture.js';
import { createDefaultGuards } from '../guards/registry.js';
import { JsonlSessionStore } from '../sessions/jsonl-store.js';
import { FileAuditLog } from '../trust/audit/audit-log.js';
import { ChatPiiScanner } from '../trust/pii/chat-scanner.js';
import { runSecretCommand } from '../trust/vault/cli.js';

export async function runMain(args: string[]): Promise<void> {
  const command = args[0] ?? 'start';

  switch (command) {
    // --- User-facing commands ---
    case 'start':
      await startGateway();
      break;
    case 'chat':
      await startChat(args.slice(1));
      break;
    case 'setup':
    case 'setup-token':
      await setupToken(args.slice(1));
      break;

    // --- Developer commands ---
    case 'serve':
      await startGateway();
      break;
    case 'web':
      await startFrontend();
      break;
    case 'secret':
      await runSecretCommand(args.slice(1));
      break;

    case 'version':
      console.log('yojin v0.1.0');
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

async function startGateway(): Promise<void> {
  const config = loadConfig();

  // --- Composition root: wire AgentRuntime ---
  const dataRoot = '.';
  const auditLog = new FileAuditLog(`${dataRoot}/data/audit`);
  const toolRegistry = new ToolRegistry();
  for (const tool of starterTools) {
    toolRegistry.register(tool);
  }

  const agentRegistry = new AgentRegistry();
  for (const profile of createDefaultProfiles()) {
    agentRegistry.register(profile);
  }

  const providerRouter = new ProviderRouter();
  providerRouter.registerBackend(new ClaudeCodeProvider());
  providerRouter.registerBackend(new VercelAIProvider());
  await providerRouter.loadConfig();
  providerRouter.startConfigRefresh();

  const posture = getPostureConfig('local');
  const { guards, outputDlp } = createDefaultGuards(posture);
  const guardRunner = new GuardRunner(guards, { auditLog, posture: 'local' });
  guardRunner.freeze();

  const piiScanner = new ChatPiiScanner({
    auditLog,
    enableNer: process.env.YOJIN_PII_NER === '1',
  });

  const agentRuntime = new AgentRuntime({
    agentRegistry,
    toolRegistry,
    guardRunner,
    sessionStore: new JsonlSessionStore(`${dataRoot}/data/sessions`),
    eventLog: new EventLog(`${dataRoot}/data/event-log`),
    provider: providerRouter,
    outputDlp,
    piiScanner,
    dataRoot,
  });

  const gateway = new Gateway(config, agentRuntime);

  // Graceful shutdown
  const shutdown = async () => {
    await gateway.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await gateway.start();
}

function startFrontend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['--filter', '@yojin/web', 'dev'], {
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Frontend exited with code ${code}`))));
    child.on('error', reject);
  });
}

function printHelp(): void {
  console.log(`
Yojin — Your personal AI finance agent

Commands:
  yojin                Start Yojin (server + dashboard)
  yojin chat           Chat with Yojin in your terminal
  yojin setup          Connect your Claude account

Advanced:
  yojin serve          Start the server only (no dashboard)
  yojin web            Start the dashboard only
  yojin secret <cmd>   Manage stored credentials
  yojin version        Print version
  yojin help           Show this message
`);
}
