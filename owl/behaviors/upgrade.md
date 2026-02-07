# upgrade

how TheSystem handles component upgrades with version safety.

## upgrade flow

1. user runs `thesystem upgrade [component]`
2. if no component specified: check all components for available updates
3. compatibility-checker resolves the latest compatible version
4. if target version is incompatible with other installed components:
   a. report the conflict
   b. suggest a resolution (upgrade other components too, or pin to a lower version)
   c. abort unless user confirms with --force
5. if compatible: install the new version via npm
6. if TheSystem is running: restart the upgraded component only
7. cli prints updated status table

## doctor flow

1. user runs `thesystem doctor`
2. check Node.js version (>= 20)
3. check all components installed and importable
4. check version compatibility matrix
5. check port availability for all configured ports
6. check agentchat server reachable (if running)
7. report issues with suggested fixes
