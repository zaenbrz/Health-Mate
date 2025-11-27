import whisper
import base64
import os
import logging
from pathlib import Path
import subprocess
import json
import tempfile
import uuid
from datetime import datetime
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SpeechService:
    def __init__(self):
        # Load the Whisper model (using medium for multilingual support)
        logger.info("Initializing Whisper model (multilingual)...")
        try:
            # Use 'medium' model for better multilingual support (Urdu, Punjabi, English)
            self.model = whisper.load_model("medium")
            logger.info("Whisper medium model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper medium model: {e}")
            # Fallback to small model
            logger.info("Attempting to load small model as fallback...")
            self.model = whisper.load_model("small")
            logger.info("Whisper small model loaded successfully")
        
        # Initialize TTS configuration
        self.audio_output_dir = Path("media/audio")
        self.audio_output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Audio output directory: {self.audio_output_dir}")
        
        # Language configurations
        self.supported_languages = {
            "en": {
                "name": "English",
                "whisper_code": "en",
                "initial_prompt": "Medical symptoms, health questions, appointment scheduling: ",
                "piper_voice": "piper_models/en_US-lessac-medium.onnx"  # Local model path
            },
            "ur": {
                "name": "Urdu",
                "whisper_code": "ur",
                "initial_prompt": "طبی علامات، صحت کے سوالات، ملاقات کا وقت: ",
                "piper_voice": None  # Urdu not available in Piper, will use fallback
            }
        }
        
        # Default language
        self.current_language = "en"
    
    def set_language(self, language_code: str):
        """Set the current language for transcription"""
        if language_code in self.supported_languages:
            self.current_language = language_code
            logger.info(f"Language set to: {self.supported_languages[language_code]['name']}")
        else:
            logger.warning(f"Unsupported language code: {language_code}, keeping current language")
    
    def get_supported_languages(self):
        """Get list of supported languages"""
        return {
            code: {"name": lang["name"]} 
            for code, lang in self.supported_languages.items()
        }
    
    async def transcribe_audio(self, audio_file_path: str, language: str = None) -> str:
        """
        Transcribe audio file with language support (English, Urdu)
        """
        try:
            # Use provided language or current language
            lang_code = language if language in self.supported_languages else self.current_language
            lang_config = self.supported_languages[lang_code]
            
            logger.info(f"Transcribing audio in {lang_config['name']} ({lang_code})")
            
            # Convert to Path object for better path handling
            audio_path = Path(audio_file_path)
            logger.info(f"Starting transcription of file: {audio_path}")
            
            # Verify file exists and is readable
            if not audio_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
            if not os.access(str(audio_path), os.R_OK):
                raise PermissionError(f"Cannot read audio file: {audio_path}")
            
            # Get file size
            file_size = audio_path.stat().st_size
            logger.info(f"Audio file size: {file_size} bytes")
            
            if file_size == 0:
                raise ValueError("Audio file is empty")
            
            # Preprocess audio for better transcription
            processed_audio_path = await self._preprocess_audio(audio_path)
            
            # Use compatibility-safe transcription approach
            logger.info(f"Starting Whisper transcription in {lang_config['name']}...")
            result = await self._safe_transcribe(processed_audio_path, lang_code)
            
            # Clean up temporary processed file if different from original
            if processed_audio_path != audio_path:
                try:
                    os.unlink(processed_audio_path)
                except:
                    pass
            
            if result and "text" in result:
                transcribed_text = result["text"].strip()
                logger.info(f"Raw transcription result: '{transcribed_text}'")
                
                # Clean up the transcribed text
                cleaned_text = self._clean_transcription(transcribed_text)
                
                if cleaned_text and len(cleaned_text) > 0:
                    logger.info(f"Final cleaned transcription: '{cleaned_text}'")
                    return cleaned_text
                else:
                    logger.warning("Transcription returned empty text after cleaning")
                    return "I didn't catch that clearly. Could you please speak again?"
            else:
                logger.error("No text found in transcription result")
                logger.error(f"Full result: {result}")
                raise ValueError("No text in transcription result")
            
        except Exception as e:
            logger.error(f"Transcription failed with error: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            # Return a helpful error message instead of random mock text
            return "I'm having trouble hearing you clearly. Please try speaking again."
    
    async def _safe_transcribe(self, audio_path: Path, language: str = "en") -> dict:
        """
        Safe transcription method with multilingual support
        """
        try:
            lang_config = self.supported_languages.get(language, self.supported_languages["en"])
            
            # Try the direct approach first (works with most versions)
            logger.info(f"Attempting transcription in {lang_config['name']}...")
            
            # Use language-specific options
            transcribe_options = {
                "language": lang_config["whisper_code"],
                "temperature": 0.0,
                "initial_prompt": lang_config["initial_prompt"],
                "no_speech_threshold": 0.2,
            }
            
            result = self.model.transcribe(str(audio_path), **transcribe_options)
            logger.info(f"Transcription successful in {lang_config['name']}")
            logger.info(f"Detected language: {result.get('language', 'unknown')}")
            return result
            
        except TypeError as e:
            logger.warning(f"Direct transcription failed with TypeError: {e}")
            logger.info("Trying compatibility mode...")
            
            # Fallback: use the most basic transcription call
            try:
                result = self.model.transcribe(str(audio_path))
                logger.info("Basic transcription successful")
                return result
            except Exception as e2:
                logger.error(f"Basic transcription also failed: {e2}")
                raise e2
                
        except Exception as e:
            logger.error(f"Transcription failed with: {e}")
            raise

    async def _preprocess_audio(self, audio_path: Path) -> Path:
        """
        Preprocess audio file for better transcription quality
        Returns path to processed file (may be same as input if no processing needed)
        """
        try:
            # Try to use soundfile for audio preprocessing if available
            try:
                import soundfile as sf
                import numpy as np
                
                logger.info("Preprocessing audio with soundfile...")
                
                # Read audio data
                data, sample_rate = sf.read(str(audio_path))
                logger.info(f"Original audio: sample_rate={sample_rate}, shape={data.shape}")
                
                # Normalize audio to prevent clipping
                if len(data) > 0:
                    max_val = np.abs(data).max()
                    if max_val > 0:
                        data = data / max_val * 0.8  # Leave some headroom
                
                # Create temporary processed file
                import tempfile
                temp_fd, temp_path = tempfile.mkstemp(suffix='.wav', prefix='processed_')
                os.close(temp_fd)  # Close the file descriptor
                
                # Write processed audio
                sf.write(temp_path, data, sample_rate)
                logger.info(f"Audio preprocessed and saved to: {temp_path}")
                
                return Path(temp_path)
                
            except ImportError:
                logger.info("soundfile not available, using original audio file")
                return audio_path
            except Exception as e:
                logger.warning(f"Audio preprocessing failed: {e}, using original file")
                return audio_path
                
        except Exception as e:
            logger.error(f"Error in audio preprocessing: {e}")
            return audio_path

    def _clean_transcription(self, text: str) -> str:
        """Clean and normalize transcribed text"""
        if not text:
            return ""
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Remove filler words and speech artifacts
        filler_words = ["um", "uh", "er", "ah", "hmm"]
        for filler in filler_words:
            text = text.replace(f" {filler} ", " ")
            text = text.replace(f"{filler} ", "")
            text = text.replace(f" {filler}", "")
        
        # Fix common contractions
        contractions = {
            "gonna": "going to",
            "wanna": "want to", 
            "gotta": "got to",
            "lemme": "let me",
            "gimme": "give me",
            "dunno": "don't know"
        }
        
        for contraction, expansion in contractions.items():
            text = text.replace(contraction, expansion)
        
        # Clean up multiple spaces
        text = " ".join(text.split())
        
        # Capitalize first letter
        if text:
            text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
        
        return text
    
    async def generate_speech(self, text: str, language: str = "en") -> dict:
        """
        Generate speech audio using Piper TTS
        Returns: dict with audio_url, filename, duration
        """
        try:
            lang_config = self.supported_languages.get(language, self.supported_languages["en"])
            logger.info(f"Generating speech in {lang_config['name']} for text: {text[:50]}...")
            
            # Check if Piper voice is available for this language
            if not lang_config.get("piper_voice"):
                raise Exception(f"Piper TTS not available for {lang_config['name']}")
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"speech_{timestamp}_{uuid.uuid4().hex[:8]}.wav"
            output_path = self.audio_output_dir / filename
            
            # Use Piper Python API with local model
            from piper import PiperVoice
            import wave
            
            model_path = lang_config["piper_voice"]
            logger.info(f"Loading Piper model from: {model_path}")
            
            # Load voice from local model file
            voice = PiperVoice.load(model_path)
            
            # Synthesize speech - returns a generator of AudioChunk objects
            logger.info(f"Synthesizing speech...")
            audio_chunks = []
            for audio_chunk in voice.synthesize(text):
                # AudioChunk has an 'audio_int16_bytes' property containing PCM audio bytes
                audio_chunks.append(audio_chunk.audio_int16_bytes)
            
            # Combine all chunks into bytes
            audio_bytes = b''.join(audio_chunks)
            logger.info(f"Generated {len(audio_bytes)} bytes of audio")
            
            # Write to WAV file
            with wave.open(str(output_path), 'wb') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(voice.config.sample_rate)
                wav_file.writeframes(audio_bytes)
            
            logger.info(f"Speech generated successfully: {output_path}")
            
            # Calculate duration
            duration = len(audio_bytes) / (voice.config.sample_rate * 2)  # 2 bytes per sample
            
            return {
                "audio_url": f"/media/audio/{filename}",
                "filename": filename,
                "duration": duration
            }
            
        except Exception as e:
            logger.error(f"Speech generation failed: {e}")
            raise
    
    async def generate_speech_with_lipsync(self, text: str, language: str = "en") -> dict:
        """
        Generate speech audio + lip-sync viseme data using Piper TTS + Rhubarb (English) or Eleven Labs (Urdu)
        Returns: dict with audio_url, filename, duration, visemes
        """
        try:
            if language == "ur":
                return await self.generate_urdu_speech_with_lipsync(text)
            # Step 1: Generate audio with Piper
            audio_result = await self.generate_speech(text, language)
            audio_path = self.audio_output_dir / audio_result["filename"]
            # Step 2: Generate lip-sync with Rhubarb
            logger.info(f"Generating lip-sync data for: {audio_path}")
            visemes = await self._run_rhubarb(audio_path)
            
            return {
                "audio_url": audio_result["audio_url"],
                "filename": audio_result["filename"],
                "duration": audio_result["duration"],
                "visemes": visemes
            }
        except Exception as e:
            logger.error(f"Speech + lip-sync generation failed: {e}")
            raise

    async def generate_urdu_speech_with_lipsync(self, text: str) -> dict:
        """
        Generate Urdu speech audio using Eleven Labs and lipsync with Rhubarb
        Returns: dict with audio_url, filename, duration, visemes
        """
        try:
            from elevenlabs import VoiceSettings
            from elevenlabs.client import ElevenLabs
            from pydub import AudioSegment
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            mp3_filename = f"speech_urdu_{timestamp}_{uuid.uuid4().hex[:8]}.mp3"
            wav_filename = f"speech_urdu_{timestamp}_{uuid.uuid4().hex[:8]}.wav"
            mp3_path = self.audio_output_dir / mp3_filename
            wav_path = self.audio_output_dir / wav_filename
            
            logger.info(f"Generating Urdu speech with Eleven Labs for text: {text[:50]}...")
            
            elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
            audio_response = elevenlabs.text_to_speech.convert(
                text=text,
                voice_id="9cI5mhBtM4WtQ9Fo6jWQ",  # Urdu voice ID
                model_id="eleven_turbo_v2_5",
                output_format="mp3_22050_32",
                voice_settings=VoiceSettings(
                    stability=0.5,
                    similarity_boost=0.75,
                    use_speaker_boost=True,
                    speed=1.0,
                ),
            )
            
            # Save audio to MP3 file first
            with open(mp3_path, 'wb') as f:
                for chunk in audio_response:
                    if chunk:
                        f.write(chunk)
            
            logger.info(f"Urdu speech MP3 saved to: {mp3_path}")
            
            # Convert MP3 to WAV for Rhubarb
            logger.info(f"Converting MP3 to WAV for Rhubarb...")
            audio = AudioSegment.from_mp3(str(mp3_path))
            audio.export(str(wav_path), format="wav")
            logger.info(f"WAV file created: {wav_path}")
            
            # Generate lip-sync with Rhubarb using WAV file
            visemes = await self._run_rhubarb(wav_path)
            
            # Calculate duration from WAV
            duration = len(audio) / 1000.0  # pydub returns milliseconds
            
            # Delete WAV file (we only need MP3 for frontend)
            if wav_path.exists():
                wav_path.unlink()
            
            return {
                'audio_url': f"/media/audio/{mp3_filename}",
                'filename': mp3_filename,
                'duration': duration,
                'visemes': visemes
            }
        except Exception as e:
            logger.error(f"Urdu speech + lipsync generation failed: {e}")
            raise
    
    async def _run_rhubarb(self, audio_path: Path) -> list:
        """
        Run Rhubarb Lip Sync to extract viseme timing from audio
        Returns: list of viseme events [{time, type}]
        """
        try:
            # Create temporary file for Rhubarb output
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
                temp_output = temp_file.name
            
            # Run Rhubarb command
            cmd = [
                "rhubarb",
                "-f", "json",
                "-o", temp_output,
                str(audio_path)
            ]
            
            logger.info(f"Running Rhubarb: {' '.join(cmd)}")
            start_time = time.time()
            process = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )
            end_time = time.time()
            logger.info(f"Rhubarb finished in {end_time - start_time:.2f} seconds.")
            
            if process.returncode != 0:
                logger.error(f"Rhubarb failed: {process.stderr}")
                raise Exception(f"Rhubarb lip-sync failed: {process.stderr}")
            
            # Read Rhubarb output
            with open(temp_output, 'r') as f:
                rhubarb_data = json.load(f)
            
            # Log the raw Rhubarb output for debugging
            logger.info(f"Raw Rhubarb output: {json.dumps(rhubarb_data, indent=2)}")
            
            # Clean up temp file
            os.unlink(temp_output)
            
            # Extract viseme cues (mouthCues)
            visemes = rhubarb_data.get("mouthCues", [])
            logger.info(f"Extracted {len(visemes)} viseme cues from Rhubarb")
            logger.info(f"First 5 cues: {visemes[:5] if len(visemes) > 0 else 'NONE'}")
            
            # Convert Rhubarb phonemes to Ready Player Me viseme names
            visemes_mapped = self._map_rhubarb_to_rpm_visemes(visemes)
            logger.info(f"Mapped visemes count: {len(visemes_mapped)}")
            logger.info(f"First 5 mapped: {visemes_mapped[:5] if len(visemes_mapped) > 0 else 'NONE'}")
            
            return visemes_mapped
            
        except subprocess.TimeoutExpired:
            logger.error("Rhubarb timed out")
            raise Exception("Lip-sync generation timed out")
        except Exception as e:
            logger.error(f"Rhubarb execution failed: {e}")
            raise
    
    def _map_rhubarb_to_rpm_visemes(self, rhubarb_cues: list) -> list:
        """
        Map Rhubarb phoneme codes to Ready Player Me viseme names
        Rhubarb uses: A, B, C, D, E, F, G, H, X
        RPM uses: viseme_sil, viseme_PP, viseme_FF, viseme_TH, etc.
        """
        # Mapping from Rhubarb to RPM visemes
        phoneme_map = {
            "X": "viseme_sil",      # Silence
            "A": "viseme_aa",       # Open vowel (father)
            "B": "viseme_PP",       # Lips together (p, b, m)
            "C": "viseme_E",        # Slightly open (bed)
            "D": "viseme_aa",       # Open (cat, but)
            "E": "viseme_O",        # Rounded (bird)
            "F": "viseme_FF",       # Lips against teeth (f, v)
            "G": "viseme_kk",       # Back of tongue (k, g)
            "H": "viseme_CH",       # Affricates (ch, j)
        }
        
        mapped_cues = []
        for cue in rhubarb_cues:
            phoneme = cue.get("value", "X")
            time = cue.get("start", 0)
            
            viseme_name = phoneme_map.get(phoneme, "viseme_sil")
            mapped_cues.append({
                "time": time,
                "type": viseme_name
            })
        
        return mapped_cues




