"""
Transcription service using Sarvam AI API for Tamil speech-to-text.
Splits audio into 30-second chunks for the real-time API.
"""

import os
import time
from dataclasses import dataclass
from typing import Optional, List
import requests
from pydub import AudioSegment


@dataclass
class TranscriptionResult:
    """Result of a transcription operation."""
    transcript: str
    timestamps: Optional[List[dict]] = None
    error: Optional[str] = None


def transcribe_audio_chunks(
    audio_file: str,
    api_key: str,
    language_code: str = "ta-IN",
    model: str = "saarika:v2.5",
    progress_callback=None
) -> TranscriptionResult:
    """
    Transcribe an audio file by splitting it into 30-second chunks.
    
    Args:
        audio_file: Path to the audio file
        api_key: Sarvam AI API key
        language_code: Language code (default: ta-IN for Tamil)
        model: Model to use
        progress_callback: Optional callback function for progress updates
        
    Returns:
        TranscriptionResult with combined transcript
    """
    try:
        # Load audio file
        print(f"Loading audio: {audio_file}")
        audio = AudioSegment.from_file(audio_file)
        duration_sec = len(audio) / 1000.0
        print(f"Duration: {duration_sec:.1f} seconds")
        
        # Split into 25-second chunks (leaving buffer below 30s limit)
        chunk_duration_ms = 25 * 1000  # 25 seconds in milliseconds
        num_chunks = int((len(audio) + chunk_duration_ms - 1) / chunk_duration_ms)
        
        print(f"Splitting into {num_chunks} chunks of ~25 seconds each")
        
        all_transcripts = []
        
        for i in range(num_chunks):
            start_ms = i * chunk_duration_ms
            end_ms = min((i + 1) * chunk_duration_ms, len(audio))
            chunk = audio[start_ms:end_ms]
            
            # Export chunk to temp file
            temp_chunk_path = f"/tmp/chunk_{i}.mp3"
            chunk.export(temp_chunk_path, format="mp3", bitrate="128k")
            
            # Transcribe chunk
            print(f"Transcribing chunk {i+1}/{num_chunks}...")
            
            if progress_callback:
                progress_callback(i, num_chunks)
            
            result = _transcribe_single_chunk(temp_chunk_path, api_key, language_code, model)
            
            if result.error:
                print(f"Chunk {i+1} error: {result.error}")
                all_transcripts.append(f"[Error in chunk {i+1}]")
            else:
                all_transcripts.append(result.transcript)
            
            # Clean up temp file
            try:
                os.remove(temp_chunk_path)
            except:
                pass
            
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        
        # Combine all transcripts
        combined_transcript = " ".join(all_transcripts)
        
        return TranscriptionResult(
            transcript=combined_transcript
        )
        
    except Exception as e:
        return TranscriptionResult(
            transcript="",
            error=str(e)
        )


def _transcribe_single_chunk(
    audio_file: str,
    api_key: str,
    language_code: str = "ta-IN",
    model: str = "saarika:v2.5",
) -> TranscriptionResult:
    """
    Transcribe a single audio chunk (must be < 30 seconds).
    """
    try:
        url = "https://api.sarvam.ai/speech-to-text"
        
        headers = {
            "api-subscription-key": api_key,
        }
        
        with open(audio_file, "rb") as f:
            files = {
                "file": (os.path.basename(audio_file), f, "audio/mpeg")
            }
            
            data = {
                "language_code": language_code,
                "model": model,
            }
            
            response = requests.post(
                url,
                headers=headers,
                files=files,
                data=data,
                timeout=60
            )
        
        if response.status_code == 200:
            result = response.json()
            transcript = result.get("transcript", "")
            
            return TranscriptionResult(
                transcript=transcript,
                timestamps=result.get("timestamps", [])
            )
        else:
            return TranscriptionResult(
                transcript="",
                error=f"API Error {response.status_code}: {response.text}"
            )
            
    except requests.exceptions.Timeout:
        return TranscriptionResult(
            transcript="",
            error="Request timed out."
        )
    except Exception as e:
        return TranscriptionResult(
            transcript="",
            error=str(e)
        )


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python transcriber.py <audio_file> <api_key>")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    api_key = sys.argv[2]
    
    result = transcribe_audio_chunks(audio_file, api_key)
    
    if result.error:
        print(f"Error: {result.error}")
    else:
        print(f"\nTranscript:\n{'-'*50}")
        print(result.transcript)
        print(f"{'-'*50}")
