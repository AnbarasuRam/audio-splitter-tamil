# Tamil Audio Splitter & Transcriber

A simple Streamlit app to split audio files and transcribe Tamil speech using an API.

## Features

- **Audio Upload**: Support for MP3, M4A, WAV files
- **Auto-Split**: Automatically splits long audio into 15-minute chunks
- **Tamil Transcription**: Uses API's speech-to-text service
- **Speaker Diarization**: Identifies different speakers in the audio
- **Download**: Export the full transcript as a text file

## Local Setup

### Prerequisites

1. Python 3.9+
2. FFmpeg (required by pydub for audio processing)

#### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

### Installation

```bash
pip install -r requirements.txt
```

### Run Locally

```bash
streamlit run app.py
```

The app will open at http://localhost:8501

## Deploy to Streamlit Cloud

### 1. Push to GitHub

Make sure your code is in a GitHub repository.

### 2. Create `packages.txt`

Create a `packages.txt` file in the same directory with:
```
ffmpeg
```

### 3. Deploy on Streamlit Cloud

1. Go to https://streamlit.io/cloud
2. Sign in with GitHub
3. Click "New app"
4. Select your repository
5. Set the main file path to `app.py`
6. Click "Deploy"

### 4. Add Secrets (Optional)

If you want to pre-configure the API key:
1. Go to your app settings on Streamlit Cloud
2. Click "Secrets"
3. Add:
```toml
API_KEY = "your-api-key-here"
```

## Usage

1. Enter your API key (get one from the service provider)
2. Upload an audio file (MP3, M4A, or WAV)
3. Click "Start Transcription"
4. Wait for processing to complete
5. Download the transcript

## API Information

This app uses the speech-to-text API:

- **Model**: saarika:v2
- **Language**: Tamil (ta-IN)
- **Features**: Word timestamps, Speaker diarization

## File Structure

```
├── app.py              # Main Streamlit application
├── audio_processor.py  # Audio splitting utilities
├── transcriber.py      # API transcription service
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Limitations

- Streamlit Cloud has a file upload limit (default 200MB)
- Very long audio files may timeout during transcription
- API rate limits may apply based on your plan

## License

MIT
