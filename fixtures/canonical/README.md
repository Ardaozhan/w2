# Canonical fixture

The nested `project` is a deterministic TypeScript bug fixture. Its initial
implementation subtracts percentage points instead of calculating a percentage.
The tracked baseline is reset with `git -C project reset --hard canonical-baseline`.
