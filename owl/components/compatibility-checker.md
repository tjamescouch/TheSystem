# compatibility-checker

enforces version compatibility between components.

## state

- compatibility matrix: `{ component: { min: semver, max: semver } }`
- installed versions: `{ component: semver }`

## capabilities

- check if a component version is compatible with the current matrix
- check if an upgrade target is compatible with all other installed components
- report incompatibilities with clear messages (which versions conflict, what to upgrade)
- suggest a resolution path (upgrade X to Y, or downgrade Z to W)

## interfaces

exposes:
- `check(component, targetVersion)` — returns compatible/incompatible with details
- `checkAll()` — validate all installed components against the matrix
- `suggest(component)` — return the best compatible version for a component

depends on:
- the embedded compatibility matrix (shipped with each TheSystem release)
- installed component versions (from node_modules or global installs)

## invariants

- the matrix is never fetched from the network — it ships with the release
- incompatible installs are blocked, not warned
- the matrix is the single source of truth for version compatibility
