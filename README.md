# @nulib/clover-mcp

A Node.js package that provides a ready-to-use [Clover IIIF Viewer](https://samvera-labs.github.io/clover-iiif/) UI resource for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers.

## Overview

This package bundles a generic MCP UI resource that integrates the Samvera Clover IIIF viewer, making it easy to add IIIF content visualization capabilities to your MCP server with a single function call.

## Installation

```bash
npm install @nulib/clover-mcp
```

## Usage

### Basic Setup

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCloverUIResource } from "@nulib/clover-mcp";

const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0"
});

// Register the Clover UI resource
registerCloverUIResource(server, {
  resourceUri: "ui://my-server/viewer",
  description: "UI resource for viewing IIIF content",
  resourceDomains: ["https://iiif.example.org"],
  connectDomains: ["https://api.example.org"]
});
```

### Complete Example with Tool

Here's a complete example showing how to embed the viewer resource with a tool that returns IIIF content:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCloverUIResource } from "@nulib/clover-mcp";

const UI_RESOURCE_URI = "ui://dc-viewer/viewer";
const DC_API_ORIGIN = "https://api.dc.library.northwestern.edu";
const DC_IIIF_ORIGIN = "https://iiif.dc.library.northwestern.edu";

// Create and configure the server
const server = new McpServer({
  name: "northwestern-dc-server",
  version: "1.0.0"
});

// Register the Clover UI resource
registerCloverUIResource(server, {
  resourceUri: UI_RESOURCE_URI,
  description: "Northwestern Digital Collections viewer",
  resourceDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN],
  connectDomains: [DC_API_ORIGIN, DC_IIIF_ORIGIN]
});

// Define a tool that returns IIIF content
server.tool(
  "view-collection",
  "Display a Northwestern Digital Collections IIIF collection in the Clover viewer",
  {
    collectionId: {
      type: "string",
      description: "Northwestern Digital Collections collection ID"
    }
  },
  async ({ collectionId }) => {
    const collectionUrl = `${DC_API_ORIGIN}/api/v2/collections/${collectionId}?as=iiif`;

    return {
      content: [
        {
          type: "text",
          text: `Viewing Northwestern Digital Collections collection ${collectionId}`
        },
        {
          type: "resource",
          resource: UI_RESOURCE_URI
        }
      ],
      structuredContent: {
        iiifContentUrl: collectionUrl
      }
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
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

### `registerCloverUIResource(server, options)`

Registers a Clover IIIF viewer UI resource with your MCP server.

#### Parameters

- **`server`** (`McpServer`): Your MCP server instance
- **`options`** (`CloverUIResourceOpts`):
  - **`resourceUri`** (string, required): The URI identifier for the UI resource (e.g., `"ui://my-server/viewer"`)
  - **`description`** (string, required): Human-readable description of the resource
  - **`resourceDomains`** (string[], optional): Array of domains allowed for loading resources (images, manifests) in the viewer's Content Security Policy
  - **`connectDomains`** (string[], optional): Array of domains allowed for API connections in the viewer's Content Security Policy

## How It Works

1. The package bundles a React-based Clover IIIF viewer as a single HTML file
2. When registered, it creates an MCP app resource with proper CSP configuration
3. Your MCP tools return results containing:
   - A `resource` reference to the UI resource URI in the `content` array
   - A `iiifContentUrl` in the `structuredContent` object pointing to a valid IIIF manifest or collection
4. The viewer automatically displays the IIIF content when tool results are received

## Development

### Building

```bash
npm run build
```

This builds both the viewer UI and the main package.

### Watch Mode

```bash
npm run build:watch
```

## License

MIT

## Credits

Built with:
- [@samvera/clover-iiif](https://github.com/samvera-labs/clover-iiif) - The IIIF viewer component
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK for TypeScript
- [@modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/typescript-sdk) - MCP app extensions
