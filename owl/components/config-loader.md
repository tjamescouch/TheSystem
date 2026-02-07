# config-loader

reads, validates, and merges configuration from defaults and thesystem.yaml.

## state

- default config (built-in sensible defaults)
- user config (from thesystem.yaml)
- resolved config (defaults merged with user overrides)
- environment variable bindings

## capabilities

- locate thesystem.yaml (cwd, then walk up to git root)
- parse YAML with clear error messages on syntax errors
- validate against config schema (known keys, correct types, valid ranges)
- merge user config over defaults (deep merge)
- resolve environment variable references (`${ENV_VAR}` syntax in config values)
- generate a default thesystem.yaml for `thesystem init`

## interfaces

exposes:
- `load()` — find, parse, validate, merge, return resolved config
- `generateDefault()` — return a default config as YAML string

depends on:
- filesystem (to read thesystem.yaml)
- environment (to resolve variable references)

## invariants

- unknown config keys produce warnings, not errors (forward compatibility)
- missing config file is not an error — defaults are always sufficient
- secrets are never logged or written to disk
