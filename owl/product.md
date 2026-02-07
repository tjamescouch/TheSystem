# TheSystem

install it and you have a dev shop.

## what it is

a thin orchestrator that bootstraps a complete multi-agent development environment from published packages. one command gives you: a communication server, a swarm of AI agents, a real-time dashboard, and the tools to coordinate them.

## what it is not

- not a monorepo — each component lives in its own published package
- not a framework — it doesn't impose structure on your project
- not a runtime — it delegates execution to the components it installs

## first principles

### axiom 1: composition over integration

TheSystem doesn't contain the components — it installs, configures, and orchestrates them. each component is a standalone package that works independently. TheSystem is the glue.

### axiom 2: version compatibility is enforced

every release of TheSystem declares a compatibility matrix. component versions are pinned to known-good combinations. upgrading one component checks compatibility with all others before proceeding.

### axiom 3: one command to start

`thesystem start` boots the entire stack. `thesystem stop` shuts it down. the human should never need to manage individual services manually unless they want to.

### axiom 4: progressive disclosure

a new user runs `thesystem init` and gets a working setup with sensible defaults. an advanced user edits `thesystem.yaml` to customize every detail. the simple path and the power-user path coexist.

## components

see [components/](components/)

## behaviors

see [behaviors/](behaviors/)

## constraints

see [constraints.md](constraints.md)
