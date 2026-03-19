const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3005,http://localhost:3006,http://localhost:4000")
  .split(",")
  .map((o) => o.trim())

export function corsHeaders(request?: Request): Record<string, string> {
  const requestOrigin = request?.headers.get("Origin") ?? ""
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}
