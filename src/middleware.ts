import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  const response = await next()

  // Security headers em todas as respostas
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")

  // Cache longo para imagens estaticas (1 ano)
  if (url.pathname.startsWith("/static/")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable")
    response.headers.set("Access-Control-Allow-Origin", "*")
  }

  return response
})
