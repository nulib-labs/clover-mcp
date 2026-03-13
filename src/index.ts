import {
  McpServer,
  ReadResourceCallback,
  RegisteredTool,
  ToolCallback
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceMetadata } from "@modelcontextprotocol/ext-apps/server";
import html from "virtual:inline-html";

export type CloverUIResourceOpts = {
  description: string;
  resourceUri: string;
  resourceDomains?: string[];
  connectDomains?: string[];
};

type CloverUIResourceResult = {
  name: string;
  uri: string;
  config: ResourceMetadata;
  handler: ReadResourceCallback;
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
      connectDomains = []
    } = this.opts;
    const result: CloverUIResourceResult = {
      name: resourceUri,
      uri: resourceUri,
      config: {
        description,
        mimeType: "text/html"
      },
      handler: async () => {
        return {
          contents: [
            {
              uri: "ui://clover-viewer/mcp-app.html",
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

  addResourceMeta(content: any): any {
    const { resourceUri } = this.opts;
    const result = { ...content };
    result._meta ||= {};
    result._meta.ui ||= {};
    result._meta.ui.resourceUri = resourceUri;
    result._meta["ui/resourceUri"] = resourceUri;
    return result;
  }

  wrapToolCallback(cb: ToolCallback): ToolCallback {
    return async (args) => {
      const toolResult = await cb(args);
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
    toolConfig: Record<any, any>,
    cb: ToolCallback
  ): RegisteredTool {
    return server.registerTool(
      toolName,
      this.addResourceMeta(toolConfig),
      this.wrapToolCallback(cb)
    );
  }
}
