"""
Tamil Audio Splitter & Transcriber
A Streamlit app to split audio files and transcribe Tamil speech using an API.
"""

import streamlit as st
import os
import tempfile
from pathlib import Path
from datetime import datetime
from audio_processor import split_audio_file, get_audio_duration
from transcriber import transcribe_audio_chunks, TranscriptionResult

# Use temporary directory for Streamlit Cloud compatibility
OUTPUT_DIR = Path(tempfile.gettempdir()) / "streamlit_audio_chunks"
OUTPUT_DIR.mkdir(exist_ok=True)

st.set_page_config(
    page_title="Tamil Audio Transcriber",
    page_icon="🎙️",
    layout="wide"
)

st.title("🎙️ Tamil Audio Splitter & Transcriber")
st.markdown("""
Upload an audio file (MP3, M4A, WAV) and get a full Tamil transcription.
The audio will be automatically split into manageable chunks for processing.
""")

# Sidebar for API key
with st.sidebar:
    st.header("⚙️ Settings")
    
    # Check for API key in environment
    api_key = os.getenv('API_KEY')
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        api_key = st.text_input(
            "API Key",
            type="password",
            help="Get your API key from the service provider, or set API_KEY environment variable"
        )
    else:
        st.success("API Key loaded from environment variable")
    
    if gemini_api_key:
        st.success("Gemini API Key loaded for Tamil text correction")
    
    chunk_minutes = st.slider(
        "Chunk size (minutes)",
        min_value=5,
        max_value=30,
        value=15,
        help="Split audio into chunks of this duration"
    )
    
    st.markdown("---")
    st.markdown("""
    ### How it works
    1. Upload your audio file
    2. Audio is split into chunks
    3. Each chunk is transcribed using Sarvam AI
    4. Download the complete transcript
    
    ### Supported formats
    - MP3, M4A, WAV
    - Tamil language (ta-IN)
    """)

# Main content
uploaded_file = st.file_uploader(
    "Upload Audio File",
    type=["mp3", "m4a", "wav", "mp4"],
    help="Maximum file size depends on Streamlit Cloud limits"
)

if uploaded_file is not None:
    st.success(f"✅ Uploaded: **{uploaded_file.name}** ({uploaded_file.size / (1024*1024):.2f} MB)")
    
    # Create audio player
    st.audio(uploaded_file)
    
    # Process button
    if st.button("🚀 Start Transcription", type="primary", disabled=not api_key):
        if not api_key:
            st.error("Please enter your Sarvam AI API key in the sidebar.")
        else:
            try:
                # Create session directory for this upload
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                session_name = f"{Path(uploaded_file.name).stem}_{timestamp}"
                session_dir = OUTPUT_DIR / session_name
                session_dir.mkdir(exist_ok=True)
                chunks_dir = session_dir / "chunks"
                chunks_dir.mkdir(exist_ok=True)
                
                # Save uploaded file
                input_file = session_dir / uploaded_file.name
                with open(input_file, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                
                st.info(f"📁 Files saved to: `{session_dir}`")
                
                # Get duration
                duration = get_audio_duration(str(input_file))
                st.info(f"📊 Audio duration: **{duration // 60:.0f} min {duration % 60:.0f} sec**")
                
                # Split audio
                st.subheader("📂 Step 1: Splitting Audio")
                progress_split = st.progress(0, text="Splitting audio into chunks...")
                
                chunk_files = split_audio_file(
                    str(input_file),
                    str(chunks_dir),
                    chunk_duration_minutes=chunk_minutes
                )
                
                progress_split.progress(100, text=f"✅ Created {len(chunk_files)} chunk(s)")
                
                # Display chunks
                with st.expander(f"📁 View {len(chunk_files)} audio chunks (saved to disk)"):
                    for i, chunk in enumerate(chunk_files):
                        chunk_path = Path(chunk)
                        st.write(f"**Chunk {i+1}:** `{chunk_path.name}`")
                
                # Transcribe
                st.subheader("📝 Step 2: Transcribing Audio")
                
                all_transcripts = []
                
                for i, chunk_file in enumerate(chunk_files):
                    progress_text = f"Transcribing chunk {i+1}/{len(chunk_files)}..."
                    st.text(progress_text)
                    
                    with st.spinner(progress_text):
                        result = transcribe_audio_chunks(chunk_file, api_key, gemini_api_key)
                    
                    if result.error:
                        st.warning(f"⚠️ Chunk {i+1} error: {result.error}")
                        all_transcripts.append(f"[Error in chunk {i+1}: {result.error}]")
                    else:
                        all_transcripts.append(result.transcript)
                        st.success(f"✅ Chunk {i+1} transcribed ({len(result.transcript)} chars)")
                
                # Combine transcripts
                st.subheader("📄 Full Transcript")
                
                combined_transcript = "\n\n".join([
                    f"--- Chunk {i+1} ---\n{t}" 
                    for i, t in enumerate(all_transcripts)
                ])
                
                if combined_transcript:
                    # Display transcript
                    st.text_area(
                        "Transcript",
                        combined_transcript,
                        height=400,
                        label_visibility="collapsed"
                    )

                    # Store in session history
                    session_data = {
                        'name': session_name,
                        'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        'duration': duration,
                        'chunks_count': len(chunks),
                        'transcript': combined_transcript
                    }
                    st.session_state.transcription_history.append(session_data)

                    st.success("✅ Transcription completed and saved to session history!")

                    # Download button
                    st.download_button(
                        label="📥 Download Transcript",
                        data=combined_transcript,
                        file_name=f"{session_name}_transcript.txt",
                        mime="text/plain"
                    )
                else:
                    st.error("No transcript was generated. Please check your API key and try again.")
                    
            except Exception as e:
                st.error(f"❌ Error: {str(e)}")
                st.exception(e)

elif not api_key:
    st.warning("👈 Please enter your Sarvam AI API key in the sidebar to get started.")
else:
    st.info("👆 Upload an audio file to begin transcription.")

# Show existing outputs
st.markdown("---")
st.subheader("📁 Session History")

# Initialize session history in session state
if 'transcription_history' not in st.session_state:
    st.session_state.transcription_history = []

if st.session_state.transcription_history:
    for i, session in enumerate(reversed(st.session_state.transcription_history[-5:])):  # Show last 5
        with st.expander(f"📂 {session['name']} - {session['timestamp']}"):
            st.write(f"**Duration:** {session['duration']:.1f} seconds")
            st.write(f"**Chunks:** {session['chunks_count']}")
            st.write("**Transcript:** ✅ Available")
            st.download_button(
                label="📥 Download Transcript",
                data=session['transcript'],
                file_name=f"{session['name']}_transcript.txt",
                mime="text/plain",
                key=f"download_{i}"
            )
else:
    st.info("No transcription sessions yet. Upload an audio file to get started!")

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: gray;'>
    Built with ❤️ using Streamlit and Sarvam AI
</div>
""", unsafe_allow_html=True)
