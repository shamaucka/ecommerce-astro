import { defineMiddleware } from "astro:middleware"

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  const response = await next()

  // Cache longo para imagens estaticas (1 ano)
  if (url.pathname.startsWith("/static/")) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable")
    response.headers.set("Access-Control-Allow-Origin", "*")
  }

  return response
})
