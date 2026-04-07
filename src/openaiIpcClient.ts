import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";

import type { Logger } from "./logger";
import type { SavedCodexSessionSnapshot, SavedCodexSessionStatus } from "./history";
import { CODEX_URI_AUTHORITY, CODEX_URI_SCHEME } from "./types";

const INITIALIZE_CLIENT_TYPE = "vscode";
const INITIALIZE_METHOD = "initialize";
const INITIALIZE_VERSION = 1;
const INITIALIZING_CLIENT_ID = "initializing-client";
const MAX_FRAME_SIZE_BYTES = 256 * 1024 * 1024;
const RECONNECT_DELAY_MS = 2_000;
const THREAD_STREAM_STATE_CHANGED_METHOD = "thread-stream-state-changed";

interface IpcBroadcastMessage {
  method?: unknown;
  params?: unknown;
  type?: unknown;
}

interface IpcResponseMessage {
  method?: unknown;
  result?: unknown;
  resultType?: unknown;
  type?: unknown;
}

interface IpcCodexConversationStateBroadcast {
  params?: {
    change?: {
      conversationState?: unknown;
      type?: unknown;
    };
    conversationId?: unknown;
  };
}

interface StartOptions {
  onSessionSnapshot: (snapshot: SavedCodexSessionSnapshot) => Promise<void> | void;
}

export interface CodexSessionSync {
  dispose(): void;
  start(): void;
}

interface RuntimeDependencies {
  clearTimeout: typeof clearTimeout;
  createConnection: (socketPath: string) => net.Socket;
  existsSync: (socketPath: string) => boolean;
  setTimeout: typeof setTimeout;
}

const runtimeDependencies: RuntimeDependencies = {
  clearTimeout,
  createConnection: (socketPath) => net.createConnection(socketPath),
  existsSync: (socketPath) => fs.existsSync(socketPath),
  setTimeout
};

export class OpenAICodexSessionSync implements CodexSessionSync {
  private buffer = Buffer.alloc(0);
  private clientId = INITIALIZING_CLIENT_ID;
  private disposed = false;
  private expectedFrameLength: number | null = null;
  private reconnectTimeout: NodeJS.Timeout | undefined;
  private socket: net.Socket | undefined;

  public constructor(
    private readonly logger: Logger,
    private readonly options: StartOptions,
    private readonly runtime: RuntimeDependencies = runtimeDependencies
  ) {}

  public start(): void {
    void this.connect();
  }

  public dispose(): void {
    this.disposed = true;
    this.clearReconnectTimeout();
    this.expectedFrameLength = null;
    this.buffer = Buffer.alloc(0);
    this.clientId = INITIALIZING_CLIENT_ID;
    this.socket?.destroy();
    this.socket = undefined;
  }

  private async connect(): Promise<void> {
    if (this.disposed || this.socket) {
      return;
    }

    const socketPath = getCodexIpcSocketPath();
    if (!this.runtime.existsSync(socketPath)) {
      this.logger.info("Codex IPC socket is not available yet.", { socketPath });
      this.scheduleReconnect();
      return;
    }

    const socket = this.runtime.createConnection(socketPath);
    this.socket = socket;

    socket.on("connect", () => {
      this.logger.info("Connected to the Codex IPC socket.", { socketPath });
      this.sendInitializeRequest();
    });

    socket.on("data", (chunk) => {
      void this.handleData(chunk);
    });

    socket.on("error", (error) => {
      this.logger.warn("Codex IPC socket error.", { error: error instanceof Error ? error.message : String(error), socketPath });
    });

    socket.on("close", () => {
      this.logger.info("Codex IPC socket closed.", { socketPath });
      this.socket = undefined;
      this.buffer = Buffer.alloc(0);
      this.expectedFrameLength = null;
      this.clientId = INITIALIZING_CLIENT_ID;
      this.scheduleReconnect();
    });
  }

