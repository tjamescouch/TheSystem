#!/usr/bin/env node

import { loadConfig, writeDefaultConfig } from './config-loader';
import { checkAll } from './compatibility-checker';
import { Orchestrator } from './orchestrator';
import { ComponentStatus } from './types';

const VERSION = '0.1.0';

function printUsage(): void {
  console.log(`
thesystem v${VERSION} — install it and you have a dev shop

Usage:
  thesystem init          Create thesystem.yaml with defaults
  thesystem start         Boot all components
  thesystem stop          Graceful shutdown (sends SIGTERM)
  thesystem status        Show component status
  thesystem doctor        Check system health
  thesystem config        Show resolved configuration
  thesystem version       Show version
  thesystem help          Show this message
`);
}

function printStatusTable(statuses: ComponentStatus[]): void {
  const header = 'Component'.padEnd(25) + 'Version'.padEnd(12) + 'Port'.padEnd(8) + 'PID'.padEnd(10) + 'Status'.padEnd(12) + 'Restarts';
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const s of statuses) {
    console.log(
      s.name.padEnd(25) +
      s.version.padEnd(12) +
      (s.port || '-').toString().padEnd(8) +
      (s.pid || '-').toString().padEnd(10) +
      s.status.padEnd(12) +
      s.restarts
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'init': {
      const configPath = writeDefaultConfig(process.cwd());
      console.log(`Created ${configPath}`);
      console.log('Edit the file to customize, then run: thesystem start');
      break;
    }

    case 'start': {
      const config = loadConfig();
      console.log('[thesystem] Starting TheSystem...');

      const orchestrator = new Orchestrator();

      process.on('SIGINT', async () => {
        console.log('\n[thesystem] Caught SIGINT, shutting down...');
        await orchestrator.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log('\n[thesystem] Caught SIGTERM, shutting down...');
        await orchestrator.stop();
        process.exit(0);
      });

      await orchestrator.start(config);
      console.log('\n[thesystem] Status:');
      printStatusTable(orchestrator.getStatus());
      console.log('\n[thesystem] TheSystem is running. Press Ctrl+C to stop.');

      // Keep process alive
      await new Promise(() => {});
      break;
    }

    case 'stop': {
      console.log('[thesystem] Sending stop signal...');
      // In a real implementation, this would signal the running process
      console.log('[thesystem] Use Ctrl+C on the running thesystem process.');
      break;
    }

    case 'status': {
      const config = loadConfig();
      const orchestrator = new Orchestrator();
      orchestrator.buildComponentList(config);
      printStatusTable(orchestrator.getStatus());
      break;
    }

    case 'doctor': {
      console.log('[thesystem] Running diagnostics...\n');

      // Check Node version
      const nodeVersion = process.versions.node;
      const [major] = nodeVersion.split('.').map(Number);
      if (major >= 20) {
        console.log(`  Node.js ${nodeVersion} ... ok`);
      } else {
        console.log(`  Node.js ${nodeVersion} ... FAIL (need >= 20)`);
      }

      // Check config
      try {
        loadConfig();
        console.log('  thesystem.yaml ... ok');
      } catch {
        console.log('  thesystem.yaml ... not found (will use defaults)');
      }

      // Check component compatibility
      const installed: Record<string, string> = {};
      for (const pkg of ['agentchat', 'agentctl-swarm', 'agentchat-dashboard']) {
        try {
          const pkgJson = require(`${pkg}/package.json`);
          installed[pkg] = pkgJson.version;
          console.log(`  ${pkg}@${pkgJson.version} ... installed`);
        } catch {
          console.log(`  ${pkg} ... not installed`);
        }
      }

      if (Object.keys(installed).length > 0) {
        const result = checkAll(installed);
        if (result.compatible) {
          console.log('\n  Compatibility ... ok');
        } else {
          console.log('\n  Compatibility ... ISSUES:');
          for (const issue of result.issues) {
            console.log(`    - ${issue}`);
          }
          for (const suggestion of result.suggestions) {
            console.log(`    suggestion: ${suggestion}`);
          }
        }
      }

      console.log('\n[thesystem] Diagnostics complete.');
      break;
    }

    case 'config': {
      const config = loadConfig();
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case 'version': {
      console.log(`thesystem v${VERSION}`);
      break;
    }

    case 'help':
    default: {
      printUsage();
      break;
    }
  }
}

main().catch((err) => {
  console.error('[thesystem] Fatal error:', err.message);
  process.exit(1);
});
