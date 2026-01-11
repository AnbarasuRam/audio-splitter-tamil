"""
Transcription service using API for Tamil speech-to-text.
Splits audio into 30-second chunks for the real-time API.
"""

import os
import time
from dataclasses import dataclass
from typing import Optional, List
import requests
import google.genai as genai
from pydub import AudioSegment
from sarvamai import SarvamAI


@dataclass
class TranscriptionResult:
    """Result of a transcription operation."""
    transcript: str
    timestamps: Optional[List[dict]] = None
    error: Optional[str] = None


def correct_colloquial_tamil(text: str, api_key: str) -> str:
    """
    Correct colloquial Tamil in the text to proper written Tamil using Gemini AI.
    
    Args:
        text: The Tamil text to correct
        api_key: Gemini API key
        
    Returns:
        Corrected Tamil text
    """
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=f"""this tamil text has some colloqial tamil in some places. convert them into to proper writing tamil. do not remove any sentences. just correct only the sentences with colloqial tamil

Text: {text}"""
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error correcting Tamil text: {e}")
        return text  # Return original text if correction fails


def transcribe_audio_batch(
    audio_file: str,
    api_key: str,
    gemini_api_key: str = None,
    output_dir: str = None,
    language_code: str = "ta-IN",
    model: str = "saarika:v2.5",
    progress_callback=None
) -> TranscriptionResult:
    """
    Transcribe an audio file using SarvamAI batch API (for files > 30 seconds).
    
    Args:
        audio_file: Path to the audio file
        api_key: SarvamAI API key
        gemini_api_key: Gemini API key for Tamil text correction (optional)
        output_dir: Directory to store individual chunk transcriptions
        language_code: Language code (default: ta-IN for Tamil)
        model: Model to use
        progress_callback: Optional callback function for progress updates
        
    Returns:
        TranscriptionResult with combined transcript
    """
    try:
        if progress_callback:
            progress_callback("Initializing batch job...")
            
        client = SarvamAI(api_subscription_key=api_key)
        
        # Create batch job
        job = client.speech_to_text_job.create_job(
            language_code=language_code,
            model=model,
            with_timestamps=True,
            with_diarization=True,
            num_speakers=2
        )
        
        # Upload file
        if progress_callback:
            progress_callback("Uploading audio file...")
        job.upload_files(file_paths=[audio_file])
        
        # Start job
        if progress_callback:
            progress_callback("Starting transcription job...")
        job.start()
        
        # Wait for completion
        if progress_callback:
            progress_callback("Processing audio (this may take several minutes)...")
        final_status = job.wait_until_complete()
        
        if job.is_failed():
            return TranscriptionResult(
                transcript="",
                error="Batch transcription job failed."
            )
        
        # Download outputs
        if progress_callback:
            progress_callback("Downloading results...")
        
        if output_dir:
            job.download_outputs(output_dir=output_dir)
        
        # Get the transcript from the job result
        try:
            # Get file results which should contain the transcription
            file_results = job.get_file_results()
            
            if file_results and len(file_results) > 0:
                # Assuming the first result contains the transcript
                result_data = file_results[0]
                
                # Extract transcript from the result
                if hasattr(result_data, 'transcript'):
                    transcript = result_data.transcript
                elif isinstance(result_data, dict) and 'transcript' in result_data:
                    transcript = result_data['transcript']
                elif hasattr(result_data, 'text'):
                    transcript = result_data.text
                else:
                    # Try to get the transcript from the downloaded files
                    import glob
                    output_files = glob.glob(os.path.join(output_dir, "*.json")) if output_dir else []
                    if output_files:
                        import json
                        with open(output_files[0], 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            transcript = data.get('transcript', str(data))
                    else:
                        transcript = str(file_results)
            else:
                return TranscriptionResult(
                    transcript="",
                    error="No transcription results found in batch job output."
                )
                
        except Exception as e:
            return TranscriptionResult(
                transcript="",
                error=f"Failed to extract transcript from batch job: {str(e)}"
            )
        
        # Correct colloquial Tamil if Gemini API key is provided
        if gemini_api_key and transcript:
            if progress_callback:
                progress_callback("Correcting Tamil text...")
            transcript = correct_colloquial_tamil(transcript, gemini_api_key)
        
        # Save individual chunk transcriptions if output_dir is provided
        if output_dir and transcript:
            try:
                transcript_file = os.path.join(output_dir, "batch_transcript.txt")
                with open(transcript_file, 'w', encoding='utf-8') as f:
                    f.write(transcript)
            except Exception as e:
                print(f"Warning: Could not save transcript to file: {e}")
        
        return TranscriptionResult(transcript=transcript)
        
    except Exception as e:
        return TranscriptionResult(
            transcript="",
            error=f"Batch transcription failed: {str(e)}"
        )


def transcribe_audio_chunks(
    audio_file: str,
    api_key: str,
    gemini_api_key: str = None,
    language_code: str = "ta-IN",
    model: str = "saarika:v2.5",
    progress_callback=None
) -> TranscriptionResult:
    """
    Transcribe an audio file by splitting it into 30-second chunks.
    
    Args:
        audio_file: Path to the audio file
        api_key: API key
        gemini_api_key: Gemini API key for Tamil text correction (optional)
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
        
        # Correct colloquial Tamil if Gemini API key is provided
        if gemini_api_key:
            combined_transcript = correct_colloquial_tamil(combined_transcript, gemini_api_key)
        
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
