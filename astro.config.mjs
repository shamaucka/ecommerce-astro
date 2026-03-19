import { defineConfig } from "astro/config"
import node from "@astrojs/node"
import react from "@astrojs/react"

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: { port: 4000, host: "0.0.0.0" },
  vite: {
    css: {
      postcss: "./postcss.config.mjs",
    },
    build: {
      rollupOptions: {
        external: ["nfewizard-io"],
      },
    },
  },
})
