"""
Audio processing utilities for splitting audio files into chunks.
Uses pydub for audio manipulation.
"""

import os
from pathlib import Path
from pydub import AudioSegment
from typing import List


def get_audio_duration(file_path: str) -> float:
    """
    Get the duration of an audio file in seconds.
    
    Args:
        file_path: Path to the audio file
        
    Returns:
        Duration in seconds
    """
    audio = AudioSegment.from_file(file_path)
    return len(audio) / 1000.0  # Convert milliseconds to seconds


def split_audio_file(
    input_file: str,
    output_dir: str,
    chunk_duration_minutes: int = 15
) -> List[str]:
    """
    Split an audio file into chunks of specified duration.
    
    Args:
        input_file: Path to the input audio file
        output_dir: Directory to save the chunks
        chunk_duration_minutes: Duration of each chunk in minutes (default: 15)
        
    Returns:
        List of paths to the generated chunk files
    """
    # Load the audio file
    print(f"Loading audio file: {input_file}")
    audio = AudioSegment.from_file(input_file)
    
    # Calculate chunk duration in milliseconds
    chunk_duration_ms = chunk_duration_minutes * 60 * 1000
    
    # Get total duration
    total_duration_ms = len(audio)
    total_duration_sec = total_duration_ms / 1000
    
    print(f"Total duration: {total_duration_sec / 60:.2f} minutes")
    
    # Calculate number of chunks needed
    num_chunks = (total_duration_ms + chunk_duration_ms - 1) // chunk_duration_ms
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get the original filename without extension
    input_filename = Path(input_file).stem
    
    chunk_files = []
    
    for i in range(num_chunks):
        start_ms = i * chunk_duration_ms
        end_ms = min((i + 1) * chunk_duration_ms, total_duration_ms)
        
        # Extract chunk
        chunk = audio[start_ms:end_ms]
        
        # Generate output filename
        chunk_filename = f"{input_filename}_chunk_{i+1:03d}.mp3"
        chunk_path = os.path.join(output_dir, chunk_filename)
        
        # Export chunk as MP3
        print(f"Exporting chunk {i+1}/{num_chunks}: {chunk_filename}")
        chunk.export(chunk_path, format="mp3", bitrate="128k")
        
        chunk_files.append(chunk_path)
    
    print(f"Successfully created {len(chunk_files)} chunks")
    return chunk_files


def get_audio_info(file_path: str) -> dict:
    """
    Get information about an audio file.
    
    Args:
        file_path: Path to the audio file
        
    Returns:
        Dictionary with audio information
    """
    audio = AudioSegment.from_file(file_path)
    
    return {
        "duration_seconds": len(audio) / 1000.0,
        "duration_minutes": len(audio) / 1000.0 / 60.0,
        "channels": audio.channels,
        "sample_width": audio.sample_width,
        "frame_rate": audio.frame_rate,
        "frame_count": len(audio.get_array_of_samples()),
    }


if __name__ == "__main__":
    # Test the audio processor
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python audio_processor.py <audio_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    # Get audio info
    info = get_audio_info(input_file)
    print(f"Audio Info: {info}")
    
    # Split audio
    output_dir = "./test_chunks"
    chunks = split_audio_file(input_file, output_dir, chunk_duration_minutes=15)
    print(f"Created chunks: {chunks}")
