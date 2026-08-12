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

### IIIF helpers

The package also exports the IIIF projection helpers the viewer uses, so server
tools can describe a manifest without reimplementing the traversal:

```typescript
import { projectWork, describeWork } from "@nulib/clover-mcp";

const summary = projectWork(await (await fetch(url)).json());
// -> { id, type, label, summary?, attribution?, homepage?, metadata[], partOf[], itemCount? }

describeWork(summary);          // model-readable text
describeWork(summary, "Now showing this Manifest.");  // custom opening line
```

- **`projectWork(resource)`** — reduce a IIIF Manifest or Collection to a
  `WorkSummary`. Metadata is capped at 24 entries and 400 characters per value,
  since this text lands in the model's context. Returns `null` without an `id`.
- **`describeWork(work, lead?)`** — render a `WorkSummary` as text, including a
  note that the descriptive values are retrieved data rather than instructions.
- **`manifestIdFromContentState(contentState)`** — find the active Manifest id
  in the `{ encoded, json }` payload Clover's `contentStateCallback` fires,
  reading it from the target Canvas's `partOf` (a bare annotation also works).
- **`flattenLabel(label)`** / **`labelValues(label)`** — collapse an
  internationalized IIIF label to a string or array of strings.

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

## What the Viewer Reports Back

The bundled viewer is not display-only. Once content is on screen it tells the
host what the user is looking at, so the model can act on it.

### `get_displayed_work` (app-provided tool)

The viewer registers this tool with the host over MCP Apps (`App.registerTool`),
so the model sees it alongside your server's own tools. It takes no arguments
and returns the displayed work's ID plus a compact projection of its descriptive
metadata:

```json
{
  "id": "https://api.dc.library.northwestern.edu/api/v2/works/{id}?as=iiif",
  "type": "Manifest",
  "label": "Correspondence from Steve and Eileen Eliot to John Cage",
  "attribution": "Courtesy of Northwestern University Libraries",
  "homepage": "https://dc.library.northwestern.edu/items/{id}",
  "metadata": [{ "label": "Date", "value": "1975" }],
  "partOf": [{ "id": "...collections/{id}?as=iiif", "label": "John Cage Correspondence" }]
}
```

This closes a loop: the model can ask what is displayed, then call one of your
tools with the answer. Because your tools are registered through
`CloverUIResource`, their results render back into the same viewer.

When a **Collection** is loaded, its items are stubs without descriptive
metadata, so the viewer resolves the active Manifest from Clover's
`contentStateCallback` and fetches it. That Manifest's origin must be in
`connectDomains`.

### `ui/update-model-context`

Whenever the displayed work changes, the viewer also pushes a text summary via
`app.updateModelContext()` (when `getHostCapabilities().updateModelContext` is
advertised). Hosts hold this until the next user message, so a prompt like
"show me more items like this one" already has the current work in context
without any tool call. The tool remains useful for pulling the work
mid-turn or on demand.

> Descriptive metadata comes from a remote IIIF endpoint whose origins are
> operator-configured via `CLOVER_ALLOWED_ORIGINS`. The viewer labels these
> values as retrieved data rather than asserting them, but treat them as
> untrusted input when pointing at IIIF services you do not operate.

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

The example server works with any IIIF endpoint. Set `CLOVER_ALLOWED_ORIGINS`
to a comma-separated list of `https://...` origins to choose which ones; it
falls back to Northwestern's Digital Collections origins so the demo runs
without configuration.

It exposes two tools, one for each direction of the round trip:

| Tool | Direction | Drives the viewer? |
| --- | --- | --- |
| `view_iiif_content` | Server → viewer: display a manifest or collection | Yes |
| `describe_iiif_item` | Viewer → server: report an item's metadata as text | No |

`describe_iiif_item` is registered directly on the server rather than through
`CloverUIResource`, so its results carry no `_meta.ui.resourceUri`. Not every
tool on a server that ships a widget should claim that widget; this one reports
on an item instead of displaying one. Because the server itself performs the
fetch — outside the app sandbox's CSP — it refuses URLs whose origin is not in
the configured allow-list.

Together with the viewer's `get_displayed_work` tool, the two demonstrate the
full round trip. Open something, then ask:

> Tell me more about the item I'm looking at.

The model learns what the viewer is showing, then passes that ID to
`describe_iiif_item`. The server never queries the widget directly — it can't —
but the widget's state reaches it through the model.

How the model learns it depends on the host. Where app-provided tools are
surfaced, it can call `get_displayed_work`. Where they are not, the viewer's
`ui/update-model-context` push still puts the displayed item in context, so the
chain works with no tool call. `describe_iiif_item`'s description is written
not to depend on the tool existing.

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
