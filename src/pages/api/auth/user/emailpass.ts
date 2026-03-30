import type { APIRoute } from "astro";
import { getCorsHeaders } from "@/lib/cors";
import { verifyPassword, generateToken } from "@/services/auth";

// In-memory rate limiting: 5 failed attempts → 15 min lockout per IP
const failedAttempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000

export const POST: APIRoute = async ({ request }) => {
  const corsH = getCorsHeaders(request)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || request.headers.get("cf-connecting-ip")
    || "unknown"

  const now = Date.now()
  const attempts = failedAttempts.get(ip)

  // Check lockout
  if (attempts && now < attempts.resetAt && attempts.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((attempts.resetAt - now) / 1000)
    return new Response(
      JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          ...corsH,
        },
      }
    )
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsH } }
      );
    }

    const user = await verifyPassword(email, password);
    const token = await generateToken(user.id, user.email);

    // Clear failed attempts on success
    failedAttempts.delete(ip)

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsH } }
    );
  } catch (err: any) {
    // Record failed attempt
    const prev = failedAttempts.get(ip)
    if (!prev || now >= prev.resetAt) {
      failedAttempts.set(ip, { count: 1, resetAt: now + LOCKOUT_MS })
    } else {
      failedAttempts.set(ip, { count: prev.count + 1, resetAt: prev.resetAt })
    }

    // Artificial delay to slow brute force
    await new Promise((r) => setTimeout(r, 500))

    return new Response(
      JSON.stringify({ error: "Credenciais invalidas" }),
      { status: 401, headers: { "Content-Type": "application/json", ...corsH } }
    );
  }
};

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
};
