# @nulib/clover-mcp

A Node.js package that provides a ready-to-use [Clover IIIF Viewer](https://samvera-labs.github.io/clover-iiif/) UI resource for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers.

## Overview

This package bundles a generic MCP UI resource that integrates the Samvera Clover IIIF viewer, making it easy to add IIIF content visualization capabilities to your MCP server. The `CloverUIResource` class handles resource registration and automatically wires up your tools to use the embedded viewer.

## Installation

```bash
npm install @nulib/clover-mcp @modelcontextprotocol/server
```

`@modelcontextprotocol/server@^2.0.0` (the MCP TypeScript SDK v2, supporting
protocol revision 2026-07-28) is a peer dependency and must be installed
alongside this package.

## Usage

### Basic Setup

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { CloverUIResource } from "@nulib/clover-mcp";

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0"
});

// Create a Clover UI resource
const uiResource = new CloverUIResource({
  resourceUri: "ui://my-server/viewer",
  description: "UI resource for viewing IIIF content",
  resourceDomains: ["https://iiif.example.org"],
  connectDomains: ["https://api.example.org", "https://iiif.example.org"]
});

// Register tools that use this resource
uiResource.registerTool(
  server,
  "my-tool",
  { /* tool config */ },
  async (args) => { /* tool handler */ }
);

// Register the resource with the server
uiResource.registerResource(server);
```

### Complete Example with Tool

Here's a complete example showing how to embed the viewer resource with a tool that returns IIIF content:

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { CloverUIResource } from "@nulib/clover-mcp";
import * as z from "zod/v4";

const UI_RESOURCE_URI = "ui://dc-viewer/viewer";
const DC_API_ORIGIN = "https://api.dc.library.northwestern.edu";
const DC_IIIF_ORIGIN = "https://iiif.dc.library.northwestern.edu";

// Factory that creates and configures a server instance
const createServer = () => {
  const server = new McpServer({
    name: "northwestern-dc-server",
    version: "1.0.0"
  });

  // Create a Clover UI resource
  const uiResource = new CloverUIResource({
    resourceUri: UI_RESOURCE_URI,
    description: "Northwestern Digital Collections viewer",
    resourceDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN],
    connectDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN]
  });

  // Register a tool that returns IIIF content
  uiResource.registerTool(
    server,
    "view-collection",
    {
      description: "Display a Northwestern Digital Collections IIIF collection in the Clover viewer",
      inputSchema: z.object({
        collectionId: z
          .string()
          .describe("Northwestern Digital Collections collection ID")
      })
    },
    async ({ collectionId }) => {
      const collectionUrl = `${DC_API_ORIGIN}/api/v2/collections/${collectionId}?as=iiif`;

      const structuredContent = {
        iiifContentUrl: collectionUrl
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredContent)
          },
          {
            type: "resource",
            resource: UI_RESOURCE_URI
          }
        ],
        structuredContent
      };
    }
  );

  // Register the resource with the server
  uiResource.registerResource(server);

  return server;
};

// Start the server (serves both 2025- and 2026-era MCP clients)
serveStdio(createServer);
```

**Example usage:**
```typescript
// Call the tool with a real Northwestern Digital Collections collection
await server.callTool("view-collection", {
  collectionId: "c373ecd2-2c45-45f2-9f9e-52dc244870bd"
});
// This displays the IIIF collection at:
// https://api.dc.library.northwestern.edu/api/v2/collections/c373ecd2-2c45-45f2-9f9e-52dc244870bd?as=iiif
```

## API

### `CloverUIResource`

A class that manages a Clover IIIF viewer UI resource for your MCP server.

#### Constructor

```typescript
new CloverUIResource(options: CloverUIResourceOpts)
```

**Options:**
- **`resourceUri`** (string, required): The URI identifier for the UI resource (e.g., `"ui://my-server/viewer"`)
- **`description`** (string, required): Human-readable description of the resource
- **`resourceDomains`** (string[], optional): Array of domains allowed for loading resources (images, manifests) in the viewer's Content Security Policy
- **`connectDomains`** (string[], optional): Array of domains allowed for API connections in the viewer's Content Security Policy
- **`cacheHint`** (`CacheHint`, optional): Cache hint (`ttlMs`/`cacheScope`) advertised on the resource per MCP 2026-07-28 (SEP-2549). Defaults to `{ ttlMs: 3600000, cacheScope: "public" }` — the viewer HTML is static per package build

