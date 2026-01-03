# Audio Splitter App TODO

## Database & Schema
- [x] Design sessions table for organizing uploads
- [x] Design audio_chunks table with timestamp metadata
- [x] Design transcripts table for storing transcription results
- [x] Push database schema to production

## Backend Features
- [x] Install FFmpeg and audio processing dependencies
- [x] Implement audio file upload endpoint with S3 storage
- [x] Implement audio splitting logic (15-minute chunks)
- [x] Generate chunk filenames with start/end timestamps
- [x] Integrate SarvamAI batch job API for transcription
- [x] Implement job status polling mechanism
- [x] Create combined transcript generation logic
- [x] Build session management queries

## Frontend Features
- [x] Create audio upload interface with drag-and-drop
- [x] Build processing status dashboard with real-time updates
- [x] Implement session list view
- [x] Create session detail page showing chunks and transcripts
- [x] Add download functionality for audio chunks
- [x] Add download functionality for individual transcripts
- [x] Add download functionality for combined transcript
- [x] Handle multiple file format support (MP3, M4A, WAV)

## Testing & Deployment
- [x] Write vitest tests for core functionality
- [x] Test complete upload-split-transcribe workflow
- [ ] Create deployment checkpoint
- [x] Document API usage and setup instructions
