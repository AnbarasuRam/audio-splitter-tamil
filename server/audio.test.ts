import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("audio.getSessions", () => {
  it("returns empty array for user with no sessions", async () => {
    const ctx = createAuthContext(999); // User ID that doesn't exist
    const caller = appRouter.createCaller(ctx);

    const sessions = await caller.audio.getSessions();

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBe(0);
  });

  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(caller.audio.getSessions()).rejects.toThrow();
  });
});

describe("audio.getSessionDetails", () => {
  it("throws error for non-existent session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audio.getSessionDetails({ sessionId: 99999 })
    ).rejects.toThrow("Session not found or unauthorized");
  });

  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audio.getSessionDetails({ sessionId: 1 })
    ).rejects.toThrow();
  });
});

describe("audio.uploadAudio", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audio.uploadAudio({
        filename: "test.mp3",
        fileData: "dGVzdA==", // base64 "test"
        mimeType: "audio/mpeg",
      })
    ).rejects.toThrow();
  });

  it("creates a session and returns sessionId and fileUrl", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a small valid base64 audio data
    const testAudioData = Buffer.from("test audio content").toString("base64");

    const result = await caller.audio.uploadAudio({
      filename: "test-audio.mp3",
      fileData: testAudioData,
      mimeType: "audio/mpeg",
    });

    expect(result).toHaveProperty("sessionId");
    expect(result).toHaveProperty("fileUrl");
    expect(typeof result.sessionId).toBe("number");
    expect(typeof result.fileUrl).toBe("string");
    expect(result.fileUrl).toMatch(/^https?:\/\//);
  });
});

describe("audio.startTranscription", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: undefined,
      req: {
        protocol: "https",
        headers: {},
      } as TrpcContext["req"],
      res: {
        clearCookie: () => {},
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audio.startTranscription({
        sessionId: 1,
        apiKey: "test-key",
      })
    ).rejects.toThrow();
  });

  it("throws error for non-existent session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.audio.startTranscription({
        sessionId: 99999,
        apiKey: "test-key",
      })
    ).rejects.toThrow("Session not found or unauthorized");
  });
});

describe("audio processing workflow", () => {
  it("validates audio file format in upload", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const testData = Buffer.from("test").toString("base64");

    // Should accept valid audio mime types
    const validMimeTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/m4a"];
    
    for (const mimeType of validMimeTypes) {
      const result = await caller.audio.uploadAudio({
        filename: `test.${mimeType.split('/')[1]}`,
        fileData: testData,
        mimeType,
      });
      
      expect(result).toHaveProperty("sessionId");
      expect(result).toHaveProperty("fileUrl");
    }
  });
});
