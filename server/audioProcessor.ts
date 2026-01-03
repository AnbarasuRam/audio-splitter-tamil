import ffmpeg from 'fluent-ffmpeg';
import { storagePut } from './storage';
import { createAudioChunk, updateSessionStatus, updateSessionDuration } from './db';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CHUNK_DURATION_SECONDS = 15 * 60; // 15 minutes

interface AudioMetadata {
  durationSeconds: number;
}

/**
 * Get audio file duration using ffprobe
 */
export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duration = metadata.format.duration;
      if (!duration) {
        reject(new Error('Could not determine audio duration'));
        return;
      }
      resolve(Math.floor(duration));
    });
  });
}

/**
 * Format seconds to HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Split audio file into chunks and upload to S3
 */
export async function splitAudioFile(
  sessionId: number,
  userId: number,
  audioUrl: string,
  originalFilename: string
): Promise<void> {
  const tempDir = path.join(os.tmpdir(), `audio-split-${sessionId}-${nanoid()}`);
  const inputPath = path.join(tempDir, 'input.audio');
  
  try {
    // Create temp directory
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    // Download audio file
    console.log(`[AudioProcessor] Downloading audio file from ${audioUrl}`);
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.promises.writeFile(inputPath, Buffer.from(arrayBuffer));
    
    // Get audio duration
    const durationSeconds = await getAudioDuration(inputPath);
    console.log(`[AudioProcessor] Audio duration: ${durationSeconds} seconds`);
    
    // Update session with duration
    await updateSessionDuration(sessionId, durationSeconds);
    
    // Calculate number of chunks
    const numChunks = Math.ceil(durationSeconds / CHUNK_DURATION_SECONDS);
    console.log(`[AudioProcessor] Splitting into ${numChunks} chunks`);
    
    // Update session status to splitting
    await updateSessionStatus(sessionId, 'splitting');
    
    // Split and upload each chunk
    const fileExtension = path.extname(originalFilename) || '.mp3';
    const baseFilename = path.basename(originalFilename, fileExtension);
    
    for (let i = 0; i < numChunks; i++) {
      const startTime = i * CHUNK_DURATION_SECONDS;
      const endTime = Math.min((i + 1) * CHUNK_DURATION_SECONDS, durationSeconds);
      const chunkDuration = endTime - startTime;
      
      const startTimeFormatted = formatTime(startTime);
      const endTimeFormatted = formatTime(endTime);
      
      const chunkFilename = `${baseFilename}_${startTimeFormatted}-${endTimeFormatted}${fileExtension}`;
      const chunkPath = path.join(tempDir, chunkFilename);
      
      console.log(`[AudioProcessor] Creating chunk ${i + 1}/${numChunks}: ${chunkFilename}`);
      
      // Extract chunk using ffmpeg
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .setDuration(chunkDuration)
          .output(chunkPath)
          .audioCodec('copy') // Copy codec to avoid re-encoding
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });
      
      // Upload chunk to S3
      const chunkBuffer = await fs.promises.readFile(chunkPath);
      const fileKey = `sessions/${sessionId}/chunks/${nanoid()}-${chunkFilename}`;
      const { url: chunkUrl } = await storagePut(fileKey, chunkBuffer, `audio/${fileExtension.slice(1)}`);
      
      console.log(`[AudioProcessor] Uploaded chunk to ${chunkUrl}`);
      
      // Save chunk to database
      await createAudioChunk({
        sessionId,
        chunkIndex: i,
        filename: chunkFilename,
        fileUrl: chunkUrl,
        fileKey,
        startTimeSeconds: startTime,
        endTimeSeconds: endTime,
        durationSeconds: chunkDuration,
      });
      
      // Clean up chunk file
      await fs.promises.unlink(chunkPath);
    }
    
    console.log(`[AudioProcessor] Successfully split audio into ${numChunks} chunks`);
    
  } catch (error) {
    console.error('[AudioProcessor] Error splitting audio:', error);
    await updateSessionStatus(sessionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  } finally {
    // Clean up temp directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('[AudioProcessor] Failed to clean up temp directory:', err);
    }
  }
}