#### Methods

##### `registerTool(server, toolName, toolConfig, callback)`

Registers a tool with the MCP server that will use this UI resource.

**Parameters:**
- **`server`** (`McpServer`): Your MCP server instance
- **`toolName`** (string): Name of the tool
- **`toolConfig`** (object): Tool configuration including description and inputSchema
- **`callback`** (`ToolCallback`): Tool handler function that returns results with `iiifContentUrl` in `structuredContent`

**Returns:** `RegisteredTool`

##### `registerResource(server)`

Registers the UI resource with the MCP server. Call this after registering all tools.

**Parameters:**
- **`server`** (`McpServer`): Your MCP server instance

## How It Works

1. The package bundles a React-based Clover IIIF viewer as a single HTML file
2. Create a `CloverUIResource` instance with your resource configuration
3. Register tools using `registerTool()` - this automatically adds the UI resource metadata to your tools
4. Call `registerResource()` to register the viewer resource with the MCP server
5. Your tools return results containing:
   - A `resource` reference to the UI resource URI in the `content` array
   - A `iiifContentUrl` in the `structuredContent` object pointing to a valid IIIF manifest or collection
   - A `text` block containing a stringified copy of the `structuredContent` (as a backup, since some MCP 
     App hosts don't pass `structuredContent` correctly)
6. The viewer automatically displays the IIIF content when tool results are received

## Development

### Building

```bash
npm run build
```

This builds both the viewer UI and the main package. It also emits a runnable
local stdio server at `dist/local-server.js` for MCP client configuration.

### Local Claude Configuration

After building, point Claude Desktop at the local server entrypoint:

```json
{
  "mcpServers": {
    "clover-local": {
      "command": "/path/to/clover-mcp/examples/local-server/bin/run.sh",
    }
  }
}
```

The local server exposes a `view_iiif_content` tool and allows Northwestern's
Digital Collections IIIF origins by default. To allow different origins, set
`CLOVER_ALLOWED_ORIGINS` to a comma-separated list of `https://...` origins.

### Testing with MCP Inspector

Build Clover, then launch the local server through its `run.sh` wrapper:

```bash
bun install
bun run build
bunx @modelcontextprotocol/inspector ./examples/local-server/bin/run.sh
```

#### Temporary Inspector 2.0.0 workaround

The published Inspector 2.0.0 package omits `sandbox_proxy.html`
([upstream issue #1082](https://github.com/modelcontextprotocol/inspector/issues/1082)).
Its Apps renderer also reads resource metadata from `_meta` instead of the
2026-07-28 `_meta.ui` location. Until Inspector corrects both problems, run a
locally patched Inspector checkout:

```bash
git clone --branch 2.0.0 --depth 1 \
  https://github.com/modelcontextprotocol/inspector.git
cd inspector
bun install
```

In
`clients/web/src/components/elements/AppRenderer/createAppBridgeFactory.ts`,
change the text-content return inside `extractHtmlAndMeta` to unwrap the
resource's `ui` metadata:

```typescript
const rawMeta = content._meta as
  | (McpUiResourceMeta & { ui?: McpUiResourceMeta })
  | undefined;

return {
  html: text,
  meta: rawMeta?.ui ?? rawMeta,
};
```

Build and launch that checkout, passing the absolute path to Clover's wrapper:

```bash
bun run build
bun clients/launcher/build/index.js \
  /absolute/path/to/clover-mcp/examples/local-server/bin/run.sh
```

Running from the source checkout supplies the missing sandbox file; the small
metadata patch lets Inspector apply the resource's CSP and render the Clover
app. This workaround is specific to Inspector 2.0.0 and should be removed once
the upstream package and metadata handling are corrected.

### Watch Mode

```bash
npm run build:watch
```

## License

MIT

## Credits

Built with:
- [@samvera/clover-iiif](https://github.com/samvera-labs/clover-iiif) - The IIIF viewer component
- [@modelcontextprotocol/server](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK v2 for TypeScript
- [@modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps) - MCP app extensions (viewer bundle)
