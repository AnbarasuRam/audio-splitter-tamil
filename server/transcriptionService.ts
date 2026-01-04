import { SarvamAIClient } from 'sarvamai';
import { getChunksBySessionId, createTranscript, updateTranscriptStatus, updateTranscriptJobId, getTranscriptsBySessionId, updateSessionStatus } from './db';
import { storagePut } from './storage';
import { nanoid } from 'nanoid';

/**
 * Initialize transcription for all chunks in a session
 */
export async function startTranscriptionForSession(sessionId: number, apiKey: string): Promise<void> {
  try {
    console.log(`[Transcription] Starting transcription for session ${sessionId}`);
    
    // Get all chunks for this session
    const chunks = await getChunksBySessionId(sessionId);
    
    if (chunks.length === 0) {
      throw new Error('No audio chunks found for session');
    }
    
    // Update session status
    await updateSessionStatus(sessionId, 'transcribing');
    
    // Create transcript records for each chunk
    for (const chunk of chunks) {
      await createTranscript({
        sessionId,
        chunkId: chunk.id,
        transcriptType: 'chunk',
        content: '',
        status: 'pending',
      });
    }
    
    // Start batch job for all chunks
    await processBatchTranscription(sessionId, apiKey);
    
  } catch (error) {
    console.error('[Transcription] Error starting transcription:', error);
    await updateSessionStatus(sessionId, 'failed', error instanceof Error ? error.message : 'Transcription failed');
    throw error;
  }
}

/**
 * Process batch transcription using SarvamAI batch job API
 * Based on the Python SDK pattern: create_job -> upload_files -> start -> wait_until_complete -> download_outputs
 */
