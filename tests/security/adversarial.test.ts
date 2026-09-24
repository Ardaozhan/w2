import { describe, expect, it } from 'vitest';
import { RetryPolicy, SafetyError, assertCapability, assertWorkspacePath, redactSecrets } from '../../src/core/safety.js';
import { ToolRuntime } from '../../src/core/runtime.js';

describe('W2 adversarial scenarios', () => {
  it('ADV-SECURITY-INJECTION rejects traversal and redacts injected secrets', () => {
    expect(() => assertWorkspacePath(process.cwd(), '..\\outside.txt')).toThrow('Path escapes workspace');
    expect(redactSecrets('token=placeholder-secret')).toContain('[REDACTED]');
  });

  it('ADV-AUTH-UNAUTHENTICATED denies a capability without a grant', () => {
    expect(() => assertCapability(new Set(), 'fs.write')).toThrow('Capability denied');
  });

  it('ADV-AUTH-UNAUTHORIZED rejects an unapproved high-risk shell operation', async () => {
    const runtime = new ToolRuntime(process.cwd(), { capabilities: ['shell.execute'], approval: async () => false });
    await expect(runtime.shell('git', ['push', 'origin', 'main'])).rejects.toThrow('Approval denied');
  });

  it('ADV-AUTH-PRIVILEGE enforces the shell capability boundary', async () => {
    const runtime = new ToolRuntime(process.cwd(), { capabilities: [] });
    await expect(runtime.shell('echo', ['privileged'])).rejects.toThrow('Capability denied');
  });

  it('ADV-CONCURRENCY-RACE keeps retry attempts bounded', () => {
    const policy = new RetryPolicy(2);
    expect(policy.decide('race', 'retry').decision).toBe('RETRY');
    expect(policy.decide('race', 'retry').decision).toBe('RETRY');
    expect(policy.decide('race', 'stop').decision).toBe('STOP');
  });

  it('ADV-IDEMPOTENCY-REPEAT produces the same redaction result on repeat', () => {
    const value = 'Authorization: Bearer demo';
    expect(redactSecrets(value)).toBe(redactSecrets(value));
  });

  it('ADV-TIME-BOUNDARY enforces a shell timeout', async () => {
    const runtime = new ToolRuntime(process.cwd(), { capabilities: ['shell.execute'] });
    const result = await runtime.shell(process.execPath, ['-e', 'setTimeout(() => {}, 200)'], 25);
    expect(result.exitCode).toBe(124);
  });
});
