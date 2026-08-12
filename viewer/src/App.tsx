import { useEffect, useState } from "react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type {
  App as McpApp,
  RegisteredAppTool
} from "@modelcontextprotocol/ext-apps";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import Viewer from "@samvera/clover-iiif/viewer";
import {
  describeWork,
  labelValues,
  manifestIdFromContentState,
  projectWork,
  type IIIFResource,
  type WorkSummary
} from "../../src/iiif";
import "./clover-viewer.css";

declare const __CLOVER_VERSION__: string;

type ViewerContent = {
  viewerContent: unknown;
  nextPageUrl: string | null;
};

/**
 * Which Manifest the viewer has open, and whether the user put it there.
 *
 * Clover fires `contentStateCallback` on load as well as on navigation, so the
 * first Manifest reported for a given content URL is the viewer's own choice,
 * not the user's.
 */
export type ActiveManifest = {
  id: string;
  viaNavigation: boolean;
};

/**
 * How the displayed work came to be on screen:
 *
 * - `content` — it is the resource that was loaded into the viewer.
 * - `collection-default` — the viewer opened it from the loaded Collection.
 * - `collection-selection` — the user navigated to it within that Collection.
 */
export type DisplaySource =
  | "content"
  | "collection-default"
  | "collection-selection";

export type DisplayedWork = {
  work: WorkSummary;
  source: DisplaySource;
};

const NEXT_PAGE_LABEL = "next page";

export const DISPLAYED_WORK_TOOL = "get_displayed_work";

export const DISPLAYED_WORK_DESCRIPTION =
  "Returns the ID and descriptive metadata of the IIIF work currently " +
  "displayed in the Clover viewer. Call this to find out what the user is " +
  "looking at before searching for or retrieving related items.";

/**
 * The app tool is registered once, before the host handshake, but its callback
 * has to read whatever is on screen *now* — not what was on screen when the
 * closure was created. One viewer per document makes a module-level store the
 * honest representation of that.
 */
export const displayedWorkStore: {
  work: WorkSummary | null;
  source: DisplaySource | null;
  tool: RegisteredAppTool | null;
} = { work: null, source: null, tool: null };

const isNextPageCollection = (item: IIIFResource): boolean =>
  item.type === "Collection" &&
  labelValues(item.label).some(
    (value) => value.trim().toLowerCase() === NEXT_PAGE_LABEL
  );

export const splitCollectionPagination = (
  content: IIIFResource
): ViewerContent => {
  if (content.type !== "Collection" || !Array.isArray(content.items)) {
    return { viewerContent: content, nextPageUrl: null };
  }

  const nextPage = content.items.find(isNextPageCollection);
  if (!nextPage?.id) {
    return { viewerContent: content, nextPageUrl: null };
  }

  return {
    viewerContent: {
      ...content,
      items: [
        ...content.items.filter((item) => item !== nextPage),
        nextPage
      ]
    },
    nextPageUrl: nextPage.id
  };
};

const fetchIIIF = async (url: string): Promise<IIIFResource | null> => {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    return (await response.json()) as IIIFResource;
  } catch {
    return null;
  }
};

export const loadViewerContent = async (
  contentUrl: unknown
): Promise<ViewerContent> => {
  if (typeof contentUrl !== "string") {
    return splitCollectionPagination(contentUrl as IIIFResource);
  }

  const content = await fetchIIIF(contentUrl);
  if (!content) return { viewerContent: contentUrl, nextPageUrl: null };

  return splitCollectionPagination(content);
};

/**
 * Work out which IIIF resource is actually on screen, and why.
 *
 * A Manifest is its own work. A Collection is not — its items are stubs
 * carrying only id/label/thumbnail — so when the content state names a nested
 * Manifest, that Manifest is fetched for its descriptive metadata. Falling back
 * to the Collection keeps the tool useful before any item has been opened.
 */
