import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  createLocalServer,
  LOCAL_TOOL_NAME,
  LOCAL_UI_RESOURCE_URI
} from "../../../examples/local-server/index";

describe("CloverUIResource integration", () => {
  it("exposes tools and resources via MCP protocol", async () => {
    // Create server
    const server = createLocalServer();

    // Create linked transports
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    // Connect server and client
    await server.connect(serverTransport);

    const client = new Client({
      name: "test-client",
      version: "1.0.0"
    });
    await client.connect(clientTransport);

    // Test that tools are exposed correctly
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(1);
    expect(tools.tools[0].name).toBe(LOCAL_TOOL_NAME);
    expect(tools.tools[0]._meta?.["ui/resourceUri"]).toBe(
      LOCAL_UI_RESOURCE_URI
    );
    expect(tools.tools[0]._meta?.ui?.resourceUri).toBe(LOCAL_UI_RESOURCE_URI);

    // Test that resources are exposed correctly
    const resources = await client.listResources();
    expect(resources.resources).toHaveLength(1);
    expect(resources.resources[0].uri).toBe(LOCAL_UI_RESOURCE_URI);
    expect(resources.resources[0].mimeType).toBe("text/html");

    // Test calling the tool
    const result = await client.callTool({
      name: LOCAL_TOOL_NAME,
      arguments: { iiifContentUrl: "https://example.org/manifest.json" }
    });
    expect(result.structuredContent?.iiifContentUrl).toBe(
      "https://example.org/manifest.json"
    );
    expect(result._meta?.["ui/resourceUri"]).toBe(LOCAL_UI_RESOURCE_URI);

    // Clean up
    await client.close();
    await server.close();
  });
});
