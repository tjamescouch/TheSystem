# cli

the user-facing command-line interface.

## state

- parsed command and flags
- resolved config (defaults merged with thesystem.yaml)
- component registry (installed components and their versions)

## capabilities

- `thesystem init` — create a thesystem.yaml with defaults, install components
- `thesystem start` — boot all components in dependency order
- `thesystem stop` — graceful shutdown of all components
- `thesystem status` — show running components, versions, ports, health
- `thesystem upgrade [component]` — upgrade a component within compatibility bounds
- `thesystem config` — show resolved configuration
- `thesystem doctor` — check system health, dependencies, port availability

## interfaces

exposes:
- CLI binary `thesystem` with subcommands

depends on:
- config-loader (to read thesystem.yaml)
- orchestrator (to start/stop/manage components)
- compatibility-checker (to validate upgrades)

## invariants

- every command provides --help with usage examples
- destructive operations require confirmation
- exit codes: 0 success, 1 error, 2 misconfiguration
