import subprocess
import sys
import os

# Path to the latest Urdu WAV file (update if needed)
wav_path = r"media/audio/speech_urdu_20251127_131757_31003c22.wav"
output_path = r"media/audio/test_rhubarb_output.json"

cmd = [
    "rhubarb",
    "-f", "json",
    "-o", output_path,
    wav_path
]

print(f"Running: {' '.join(cmd)}")
try:
    process = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    print(f"Return code: {process.returncode}")
    if process.stdout:
        print("STDOUT:", process.stdout)
    if process.stderr:
        print("STDERR:", process.stderr)
    if process.returncode == 0 and os.path.exists(output_path):
        print(f"Success! Output written to {output_path}")
    else:
        print("Rhubarb failed or timed out.")
except subprocess.TimeoutExpired:
    print("Rhubarb process timed out.")
except Exception as e:
    print(f"Error running Rhubarb: {e}")
