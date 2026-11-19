// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { generateMetadataTypes } from "@/scripts/metadata-types.mjs";
import { metadataErrors } from "@/scripts/metadata-validator.mjs";
import metadataFixture from "@/tests/fixtures/metadata-1.0.0.json";

describe("/metadata 1.0.0 contract", () => {
  it("keeps the committed types in step with the schema copy", async () => {
    const committed = readFileSync(
      resolve(import.meta.dirname, "../../types/metadata.ts"),
      "utf8",
    );
    expect(committed).toBe(await generateMetadataTypes());
  });

  it("accepts the fixture recorded from the API", () => {
    expect(metadataErrors(metadataFixture)).toEqual([]);
  });

  it("rejects the legacy array response", () => {
    expect(metadataErrors([{ id: "paleocar_v3" }])).not.toEqual([]);
  });
});
