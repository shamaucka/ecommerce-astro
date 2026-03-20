import bcrypt from "bcryptjs"
import { SignJWT, jwtVerify } from "jose"
import { eq } from "drizzle-orm"
import { db } from "../db/index.js"
import { astroAdminUser } from "../db/schema/product.js"

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "dev-local-secret-change-in-production-abc123xyz789"
  return new TextEncoder().encode(secret)
}

export async function verifyPassword(email: string, password: string) {
  const results = await db
    .select()
    .from(astroAdminUser)
    .where(eq(astroAdminUser.email, email))
    .limit(1)

  const user = results[0]
  if (!user) {
    throw new Error("Credenciais invalidas")
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    throw new Error("Credenciais invalidas")
  }

  return { id: user.id, email: user.email }
}

export async function generateToken(userId: string, email: string) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecret())
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return { userId: payload.sub as string, email: payload.email as string }
  } catch {
    throw new Error("Token invalido ou expirado")
  }
}

export async function requireAuth(request: Request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Token de autenticacao nao fornecido")
  }

  const token = authHeader.slice(7)
  return verifyToken(token)
}
