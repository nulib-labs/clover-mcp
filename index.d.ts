import type {
  CacheHint,
  McpServer,
  RegisteredTool
} from "@modelcontextprotocol/server";

/**
 * Tool callbacks are passed through to `McpServer.registerTool` with UI
 * resource metadata merged into their results; any registerTool-compatible
 * callback shape is accepted.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CloverToolCallback = (...args: any[]) => any;

export type IIIFLabel = string | { none?: string[]; [key: string]: unknown };

export type IIIFResource = {
  id?: string;
  type?: string;
  label?: IIIFLabel;
  summary?: IIIFLabel;
  metadata?: Array<{ label?: IIIFLabel; value?: IIIFLabel }>;
  requiredStatement?: { label?: IIIFLabel; value?: IIIFLabel };
  partOf?: IIIFResource[];
  homepage?: IIIFResource[];
  items?: IIIFResource[];
  [key: string]: unknown;
};

export type WorkMetadata = {
  label: string;
  value: string;
};

/** Compact, model-readable projection of a IIIF Manifest or Collection. */
export type WorkSummary = {
  id: string;
  type: string;
  label: string;
  summary?: string;
  attribution?: string;
  homepage?: string;
  metadata: WorkMetadata[];
  partOf: Array<{ id: string; label: string }>;
  itemCount?: number;
};

export declare function labelValues(label: IIIFLabel | undefined): string[];
export declare function flattenLabel(label: IIIFLabel | undefined): string;
export declare function projectWork(
  resource: IIIFResource | null | undefined
): WorkSummary | null;
export declare function describeWork(work: WorkSummary, lead?: string): string;
export declare function manifestIdFromContentState(
  contentState: unknown
): string | null;

export type CloverUIResourceOpts = {
  description: string;
  resourceUri: string;
  resourceDomains?: string[];
  connectDomains?: string[];
  cacheHint?: CacheHint;
};

export declare class CloverUIResource {
  opts: CloverUIResourceOpts;
  constructor(opts: CloverUIResourceOpts);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addResourceMeta(content: Record<string, unknown>): any;
  wrapToolCallback(cb: CloverToolCallback): CloverToolCallback;
  registerResource(server: McpServer): void;
  registerTool(
    server: McpServer,
    toolName: string,
    toolConfig: Record<string, unknown>,
    cb: CloverToolCallback
  ): RegisteredTool;
}
