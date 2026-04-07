import { describe, expect, it, vi } from "vitest";

import { createSavedCodexSessionSnapshotFromTab, GlobalStateSavedCodexSessionStore, isCodexSessionResource } from "../src/history";

const createMemento = (initialValue: unknown[] = []) => {
  let value = initialValue;
  return {
    get: vi.fn((_key: string, fallback: unknown[]) => value ?? fallback),
    update: vi.fn(async (_key: string, nextValue: unknown[]) => {
      value = nextValue;
    })
  };
};

describe("GlobalStateSavedCodexSessionStore", () => {
  it("upserts sessions by resource and refreshes the title", async () => {
    const store = new GlobalStateSavedCodexSessionStore(createMemento() as never);

    await store.upsert({
      createdAt: "2026-04-07T00:00:00.000Z",
      openedAt: "2026-04-07T00:10:00.000Z",
      resource: "openai-codex://route/local/thread-1",
      status: "In Progress",
      title: "Codex Session",
      workspaceLabel: "open-codex"
    });
    await store.upsert({
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "Fix button freeze on send"
    });

    const sessions = store.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.status).toBe("Completed");
    expect(sessions[0]?.title).toBe("Fix button freeze on send");
    expect(sessions[0]?.openedAt).toBe("2026-04-07T00:10:00.000Z");
    expect(sessions[0]?.workspaceLabel).toBe("open-codex");
  });

  it("keeps the most recently updated session first", async () => {
    const store = new GlobalStateSavedCodexSessionStore(createMemento() as never);
    await store.upsert({
      openedAt: "2026-04-07T00:00:00.000Z",
      updatedAt: "2026-04-07T00:00:00.000Z",
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "First"
    });
    await store.upsert({
      openedAt: "2026-04-07T00:05:00.000Z",
      updatedAt: "2026-04-07T00:05:00.000Z",
      resource: "openai-codex://route/local/thread-2",
      status: "Completed",
      title: "Second"
    });
    await store.upsert({
      updatedAt: "2026-04-07T00:10:00.000Z",
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "First updated"
    });

    const sessions = store.list();
    expect(sessions[0]?.resource).toBe("openai-codex://route/local/thread-1");
    expect(sessions[0]?.title).toBe("First updated");
    expect(sessions[1]?.resource).toBe("openai-codex://route/local/thread-2");
  });

  it("keeps only the latest 50 sessions", async () => {
    const store = new GlobalStateSavedCodexSessionStore(createMemento() as never);

    for (let index = 0; index < 55; index += 1) {
      await store.upsert({
        openedAt: new Date(Date.UTC(2026, 3, 7, 0, index, 0)).toISOString(),
        updatedAt: new Date(Date.UTC(2026, 3, 7, 0, index, 0)).toISOString(),
        resource: `openai-codex://route/local/thread-${index}`,
        status: "Completed",
        title: `Session ${index}`
      });
    }

    const sessions = store.list();

    expect(sessions).toHaveLength(50);
    expect(sessions[0]?.resource).toBe("openai-codex://route/local/thread-54");
    expect(sessions[49]?.resource).toBe("openai-codex://route/local/thread-5");
  });

  it("strips corrupted structured suffixes from titles", async () => {
    const store = new GlobalStateSavedCodexSessionStore(createMemento() as never);

    await store.upsert({
      resource: "openai-codex://route/local/thread-7",
      status: "Completed",
      title: "t7'}]}]}]}'}]}]}]}"
    });

    const sessions = store.list();
    expect(sessions[0]?.title).toBe("t7");
  });

  it("removes a saved session by resource", async () => {
    const store = new GlobalStateSavedCodexSessionStore(createMemento() as never);

    await store.upsert({
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "First"
    });
    await store.upsert({
      resource: "openai-codex://route/local/thread-2",
      status: "Completed",
      title: "Second"
    });

    await store.remove("openai-codex://route/local/thread-1");

    const sessions = store.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.resource).toBe("openai-codex://route/local/thread-2");
  });

  it("captures openedAt when a tab snapshot is created for a newly opened window", () => {
    const snapshot = createSavedCodexSessionSnapshotFromTab(
      {
        input: {
          uri: {
            toString: () => "openai-codex://route/local/thread-1"
          },
          viewType: "chatgpt.conversationEditor"
        },
        label: "Fix button freeze"
      } as never,
      { openedAt: "2026-04-07T00:15:00.000Z", workspaceLabel: "open-codex" }
    );

    expect(snapshot?.openedAt).toBe("2026-04-07T00:15:00.000Z");
    expect(snapshot?.workspaceLabel).toBe("open-codex");
  });
});

describe("createSavedCodexSessionSnapshotFromTab", () => {
  it("captures a Codex custom editor tab", () => {
    const snapshot = createSavedCodexSessionSnapshotFromTab({
      input: {
        uri: {
          toString: () => "openai-codex://route/local/thread-1"
        },
        viewType: "chatgpt.conversationEditor"
      },
      label: "Fix button freeze"
    } as never);

    expect(snapshot).toEqual({
      openedAt: undefined,
      resource: "openai-codex://route/local/thread-1",
      title: "Fix button freeze",
      workspaceLabel: undefined
    });
  });

  it("ignores non-Codex resources", () => {
    const snapshot = createSavedCodexSessionSnapshotFromTab({
      input: {
        uri: {
          toString: () => "file:///tmp/test.txt"
        },
        viewType: "chatgpt.conversationEditor"
      },
      label: "Ignore me"
    } as never);

    expect(snapshot).toBeNull();
  });
});

describe("isCodexSessionResource", () => {
  it("accepts local and remote Codex conversation resources", () => {
    expect(isCodexSessionResource("openai-codex://route/local/thread-1")).toBe(true);
    expect(isCodexSessionResource("openai-codex://route/remote/thread-2")).toBe(true);
  });

  it("rejects new-panel and non-Codex resources", () => {
    expect(isCodexSessionResource("openai-codex://route/extension/panel/new")).toBe(false);
    expect(isCodexSessionResource("file:///tmp/test.txt")).toBe(false);
  });
});
