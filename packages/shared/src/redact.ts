/** Strip secrets and operator-machine PII from hop traces. Public rail facts stay. */
export function redactTrace(msg: string): string {
  return String(msg)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/0x[0-9a-fA-F]{64}/g, "0x[redacted]")
    .replace(/\b302[a-eA-E][0-9a-fA-F]{60,}\b/g, "[redacted-key]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/[A-Za-z]:\\[^\s"'<>]+/g, "[path]")
    .replace(/\/(?:Users|home|root)\/[^\s"'<>]+/g, "[path]")
    .replace(/[^\s"'<>]*\.env\b[^\s"'<>]*/gi, "[env]")
    .replace(
      /\b(GRAPH_API_KEY|HEDERA_[A-Z0-9_]*KEY|[A-Z0-9_]*SECRET|[A-Z0-9_]*PASSWORD|[A-Z0-9_]*TOKEN|API_KEY)\s*[=:]\s*\S+/gi,
      "$1=[redacted]",
    )
    .replace(
      /([?&](?:api[_-]?key|access[_-]?token|token|secret|password|auth)=)[^&\s]+/gi,
      "$1[redacted]",
    );
}
