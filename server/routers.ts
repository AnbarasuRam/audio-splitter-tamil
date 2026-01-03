import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { 
  createSession, 
  getSessionById, 
  getSessionsByUserId, 
  getChunksBySessionId,
  getTranscriptsBySessionId,
  updateSessionStatus
} from "./db";
import { splitAudioFile } from "./audioProcessor";
import { startTranscriptionForSession, checkTranscriptionStatus } from "./transcriptionService";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  audio: router({
    // Upload audio file and create session
    uploadAudio: protectedProcedure
      .input(z.object({
        filename: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        
        // Decode base64 and upload to S3
        const fileBuffer = Buffer.from(input.fileData, 'base64');
        const fileKey = `uploads/${userId}/${nanoid()}-${input.filename}`;
        const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);
        
        // Create session
        const sessionId = await createSession({
          userId,
          originalFilename: input.filename,
          originalFileUrl: fileUrl,
          originalFileKey: fileKey,
          status: 'uploading',
        });
        
        // Start async processing
        (async () => {
          try {
            await splitAudioFile(sessionId, userId, fileUrl, input.filename);
          } catch (error) {
            console.error('[Router] Error in async audio processing:', error);
          }
        })();
        
        return { sessionId, fileUrl };
      }),

    // Get all sessions for current user
    getSessions: protectedProcedure
      .query(async ({ ctx }) => {
        const sessions = await getSessionsByUserId(ctx.user.id);
        return sessions;
      }),

    // Get session details with chunks and transcripts
    getSessionDetails: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        
        if (!session || session.userId !== ctx.user.id) {
          throw new Error('Session not found or unauthorized');
        }
        
        const chunks = await getChunksBySessionId(input.sessionId);
        const transcripts = await getTranscriptsBySessionId(input.sessionId);
        
        return {
          session,
          chunks,
          transcripts,
        };
      }),

    // Start transcription for a session
    startTranscription: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        apiKey: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        
        if (!session || session.userId !== ctx.user.id) {
          throw new Error('Session not found or unauthorized');
        }
        
        if (session.status !== 'splitting') {
          // Check if splitting is complete
          const chunks = await getChunksBySessionId(input.sessionId);
          if (chunks.length === 0) {
            throw new Error('No audio chunks available. Please wait for splitting to complete.');
          }
        }
        
        // Start async transcription
        (async () => {
          try {
            await startTranscriptionForSession(input.sessionId, input.apiKey);
          } catch (error) {
            console.error('[Router] Error in async transcription:', error);
          }
        })();
        
        return { success: true };
      }),

    // Check transcription status
    getTranscriptionStatus: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        
        if (!session || session.userId !== ctx.user.id) {
          throw new Error('Session not found or unauthorized');
        }
        
        const status = await checkTranscriptionStatus(input.sessionId);
        return status;
      }),

    // Delete a session
    deleteSession: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const session = await getSessionById(input.sessionId);
        
        if (!session || session.userId !== ctx.user.id) {
          throw new Error('Session not found or unauthorized');
        }
        
        // Update status to mark as deleted
        await updateSessionStatus(input.sessionId, 'failed', 'Deleted by user');
        
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
