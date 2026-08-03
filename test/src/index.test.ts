import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/server";
import { CloverUIResource } from "../../src/index";

describe("CloverUIResource", () => {
  it("registers the UI resource on the MCP server", () => {
    const server = {
      registerResource: vi.fn()
    } as unknown as McpServer;

    const uiResource = new CloverUIResource({
      resourceUri: "ui://example/viewer",
      description: "Viewer",
      resourceDomains: ["https://example.org"],
      connectDomains: ["https://api.example.org"]
    });

    uiResource.registerResource(server);

    expect(server.registerResource).toHaveBeenCalledWith(
      "ui://example/viewer",
      "ui://example/viewer",
      {
        description: "Viewer",
        mimeType: "text/html",
        cacheHint: { ttlMs: 3_600_000, cacheScope: "public" }
      },
      expect.any(Function)
    );
  });

  it("serves the resource content at the configured URI", async () => {
    const server = {
      registerResource: vi.fn()
    } as unknown as McpServer;

    const uiResource = new CloverUIResource({
      resourceUri: "ui://example/viewer",
      description: "Viewer",
      resourceDomains: ["https://example.org"],
      connectDomains: ["https://api.example.org"]
    });

    uiResource.registerResource(server);

    const handler = vi.mocked(server.registerResource).mock.calls[0][3];
    const result = await handler(new URL("ui://example/viewer"), {});

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].uri).toBe("ui://example/viewer");
    expect(result.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(result.contents[0]._meta?.ui?.csp).toEqual({
      resourceDomains: ["https://example.org"],
      connectDomains: ["https://api.example.org"]
    });
  });

  it("allows overriding the resource cache hint", () => {
    const server = {
      registerResource: vi.fn()
    } as unknown as McpServer;

    const uiResource = new CloverUIResource({
      resourceUri: "ui://example/viewer",
      description: "Viewer",
      cacheHint: { ttlMs: 60_000, cacheScope: "private" }
    });

    uiResource.registerResource(server);

    expect(server.registerResource).toHaveBeenCalledWith(
      "ui://example/viewer",
      "ui://example/viewer",
      expect.objectContaining({
        cacheHint: { ttlMs: 60_000, cacheScope: "private" }
      }),
      expect.any(Function)
    );
  });

  it("registers tools with resource metadata automatically added", () => {
    const server = {
      registerTool: vi.fn().mockReturnValue({ name: "test-tool" })
    } as unknown as McpServer;

    const uiResource = new CloverUIResource({
      resourceUri: "ui://example/viewer",
      description: "Viewer"
    });

    const toolCallback = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Test result" }]
    });

    uiResource.registerTool(
      server,
      "test-tool",
      {
        description: "Test tool",
        inputSchema: { type: "object" }
      },
      toolCallback
    );

    expect(server.registerTool).toHaveBeenCalledWith(
      "test-tool",
      {
        description: "Test tool",
        inputSchema: { type: "object" },
        _meta: {
          ui: {
            resourceUri: "ui://example/viewer"
          }
        }
      },
      expect.any(Function)
    );
  });

  it("wraps tool callbacks to inject resource metadata into results", async () => {
    const server = {
      registerTool: vi.fn().mockReturnValue({ name: "test-tool" })
    } as unknown as McpServer;

    const uiResource = new CloverUIResource({
      resourceUri: "ui://example/viewer",
      description: "Viewer"
    });

    const toolCallback = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Test result" }],
      structuredContent: { iiifContentUrl: "https://example.org/manifest.json" }
    });

    uiResource.registerTool(server, "test-tool", {}, toolCallback);

    // Get the wrapped callback that was passed to registerTool
    const wrappedCallback = server.registerTool.mock.calls[0][2];

    // Call the wrapped callback
    const result = await wrappedCallback({ testArg: "value" });

    // Verify the original callback was called
    expect(toolCallback).toHaveBeenCalledWith({ testArg: "value" });

    // Verify metadata was injected into the result
    expect(result).toEqual({
      content: [{ type: "text", text: "Test result" }],
      structuredContent: {
        iiifContentUrl: "https://example.org/manifest.json"
      },
      _meta: {
        ui: {
          resourceUri: "ui://example/viewer"
        }
      }
    });
  });
});
