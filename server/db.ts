import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sessions, audioChunks, transcripts, InsertSession, InsertAudioChunk, InsertTranscript } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Session management
export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sessions).values(data);
  return result[0].insertId;
}

export async function getSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getSessionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(sessions).where(eq(sessions.userId, userId)).orderBy(desc(sessions.createdAt));
}

export async function updateSessionStatus(sessionId: number, status: "uploading" | "splitting" | "transcribing" | "completed" | "failed", errorMessage?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions)
    .set({ status, errorMessage: errorMessage || null, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function updateSessionDuration(sessionId: number, durationSeconds: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(sessions)
    .set({ durationSeconds, updatedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

// Audio chunk management
export async function createAudioChunk(data: InsertAudioChunk) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(audioChunks).values(data);
  return result[0].insertId;
}

export async function getChunksBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(audioChunks).where(eq(audioChunks.sessionId, sessionId)).orderBy(audioChunks.chunkIndex);
}

// Transcript management
export async function createTranscript(data: InsertTranscript) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(transcripts).values(data);
  return result[0].insertId;
}

export async function getTranscriptsBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return db.select().from(transcripts).where(eq(transcripts.sessionId, sessionId));
}

export async function updateTranscriptStatus(transcriptId: number, status: "pending" | "processing" | "completed" | "failed", content?: string, errorMessage?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: any = { status, updatedAt: new Date() };
  if (content !== undefined) updateData.content = content;
  if (errorMessage !== undefined) updateData.errorMessage = errorMessage;
  
  await db.update(transcripts)
    .set(updateData)
    .where(eq(transcripts.id, transcriptId));
}

export async function updateTranscriptJobId(transcriptId: number, jobId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transcripts)
    .set({ sarvamJobId: jobId, updatedAt: new Date() })
    .where(eq(transcripts.id, transcriptId));
}
