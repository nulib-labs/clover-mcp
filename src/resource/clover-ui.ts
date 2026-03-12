import {
  ReadResourceCallback,
  ResourceMetadata
} from "@modelcontextprotocol/ext-apps/server";
import html from "virtual:inline-html";

export type CloverUIResourceOpts = {
  description: string;
  resourceUri: string;
  resourceDomains?: string[];
  connectDomains?: string[];
};

type CloverUIResourceResult = {
  name: string;
  uri: string;
  config: ResourceMetadata;
  handler: ReadResourceCallback;
};

export const makeCloverUIResource = (
  opts: CloverUIResourceOpts
): CloverUIResourceResult => {
  const {
    description,
    resourceUri,
    resourceDomains = [],
    connectDomains = []
  } = opts;
  const result: CloverUIResourceResult = {
    name: resourceUri,
    uri: resourceUri,
    config: {
      description,
      mimeType: "text/html"
    },
    handler: async () => {
      return {
        contents: [
          {
            uri: "ui://clover-viewer/mcp-app.html",
            text: html,
            mimeType: "text/html;profile=mcp-app",
            _meta: {
              ui: {
                csp: {
                  resourceDomains,
                  connectDomains
                }
              }
            }
          }
        ]
      };
    }
  };
  return result;
};
