/**
 * Helper para URLs de imagem otimizadas via imgproxy.
 *
 * Em dev: retorna a URL original (sem imgproxy).
 * Em prod: gera URL imgproxy com resize + formato automatico (webp/avif).
 *
 * Quando Cloudflare estiver na frente, a URL sera:
 *   https://img.sualoja.com.br/insecure/rs:fill:600:600/plain/local:///nome-da-imagem.webp
 *
 * O Cloudflare cacheia no edge (PoP Sao Paulo) com TTL longo.
 */

const IMGPROXY_URL = import.meta.env.IMGPROXY_URL || "http://localhost:8081"
const USE_IMGPROXY = import.meta.env.USE_IMGPROXY === "true"

type ImageOptions = {
  width?: number
  height?: number
  quality?: number
  fit?: "fill" | "fit" | "auto"
  format?: "webp" | "avif" | "jpg" | "png" | "auto"
  gravity?: "no" | "sm" | "ce" // no=north, sm=smart, ce=center
}

/**
 * Gera URL otimizada para uma imagem.
 *
 * @param src - URL original da imagem (ex: "http://localhost:4000/static/foto.webp" ou "/static/foto.webp")
 * @param options - Opcoes de redimensionamento
 * @returns URL otimizada (imgproxy em prod, original em dev)
 */
export function imageUrl(src: string | null | undefined, options: ImageOptions = {}): string {
  if (!src) return "/placeholder.svg"

  // Se imgproxy nao esta habilitado, retorna original
  if (!USE_IMGPROXY) return src

  const {
    width = 0,
    height = 0,
    quality = 80,
    fit = "fill",
    gravity = "sm",
    format = "auto",
  } = options

  // Determinar source path
  let sourcePath: string

  if (src.startsWith("http://localhost") || src.startsWith("/static/")) {
    // Imagem local - usar filesystem do imgproxy
    const filename = src.split("/static/").pop() || src.split("/").pop() || ""
    sourcePath = `local:///${filename}`
  } else if (src.startsWith("http")) {
    // Imagem externa - imgproxy faz download
    sourcePath = `plain/${src}`
  } else {
    sourcePath = `plain/${src}`
  }

  // Construir URL imgproxy
  // Formato: /insecure/rs:{fit}:{w}:{h}/g:{gravity}/q:{quality}/{source}
  const parts = ["insecure"]

  if (width || height) {
    parts.push(`rs:${fit}:${width}:${height}`)
  }

  parts.push(`g:${gravity}`)
  parts.push(`q:${quality}`)

  if (format !== "auto") {
    // Formato especifico
    return `${IMGPROXY_URL}/${parts.join("/")}/${sourcePath}@${format}`
  }

  // Formato automatico (imgproxy detecta pelo Accept header)
  return `${IMGPROXY_URL}/${parts.join("/")}/${sourcePath}`
}

/**
 * Gera srcset responsivo para <img> ou <picture>.
 *
 * @param src - URL original
 * @param widths - Array de larguras (ex: [300, 600, 900, 1200])
 * @returns string para usar em srcset=""
 */
export function imageSrcSet(src: string | null | undefined, widths: number[] = [300, 600, 900, 1200]): string {
  if (!src || !USE_IMGPROXY) return ""

  return widths
    .map((w) => `${imageUrl(src, { width: w, height: 0, fit: "fit" })} ${w}w`)
    .join(", ")
}

/**
 * Presets comuns para e-commerce.
 */
export const IMAGE_PRESETS = {
  thumbnail: { width: 100, height: 100, fit: "fill" as const, quality: 70 },
  card: { width: 400, height: 400, fit: "fill" as const, quality: 80 },
  product: { width: 800, height: 800, fit: "fit" as const, quality: 85 },
  productZoom: { width: 1600, height: 1600, fit: "fit" as const, quality: 90 },
  banner: { width: 1200, height: 600, fit: "fill" as const, quality: 80, gravity: "sm" as const },
  bannerMobile: { width: 600, height: 750, fit: "fill" as const, quality: 80, gravity: "sm" as const },
  og: { width: 1200, height: 630, fit: "fill" as const, quality: 85 },
} as const
