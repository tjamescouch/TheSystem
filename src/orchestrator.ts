import { spawn, ChildProcess } from 'child_process';
import { SystemConfig, ComponentStatus } from './types';

interface ManagedComponent {
  name: string;
  command: string;
  args: string[];
  port: number;
  process: ChildProcess | null;
  status: ComponentStatus;
}

export class Orchestrator {
  private components: Map<string, ManagedComponent> = new Map();
  private shutdownInProgress = false;

  buildComponentList(config: SystemConfig): void {
    this.components.set('agentchat-server', {
      name: 'agentchat-server',
      command: 'npx',
      args: ['agentchat-server', '--port', String(config.server.port)],
      port: config.server.port,
      process: null,
      status: {
        name: 'agentchat-server',
        version: '0.1.0',
        port: config.server.port,
        pid: null,
        status: 'stopped',
        restarts: 0,
      },
    });

    this.components.set('agentctl-swarm', {
      name: 'agentctl-swarm',
      command: 'npx',
      args: ['agentctl-swarm', 'start', '--count', String(config.swarm.agents)],
      port: 0,
      process: null,
      status: {
        name: 'agentctl-swarm',
        version: '0.1.0',
        port: 0,
        pid: null,
        status: 'stopped',
        restarts: 0,
      },
    });

    this.components.set('agentchat-dashboard', {
      name: 'agentchat-dashboard',
      command: 'npx',
      args: ['agentchat-dashboard', '--port', String(config.dashboard.port)],
      port: config.dashboard.port,
      process: null,
      status: {
        name: 'agentchat-dashboard',
        version: '0.1.0',
        port: config.dashboard.port,
        pid: null,
        status: 'stopped',
        restarts: 0,
      },
    });
  }

  async start(config: SystemConfig): Promise<void> {
    this.buildComponentList(config);
    const bootOrder = ['agentchat-server', 'agentctl-swarm', 'agentchat-dashboard'];

    for (const name of bootOrder) {
      const component = this.components.get(name);
      if (!component) continue;

      console.log(`[thesystem] Starting ${name}...`);
      await this.startComponent(component);
      console.log(`[thesystem] ${name} started (PID: ${component.status.pid})`);
    }

    console.log('[thesystem] All components started.');
  }

  private async startComponent(component: ManagedComponent): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(component.command, component.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      component.process = child;
      component.status.pid = child.pid || null;
      component.status.status = 'running';

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          console.log(`[${component.name}] ${line}`);
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        for (const line of lines) {
          console.error(`[${component.name}] ${line}`);
        }
      });

      child.on('exit', (code) => {
        component.status.status = 'stopped';
        component.status.pid = null;
        if (!this.shutdownInProgress) {
          console.log(`[thesystem] ${component.name} exited with code ${code}`);
          if (component.status.restarts < 5) {
            component.status.restarts++;
            const delay = Math.min(1000 * Math.pow(2, component.status.restarts), 30000);
            console.log(`[thesystem] Restarting ${component.name} in ${delay}ms...`);
            setTimeout(() => this.startComponent(component), delay);
          }
        }
      });

      // Give it a moment to start
      setTimeout(resolve, 1000);
    });
  }

  async stop(): Promise<void> {
    this.shutdownInProgress = true;
    const stopOrder = ['agentchat-dashboard', 'agentctl-swarm', 'agentchat-server'];

    for (const name of stopOrder) {
      const component = this.components.get(name);
      if (!component?.process) continue;

      console.log(`[thesystem] Stopping ${name}...`);
      component.process.kill('SIGTERM');

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          component.process?.kill('SIGKILL');
          resolve();
        }, 5000);

        component.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      component.status.status = 'stopped';
      component.status.pid = null;
      console.log(`[thesystem] ${name} stopped.`);
    }

    console.log('[thesystem] All components stopped.');
  }

  getStatus(): ComponentStatus[] {
    return Array.from(this.components.values()).map((c) => c.status);
  }
}
