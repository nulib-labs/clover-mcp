import type { CloverUIResourceOpts } from "./resource/clover-ui";
import { makeCloverUIResource } from "./resource/clover-ui";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const registerCloverUIResource = (
  server: McpServer,
  opts: CloverUIResourceOpts
) => {
  const { name, uri, config, handler } = makeCloverUIResource(opts);
  server.registerResource(name, uri, config, handler);
};
