# MP3 Audio Splitter with Tamil Transcription

A web application that automatically splits audio files into 15-minute chunks and provides Tamil transcription with speaker diarization using SarvamAI API.

## Features

### Audio Processing
- **Automatic Splitting**: Upload audio files and automatically split them into 15-minute chunks
- **Multiple Formats**: Supports MP3, M4A, WAV, and other common audio formats
- **Timestamp Naming**: Each chunk is named with start and end timestamps (e.g., `audio_00:00:00-00:15:00.mp3`)
- **Cloud Storage**: All files are securely stored in S3 with direct download links

### Tamil Transcription
- **Batch Processing**: Transcribe all audio chunks using SarvamAI's batch job API
- **Speaker Diarization**: Automatically identify and label different speakers
- **Timestamps**: Get detailed timestamps for each segment of speech
- **Combined Transcript**: Automatically merge all chunk transcripts in chronological order

### User Interface
- **Drag-and-Drop Upload**: Easy file upload with drag-and-drop support
- **Real-time Status**: Monitor upload, splitting, and transcription progress in real-time
- **Session Management**: View all your processing sessions with status indicators
- **Download Options**: Download individual chunks, transcripts, or combined transcript

## Technology Stack

### Backend
- **Node.js** with TypeScript
- **Express** web server
- **tRPC** for type-safe API
- **FFmpeg** for audio processing
- **Drizzle ORM** with MySQL/TiDB database
- **SarvamAI SDK** for transcription

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library
- **Wouter** for routing
- **TanStack Query** for data fetching

### Infrastructure
- **S3** for file storage
- **Manus Platform** for hosting and authentication

## Getting Started

### Prerequisites
- Node.js 18+ installed
- SarvamAI API key (get from [dashboard.sarvam.ai](https://dashboard.sarvam.ai))
- FFmpeg installed (pre-installed in production environment)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables (handled automatically in production)

4. Push database schema:
   ```bash
   pnpm db:push
   ```

5. Start development server:
   ```bash
   pnpm dev
   ```

## Usage

### 1. Upload Audio File

1. Navigate to the home page
2. Click or drag-and-drop an audio file (MP3, M4A, or WAV)
3. Click "Upload and Process"
4. You'll be redirected to the session detail page

### 2. Monitor Splitting Progress

- The application automatically splits your audio into 15-minute chunks
- Watch the status indicator change from "Splitting" to ready
- Each chunk will appear in the list with download buttons

### 3. Start Transcription

1. Once splitting is complete, click "Start Transcription"
2. Enter your SarvamAI API key
3. Click "Start Transcription" to begin
4. The application will process each chunk with:
   - Tamil language transcription
   - Speaker diarization (up to 2 speakers)
   - Timestamp information

### 4. Download Results

- **Audio Chunks**: Click the download button next to each chunk
- **Individual Transcripts**: Click the transcript button for each chunk
- **Combined Transcript**: Download the merged transcript from the top of the page

## API Endpoints

The application uses tRPC for type-safe API calls:

### `audio.uploadAudio`
Upload an audio file and create a processing session.

**Input:**
- `filename`: Original filename
- `fileData`: Base64-encoded audio data
- `mimeType`: Audio MIME type

**Output:**
- `sessionId`: Created session ID
- `fileUrl`: S3 URL of uploaded file

### `audio.getSessions`
Get all sessions for the current user.

**Output:** Array of session objects with status and metadata

### `audio.getSessionDetails`
Get detailed information about a specific session.

**Input:**
- `sessionId`: Session ID

**Output:**
- `session`: Session information
- `chunks`: Array of audio chunks
- `transcripts`: Array of transcripts

### `audio.startTranscription`
Start transcription for a session's audio chunks.

**Input:**
- `sessionId`: Session ID
- `apiKey`: SarvamAI API key

**Output:**
- `success`: Boolean indicating if transcription started

## Database Schema

### `sessions`
- Stores information about each audio upload session
- Tracks processing status (uploading, splitting, transcribing, completed, failed)
- Links to user and original file

### `audioChunks`
- Stores metadata for each 15-minute chunk
- Includes start/end timestamps and S3 URLs
- Ordered by chunk index

### `transcripts`
- Stores transcription results for each chunk
- Includes both individual and combined transcripts
- Links to SarvamAI job IDs for tracking

## Configuration

### Audio Splitting
- **Chunk Duration**: 15 minutes (900 seconds)
- **Last Chunk**: Can be less than 15 minutes
- **Format**: Preserves original audio codec

### Transcription
- **Language**: Tamil (ta-IN)
- **Model**: Saarika v2.5
- **Diarization**: Enabled with 2 speakers
- **Timestamps**: Enabled

## Troubleshooting

### Upload Fails
- Check file format (must be MP3, M4A, or WAV)
- Ensure file size is reasonable (under 100MB recommended)
- Check network connection

### Splitting Takes Long Time
- Large files take longer to process
- Each 15-minute chunk needs to be extracted
- Status updates every 5 seconds

### Transcription Fails
- Verify SarvamAI API key is correct
- Check API key has sufficient credits
- Ensure audio quality is good
- Check SarvamAI service status

### Download Not Working
- Files are stored in S3 with public URLs
- Check browser popup blocker
- Try right-click and "Save Link As"

## Development

### Running Tests
```bash
pnpm test
```

### Type Checking
```bash
pnpm check
```

### Database Migrations
```bash
pnpm db:push
```

## Deployment

The application is hosted on Manus Platform with automatic deployment:

1. Create a checkpoint:
   ```bash
   # Checkpoint is created via Manus UI
   ```

2. Click "Publish" in the Manus UI

3. Your application will be deployed with:
   - Automatic SSL certificates
   - OAuth authentication
   - Database provisioning
   - S3 storage setup

## License

MIT

## Support

For issues or questions:
- Check the troubleshooting section
- Review SarvamAI documentation at [docs.sarvam.ai](https://docs.sarvam.ai)
- Contact support through Manus Platform
