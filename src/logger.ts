import type * as vscode from "vscode";

type LogLevel = "info" | "warn" | "error";

export interface Logger {
  error(message: string, metadata?: unknown): void;
  info(message: string, metadata?: unknown): void;
  warn(message: string, metadata?: unknown): void;
}

export class OutputChannelLogger implements Logger {
  private readonly channel: vscode.OutputChannel;

  public constructor(channel: vscode.OutputChannel) {
    this.channel = channel;
  }

  public info(message: string, metadata?: unknown): void {
    this.write("info", message, metadata);
  }

  public warn(message: string, metadata?: unknown): void {
    this.write("warn", message, metadata);
  }

  public error(message: string, metadata?: unknown): void {
    this.write("error", message, metadata);
  }

  private write(level: LogLevel, message: string, metadata?: unknown): void {
    const timestamp = new Date().toISOString();
    const suffix = metadata === undefined ? "" : ` ${safeStringify(metadata)}`;
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}${suffix}`);
  }
}

export const toErrorMetadata = (error: unknown): Record<string, string> => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? ""
    };
  }

  return {
    message: String(error)
  };
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
