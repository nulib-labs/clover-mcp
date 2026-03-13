import { describe, expect, it, beforeEach, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  useState: vi.fn()
}));

const extAppMocks = vi.hoisted(() => ({
  useApp: vi.fn(),
  useHostStyles: vi.fn()
}));

const viewerMocks = vi.hoisted(() => ({
  CloverIIIF: vi.fn(() => null)
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: reactMocks.useState
  };
});

vi.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useApp: extAppMocks.useApp,
  useHostStyles: extAppMocks.useHostStyles
}));

vi.mock("@samvera/clover-iiif", () => ({
  default: viewerMocks.CloverIIIF
}));

import App from "../../viewer/src/App";

function textContent(children: unknown) {
  if (Array.isArray(children)) {
    return children.join("");
  }
  return String(children);
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__CLOVER_VERSION__", "1.15.4");
  });

  it("shows the waiting state until a tool result is received", () => {
    const app = {
      getHostContext: vi.fn(() => ({ theme: "light" }))
    };

    reactMocks.useState.mockReturnValue([null, vi.fn()]);
    extAppMocks.useApp.mockReturnValue({ app, error: null });

    const element = App();

    expect(extAppMocks.useApp).toHaveBeenCalledWith({
      appInfo: { name: "Clover IIIF Viewer", version: "1.15.4" },
      capabilities: {},
      onAppCreated: expect.any(Function)
    });
    expect(extAppMocks.useHostStyles).toHaveBeenCalledWith(app, {
      theme: "light"
    });
    expect(element.type).toBe("div");
    expect(textContent(element.props.children)).toBe(
      "Waiting for tool result..."
    );
  });

  it("shows the MCP app error when initialization fails", () => {
    reactMocks.useState.mockReturnValue([null, vi.fn()]);
    extAppMocks.useApp.mockReturnValue({
      app: null,
      error: new Error("Host unavailable")
    });

    const element = App();

    expect(element.type).toBe("div");
    expect(textContent(element.props.children)).toBe("Error: Host unavailable");
    expect(extAppMocks.useHostStyles).toHaveBeenCalledWith(null, undefined);
  });

  it("wires ontoolresult to update the content URL from structured content", () => {
    const setContentUrl = vi.fn();
    const app: {
      getHostContext: ReturnType<typeof vi.fn>;
      ontoolresult?: (result: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    } = {
      getHostContext: vi.fn(() => undefined)
    };

    reactMocks.useState.mockReturnValue([null, setContentUrl]);
    extAppMocks.useApp.mockImplementation(({ onAppCreated }) => {
      onAppCreated(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
      return { app, error: null };
    });

    App();

    expect(typeof app.ontoolresult).toBe("function");

    app.ontoolresult?.({
      structuredContent: {
        iiifContentUrl: "https://iiif.example.org/manifest"
      }
    });

    expect(setContentUrl).toHaveBeenCalledWith(
      "https://iiif.example.org/manifest"
    );
  });

  it("renders the Clover viewer once a content URL is available", () => {
    const app = {
      getHostContext: vi.fn(() => undefined)
    };

    reactMocks.useState.mockReturnValue([
      "https://iiif.example.org/manifest",
      vi.fn()
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null });

    const element = App();
    const viewerElement = element.props.children;

    expect(viewerElement.type).toBe(viewerMocks.CloverIIIF);
    expect(viewerElement.props).toEqual({
      id: "https://iiif.example.org/manifest"
    });
  });
});