async function processBatchTranscription(sessionId: number, apiKey: string): Promise<void> {
  const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
  
  try {
    // Get all chunks
    const chunks = await getChunksBySessionId(sessionId);
    const transcripts = await getTranscriptsBySessionId(sessionId);
    
    // Filter only chunk transcripts
    const chunkTranscripts = transcripts.filter(t => t.transcriptType === 'chunk');
    
    console.log(`[Transcription] Processing ${chunks.length} chunks for session ${sessionId}`);
    
    // Process each chunk individually using the batch API
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const transcript = chunkTranscripts.find(t => t.chunkId === chunk.id);
      
      if (!transcript) {
        console.warn(`[Transcription] No transcript record found for chunk ${chunk.id}`);
        continue;
      }
      
      try {
        console.log(`[Transcription] Creating job for chunk ${i + 1}/${chunks.length}: ${chunk.filename}`);
        
        // Update status to processing
        await updateTranscriptStatus(transcript.id, 'processing');
        
        // Create a new batch job using the SDK pattern
        const job = await client.speechToTextJob.createJob({
          languageCode: 'ta-IN',
          model: 'saarika:v2.5',
          withTimestamps: true,
          withDiarization: true,
          numSpeakers: 2,
        });
        
        console.log(`[Transcription] Job created with ID: ${job.jobId}`);
        
        // Update transcript with job ID
        await updateTranscriptJobId(transcript.id, job.jobId);
        
        // Download audio file to temp location
        const fsPromises = await import('fs/promises');
        const pathModule = await import('path');
        const tempDir = `/tmp/transcription-${sessionId}-${chunk.id}`;
        await fsPromises.mkdir(tempDir, { recursive: true });
        
        const tempFilePath = pathModule.join(tempDir, chunk.filename);
        
        console.log(`[Transcription] Downloading ${chunk.fileUrl} to ${tempFilePath}`);
        const response = await fetch(chunk.fileUrl);
        if (!response.ok) {
          throw new Error(`Failed to download audio: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        await fsPromises.writeFile(tempFilePath, Buffer.from(arrayBuffer));
        
        // Upload files using local file path
        await job.uploadFiles([
          tempFilePath,
        ]);
        
        console.log(`[Transcription] File uploaded for chunk ${chunk.filename}`);
        
        // Clean up temp file after upload
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        console.log(`[Transcription] Cleaned up temp file for chunk ${chunk.filename}`);
        
        // Start the job
        await job.start();
        
        console.log(`[Transcription] Job started for chunk ${chunk.filename}`);
        
        // Wait for completion
        await job.waitUntilComplete();
        
        console.log(`[Transcription] Job completed for chunk ${chunk.filename}`);
        
        // Check if job failed
        const jobFailed = await job.isFailed();
        if (jobFailed) {
          console.error(`[Transcription] Job failed for chunk ${chunk.filename}`);
          await updateTranscriptStatus(transcript.id, 'failed', '', 'Transcription job failed');
          continue;
        }
        
        // Get file results
        const fileResults = await job.getFileResults();
        
        if (!fileResults || fileResults.successful.length === 0) {
          console.error(`[Transcription] No successful results for chunk ${chunk.filename}`);
          await updateTranscriptStatus(transcript.id, 'failed', '', 'No transcription output received');
          continue;
        }
        
        // Download outputs to a temporary directory
        const tempOutputDir = `/tmp/transcripts-${sessionId}-${chunk.id}`;
        await job.downloadOutputs(tempOutputDir);
        
        // Read the output file
        const fs = await import('fs/promises');
        const path = await import('path');
        const outputFiles = await fs.readdir(tempOutputDir);
        
        if (outputFiles.length === 0) {
          console.error(`[Transcription] No output files for chunk ${chunk.filename}`);
          await updateTranscriptStatus(transcript.id, 'failed', '', 'No transcription output files');
          await fs.rm(tempOutputDir, { recursive: true, force: true });
          continue;
        }
        
        // Read the first JSON output file
        const outputFilePath = path.join(tempOutputDir, outputFiles[0]);
        const outputContent = await fs.readFile(outputFilePath, 'utf-8');
        const output = JSON.parse(outputContent);
        
        // Clean up temp directory
        await fs.rm(tempOutputDir, { recursive: true, force: true });
        
        // Extract transcript text from the output
        let transcriptText = '';
        
        if (output.transcript) {
          transcriptText = output.transcript;
        } else if (output.segments && Array.isArray(output.segments)) {
          // Combine all segments
          transcriptText = output.segments.map((seg: any) => seg.text || '').join(' ');
        }
        
        // Save transcript as JSON for full details
        const transcriptData = JSON.stringify(output, null, 2);
        
        // Upload transcript to S3
        const transcriptKey = `sessions/${sessionId}/transcripts/${nanoid()}-${chunk.filename}.json`;
        const { url: transcriptUrl } = await storagePut(transcriptKey, transcriptData, 'application/json');
        
        console.log(`[Transcription] Transcript saved to ${transcriptUrl}`);
        
        // Update transcript in database
        await updateTranscriptStatus(transcript.id, 'completed', transcriptText);
        await updateTranscriptFileUrl(transcript.id, transcriptUrl, transcriptKey);
        
      } catch (error) {
        console.error(`[Transcription] Error processing chunk ${chunk.filename}:`, error);
        await updateTranscriptStatus(transcript.id, 'failed', '', error instanceof Error ? error.message : 'Unknown error');
      }
    }
    
    // Check if all transcripts are completed
    const updatedTranscripts = await getTranscriptsBySessionId(sessionId);
    const chunkTranscriptsUpdated = updatedTranscripts.filter(t => t.transcriptType === 'chunk');
    const allCompleted = chunkTranscriptsUpdated.every(t => t.status === 'completed' || t.status === 'failed');
    
    if (allCompleted) {
      console.log(`[Transcription] All chunks processed for session ${sessionId}`);
      
      // Create combined transcript
      await createCombinedTranscript(sessionId);
      
      // Update session status
      const anyFailed = chunkTranscriptsUpdated.some(t => t.status === 'failed');
      if (anyFailed) {
        await updateSessionStatus(sessionId, 'completed', 'Some transcriptions failed');
      } else {
        await updateSessionStatus(sessionId, 'completed');
      }
    }
    
  } catch (error) {
    console.error('[Transcription] Error in batch transcription:', error);
    await updateSessionStatus(sessionId, 'failed', error instanceof Error ? error.message : 'Batch transcription failed');
    throw error;
  }
}

/**
 * Create a combined transcript from all chunk transcripts
 */
async function createCombinedTranscript(sessionId: number): Promise<void> {
  try {
    console.log(`[Transcription] Creating combined transcript for session ${sessionId}`);
    
    const chunks = await getChunksBySessionId(sessionId);
    const transcripts = await getTranscriptsBySessionId(sessionId);
    
    // Get chunk transcripts in order
    const chunkTranscripts = transcripts
      .filter(t => t.transcriptType === 'chunk' && t.status === 'completed')
      .sort((a, b) => {
        const chunkA = chunks.find(c => c.id === a.chunkId);
        const chunkB = chunks.find(c => c.id === b.chunkId);
        return (chunkA?.chunkIndex || 0) - (chunkB?.chunkIndex || 0);
      });
    
    if (chunkTranscripts.length === 0) {
      console.warn(`[Transcription] No completed transcripts found for session ${sessionId}`);
      return;
    }
    
    // Combine all transcripts
    let combinedText = '';
    for (const transcript of chunkTranscripts) {
      const chunk = chunks.find(c => c.id === transcript.chunkId);
      if (chunk) {
        combinedText += `\n\n=== ${chunk.filename} ===\n\n`;
        combinedText += transcript.content;
      }
    }
    
    // Upload combined transcript to S3
    const combinedKey = `sessions/${sessionId}/transcripts/combined-${nanoid()}.txt`;
    const { url: combinedUrl } = await storagePut(combinedKey, combinedText.trim(), 'text/plain');
    
    console.log(`[Transcription] Combined transcript saved to ${combinedUrl}`);
    
    // Create combined transcript record
    const transcriptId = await createTranscript({
      sessionId,
      chunkId: null,
      transcriptType: 'combined',
      content: combinedText.trim(),
      fileUrl: combinedUrl,
      fileKey: combinedKey,
      status: 'completed',
    });
    
    console.log(`[Transcription] Combined transcript created with ID ${transcriptId}`);
    
  } catch (error) {
    console.error('[Transcription] Error creating combined transcript:', error);
    throw error;
  }
}

/**
 * Helper to update transcript file URL
 */
async function updateTranscriptFileUrl(transcriptId: number, fileUrl: string, fileKey: string): Promise<void> {
  const { getDb } = await import('./db');
  const { transcripts } = await import('../drizzle/schema');
  const { eq } = await import('drizzle-orm');
  
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(transcripts)
    .set({ fileUrl, fileKey, updatedAt: new Date() })
    .where(eq(transcripts.id, transcriptId));
}

/**
 * Check status of a transcription job
 */
export async function checkTranscriptionStatus(sessionId: number): Promise<{
  status: string;
  completed: number;
  total: number;
  failed: number;
}> {
  const transcripts = await getTranscriptsBySessionId(sessionId);
  const chunkTranscripts = transcripts.filter(t => t.transcriptType === 'chunk');
  
  const completed = chunkTranscripts.filter(t => t.status === 'completed').length;
  const failed = chunkTranscripts.filter(t => t.status === 'failed').length;
  const total = chunkTranscripts.length;
  
  let status = 'processing';
  if (completed + failed === total) {
    status = failed > 0 ? 'completed_with_errors' : 'completed';
  }
  
  return { status, completed, total, failed };
}
