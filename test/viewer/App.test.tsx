import { describe, expect, it, beforeEach, vi } from "vitest";

const reactMocks = vi.hoisted(() => ({
  useEffect: vi.fn(),
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
    useEffect: reactMocks.useEffect,
    useState: reactMocks.useState
  };
});

vi.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useApp: extAppMocks.useApp,
  useHostStyles: extAppMocks.useHostStyles
}));

vi.mock("@samvera/clover-iiif/viewer", () => ({
  default: viewerMocks.CloverIIIF
}));

import App, {
  loadViewerContent,
  splitCollectionPagination
} from "../../viewer/src/App";

function textContent(children: unknown) {
  if (Array.isArray(children)) {
    return children.map(textContent).join("");
  }
  if (
    children &&
    typeof children === "object" &&
    "props" in children &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props
  ) {
    return textContent(children.props.children);
  }
  return String(children);
}

const mockState = (
  values: Array<[unknown, ReturnType<typeof vi.fn>]>
): void => {
  reactMocks.useState.mockReset();
  for (const value of values) {
    reactMocks.useState.mockReturnValueOnce(value);
  }
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__CLOVER_VERSION__", "1.15.4");
    reactMocks.useEffect.mockImplementation(() => undefined);
  });

  it("shows the waiting state until a tool result is received", () => {
    const app = {
      getHostContext: vi.fn(() => ({ theme: "light" }))
    };

    mockState([
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()]
    ]);
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
    mockState([
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()]
    ]);
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

    mockState([
      [null, setContentUrl],
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()]
    ]);
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

  it("wires ontoolresult to update the content URL from text content if structured content is not present", () => {
    const setContentUrl = vi.fn();
    const app: {
      getHostContext: ReturnType<typeof vi.fn>;
      ontoolresult?: (result: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    } = {
      getHostContext: vi.fn(() => undefined)
    };

    mockState([
      [null, setContentUrl],
      [null, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()]
    ]);
    extAppMocks.useApp.mockImplementation(({ onAppCreated }) => {
      onAppCreated(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
      return { app, error: null };
    });

    App();

    expect(typeof app.ontoolresult).toBe("function");

    app.ontoolresult?.({
      content: [
        {
          type: "text",
          text: "Human readable content"
        },
        {
          type: "text",
          text: '{"iiifContentUrl":"https://iiif.example.org/manifest"}'
        }
      ]
    });

    expect(setContentUrl).toHaveBeenCalledWith(
      "https://iiif.example.org/manifest"
    );
  });

  it("renders the Clover viewer once viewer content is available", () => {
    const app = {
      getHostContext: vi.fn(() => undefined)
    };

    const viewerContent = { id: "https://iiif.example.org/manifest" };
    mockState([
      ["https://iiif.example.org/manifest", vi.fn()],
      [viewerContent, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()]
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null });

    const element = App();
    const viewerElement = element.props.children;

    expect(viewerElement.type).toBe(viewerMocks.CloverIIIF);
    expect(viewerElement.props).toEqual({
      iiifContent: viewerContent
    });
  });

  it("does not render a separate next-page control when a page URL is available", () => {
    const app = {
      getHostContext: vi.fn(() => undefined)
    };
    const setContentUrl = vi.fn();
    const viewerContent = { id: "https://iiif.example.org/search?page=1" };
    mockState([
      ["https://iiif.example.org/search?page=1", setContentUrl],
      [viewerContent, vi.fn()],
      ["https://iiif.example.org/search?page=2", vi.fn()],
      [null, vi.fn()]
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null });

    const element = App();

    expect(element.props.children.type).toBe(viewerMocks.CloverIIIF);
    expect(setContentUrl).not.toHaveBeenCalled();
  });
});

describe("splitCollectionPagination", () => {
  it("keeps the next-page collection item at the end of Clover content", () => {
    const content = {
      id: "https://iiif.example.org/search?page=1",
      type: "Collection",
      items: [
        {
          id: "https://iiif.example.org/manifest/1",
          type: "Manifest",
          label: { none: ["One"] }
        },
        {
          id: "https://iiif.example.org/search?page=2",
          type: "Collection",
          label: { none: ["Next page"] }
        },
        {
          id: "https://iiif.example.org/manifest/2",
          type: "Manifest",
          label: { none: ["Two"] }
        }
      ]
    };

    const result = splitCollectionPagination(content);

    expect(result.nextPageUrl).toBe("https://iiif.example.org/search?page=2");
    expect(result.viewerContent).toEqual({
      ...content,
      items: [content.items[0], content.items[2], content.items[1]]
    });
  });

  it("leaves ordinary content unchanged", () => {
    const content = {
      id: "https://iiif.example.org/manifest/1",
      type: "Manifest"
    };

    expect(splitCollectionPagination(content)).toEqual({
      viewerContent: content,
      nextPageUrl: null
    });
  });
});

describe("loadViewerContent", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and splits remote IIIF collection pagination", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id: "https://iiif.example.org/search?page=1",
          type: "Collection",
          items: [
            {
              id: "https://iiif.example.org/manifest/1",
              type: "Manifest"
            },
            {
              id: "https://iiif.example.org/search?page=2",
              type: "Collection",
              label: { none: ["Next page"] }
            }
          ]
        })
      }))
    );

    const result = await loadViewerContent(
      "https://iiif.example.org/search?page=1"
    );

    expect(fetch).toHaveBeenCalledWith("https://iiif.example.org/search?page=1", {
      headers: { Accept: "application/json" }
    });
    expect(result.nextPageUrl).toBe("https://iiif.example.org/search?page=2");
  });
});
