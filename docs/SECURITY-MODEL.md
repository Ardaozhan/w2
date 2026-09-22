# W2 Phase 03 Security Model

W2 uses a scoped runtime policy, not a claim of a secure sandbox. Tools declare
capabilities and the runtime fails closed when a capability is absent. The
default local policy permits `fs.read`, `fs.write`, `shell.execute`, and
`git.read`; delete, git write, network, secret, and external capabilities are
not granted by default.

Workspace paths are canonicalized with `realpath`. Traversal and symlink escape
are rejected before filesystem access. Shell execution is bounded by timeout,
output, filtered environment, and runtime budgets. High-risk shell actions and
deletes require an approval callback; an absent callback means DENY.

Denied actions, approval requests/resolutions, budget exhaustion, checkpoints,
resume, and abort are persisted as ordered run events and therefore appear in
the evidence projection.

This is a credible local boundary for the competition harness. It is not an
OS-level container, a remote sandbox, or a zero-trust security product.
