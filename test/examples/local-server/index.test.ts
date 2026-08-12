import { afterEach, describe, expect, it, vi } from "vitest";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import {
  assertAllowedOrigin,
  createLocalServer,
  DEFAULT_ALLOWED_ORIGINS,
  DESCRIBE_TOOL_NAME,
  getAllowedOrigins,
  LOCAL_TOOL_NAME,
  LOCAL_UI_RESOURCE_URI
} from "../../../examples/local-server/index";

const TEST_ORIGIN = "https://iiif.example.org";
const MANIFEST_URL = `${TEST_ORIGIN}/works/abc/manifest`;

const MANIFEST = {
  id: MANIFEST_URL,
  type: "Manifest",
  label: { none: ["Correspondence from Steve and Eileen Eliot to John Cage"] },
  metadata: [
    { label: { none: ["Date"] }, value: { none: ["1975"] } },
    { label: { none: ["Genre"] }, value: { none: ["personal correspondence"] } }
  ]
};

/** Tests configure their own origins so none of this depends on the defaults. */
const connect = async (
  env: NodeJS.ProcessEnv = {
    CLOVER_ALLOWED_ORIGINS: TEST_ORIGIN
  } as NodeJS.ProcessEnv
) => {
  const server = createLocalServer(env);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    }
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CloverUIResource integration", () => {
  it("exposes tools and resources via MCP protocol", async () => {
    const { client, close } = await connect();

    // Test that tools are exposed correctly
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      [DESCRIBE_TOOL_NAME, LOCAL_TOOL_NAME].sort()
    );

    // Test that resources are exposed correctly
    const resources = await client.listResources();
    expect(resources.resources).toHaveLength(1);
    expect(resources.resources[0].uri).toBe(LOCAL_UI_RESOURCE_URI);
    expect(resources.resources[0].mimeType).toBe("text/html");

    // Test reading the UI resource (2026-07-28: contents echo the request URI)
    const resource = await client.readResource({ uri: LOCAL_UI_RESOURCE_URI });
    expect(resource.contents).toHaveLength(1);
    expect(resource.contents[0].uri).toBe(LOCAL_UI_RESOURCE_URI);
    expect(resource.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.contents[0]._meta?.ui?.csp?.resourceDomains).toEqual([
      TEST_ORIGIN
    ]);

    // Test calling the tool
    const result = await client.callTool({
      name: LOCAL_TOOL_NAME,
      arguments: { iiifContentUrl: `${TEST_ORIGIN}/manifest.json` }
    });
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe(
      `Opening Clover viewer for ${TEST_ORIGIN}/manifest.json`
    );
    expect(result.content[1].type).toBe("text");
    expect(JSON.parse(result.content[1].text)).toEqual(
      result.structuredContent
    );
    expect(result.structuredContent?.iiifContentUrl).toBe(
      `${TEST_ORIGIN}/manifest.json`
    );
    expect(result._meta?.ui?.resourceUri).toBe(LOCAL_UI_RESOURCE_URI);

    await close();
  });

  it("marks only the viewer-driving tool with the UI resource", async () => {
    const { client, close } = await connect();

    const tools = await client.listTools();
    const byName = Object.fromEntries(
      tools.tools.map((tool) => [tool.name, tool])
    );

    expect(byName[LOCAL_TOOL_NAME]._meta?.ui?.resourceUri).toBe(
      LOCAL_UI_RESOURCE_URI
    );
    // describe_iiif_item reports rather than displays, so it must not claim
    // the UI resource.
    expect(byName[DESCRIBE_TOOL_NAME]._meta?.ui?.resourceUri).toBeUndefined();

    await close();
  });

  it("points the model at the app-provided get_displayed_work tool", async () => {
    const { client, close } = await connect();

    const tools = await client.listTools();
    const describe = tools.tools.find(
      (tool) => tool.name === DESCRIBE_TOOL_NAME
    );

    expect(describe?.description).toContain("get_displayed_work");

    await close();
  });

  it("describes a fetched IIIF item without driving the viewer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => MANIFEST }))
    );

    const { client, close } = await connect();

    const result = await client.callTool({
      name: DESCRIBE_TOOL_NAME,
      arguments: { iiifContentUrl: MANIFEST_URL }
    });

    expect(fetch).toHaveBeenCalledWith(MANIFEST_URL, {
      headers: { Accept: "application/json" }
    });
    expect(result.structuredContent).toMatchObject({
      id: MANIFEST_URL,
      type: "Manifest",
      metadata: [
        { label: "Date", value: "1975" },
        { label: "Genre", value: "personal correspondence" }
      ]
    });
    expect(result.content[0].text).toContain("- Date: 1975");
    expect(result.structuredContent?.iiifContentUrl).toBeUndefined();

    await close();
  });

  it("refuses to fetch an origin that is not allowed", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { client, close } = await connect();

    const result = await client.callTool({
      name: DESCRIBE_TOOL_NAME,
      arguments: { iiifContentUrl: "https://elsewhere.example.org/manifest" }
    });

    expect(result.isError).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    await close();
  });

  it("reports an upstream failure instead of inventing a description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    const { client, close } = await connect();

    const result = await client.callTool({
      name: DESCRIBE_TOOL_NAME,
      arguments: { iiifContentUrl: MANIFEST_URL }
    });

    expect(result.isError).toBe(true);

    await close();
  });
});

describe("getAllowedOrigins", () => {
  it("prefers configured origins", () => {
    expect(
      getAllowedOrigins({
        CLOVER_ALLOWED_ORIGINS: "https://a.example.org, https://b.example.org"
      } as NodeJS.ProcessEnv)
    ).toEqual(["https://a.example.org", "https://b.example.org"]);
  });

  it("falls back to the defaults when unconfigured", () => {
    expect(getAllowedOrigins({} as NodeJS.ProcessEnv)).toEqual(
      DEFAULT_ALLOWED_ORIGINS
    );
  });
});

describe("assertAllowedOrigin", () => {
  const allowed = [TEST_ORIGIN];

  it("accepts a URL on an allowed origin", () => {
    expect(assertAllowedOrigin(`${TEST_ORIGIN}/manifest`, allowed).origin).toBe(
      TEST_ORIGIN
    );
  });

  it("rejects other origins and non-http protocols", () => {
    expect(() =>
      assertAllowedOrigin("https://elsewhere.example.org/manifest", allowed)
    ).toThrow(/not an allowed origin/);
    expect(() => assertAllowedOrigin("file:///etc/passwd", allowed)).toThrow(
      /absolute http\(s\) URL/
    );
  });
});
