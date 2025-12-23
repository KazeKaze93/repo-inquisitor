import os
import sys
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.io_helper import emit_success, emit_error

def analyze_directory(target_path: str):
    if not os.path.exists(target_path):
        emit_error(f"Target path does not exist: {target_path}")

    stats = {
        "files": 0,
        "dirs": 0,
        "extensions": {},
        "total_size_bytes": 0
    }
    
    logs = []
    logs.append(f"Starting analysis of: {target_path}")

    try:
        for root, dirs, files in os.walk(target_path):
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
            if 'venv' in dirs:
                dirs.remove('venv')
            if '.git' in dirs:
                dirs.remove('.git')

            stats["dirs"] += len(dirs)
            
            for file in files:
                stats["files"] += 1
                full_path = os.path.join(root, file)
                stats["total_size_bytes"] += os.path.getsize(full_path)
                
                ext = os.path.splitext(file)[1].lower() or "no_ext"
                stats["extensions"][ext] = stats["extensions"].get(ext, 0) + 1

        emit_success(data=stats, logs=logs)

    except Exception as e:
        emit_error(f"Analysis failed: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze a repository")
    parser.add_argument("target", help="Target directory to analyze")
    
    args = parser.parse_args()
    
    abs_target = os.path.abspath(args.target)
    
    analyze_directory(abs_target)