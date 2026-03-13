import { defineConfig } from "vite";
import path from "node:path";
import { readFileSync } from "node:fs";

const pkgInfo = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkgInfo.version)
  },
  plugins: [],
  root: path.resolve(__dirname),
  build: {
    target: "es2022",
    lib: {
      name: "clover-mcp-local-server",
      entry: {
        index: path.resolve(__dirname, "index.ts")
      }
    },
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  }
});
