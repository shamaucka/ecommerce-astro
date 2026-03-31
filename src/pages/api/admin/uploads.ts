import type { APIRoute } from "astro";
import { corsHeaders, getCorsHeaders } from "@/lib/cors";
import { requireAuth } from "@/services/auth";
import { v2 as cloudinary } from "cloudinary";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;   // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100MB

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

    const isImage = IMAGE_TYPES.has(file.type);
    const isVideo = VIDEO_TYPES.has(file.type);

    if (!isImage && !isVideo) {
      return new Response(
        JSON.stringify({ error: "Tipo nao permitido. Aceitos: JPEG, PNG, WebP, AVIF, MP4, WebM, MOV." }),
        { status: 400, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: `Arquivo excede ${isVideo ? "100MB" : "10MB"}.` }),
        { status: 400, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const resourceType = isVideo ? "video" : "image";
    const folder = isVideo ? "tessquadros/videos" : "tessquadros";

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64, {
      folder,
      resource_type: resourceType,
      ...(isImage ? { quality: "auto:good", fetch_format: "auto" } : {}),
    });

    // Rewrite Cloudinary URL to custom CDN
    const url = result.secure_url.replace(
      /^https:\/\/res\.cloudinary\.com\/[^/]+\//,
      "https://cdn.tessquadros.com.br/"
    );

    return new Response(
      JSON.stringify({ files: [{ url, public_id: result.public_id, resource_type: resourceType }] }),
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
