import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import {
  CloverUIResource,
  describeWork,
  projectWork,
  type IIIFResource
} from "@nulib/clover-mcp";

declare const __APP_VERSION__: string;

export const LOCAL_SERVER_NAME = "clover-local";
export const LOCAL_UI_RESOURCE_URI = "ui://clover-local/viewer";
export const LOCAL_TOOL_NAME = "view_iiif_content";
export const DESCRIBE_TOOL_NAME = "describe_iiif_item";

/**
 * A starting allow-list so the example runs without configuration. Nothing in
 * this server is specific to these origins — set `CLOVER_ALLOWED_ORIGINS` to
 * point it at any IIIF endpoints you like.
 */
export const DEFAULT_ALLOWED_ORIGINS = [
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

/**
 * `describe_iiif_item` makes the server itself fetch a URL the model supplied,
 * so unlike the browser-side viewer it is not behind the app sandbox's CSP.
 * Restricting it to the configured origins keeps the model from pointing the
 * server at arbitrary hosts.
 */
export const assertAllowedOrigin = (
  iiifContentUrl: string,
  allowedOrigins: string[]
): URL => {
  const url = new URL(iiifContentUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("iiifContentUrl must be an absolute http(s) URL");
  }

  if (!allowedOrigins.includes(url.origin)) {
    throw new Error(
      `${url.origin} is not an allowed origin. ` +
        "Set CLOVER_ALLOWED_ORIGINS to include it."
    );
  }

  return url;
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

  // Server -> viewer. Registered through `CloverUIResource`, so the result
  // carries `_meta.ui.resourceUri` and the host routes it into the widget.
  uiResource.registerTool(
    server,
    LOCAL_TOOL_NAME,
    {
      description: "Display a IIIF manifest or collection in the Clover viewer",
      inputSchema: z.object({
        iiifContentUrl: z
          .string()
          .url()
          .describe(
            "Absolute http(s) URL for the IIIF manifest or collection to display"
          )
      })
    },
    async ({ iiifContentUrl }) => {
      const url = new URL(iiifContentUrl);

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("iiifContentUrl must be an absolute http(s) URL");
      }

      const structuredContent = { iiifContentUrl };

      return {
        content: [
          {
            type: "text" as const,
            text: `Opening Clover viewer for ${iiifContentUrl}`
          },
          // Some hosts drop `structuredContent`; the viewer falls back to
          // parsing a stringified copy out of a text block.
          { type: "text" as const, text: JSON.stringify(structuredContent) }
        ],
        structuredContent
      };
    }
  );

  // Viewer -> server. The other half of the round trip: the viewer app reports
  // what is on screen through its own `get_displayed_work` tool, and the model
  // hands that ID here.
  //
  // Registered directly on the server rather than through `CloverUIResource`,
  // so it carries no `_meta.ui.resourceUri` — it reports on an item instead of
  // displaying one, and has no business re-rendering the viewer.
  server.registerTool(
    DESCRIBE_TOOL_NAME,
    {
      // Deliberately does not tell the model to call `get_displayed_work`
      // first: that tool is registered by the viewer app, and hosts that do
      // not surface app-provided tools would send the model chasing a call it
      // cannot make. The viewer also publishes the displayed item through
      // `ui/update-model-context`, which needs no tool call at all.
      description:
        "Fetch a IIIF manifest or collection and report its descriptive " +
        "metadata as text, without changing what the viewer is showing. Pass " +
        "the URL of the item to describe. To describe what the user is " +
        "currently looking at, take the ID from the viewer's reported " +
        "context; if a `get_displayed_work` tool is available, that returns " +
        "the same ID on demand.",
      inputSchema: z.object({
        iiifContentUrl: z
          .string()
          .url()
          .describe(
            "Absolute http(s) URL of the IIIF manifest or collection to describe"
          )
      })
    },
    async ({ iiifContentUrl }) => {
      assertAllowedOrigin(iiifContentUrl, allowedOrigins);

      const response = await fetch(iiifContentUrl, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(
          `Could not fetch ${iiifContentUrl} (HTTP ${response.status})`
        );
      }

      const summary = projectWork((await response.json()) as IIIFResource);

      if (!summary) {
        throw new Error(
          `${iiifContentUrl} did not return a IIIF resource with an id`
        );
      }

      return {
        content: [{ type: "text" as const, text: describeWork(summary) }],
        structuredContent: summary as unknown as Record<string, unknown>
      };
    }
  );

  return server;
};

export const startLocalServer = async (
  env: NodeJS.ProcessEnv = process.env
) => {
  serveStdio(() => createLocalServer(env));
  console.error(`${LOCAL_SERVER_NAME} ready`);
};

const isEntrypoint = import.meta.main === undefined ? true : import.meta.main;

if (isEntrypoint) {
  startLocalServer().catch((error) => {
    console.error(`${LOCAL_SERVER_NAME} failed to start`, error);
    process.exit(1);
  });
}
