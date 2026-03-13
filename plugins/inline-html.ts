import { readFileSync } from "node:fs";

export function inlineHtml(htmlPath: string) {
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
