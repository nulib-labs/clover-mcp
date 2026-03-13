import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { CloverUIResource } from "@nulib/clover-mcp";

declare const __APP_VERSION__: string;

export const LOCAL_SERVER_NAME = "clover-local";
export const LOCAL_UI_RESOURCE_URI = "ui://clover-local/viewer";
export const LOCAL_TOOL_NAME = "view_iiif_content";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://api.dc.library.northwestern.edu",
  "https://iiif.dc.library.northwestern.edu"
];

export const parseOrigins = (value?: string): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const getAllowedOrigins = (env: NodeJS.ProcessEnv): string[] => {
  const configuredOrigins = parseOrigins(env.CLOVER_ALLOWED_ORIGINS);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return DEFAULT_ALLOWED_ORIGINS;
};

export const createLocalServer = (env: NodeJS.ProcessEnv = process.env) => {
  const server = new McpServer({
    name: LOCAL_SERVER_NAME,
    version: __APP_VERSION__
  });
  const allowedOrigins = getAllowedOrigins(env);

  const uiResource = new CloverUIResource({
    resourceUri: LOCAL_UI_RESOURCE_URI,
    description: "Local Clover IIIF viewer",
    resourceDomains: allowedOrigins,
    connectDomains: allowedOrigins
  });

  uiResource.registerResource(server);

  uiResource.registerTool(
    server,
    LOCAL_TOOL_NAME,
    {
      description: "Display a IIIF manifest or collection in the Clover viewer",
      inputSchema: {
        iiifContentUrl: z
          .string()
          .url()
          .describe(
            "Absolute http(s) URL for the IIIF manifest or collection to display"
          )
      }
    },
    async ({ iiifContentUrl }) => {
      const url = new URL(iiifContentUrl);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("iiifContentUrl must be an absolute http(s) URL");
      }

      return {
        content: [
          {
            type: "text",
            text: `Opening Clover viewer for ${iiifContentUrl}`
          }
        ],
        structuredContent: {
          iiifContentUrl
        }
      };
    }
  );

  return server;
};

export const startLocalServer = async (
  env: NodeJS.ProcessEnv = process.env
) => {
  const server = createLocalServer(env);
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error(`${LOCAL_SERVER_NAME} ready`);
};

const isEntrypoint = import.meta.main === undefined ? true : import.meta.main;

if (isEntrypoint) {
  startLocalServer().catch((error) => {
    console.error(`${LOCAL_SERVER_NAME} failed to start`, error);
    process.exit(1);
  });
}
