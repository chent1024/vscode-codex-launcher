import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OpenAICodexSessionSync,
  createSavedCodexSessionSnapshotFromConversationState,
  createSavedCodexSessionSnapshotFromThreadBroadcast
} from "../src/openaiIpcClient";

class FakeSocket extends EventEmitter {
  public readonly writes: Buffer[] = [];
  public writable = true;

  public destroy(): this {
    this.writable = false;
    this.emit("close");
    return this;
  }

  public write(buffer: Buffer): boolean {
    this.writes.push(Buffer.from(buffer));
    return true;
  }
}

const frameMessage = (message: unknown): Buffer => {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const frame = Buffer.alloc(4 + payload.length);
  frame.writeUInt32LE(payload.length, 0);
  payload.copy(frame, 4);
  return frame;
};

const parseFirstWrite = (socket: FakeSocket): unknown => {
  const frame = socket.writes[0];
  if (!frame) {
    return null;
  }

  const payloadLength = frame.readUInt32LE(0);
  return JSON.parse(frame.subarray(4, 4 + payloadLength).toString("utf8"));
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("createSavedCodexSessionSnapshotFromConversationState", () => {
  it("extracts a resumable Codex session from a local conversation snapshot", () => {
    const snapshot = createSavedCodexSessionSnapshotFromConversationState({
      hostId: "local",
      id: "thread-1",
      turns: [
        {
          finalAssistantStartedAtMs: 1_700_000_100_000,
          params: {
            input: [
              {
                text: "Fix the stuck send state in the old Codex tab\n",
                type: "text"
              }
            ]
          },
          status: "completed",
          turnStartedAtMs: 1_700_000_000_000
        }
      ]
    });

    expect(snapshot).toEqual({
      createdAt: "2023-11-14T22:13:20.000Z",
      resource: "openai-codex://route/local/thread-1",
      status: "Completed",
      title: "Fix the stuck send state in the old Codex tab",
      updatedAt: "2023-11-14T22:15:00.000Z"
    });
  });

  it("maps non-completed turn statuses to in-progress or failed", () => {
    expect(
      createSavedCodexSessionSnapshotFromConversationState({
        hostId: "local",
        id: "thread-2",
        turns: [{ status: "streaming" }]
      })?.status
    ).toBe("In Progress");

    expect(
      createSavedCodexSessionSnapshotFromConversationState({
        hostId: "remote",
        id: "thread-3",
        turns: [{ status: "aborted" }]
      })?.status
    ).toBe("Failed");
  });

  it("falls back to the default status when a turn status is missing", () => {
    const snapshot = createSavedCodexSessionSnapshotFromConversationState({
      hostId: "local",
      id: "thread-4",
      turns: [{}]
    });

    expect(snapshot?.status).toBe("Completed");
    expect(snapshot?.title).toBeUndefined();
  });
});

describe("createSavedCodexSessionSnapshotFromThreadBroadcast", () => {
  it("ignores unrelated IPC messages", () => {
    expect(
      createSavedCodexSessionSnapshotFromThreadBroadcast({
        method: "client-status-changed",
        type: "broadcast"
      })
    ).toBeNull();
  });

  it("extracts a snapshot from a thread-stream-state-changed broadcast", () => {
    const snapshot = createSavedCodexSessionSnapshotFromThreadBroadcast({
      method: "thread-stream-state-changed",
      params: {
        change: {
          conversationState: {
            hostId: "local",
            id: "thread-4",
            turns: [
              {
                params: {
                  input: [
                    {
                      text: "Reopen the same Codex session like resume",
                      type: "text"
                    }
                  ]
                },
                status: "completed"
              }
            ]
          },
          type: "snapshot"
        }
      },
      type: "broadcast"
    });

    expect(snapshot?.resource).toBe("openai-codex://route/local/thread-4");
    expect(snapshot?.title).toBe("Reopen the same Codex session like resume");
  });
});

describe("OpenAICodexSessionSync", () => {
  it("sends initialize when it connects to the Codex IPC socket", async () => {
    const socket = new FakeSocket();

    const sync = new OpenAICodexSessionSync(
      {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
      },
      {
        onSessionSnapshot: vi.fn()
      },
      {
        clearTimeout,
        createConnection: () => {
          queueMicrotask(() => {
            socket.emit("connect");
          });
          return socket as never;
        },
        existsSync: () => true,
        setTimeout
      }
    );

    sync.start();
    await vi.runAllTicks();

    expect(parseFirstWrite(socket)).toMatchObject({
      method: "initialize",
      params: { clientType: "vscode" },
      type: "request",
      version: 1
    });

    sync.dispose();
  });

  it("forwards thread snapshot broadcasts into saved session snapshots", async () => {
    const socket = new FakeSocket();
    const onSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const sync = new OpenAICodexSessionSync(
      {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
      },
      { onSessionSnapshot },
      {
        clearTimeout,
        createConnection: () => {
          queueMicrotask(() => {
            socket.emit("connect");
          });
          return socket as never;
        },
        existsSync: () => true,
        setTimeout
      }
    );

    sync.start();
    await vi.runAllTicks();

    socket.emit(
      "data",
      frameMessage({
        method: "initialize",
        result: {
          clientId: "client-1"
        },
        resultType: "success",
        type: "response"
      })
    );
    socket.emit(
      "data",
      frameMessage({
        method: "thread-stream-state-changed",
        params: {
          change: {
            conversationState: {
              hostId: "local",
              id: "thread-55",
              turns: [
                {
                  params: {
                    input: [{ text: "Resume this exact Codex session", type: "text" }]
                  },
                  status: "completed",
                  turnStartedAtMs: 1_700_000_000_000
                }
              ]
            },
            type: "snapshot"
          }
        },
        type: "broadcast"
      })
    );
    await vi.runAllTicks();

    expect(onSessionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "openai-codex://route/local/thread-55",
        status: "Completed",
        title: "Resume this exact Codex session"
      })
    );

    sync.dispose();
  });

  it("reconnects after the socket closes", async () => {
    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const createConnection = vi
      .fn()
      .mockImplementationOnce(() => {
        queueMicrotask(() => {
          firstSocket.emit("connect");
        });
        return firstSocket as never;
      })
      .mockImplementationOnce(() => secondSocket as never);

    const sync = new OpenAICodexSessionSync(
      {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
      },
      {
        onSessionSnapshot: vi.fn()
      },
      {
        clearTimeout,
        createConnection,
        existsSync: () => true,
        setTimeout
      }
    );

    sync.start();
    await vi.runAllTicks();
    firstSocket.emit("close");
    vi.advanceTimersByTime(2_000);

    expect(createConnection).toHaveBeenCalledTimes(2);

    sync.dispose();
  });

  it("retries when the IPC socket is initially missing", async () => {
    const socket = new FakeSocket();
    const createConnection = vi.fn().mockImplementation(() => {
      queueMicrotask(() => {
        socket.emit("connect");
      });
      return socket as never;
    });
    const existsSync = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValue(true);
    const sync = new OpenAICodexSessionSync(
      {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
      },
      {
        onSessionSnapshot: vi.fn()
      },
      {
        clearTimeout,
        createConnection,
        existsSync,
        setTimeout
      }
    );

    sync.start();
    expect(createConnection).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);
    await vi.runAllTicks();

    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(parseFirstWrite(socket)).toMatchObject({
      method: "initialize"
    });

    sync.dispose();
  });

  it("assembles split frames before emitting snapshots", async () => {
    const socket = new FakeSocket();
    const onSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const sync = new OpenAICodexSessionSync(
      {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
      },
      { onSessionSnapshot },
      {
        clearTimeout,
        createConnection: () => {
          queueMicrotask(() => {
            socket.emit("connect");
          });
          return socket as never;
        },
        existsSync: () => true,
        setTimeout
      }
    );

    sync.start();
    await vi.runAllTicks();

    const frame = frameMessage({
      method: "thread-stream-state-changed",
      params: {
        change: {
          conversationState: {
            hostId: "local",
            id: "thread-77",
            turns: [{}]
          },
          type: "snapshot"
        }
      },
      type: "broadcast"
    });

    socket.emit("data", frame.subarray(0, 5));
    await vi.runAllTicks();
    expect(onSessionSnapshot).not.toHaveBeenCalled();

    socket.emit("data", frame.subarray(5));
    await vi.runAllTicks();

    expect(onSessionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "openai-codex://route/local/thread-77",
        status: "Completed"
      })
    );

    sync.dispose();
  });
});
