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
  DISPLAYED_WORK_TOOL,
  displayedWorkStore,
  loadViewerContent,
  publishWorkContext,
  registerDisplayedWorkTool,
  resolveDisplayedWork,
  splitCollectionPagination
} from "../../viewer/src/App";
import type { WorkSummary } from "../../src/iiif";

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

/** App has six useState hooks; unlisted ones default to null. */
const idleState = (
  overrides: Array<[unknown, ReturnType<typeof vi.fn>]> = []
): void => {
  const state: Array<[unknown, ReturnType<typeof vi.fn>]> = Array.from(
    { length: 6 },
    (_, index) => overrides[index] ?? [null, vi.fn()]
  );
  mockState(state);
};

const work: WorkSummary = {
  id: "https://api.example.org/works/abc?as=iiif",
  type: "Manifest",
  label: "A Displayed Work",
  metadata: [{ label: "Date", value: "1975" }],
  partOf: []
};

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("__CLOVER_VERSION__", "1.15.4");
    reactMocks.useEffect.mockImplementation(() => undefined);
    displayedWorkStore.work = null;
    displayedWorkStore.source = null;
    displayedWorkStore.tool = null;
  });

  it("shows the waiting state until a tool result is received", () => {
    const app = {
      getHostContext: vi.fn(() => ({ theme: "light" }))
    };

    idleState();
    extAppMocks.useApp.mockReturnValue({ app, error: null, isConnected: true });

    const element = App();

    expect(extAppMocks.useApp).toHaveBeenCalledWith({
      appInfo: { name: "Clover IIIF Viewer", version: "1.15.4" },
      capabilities: { tools: { listChanged: true } },
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
    idleState();
    extAppMocks.useApp.mockReturnValue({
      app: null,
      error: new Error("Host unavailable"),
      isConnected: false
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
      registerTool: ReturnType<typeof vi.fn>;
      ontoolresult?: (result: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    } = {
      getHostContext: vi.fn(() => undefined),
      registerTool: vi.fn(() => ({ update: vi.fn() }))
    };

    idleState([[null, setContentUrl]]);
    extAppMocks.useApp.mockImplementation(({ onAppCreated }) => {
      onAppCreated(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
      return { app, error: null, isConnected: true };
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
      registerTool: ReturnType<typeof vi.fn>;
      ontoolresult?: (result: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    } = {
      getHostContext: vi.fn(() => undefined),
      registerTool: vi.fn(() => ({ update: vi.fn() }))
    };

    idleState([[null, setContentUrl]]);
    extAppMocks.useApp.mockImplementation(({ onAppCreated }) => {
      onAppCreated(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
      return { app, error: null, isConnected: true };
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

  it("registers the displayed-work app tool when the app is created", () => {
    const registeredTool = { update: vi.fn() };
    const app = {
      getHostContext: vi.fn(() => undefined),
      registerTool: vi.fn(() => registeredTool)
    };

    idleState();
    extAppMocks.useApp.mockImplementation(({ onAppCreated }) => {
      onAppCreated(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
      return { app, error: null, isConnected: true };
    });

    App();

    expect(app.registerTool).toHaveBeenCalledWith(
      DISPLAYED_WORK_TOOL,
      expect.objectContaining({ title: "Get displayed work" }),
      expect.any(Function)
    );
    expect(displayedWorkStore.tool).toBe(registeredTool);
  });

  it("renders the Clover viewer once viewer content is available", () => {
    const app = {
      getHostContext: vi.fn(() => undefined)
    };

    const viewerContent = { id: "https://iiif.example.org/manifest" };
    idleState([
      ["https://iiif.example.org/manifest", vi.fn()],
      [viewerContent, vi.fn()]
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null, isConnected: true });

    const element = App();
    const viewerElement = element.props.children;

    expect(viewerElement.type).toBe(viewerMocks.CloverIIIF);
    expect(viewerElement.props).toEqual({
      iiifContent: viewerContent,
      contentStateCallback: expect.any(Function)
    });
  });

  const fireContentState = (
    element: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    manifestId: string
  ): void =>
    // Clover fires the callback with { encoded, json }.
    element.props.children.props.contentStateCallback({
      encoded: "eyJmYWtlIjoidmFsdWUifQ",
      json: {
        type: "Annotation",
        motivation: ["contentState"],
        target: {
          id: "https://iiif.example.org/file-sets/1",
          type: "Canvas",
          partOf: [{ id: manifestId, type: "Manifest" }]
        }
      }
    });

  const activeManifestUpdater = (
    setActiveManifest: ReturnType<typeof vi.fn>
  ) =>
    setActiveManifest.mock.calls[
      setActiveManifest.mock.calls.length - 1
    ][0] as (current: unknown) => unknown;

  const appShowingCollection = (
    setActiveManifest: ReturnType<typeof vi.fn>
  ) => {
    const app = { getHostContext: vi.fn(() => undefined) };

    idleState([
      ["https://iiif.example.org/collection", vi.fn()],
      [{ id: "https://iiif.example.org/collection" }, vi.fn()],
      [null, vi.fn()],
      [null, vi.fn()],
      [null, setActiveManifest]
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null, isConnected: true });

    return App();
  };

  it("records the active manifest reported by Clover's content state", () => {
    const setActiveManifest = vi.fn();

    fireContentState(
      appShowingCollection(setActiveManifest),
      "https://iiif.example.org/manifest/7"
    );

    // The first manifest for this content is the viewer's own choice.
    expect(activeManifestUpdater(setActiveManifest)(null)).toEqual({
      id: "https://iiif.example.org/manifest/7",
      viaNavigation: false
    });
  });

  it("marks a change of manifest as user navigation", () => {
    const setActiveManifest = vi.fn();

    fireContentState(
      appShowingCollection(setActiveManifest),
      "https://iiif.example.org/manifest/9"
    );

    expect(
      activeManifestUpdater(setActiveManifest)({
        id: "https://iiif.example.org/manifest/7",
        viaNavigation: false
      })
    ).toEqual({
      id: "https://iiif.example.org/manifest/9",
      viaNavigation: true
    });
  });

  it("leaves the active manifest untouched when Clover repeats itself", () => {
    const setActiveManifest = vi.fn();
    const current = {
      id: "https://iiif.example.org/manifest/7",
      viaNavigation: false
    };

    fireContentState(
      appShowingCollection(setActiveManifest),
      "https://iiif.example.org/manifest/7"
    );

    expect(activeManifestUpdater(setActiveManifest)(current)).toBe(current);
  });

  it("does not render a separate next-page control when a page URL is available", () => {
    const app = {
      getHostContext: vi.fn(() => undefined)
    };
    const setContentUrl = vi.fn();
    const viewerContent = { id: "https://iiif.example.org/search?page=1" };
    idleState([
      ["https://iiif.example.org/search?page=1", setContentUrl],
      [viewerContent, vi.fn()],
      ["https://iiif.example.org/search?page=2", vi.fn()]
    ]);
    extAppMocks.useApp.mockReturnValue({ app, error: null, isConnected: true });

    const element = App();

    expect(element.props.children.type).toBe(viewerMocks.CloverIIIF);
    expect(setContentUrl).not.toHaveBeenCalled();
  });
});

describe("registerDisplayedWorkTool", () => {
  beforeEach(() => {
    displayedWorkStore.work = null;
    displayedWorkStore.source = null;
    displayedWorkStore.tool = null;
  });

  const callbackFor = (app: { registerTool: ReturnType<typeof vi.fn> }) => {
    registerDisplayedWorkTool(app as any); //eslint-disable-line @typescript-eslint/no-explicit-any
    return app.registerTool.mock.calls[0][2] as () => Promise<{
      content: Array<{ type: string; text: string }>;
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    }>;
  };

  it("reports an error while nothing is displayed", async () => {
    const app = { registerTool: vi.fn(() => ({ update: vi.fn() })) };
    const result = await callbackFor(app)();

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("not currently displaying");
  });

  it("returns the current work as text and structured content", async () => {
    const app = { registerTool: vi.fn(() => ({ update: vi.fn() })) };
    const callback = callbackFor(app);

    displayedWorkStore.work = work;
    const result = await callback();

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(work);
    expect(result.content[0].text).toContain(work.id);
  });

  it("says the viewer chose the work when the user has not", async () => {
    const app = { registerTool: vi.fn(() => ({ update: vi.fn() })) };
    const callback = callbackFor(app);

    displayedWorkStore.work = work;
    displayedWorkStore.source = "collection-default";

    expect((await callback()).content[0].text).toContain(
      "the user has not selected an item"
    );
  });

  it("says the user navigated to the work when they did", async () => {
    const app = { registerTool: vi.fn(() => ({ update: vi.fn() })) };
    const callback = callbackFor(app);

    displayedWorkStore.work = work;
    displayedWorkStore.source = "collection-selection";

    const text = (await callback()).content[0].text;
    expect(text).toContain("The user has navigated to this Manifest");
    expect(text).not.toContain("has not selected");
  });

  it("reads the work at call time rather than at registration time", async () => {
    const app = { registerTool: vi.fn(() => ({ update: vi.fn() })) };
    const callback = callbackFor(app);

    expect((await callback()).isError).toBe(true);

    displayedWorkStore.work = work;

    expect((await callback()).isError).toBeUndefined();
  });
});

describe("get_displayed_work against the real MCP App", () => {
  it("lists and calls the tool through ext-apps itself", async () => {
    const { App: McpApp } = await import("@modelcontextprotocol/ext-apps");
    const mcpApp = new McpApp(
      { name: "test", version: "1.0.0" },
      { tools: { listChanged: true } }
    );

    displayedWorkStore.tool = registerDisplayedWorkTool(mcpApp);
    displayedWorkStore.work = work;

    const listed = await mcpApp.onlisttools!(
      { method: "tools/list" } as any, //eslint-disable-line @typescript-eslint/no-explicit-any
      {} as any //eslint-disable-line @typescript-eslint/no-explicit-any
    );
    const listedTool = listed.tools.find(
      (tool) => tool.name === DISPLAYED_WORK_TOOL
    );
    expect(listedTool?.title).toBe("Get displayed work");

    const called = await mcpApp.oncalltool!(
      { name: DISPLAYED_WORK_TOOL, arguments: {} },
      {} as any //eslint-disable-line @typescript-eslint/no-explicit-any
    );
    expect(called.structuredContent).toEqual(work);
    expect(called.isError).toBeUndefined();
  });
});

describe("publishWorkContext", () => {
  beforeEach(() => {
    displayedWorkStore.tool = null;
  });

  it("pushes model context when the host supports it", () => {
    const updateModelContext = vi.fn(() => Promise.resolve({}));
    const app = {
      getHostCapabilities: vi.fn(() => ({ updateModelContext: {} })),
      updateModelContext
    };

    publishWorkContext(app as any, work); //eslint-disable-line @typescript-eslint/no-explicit-any

    expect(updateModelContext).toHaveBeenCalledWith({
      content: [{ type: "text", text: expect.stringContaining(work.id) }],
      structuredContent: { displayedWork: work }
    });
  });

  it("skips model context when the host does not support it", () => {
    const updateModelContext = vi.fn(() => Promise.resolve({}));
    const app = {
      getHostCapabilities: vi.fn(() => ({})),
      updateModelContext
    };

    publishWorkContext(app as any, work); //eslint-disable-line @typescript-eslint/no-explicit-any

    expect(updateModelContext).not.toHaveBeenCalled();
  });

  it("retitles the registered tool with the displayed work", () => {
    const update = vi.fn();
    displayedWorkStore.tool = { update } as any; //eslint-disable-line @typescript-eslint/no-explicit-any
    const app = {
      getHostCapabilities: vi.fn(() => ({})),
      updateModelContext: vi.fn()
    };

    publishWorkContext(app as any, work); //eslint-disable-line @typescript-eslint/no-explicit-any

    expect(update).toHaveBeenCalledWith({
      description: expect.stringContaining("Currently displaying: A Displayed Work")
    });
  });

  it("flags a default-opened work in the tool description", () => {
    const update = vi.fn();
    displayedWorkStore.tool = { update } as any; //eslint-disable-line @typescript-eslint/no-explicit-any
    const app = {
      getHostCapabilities: vi.fn(() => ({})),
      updateModelContext: vi.fn()
    };

    publishWorkContext(app as any, work, "collection-default"); //eslint-disable-line @typescript-eslint/no-explicit-any

    expect(update).toHaveBeenCalledWith({
      description: expect.stringContaining(
        "Currently displaying (opened by default, not user-selected): A Displayed Work"
      )
    });
  });

  it("carries the display source into the pushed model context", () => {
    const updateModelContext = vi.fn(() => Promise.resolve({}));
    const app = {
      getHostCapabilities: vi.fn(() => ({ updateModelContext: {} })),
      updateModelContext
    };

    publishWorkContext(app as any, work, "collection-default"); //eslint-disable-line @typescript-eslint/no-explicit-any

    expect(updateModelContext).toHaveBeenCalledWith({
      content: [
        {
          type: "text",
          text: expect.stringContaining("the user has not selected an item")
        }
      ],
      structuredContent: { displayedWork: work }
    });
  });

  it("does not reject when the host fails the context update", async () => {
    const app = {
      getHostCapabilities: vi.fn(() => ({ updateModelContext: {} })),
      updateModelContext: vi.fn(() => Promise.reject(new Error("nope")))
    };

    expect(() => publishWorkContext(app as any, work)).not.toThrow(); //eslint-disable-line @typescript-eslint/no-explicit-any
    await Promise.resolve();
  });
});

describe("resolveDisplayedWork", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  const nestedManifest = (id: string, viaNavigation: boolean) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          id,
          type: "Manifest",
          label: { none: ["Nested"] }
        })
      }))
    );

    return resolveDisplayedWork(
      { id: "https://iiif.example.org/collection", type: "Collection" },
      { id, viaNavigation }
    );
  };

  it("projects a loaded manifest directly", async () => {
    const content = {
      id: "https://iiif.example.org/manifest",
      type: "Manifest",
      label: { none: ["Direct"] }
    };

    expect(await resolveDisplayedWork(content, null)).toMatchObject({
      work: { id: content.id, label: "Direct" },
      source: "content"
    });
  });

  it("fetches the active manifest when a collection is loaded", async () => {
    const result = await nestedManifest(
      "https://iiif.example.org/manifest/7",
      false
    );

    expect(fetch).toHaveBeenCalledWith("https://iiif.example.org/manifest/7", {
      headers: { Accept: "application/json" }
    });
    expect(result).toMatchObject({
      work: { label: "Nested" },
      source: "collection-default"
    });
  });

  it("reports a navigated-to collection member as the user's choice", async () => {
    expect(
      await nestedManifest("https://iiif.example.org/manifest/7", true)
    ).toMatchObject({
      work: { label: "Nested" },
      source: "collection-selection"
    });
  });

  it("falls back to the collection when the manifest fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const result = await resolveDisplayedWork(
      {
        id: "https://iiif.example.org/collection",
        type: "Collection",
        label: { none: ["Fallback"] }
      },
      { id: "https://iiif.example.org/manifest/7", viaNavigation: true }
    );

    expect(result).toMatchObject({
      work: { label: "Fallback", type: "Collection" },
      source: "content"
    });
  });

  it("returns null without content", async () => {
    expect(await resolveDisplayedWork(null, null)).toBeNull();
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
