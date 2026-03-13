import { useState } from "react";
import { CallToolResult } from "@modelcontextprotocol/sdk";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import CloverIIIF from "@samvera/clover-iiif";

declare const __CLOVER_VERSION__: string;

export default function App() {
  const [contentUrl, setContentUrl] = useState<string | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "Clover IIIF Viewer", version: __CLOVER_VERSION__ },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = (result: CallToolResult) => {
        setContentUrl(result.structuredContent.iiifContentUrl);
      };
    }
  });

  useHostStyles(app, app?.getHostContext());

  if (error) return <div>Error: {error.message}</div>;

  if (!contentUrl) return <div>Waiting for tool result...</div>;
  return (
    <>
      <CloverIIIF id={contentUrl} />
    </>
  );
}
