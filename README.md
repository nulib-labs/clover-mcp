# @nulib/clover-mcp

A Node.js package that provides a ready-to-use [Clover IIIF Viewer](https://samvera-labs.github.io/clover-iiif/) UI resource for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers.

## Overview

This package bundles a generic MCP UI resource that integrates the Samvera Clover IIIF viewer, making it easy to add IIIF content visualization capabilities to your MCP server. The `CloverUIResource` class handles resource registration and automatically wires up your tools to use the embedded viewer.

## Installation

```bash
npm install @nulib/clover-mcp
```

## Usage

### Basic Setup

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
  connectDomains: ["https://api.example.org"]
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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CloverUIResource } from "@nulib/clover-mcp";

const UI_RESOURCE_URI = "ui://dc-viewer/viewer";
const DC_API_ORIGIN = "https://api.dc.library.northwestern.edu";
const DC_IIIF_ORIGIN = "https://iiif.dc.library.northwestern.edu";

// Create and configure the server
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
    inputSchema: {
      type: "object",
      properties: {
        collectionId: {
          type: "string",
          description: "Northwestern Digital Collections collection ID"
        }
      },
      required: ["collectionId"]
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

// Register the resource with the server
uiResource.registerResource(server);

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
6. The viewer automatically displays the IIIF content when tool results are received

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
