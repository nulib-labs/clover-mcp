import type {
  CallToolResult,
  CacheHint,
  McpServer,
  ReadResourceCallback,
  RegisteredTool,
  ResourceMetadata,
  ToolCallback
} from "@modelcontextprotocol/server";
import html from "virtual:inline-html";

export type CloverUIResourceOpts = {
  description: string;
  resourceUri: string;
  resourceDomains?: string[];
  connectDomains?: string[];
  cacheHint?: CacheHint;
};

type CloverUIResourceResult = {
  name: string;
  uri: string;
  config: ResourceMetadata;
  handler: ReadResourceCallback;
};

type ToolConfig = Record<string, unknown>;
type HasMeta = ToolConfig | CallToolResult;

const DEFAULT_CACHE_HINT: CacheHint = {
  ttlMs: 3_600_000,
  cacheScope: "public"
};

export class CloverUIResource {
  constructor(public opts: CloverUIResourceOpts) {
    this.opts = opts;
  }

  #makeResource(): CloverUIResourceResult {
    const {
      description,
      resourceUri,
      resourceDomains = [],
      connectDomains = [],
      cacheHint = DEFAULT_CACHE_HINT
    } = this.opts;
    const result: CloverUIResourceResult = {
      name: resourceUri,
      uri: resourceUri,
      config: {
        description,
        mimeType: "text/html",
        cacheHint
      },
      handler: async () => {
        return {
          contents: [
            {
              uri: resourceUri,
              text: html,
              mimeType: "text/html;profile=mcp-app",
              _meta: {
                ui: {
                  csp: {
                    resourceDomains,
                    connectDomains
                  }
                }
              }
            }
          ]
        };
      }
    };
    return result;
  }

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  addResourceMeta(content: HasMeta): any {
    const { resourceUri } = this.opts;
    const result = { ...content };
    const meta = { ...(result._meta || {}) } as any; //eslint-disable-line @typescript-eslint/no-explicit-any
    meta.ui ||= {};
    meta.ui.resourceUri = resourceUri;
    return { ...result, _meta: meta };
  }

  wrapToolCallback(cb: ToolCallback): ToolCallback {
    return async (...params: Parameters<ToolCallback>) => {
      const toolResult = await cb(...params);
      return this.addResourceMeta(toolResult);
    };
  }

  registerResource(server: McpServer) {
    const { name, uri, config, handler } = this.#makeResource();
    server.registerResource(name, uri, config, handler);
  }

  registerTool(
    server: McpServer,
    toolName: string,
    toolConfig: ToolConfig,
    cb: ToolCallback
  ): RegisteredTool {
    return server.registerTool(
      toolName,
      this.addResourceMeta(toolConfig),
      this.wrapToolCallback(cb)
    );
  }
}
