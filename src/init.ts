import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { writeDefaultConfig } from './config-loader';

/**
 * Interactive init — guides user through first-time setup.
 * 
 * Steps:
 * 1. Write thesystem.yaml with defaults
 * 2. Check for API keys in environment
 * 3. If missing, prompt user and write to .env file
 * 4. Run basic prerequisite checks
 */

interface InitOptions {
  cwd: string;
  nonInteractive?: boolean;
}

function checkPrerequisite(name: string, checkCmd: string): Promise<boolean> {
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const exec = promisify(execFile);
  
  return exec('which', [name])
    .then(() => true)
    .catch(() => false);
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function promptSecret(rl: readline.Interface, question: string): Promise<string> {
  // Note: readline doesn't natively hide input, but this is fine for terminal use
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function runInit(options: InitOptions): Promise<void> {
  const { cwd, nonInteractive } = options;
  
  console.log('[thesystem] Initializing...\n');

  // Step 1: Write config file
  const configPath = path.join(cwd, 'thesystem.yaml');
  if (fs.existsSync(configPath)) {
    console.log('  thesystem.yaml ... already exists (keeping existing)');
  } else {
    writeDefaultConfig(cwd);
    console.log('  thesystem.yaml ... created with defaults');
  }

  // Step 2: Check prerequisites
  console.log('\n[thesystem] Checking prerequisites...\n');
  
  const prereqs: { name: string; cmd: string; install: string }[] = [
    { name: 'limactl', cmd: 'limactl', install: 'brew install lima' },
    { name: 'node', cmd: 'node', install: 'brew install node' },
  ];

  let allGood = true;
  for (const p of prereqs) {
    const found = await checkPrerequisite(p.name, p.cmd);
    if (found) {
      console.log(`  ✓ ${p.name}`);
    } else {
      console.log(`  ✗ ${p.name} — install with: ${p.install}`);
      allGood = false;
    }
  }

  // Step 3: Check API keys
  console.log('\n[thesystem] Checking API keys...\n');
  
  const envFile = path.join(cwd, '.env');
  const existingEnv = fs.existsSync(envFile) 
    ? fs.readFileSync(envFile, 'utf-8') 
    : '';

  const keyChecks: { name: string; envVar: string; prompt: string }[] = [
    { 
      name: 'Anthropic', 
      envVar: 'ANTHROPIC_API_KEY',
      prompt: 'Enter your Anthropic API key (sk-ant-...): '
    },
  ];

  const newEnvLines: string[] = [];
  let needsEnvWrite = false;

  for (const key of keyChecks) {
    const inEnv = !!process.env[key.envVar];
    const inFile = existingEnv.includes(`${key.envVar}=`);

    if (inEnv || inFile) {
      console.log(`  ✓ ${key.name} (${key.envVar}) — found`);
    } else if (nonInteractive) {
      console.log(`  ✗ ${key.name} (${key.envVar}) — not set`);
      console.log(`    Set it: export ${key.envVar}=your-key`);
    } else {
      console.log(`  ? ${key.name} (${key.envVar}) — not found`);
      
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const value = await promptSecret(rl, `    ${key.prompt}`);
      rl.close();

      if (value) {
        newEnvLines.push(`${key.envVar}=${value}`);
        needsEnvWrite = true;
        console.log(`    ✓ Saved to .env`);
      } else {
        console.log(`    → Skipped (set later: export ${key.envVar}=your-key)`);
      }
    }
  }

  // Write .env if we collected any keys
  if (needsEnvWrite) {
    const envContent = existingEnv
      ? existingEnv.trimEnd() + '\n' + newEnvLines.join('\n') + '\n'
      : '# TheSystem environment\n# API keys — do not commit this file!\n\n' + newEnvLines.join('\n') + '\n';
    
    fs.writeFileSync(envFile, envContent, { mode: 0o600 });
    
    // Ensure .env is in .gitignore
    const gitignorePath = path.join(cwd, '.gitignore');
    const gitignore = fs.existsSync(gitignorePath) 
      ? fs.readFileSync(gitignorePath, 'utf-8')
      : '';
    if (!gitignore.includes('.env')) {
      fs.appendFileSync(gitignorePath, '\n.env\n');
      console.log('\n  Added .env to .gitignore');
    }
  }

  // Step 4: Summary
  console.log('\n[thesystem] Init complete.\n');
  
  if (!allGood) {
    console.log('  ⚠ Some prerequisites are missing. Install them, then run:');
    console.log('    thesystem doctor\n');
  }

  console.log('  Next steps:');
  console.log('    1. Edit thesystem.yaml if needed');
  if (needsEnvWrite) {
    console.log('    2. Source your .env: source .env');
  }
  console.log(`    ${needsEnvWrite ? '3' : '2'}. Start everything: thesystem start`);
  console.log('');
}
