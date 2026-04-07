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
      resource: "openai-codex://route/local/thread-1",
      status: "In Progress",
      title: "Codex Session"
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
  });

  it("keeps the newest updated session first", async () => {
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
    await store.upsert({
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "First updated"
    });

    const sessions = store.list();
    expect(sessions[0]?.resource).toBe("openai-codex://route/local/thread-1");
    expect(sessions[0]?.title).toBe("First updated");
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
      resource: "openai-codex://route/local/thread-1",
      title: "Fix button freeze"
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
