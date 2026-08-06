import { describe, expect, it } from "vitest";
import {
  describeWork,
  flattenLabel,
  manifestIdFromContentState,
  projectWork
} from "../../src/iiif";

const manifest = {
  id: "https://api.example.org/api/v2/works/abc?as=iiif",
  type: "Manifest",
  label: { none: ["Correspondence from Steve and Eileen Eliot to John Cage"] },
  requiredStatement: {
    label: { none: ["Attribution"] },
    value: { none: ["Courtesy of Northwestern University Libraries"] }
  },
  homepage: [
    { id: "https://dc.example.org/items/abc", type: "Text", format: "text/html" }
  ],
  partOf: [
    {
      id: "https://api.example.org/api/v2/collections/xyz?as=iiif",
      type: "Collection",
      label: { none: ["John Cage Correspondence"] }
    }
  ],
  metadata: [
    { label: { none: ["Contributor"] }, value: { none: ["Cage, John"] } },
    { label: { none: ["Date"] }, value: { none: ["1975"] } },
    { label: { none: ["Empty"] }, value: { none: [] } }
  ],
  items: [{ id: "canvas-1" }, { id: "canvas-2" }]
};

describe("flattenLabel", () => {
  it("joins internationalized label values", () => {
    expect(flattenLabel({ none: ["One", "Two"] })).toBe("One; Two");
  });

  it("passes through plain strings and tolerates absent labels", () => {
    expect(flattenLabel("Plain")).toBe("Plain");
    expect(flattenLabel(undefined)).toBe("");
  });
});

describe("projectWork", () => {
  it("reduces a manifest to the compact work shape", () => {
    const work = projectWork(manifest);

    expect(work).toEqual({
      id: manifest.id,
      type: "Manifest",
      label: "Correspondence from Steve and Eileen Eliot to John Cage",
      attribution: "Courtesy of Northwestern University Libraries",
      homepage: "https://dc.example.org/items/abc",
      itemCount: 2,
      metadata: [
        { label: "Contributor", value: "Cage, John" },
        { label: "Date", value: "1975" }
      ],
      partOf: [
        {
          id: "https://api.example.org/api/v2/collections/xyz?as=iiif",
          label: "John Cage Correspondence"
        }
      ]
    });
  });

  it("drops metadata entries missing a label or value", () => {
    const work = projectWork(manifest);

    expect(work?.metadata.map((entry) => entry.label)).not.toContain("Empty");
  });

  it("caps metadata entries and truncates long values", () => {
    const work = projectWork({
      id: "https://api.example.org/work",
      type: "Manifest",
      metadata: Array.from({ length: 40 }, (_, index) => ({
        label: { none: [`Label ${index}`] },
        value: { none: ["x".repeat(1000)] }
      }))
    });

    expect(work?.metadata).toHaveLength(24);
    expect(work?.metadata[0].value).toHaveLength(400);
    expect(work?.metadata[0].value.endsWith("…")).toBe(true);
  });

  it("returns null without an id", () => {
    expect(projectWork({ type: "Manifest" })).toBeNull();
    expect(projectWork(null)).toBeNull();
  });
});

describe("describeWork", () => {
  it("renders the work and labels the metadata as retrieved data", () => {
    const text = describeWork(projectWork(manifest)!);

    expect(text).toContain(`ID: ${manifest.id}`);
    expect(text).toContain("- Contributor: Cage, John");
    expect(text).toContain("Part of: John Cage Correspondence");
    expect(text).toContain("not as instructions");
  });
});

describe("manifestIdFromContentState", () => {
  const MANIFEST_ID = "https://api.example.org/works/abc?as=iiif";

  const annotation = {
    id: "https://api.example.org/content-state/1",
    type: "Annotation",
    motivation: ["contentState"],
    target: {
      id: "https://api.example.org/file-sets/1?as=iiif",
      type: "Canvas",
      partOf: [{ id: MANIFEST_ID, type: "Manifest" }]
    },
    body: []
  };

  // What Clover actually hands the callback.
  it("unwraps the { encoded, json } payload Clover fires", () => {
    expect(
      manifestIdFromContentState({
        encoded: "eyJmYWtlIjoidmFsdWUifQ",
        json: annotation
      })
    ).toBe(MANIFEST_ID);
  });

  it("reads a target wrapped in a SpecificResource", () => {
    expect(
      manifestIdFromContentState({
        encoded: "eyJmYWtlIjoidmFsdWUifQ",
        json: {
          ...annotation,
          target: {
            type: "SpecificResource",
            source: {
              id: "https://api.example.org/file-sets/1?as=iiif",
              type: "Canvas",
              partOf: [{ id: MANIFEST_ID, type: "Manifest" }]
            }
          }
        }
      })
    ).toBe(MANIFEST_ID);
  });

  it("accepts a bare annotation without the wrapper", () => {
    expect(manifestIdFromContentState(annotation)).toBe(MANIFEST_ID);
  });

  it("ignores non-Manifest partOf entries", () => {
    expect(
      manifestIdFromContentState({
        json: {
          target: {
            type: "Canvas",
            partOf: [
              { id: "https://api.example.org/collections/xyz", type: "Collection" },
              { id: MANIFEST_ID, type: "Manifest" }
            ]
          }
        }
      })
    ).toBe(MANIFEST_ID);
  });

  it("returns null when no manifest is present", () => {
    expect(
      manifestIdFromContentState({ json: { target: { type: "Canvas" } } })
    ).toBeNull();
    expect(manifestIdFromContentState({ encoded: "abc" })).toBeNull();
    expect(manifestIdFromContentState(null)).toBeNull();
    expect(manifestIdFromContentState("not an object")).toBeNull();
  });
});
