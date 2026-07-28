import type {
  CacheHint,
  McpServer,
  RegisteredTool
} from "@modelcontextprotocol/server";

/**
 * Tool callbacks are passed through to `McpServer.registerTool` with UI
 * resource metadata merged into their results; any registerTool-compatible
 * callback shape is accepted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CloverToolCallback = (...args: any[]) => any;

export type CloverUIResourceOpts = {
  description: string;
  resourceUri: string;
  resourceDomains?: string[];
  connectDomains?: string[];
  cacheHint?: CacheHint;
};

export declare class CloverUIResource {
  opts: CloverUIResourceOpts;
  constructor(opts: CloverUIResourceOpts);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addResourceMeta(content: Record<string, unknown>): any;
  wrapToolCallback(cb: CloverToolCallback): CloverToolCallback;
  registerResource(server: McpServer): void;
  registerTool(
    server: McpServer,
    toolName: string,
    toolConfig: Record<string, unknown>,
    cb: CloverToolCallback
  ): RegisteredTool;
}
