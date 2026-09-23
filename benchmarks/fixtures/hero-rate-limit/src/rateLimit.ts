export class LoginRateLimiter {
  isRateLimited(_clientId: string, _now = Date.now()): boolean {
    return false;
  }

  recordFailure(_clientId: string, _now = Date.now()): void {}
}
