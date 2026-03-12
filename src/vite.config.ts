import { defineConfig } from "vite";
import path from "node:path";
import { readFileSync } from "node:fs";

function inlineHtml(htmlPath: string) {
  const virtualModuleId = "virtual:inline-html";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "inline-html",
    resolveId(id: string) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        const html = readFileSync(htmlPath, "utf-8");
        return `export default ${JSON.stringify(html)}`;
      }
    }
  };
}

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
    // rollupOptions: {
    //   external: [/^node:.+/],
    //   input: "src/index.ts",
    //   preserveEntrySignatures: "exports-only",
    //   output: {
    //     format: "esm", // or "cjs" if you need require()
    //     inlineDynamicImports: true,
    //     manualChunks: undefined,
    //     entryFileNames: "[name].js",
    //     chunkFileNames: "[name].js",
    //     assetFileNames: "[name].[ext]"
    //   }
    // },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
