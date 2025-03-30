# Import Libraries
import numpy as np
import cupy as cp  
import librosa
import os
import concurrent.futures
import torch  
from tqdm import tqdm

# ===================== FOR EACH STEM =====================
def detect_active_timestamps(stem_path, sr=44100, threshold=0.002, gap=0.2):
    # Load and convert to tensor
    y, sr = librosa.load(stem_path, sr=sr)
    y_gpu = torch.tensor(y, dtype=torch.float32, device="cuda")

    # Compute RMS energy
    frame_length, hop_length = 2048, 512
    rms = torch.sqrt(torch.nn.functional.avg_pool1d(
        y_gpu.unsqueeze(0).pow(2), kernel_size=frame_length, stride=hop_length)
    ).squeeze(0)
    rms_np = rms.cpu().numpy()

    # Find active frames where energy exceeds threshold
    active_frames = np.where(rms_np > threshold)[0]
    active_times = librosa.frames_to_time(active_frames, sr=sr, hop_length=hop_length)

    if not active_times.size:
        return []

    # Generate timestamps for active segments
    timestamps = []
    start_time = active_times[0]

    for i in range(1, len(active_times)):
        if active_times[i] - active_times[i - 1] > gap:  
            timestamps.append((float(round(start_time, 2)), float(round(active_times[i - 1], 2))))
            start_time = active_times[i]

    # Append last detected segment
    timestamps.append((float(round(start_time, 2)), float(round(active_times[-1], 2))))

    return timestamps


# ===================== FOR EACH TRACK =====================
def process_all_stems(track):
    stems_dir = os.path.join(track, "stems")
    if not os.path.exists(stems_dir):
        return None  
    
    # Iterate stems and list timestamps
    output = f"Track: {track}\n"
    for stem in os.listdir(stems_dir):
        stem_path = os.path.join(stems_dir, stem)
        timestamps = detect_active_timestamps(stem_path)
        output += f"{stem}: {timestamps}\n"
    return output


# ===================== FOR EACH FOLDER =====================
def process_all_tracks(dataset_path, output_file):
    track_dirs = [os.path.join(dataset_path, d) for d in os.listdir(dataset_path) if d.startswith("Track")]

    # ThreadPoolExecutor for parallel processing
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor, open(output_file, "w") as f:
        results = list(tqdm(executor.map(process_all_stems, track_dirs), total=len(track_dirs), desc="Processing Tracks"))

        for result in results:
            if result:
                f.write(result)

# Compiling timestamps (~8-9 min)
process_all_tracks("slakh2100_flac_redux/reduced_train", "timestamps_train.txt")