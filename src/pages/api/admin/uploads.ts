import type { APIRoute } from "astro";
import { corsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const POST: APIRoute = async ({ request }) => {
  const headers = corsHeaders(request);
  try {
    await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: "Nenhum arquivo enviado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: "Tipo de arquivo nao permitido. Apenas JPEG, PNG, WebP e AVIF." }),
        { status: 400, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "Arquivo excede o tamanho maximo de 10MB." }),
        { status: 400, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    const uploadDir = join(process.cwd(), "public", "static");
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const ext = extname(file.name).replace(/[^a-zA-Z0-9.]/g, "").toLowerCase();
    const baseName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 100);
    const safeName = baseName ? `${baseName}${ext}` : `upload${ext}`;
    const filename = `${timestamp}-${safeName}`;
    const filepath = join(uploadDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    return new Response(
      JSON.stringify({ files: [{ url: `/static/${filename}` }] }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao fazer upload" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(request) } }
    );
  }
};

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
};
