# orchestrator

manages the lifecycle of all components as child processes.

## state

- component process map: `{ name: { pid, port, status, restarts } }`
- dependency graph (boot order)
- health check intervals

## capabilities

- start components in dependency order (server first, then swarm, then dashboard)
- stop components in reverse dependency order
- monitor component health via HTTP health endpoints or process signals
- restart failed components with exponential backoff (max 5 retries)
- multiplex component logs to stdout with `[component]` prefixes
- expose aggregate status (all components healthy / degraded / down)

## interfaces

exposes:
- `start(config)` — boot all components
- `stop()` — graceful shutdown
- `status()` — return component health map
- `restart(component)` — restart a single component

depends on:
- config-loader (for component configuration)
- each component's binary/entry point

## invariants

- components are always stopped in reverse boot order
- a component is never started if its dependencies are not healthy
- health check failure triggers restart, not immediate crash
- all child processes are cleaned up on TheSystem exit (SIGTERM propagation)
