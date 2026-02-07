import { COMPATIBILITY_MATRIX } from './types';

function parseVersion(v: string): [number, number, number] {
  const parts = v.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a: string, b: string): number {
  const [a0, a1, a2] = parseVersion(a);
  const [b0, b1, b2] = parseVersion(b);
  if (a0 !== b0) return a0 - b0;
  if (a1 !== b1) return a1 - b1;
  return a2 - b2;
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
  suggestions: string[];
}

export function checkComponent(component: string, version: string): CompatibilityResult {
  const entry = COMPATIBILITY_MATRIX[component];
  if (!entry) {
    return {
      compatible: true,
      issues: [],
      suggestions: [`Unknown component "${component}" — not in compatibility matrix`],
    };
  }

  const issues: string[] = [];
  const suggestions: string[] = [];

  if (compareVersions(version, entry.min) < 0) {
    issues.push(`${component}@${version} is below minimum ${entry.min}`);
    suggestions.push(`Upgrade ${component} to at least ${entry.min}`);
  }

  if (compareVersions(version, entry.max) > 0) {
    issues.push(`${component}@${version} exceeds maximum ${entry.max}`);
    suggestions.push(`Downgrade ${component} to at most ${entry.max} or upgrade TheSystem`);
  }

  return {
    compatible: issues.length === 0,
    issues,
    suggestions,
  };
}

export function checkAll(installed: Record<string, string>): CompatibilityResult {
  const allIssues: string[] = [];
  const allSuggestions: string[] = [];

  for (const [component, version] of Object.entries(installed)) {
    const result = checkComponent(component, version);
    allIssues.push(...result.issues);
    allSuggestions.push(...result.suggestions);
  }

  return {
    compatible: allIssues.length === 0,
    issues: allIssues,
    suggestions: allSuggestions,
  };
}
