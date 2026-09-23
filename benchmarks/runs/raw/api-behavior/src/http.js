export function statusFor(code) {
  if (code >= 200 && code < 300) return "success";
  if (code >= 400 && code < 500) return "client-error";
  return "server-error";
}
