import { describe, expect, it } from "vitest";

import { CodexSidebarActionProvider } from "../src/sidebarActionView";

describe("CodexSidebarActionProvider", () => {
  it("returns no tree items so the welcome CTA is shown", async () => {
    const provider = new CodexSidebarActionProvider();

    const items = await provider.getChildren();
    expect(items).toEqual([]);
  });

  it("does not provide nested children", async () => {
    const provider = new CodexSidebarActionProvider();

    expect(provider.getChildren({} as never)).toEqual([]);
  });
});
