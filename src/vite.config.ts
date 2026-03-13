import { defineConfig } from "vite";
import path from "node:path";
import { inlineHtml } from "./../plugins/inline-html";

export default defineConfig({
  plugins: [inlineHtml(path.resolve(__dirname, "../viewer/dist/index.html"))],
  root: path.resolve(__dirname),
  define: {
    "process.env": "process.env" // pass through as-is
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: {
        index: path.resolve(__dirname, "index.ts")
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "cjs" ? "cjs" : "js"}`
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
