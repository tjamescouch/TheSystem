# cli

the user-facing command-line interface.

## state

- parsed command and flags
- resolved config (defaults merged with thesystem.yaml)
- component registry (installed components and their versions)

## capabilities

- `thesystem init` — create thesystem.yaml with defaults, prompt for API keys → Keychain, validate prerequisites
- `thesystem start` — boot all components in dependency order (proxy → VM → services → swarm)
- `thesystem stop` — graceful shutdown of all components in reverse order
- `thesystem status` — show running components, versions, ports, health
- `thesystem destroy` — stop all services, delete Lima VM and all state
- `thesystem doctor` — check system health (node, lima, podman, keys, ports, proxy)
- `thesystem config` — show resolved configuration as JSON
- `thesystem logs [service]` — tail recent logs for a service (agentchat-server, dashboard, swarm)
- `thesystem version` — print version
- `thesystem keys set <provider> <key>` — store/update API key in macOS Keychain (target state)
- `thesystem keys rotate` — rotate keys in Keychain, restart proxy (target state)
- `thesystem upgrade [component]` — upgrade a component within compatibility bounds

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