export const resolveDisplayedWork = async (
  content: IIIFResource | null,
  activeManifest: ActiveManifest | null
): Promise<DisplayedWork | null> => {
  if (!content) return null;

  if (
    activeManifest &&
    activeManifest.id !== content.id &&
    content.type !== "Manifest"
  ) {
    const work = projectWork(await fetchIIIF(activeManifest.id));
    if (work) {
      return {
        work,
        source: activeManifest.viaNavigation
          ? "collection-selection"
          : "collection-default"
      };
    }
  }

  const work = projectWork(content);
  return work ? { work, source: "content" } : null;
};

/**
 * Say what is on screen *and* who put it there.
 *
 * Without the second half, a member of a Collection that the viewer opened on
 * its own arrives looking as if the user had chosen it, and the model
 * reasonably invents a reason why that member — "the first item" — when IIIF
 * Collections carry no order and Clover's default is not ours to describe.
 */
const DISPLAY_LEADS: Record<DisplaySource, (type: string) => string> = {
  content: (type) =>
    `The Clover IIIF viewer is currently displaying this ${type}.`,
  "collection-default": (type) =>
    `The Clover IIIF viewer is currently displaying this ${type}. The ` +
    "viewer opened it by default when the surrounding Collection loaded; " +
    "the user has not selected an item.",
  "collection-selection": (type) =>
    `The user has navigated to this ${type} in the Clover IIIF viewer, which ` +
    "is currently displaying it."
};

const describeDisplayedWork = (
  work: WorkSummary,
  source: DisplaySource = "content"
): string => describeWork(work, DISPLAY_LEADS[source](work.type));

export const registerDisplayedWorkTool = (app: McpApp): RegisteredAppTool =>
  app.registerTool(
    DISPLAYED_WORK_TOOL,
    {
      title: "Get displayed work",
      description: DISPLAYED_WORK_DESCRIPTION
    },
    async () => {
      const { work, source } = displayedWorkStore;

      if (!work) {
        return {
          content: [
            {
              type: "text" as const,
              text: "The Clover viewer is not currently displaying any IIIF content."
            }
          ],
          isError: true
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: describeDisplayedWork(work, source ?? undefined)
          }
        ],
        structuredContent: work as unknown as Record<string, unknown>
      };
    }
  );

/**
 * Push the displayed work into the conversation two ways: ambiently via
 * `ui/update-model-context` (which hosts hold until the next user message, so
 * "show me more like this" already has it), and by retitling the app tool so a
 * host listing tools can see what it would return. `update()` emits
 * `notifications/tools/list_changed` itself — no manual send needed.
 */
export const publishWorkContext = (
  app: McpApp,
  work: WorkSummary,
  source: DisplaySource = "content"
): void => {
  if (app.getHostCapabilities()?.updateModelContext) {
    app
      .updateModelContext({
        content: [{ type: "text", text: describeDisplayedWork(work, source) }],
        structuredContent: { displayedWork: work }
      })
      .catch((err) =>
        console.debug("[clover-mcp] updateModelContext failed", err)
      );
  }

  const qualifier =
    source === "collection-default"
      ? " (opened by default, not user-selected)"
      : "";

  displayedWorkStore.tool?.update({
    description:
      `${DISPLAYED_WORK_DESCRIPTION} Currently displaying${qualifier}: ` +
      `${work.label || work.id}.`
  });
};

const isNextPageOption = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;

  const option = target.closest('[role="option"]');
  return (
    option?.textContent?.trim().toLowerCase() === NEXT_PAGE_LABEL
  );
};

