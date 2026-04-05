import { describe, expect, it, vi } from "vitest";

import { GlobalStateLaunchHistoryStore } from "../src/history";

const createMemento = (initialValue: unknown[] = []) => {
  let value = initialValue;
  return {
    get: vi.fn((_key: string, fallback: unknown[]) => value ?? fallback),
    update: vi.fn(async (_key: string, nextValue: unknown[]) => {
      value = nextValue;
    })
  };
};

describe("GlobalStateLaunchHistoryStore", () => {
  it("adds new entries to the front of history", async () => {
    const memento = createMemento();
    const store = new GlobalStateLaunchHistoryStore(memento as never);

    const first = await store.addLaunch();
    const second = await store.addLaunch();
    const entries = store.list();

    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe(second.id);
    expect(entries[1]?.id).toBe(first.id);
  });

  it("clears stored history", async () => {
    const memento = createMemento([{ id: "1", openedAt: "2025-01-01T00:00:00.000Z" }]);
    const store = new GlobalStateLaunchHistoryStore(memento as never);

    await store.clear();

    expect(store.list()).toEqual([]);
  });
});
