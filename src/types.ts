export interface ComponentConfig {
  name: string;
  package: string;
  port: number;
  command: string;
  args: string[];
  healthEndpoint?: string;
  dependsOn: string[];
}

export interface SystemConfig {
  server: {
    port: number;
  };
  swarm: {
    agents: number;
    backend: string;
  };
  dashboard: {
    port: number;
  };
  channels: string[];
}

export interface CompatibilityMatrix {
  [component: string]: {
    min: string;
    max: string;
  };
}

export interface ComponentStatus {
  name: string;
  version: string;
  port: number;
  pid: number | null;
  status: 'running' | 'stopped' | 'degraded' | 'starting';
  restarts: number;
}

export const DEFAULT_CONFIG: SystemConfig = {
  server: {
    port: 6667,
  },
  swarm: {
    agents: 2,
    backend: 'claude',
  },
  dashboard: {
    port: 3000,
  },
  channels: ['#general', '#agents'],
};

export const COMPATIBILITY_MATRIX: CompatibilityMatrix = {
  'agentchat': { min: '0.1.0', max: '1.0.0' },
  'agentctl-swarm': { min: '0.1.0', max: '1.0.0' },
  'agentchat-dashboard': { min: '0.1.0', max: '1.0.0' },
};
