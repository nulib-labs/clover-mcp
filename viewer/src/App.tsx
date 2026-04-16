import { useState } from "react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import Viewer from "@samvera/clover-iiif/viewer";

declare const __CLOVER_VERSION__: string;

export default function App() {
  const [contentUrl, setContentUrl] = useState<unknown>(null);

  const { app, error } = useApp({
    appInfo: { name: "Clover IIIF Viewer", version: __CLOVER_VERSION__ },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result: CallToolResult) => {
        setContentUrl(result.structuredContent?.iiifContentUrl);
      };
    }
  });

  useHostStyles(app, app?.getHostContext());

  if (error) return <div>Error: {error.message}</div>;

  if (!contentUrl) return <div>Waiting for tool result...</div>;
  return (
    <>
      <Viewer iiifContent={contentUrl} />
    </>
  );
}
