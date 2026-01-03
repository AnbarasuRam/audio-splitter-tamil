import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Sessions table - represents each audio upload session
 */
export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
  originalFileUrl: text("originalFileUrl").notNull(),
  originalFileKey: varchar("originalFileKey", { length: 512 }).notNull(),
  durationSeconds: int("durationSeconds"),
  status: mysqlEnum("status", ["uploading", "splitting", "transcribing", "completed", "failed"]).default("uploading").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Audio chunks table - stores information about split audio files
 */
export const audioChunks = mysqlTable("audioChunks", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  startTimeSeconds: int("startTimeSeconds").notNull(),
  endTimeSeconds: int("endTimeSeconds").notNull(),
  durationSeconds: int("durationSeconds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AudioChunk = typeof audioChunks.$inferSelect;
export type InsertAudioChunk = typeof audioChunks.$inferInsert;

/**
 * Transcripts table - stores transcription results for each chunk
 */
export const transcripts = mysqlTable("transcripts", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  chunkId: int("chunkId"),
  transcriptType: mysqlEnum("transcriptType", ["chunk", "combined"]).notNull(),
  content: text("content").notNull(),
  fileUrl: text("fileUrl"),
  fileKey: varchar("fileKey", { length: 512 }),
  sarvamJobId: varchar("sarvamJobId", { length: 256 }),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transcript = typeof transcripts.$inferSelect;
export type InsertTranscript = typeof transcripts.$inferInsert;
