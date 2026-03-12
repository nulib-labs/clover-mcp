import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { readFileSync } from "fs";

const pkgInfo = JSON.parse(readFileSync("./package-lock.json", "utf-8"));

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  root: path.resolve(__dirname),
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false
  },
  define: {
    __CLOVER_VERSION__: JSON.stringify(
      pkgInfo.packages["node_modules/@samvera/clover-iiif"].version
    ),
    __APP_VERSION__: JSON.stringify(pkgInfo.version)
  }
});