export default function App() {
  const [contentUrl, setContentUrl] = useState<unknown>(null);
  const [viewerContent, setViewerContent] = useState<unknown>(null);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [activeManifest, setActiveManifest] = useState<ActiveManifest | null>(
    null
  );
  const [displayedWork, setDisplayedWork] = useState<DisplayedWork | null>(
    null
  );

  const { app, isConnected, error } = useApp({
    appInfo: { name: "Clover IIIF Viewer", version: __CLOVER_VERSION__ },
    capabilities: { tools: { listChanged: true } },
    onAppCreated: (createdApp) => {
      console.debug("[clover-mcp] app created");
      createdApp.ontoolresult = (result: CallToolResult) => {
        console.debug("[clover-mcp] tool result:", result);
        if (result.structuredContent?.iiifContentUrl) {
          setContentUrl(result.structuredContent?.iiifContentUrl);
        } else {
          for (const contentItem of result.content) {
            if (contentItem.type === "text") {
              try {
                const structuredContent = JSON.parse(contentItem.text);
                if (structuredContent?.iiifContentUrl) {
                  setContentUrl(structuredContent.iiifContentUrl);
                  break;
                }
              } catch {
                // Ignore JSON parse errors and continue to the next content item
              }
            }
          }
        }
      };

      displayedWorkStore.tool = registerDisplayedWorkTool(createdApp);
    }
  });

  useHostStyles(app, app?.getHostContext());

  useEffect(() => {
    if (!contentUrl) {
      setViewerContent(null);
      setNextPageUrl(null);
      return;
    }

    let isCurrent = true;
    setLoadError(null);
    setViewerContent(null);
    setNextPageUrl(null);
    setActiveManifest(null);

    loadViewerContent(contentUrl)
      .then((result) => {
        if (!isCurrent) return;
        setViewerContent(result.viewerContent);
        setNextPageUrl(result.nextPageUrl);
      })
      .catch((err) => {
        if (!isCurrent) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      isCurrent = false;
    };
  }, [contentUrl]);

  useEffect(() => {
    let isCurrent = true;

    resolveDisplayedWork(viewerContent as IIIFResource | null, activeManifest)
      .then((display) => {
        if (!isCurrent) return;
        displayedWorkStore.work = display?.work ?? null;
        displayedWorkStore.source = display?.source ?? null;
        setDisplayedWork(display);
      })
      .catch((err) => {
        console.debug("[clover-mcp] failed to resolve displayed work", err);
      });

    return () => {
      isCurrent = false;
    };
  }, [viewerContent, activeManifest]);

  useEffect(() => {
    if (!app || !isConnected || !displayedWork) return;
    publishWorkContext(app, displayedWork.work, displayedWork.source);
  }, [app, isConnected, displayedWork]);

  useEffect(() => {
    if (!nextPageUrl) return;

    const decorateNextPageOption = () => {
      document.querySelectorAll('[role="option"]').forEach((option) => {
        option.classList.toggle(
          "clover-mcp-next-page-option",
          option.textContent?.trim().toLowerCase() === NEXT_PAGE_LABEL
        );
      });
    };

    const handleSelect = (event: Event) => {
      const target =
        event instanceof KeyboardEvent ? document.activeElement : event.target;
      if (!isNextPageOption(target)) return;
      if (
        event instanceof KeyboardEvent &&
        ![" ", "Enter"].includes(event.key)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setContentUrl(nextPageUrl);
    };

    decorateNextPageOption();
    const observer = new MutationObserver(decorateNextPageOption);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("pointerup", handleSelect, true);
    document.addEventListener("click", handleSelect, true);
    document.addEventListener("keydown", handleSelect, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerup", handleSelect, true);
      document.removeEventListener("click", handleSelect, true);
      document.removeEventListener("keydown", handleSelect, true);
    };
  }, [nextPageUrl]);

  if (error) return <div>Error: {error.message}</div>;
  if (loadError) return <div>Error: {loadError.message}</div>;

  if (!contentUrl) return <div>Waiting for tool result...</div>;
  if (!viewerContent) return <div>Loading IIIF content...</div>;

  return (
    <div className="clover-mcp-viewer">
      <Viewer
        iiifContent={viewerContent}
        contentStateCallback={(contentState: object) => {
          const manifestId = manifestIdFromContentState(contentState);
          if (!manifestId) return;

          // The first Manifest reported for this content is the viewer's own
          // choice; only a *change* of Manifest means the user moved.
          setActiveManifest((current) =>
            current?.id === manifestId
              ? current
              : { id: manifestId, viaNavigation: current !== null }
          );
        }}
      />
    </div>
  );
}