  private async handleData(chunk: Buffer): Promise<void> {
    if (this.disposed || chunk.length === 0) {
      return;
    }

    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      if (this.expectedFrameLength === null) {
        this.expectedFrameLength = this.buffer.readUInt32LE(0);
        this.buffer = this.buffer.subarray(4);
      }

      if (this.expectedFrameLength > MAX_FRAME_SIZE_BYTES) {
        this.logger.warn("Codex IPC frame exceeded the supported size limit.", { frameBytes: this.expectedFrameLength });
        this.socket?.destroy();
        return;
      }

      if (this.buffer.length < this.expectedFrameLength) {
        return;
      }

      const payload = this.buffer.subarray(0, this.expectedFrameLength);
      this.buffer = this.buffer.subarray(this.expectedFrameLength);
      this.expectedFrameLength = null;

      try {
        const message = JSON.parse(payload.toString("utf8")) as IpcBroadcastMessage | IpcResponseMessage;
        await this.handleMessage(message);
      } catch (error) {
        this.logger.warn("Failed to parse a Codex IPC frame.", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async handleMessage(message: IpcBroadcastMessage | IpcResponseMessage): Promise<void> {
    if (isInitializeResponse(message)) {
      const clientId = extractClientId(message.result);
      if (clientId) {
        this.clientId = clientId;
      }
      return;
    }

    const snapshot = createSavedCodexSessionSnapshotFromThreadBroadcast(message);
    if (snapshot) {
      await this.options.onSessionSnapshot(snapshot);
    }
  }

  private sendInitializeRequest(): void {
    this.writeMessage({
      method: INITIALIZE_METHOD,
      params: {
        clientType: INITIALIZE_CLIENT_TYPE
      },
      requestId: randomUUID(),
      sourceClientId: this.clientId,
      type: "request",
      version: INITIALIZE_VERSION
    });
  }

  private writeMessage(message: unknown): void {
    if (!this.socket || !this.socket.writable) {
      return;
    }

    const payload = Buffer.from(JSON.stringify(message), "utf8");
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32LE(payload.length, 0);
    payload.copy(frame, 4);
    this.socket.write(frame);
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimeout) {
      return;
    }

    this.reconnectTimeout = this.runtime.setTimeout(() => {
      this.reconnectTimeout = undefined;
      void this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      this.runtime.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
  }
}

export const createSavedCodexSessionSnapshotFromThreadBroadcast = (
  message: IpcBroadcastMessage | IpcResponseMessage
): SavedCodexSessionSnapshot | null => {
  if (
    message.type !== "broadcast" ||
    message.method !== THREAD_STREAM_STATE_CHANGED_METHOD
  ) {
    return null;
  }

  const change = (message as IpcCodexConversationStateBroadcast).params?.change;
  if (change?.type !== "snapshot" || !change.conversationState) {
    return null;
  }

  return createSavedCodexSessionSnapshotFromConversationState(change.conversationState);
};

export const createSavedCodexSessionSnapshotFromConversationState = (state: unknown): SavedCodexSessionSnapshot | null => {
  if (!state || typeof state !== "object") {
    return null;
  }

  const conversation = state as {
    hostId?: unknown;
    id?: unknown;
    turns?: unknown;
  };

  if (typeof conversation.id !== "string" || conversation.id.length === 0) {
    return null;
  }

  const hostId = conversation.hostId === "remote" ? "remote" : conversation.hostId === "local" ? "local" : null;
  if (!hostId) {
    return null;
  }

  const turns = Array.isArray(conversation.turns) ? conversation.turns : [];
  const firstPrompt = extractFirstPrompt(turns);
  const timestamps = collectTurnTimestamps(turns);

  return {
    createdAt: timestamps.createdAt,
    resource: `${CODEX_URI_SCHEME}://${CODEX_URI_AUTHORITY}/${hostId}/${conversation.id}`,
    status: extractStatus(turns),
    title: firstPrompt,
    updatedAt: timestamps.updatedAt
  };
};

export const getCodexIpcSocketPath = (): string => {
  const uid = process.getuid?.();
  return path.join(os.tmpdir(), "codex-ipc", uid ? `ipc-${uid}.sock` : "ipc.sock");
};

const collectTurnTimestamps = (turns: unknown[]): { createdAt?: string; updatedAt?: string } => {
  const candidates = turns
    .flatMap((turn) => {
      if (!turn || typeof turn !== "object") {
        return [];
      }

      const typedTurn = turn as {
        finalAssistantStartedAtMs?: unknown;
        turnStartedAtMs?: unknown;
      };

      return [typedTurn.turnStartedAtMs, typedTurn.finalAssistantStartedAtMs]
        .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
        .filter((value): value is number => value !== null);
    })
    .sort((left, right) => left - right);

  if (candidates.length === 0) {
    return {};
  }

  const createdAt = new Date(candidates[0]).toISOString();
  const updatedAt = new Date(candidates[candidates.length - 1]).toISOString();

  return { createdAt, updatedAt };
};

const extractClientId = (result: unknown): string | null => {
  if (!result || typeof result !== "object") {
    return null;
  }

  const clientId = (result as { clientId?: unknown }).clientId;
  return typeof clientId === "string" && clientId.length > 0 ? clientId : null;
};

const extractFirstPrompt = (turns: unknown[]): string | undefined => {
  for (const turn of turns) {
    if (!turn || typeof turn !== "object") {
      continue;
    }

    const input = (turn as { params?: { input?: unknown } }).params?.input;
    if (!Array.isArray(input)) {
      continue;
    }

    for (const contentPart of input) {
      if (!contentPart || typeof contentPart !== "object") {
        continue;
      }

      const text = (contentPart as { text?: unknown; type?: unknown }).type === "text"
        ? (contentPart as { text?: unknown }).text
        : undefined;

      if (typeof text === "string") {
        const normalized = text.replace(/\s+/g, " ").trim();
        if (normalized.length > 0) {
          return normalized;
        }
      }
    }
  }

  return undefined;
};

const extractStatus = (turns: unknown[]): SavedCodexSessionStatus => {
  const lastTurn = turns.at(-1);
  const status = lastTurn && typeof lastTurn === "object" ? (lastTurn as { status?: unknown }).status : undefined;
  if (typeof status !== "string") {
    return "Completed";
  }

  const normalized = status.toLowerCase();
  if (normalized.includes("complete")) {
    return "Completed";
  }

  if (
    normalized.includes("fail") ||
    normalized.includes("error") ||
    normalized.includes("abort") ||
    normalized.includes("cancel")
  ) {
    return "Failed";
  }

  return "In Progress";
};

const isInitializeResponse = (message: IpcBroadcastMessage | IpcResponseMessage): message is IpcResponseMessage =>
  message.type === "response" &&
  message.method === INITIALIZE_METHOD &&
  "resultType" in message &&
  message.resultType === "success";
