import { defineConfig } from "vite";
import path from "node:path";
import { readFileSync } from "node:fs";
import { inlineHtml } from "./../plugins/inline-html";

const localServerPackage = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../examples/local-server/package.json"),
    "utf-8"
  )
);

export default defineConfig({
  plugins: [inlineHtml(path.resolve(__dirname, "../viewer/dist/index.html"))],
  root: path.resolve(__dirname),
  resolve: {
    alias: {
      "@nulib/clover-mcp": path.resolve(__dirname, "index.ts")
    }
  },
  define: {
    "process.env": "process.env", // pass through as-is
    __APP_VERSION__: JSON.stringify(localServerPackage.version)
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "es2022",
    lib: {
      entry: {
        index: path.resolve(__dirname, "index.ts"),
        "local-server": path.resolve(
          __dirname,
          "../examples/local-server/index.ts"
        )
      },
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "cjs" ? "cjs" : "js"}`
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      external: (id) => id.startsWith("@modelcontextprotocol/server")
    }
  }
});
