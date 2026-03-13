import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFileSync } from "node:fs";
import { inlineHtml } from "./plugins/inline-html";

const pkgInfo = JSON.parse(
  readFileSync(path.resolve(__dirname, "./package.json"), "utf-8")
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkgInfo.version)
  },
  plugins: [
    react(),
    inlineHtml(path.resolve(__dirname, "./viewer/dist/index.html"))
  ],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"]
  }
});
