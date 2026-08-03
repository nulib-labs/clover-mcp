import { useEffect, useState } from "react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useApp, useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import Viewer from "@samvera/clover-iiif/viewer";
import "./clover-viewer.css";

declare const __CLOVER_VERSION__: string;

type IIIFLabel = string | { none?: string[]; [key: string]: unknown };
type IIIFResource = {
  id?: string;
  type?: string;
  label?: IIIFLabel;
  items?: IIIFResource[];
  [key: string]: unknown;
};

type ViewerContent = {
  viewerContent: unknown;
  nextPageUrl: string | null;
};

const NEXT_PAGE_LABEL = "next page";

const labelValues = (label: IIIFLabel | undefined): string[] => {
  if (!label) return [];
  if (typeof label === "string") return [label];
  return Object.values(label).flatMap((value) =>
    Array.isArray(value) ? value.map(String) : []
  );
};

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

export const loadViewerContent = async (
  contentUrl: unknown
): Promise<ViewerContent> => {
  if (typeof contentUrl !== "string") {
    return splitCollectionPagination(contentUrl as IIIFResource);
  }

  try {
    const response = await fetch(contentUrl, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      return { viewerContent: contentUrl, nextPageUrl: null };
    }

    const content = (await response.json()) as IIIFResource;
    return splitCollectionPagination(content);
  } catch {
    return { viewerContent: contentUrl, nextPageUrl: null };
  }
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

  const { app, error } = useApp({
    appInfo: { name: "Clover IIIF Viewer", version: __CLOVER_VERSION__ },
    capabilities: {},
    onAppCreated: (app) => {
      console.debug("[clover-mcp] app created");
      app.ontoolresult = (result: CallToolResult) => {
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
      <Viewer iiifContent={viewerContent} />
    </div>
  );
}
