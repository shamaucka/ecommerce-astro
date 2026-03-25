import type { APIRoute } from "astro";
import { corsHeaders, getCorsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcwjafvah",
  api_key: process.env.CLOUDINARY_API_KEY || "113851671851966",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

export const POST: APIRoute = async ({ request }) => {
  const headers = getCorsHeaders(request);
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder: "tessquadros",
      resource_type: "image",
      quality: "auto:good",
      fetch_format: "auto",
    });

    const url = result.secure_url;

    return new Response(
      JSON.stringify({ files: [{ url, public_id: result.public_id }] }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao fazer upload" }),
      { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
    );
  }
};

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
};
