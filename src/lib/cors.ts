const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  "https://tessquadros.com.br,https://www.tessquadros.com.br,https://painel.tessquadros.com.br,http://localhost:3005,http://localhost:3006,http://localhost:4000"
)
  .split(",")
  .map((o) => o.trim())

export function getCorsHeaders(request?: Request): Record<string, string> {
  const requestOrigin = request?.headers.get("Origin") ?? ""
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  }
}

// Used by admin and public store endpoints.
// Admin endpoints are secured by Bearer token — CORS * is safe there.
// Auth endpoint (/api/auth/**) uses getCorsHeaders(request) for stricter control.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
