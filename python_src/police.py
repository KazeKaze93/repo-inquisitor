import os
import sys
import re
import argparse

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.io_helper import emit_success, emit_error, emit_log

PATTERNS = {
    "magic_hex": r'#[0-9a-fA-F]{3,6}',  # Ищет hex цвета
    "inline_style": r'style={{',         # Ищет инлайн стили
    "raw_button": r'<button',            # Ищет сырые кнопки (должен быть Button)
    "raw_input": r'<input',              # Ищет сырые инпуты (должен быть Input)
    "class_name_string": r'className="[^"]*\s{2,}[^"]*"'
}

IGNORE_FILES = ['tailwind.config.ts', 'vite.config.ts']

def scan_file(filepath: str):
    violations = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for i, line in enumerate(lines):
                line_num = i + 1
                
                if line.strip().startswith('//') or line.strip().startswith('/*'):
                    continue

                for code, pattern in PATTERNS.items():
                    matches = re.findall(pattern, line)
                    if matches:
                        if code == "magic_hex" and ("url(" in line or "id=" in line):
                            continue
                            
                        violations.append({
                            "type": code,
                            "line": line_num,
                            "match": matches[0],
                            "content": line.strip()[:50] + "..."
                        })
    except Exception as e:
        emit_log(f"Error reading {filepath}: {str(e)}")
        
    return violations

def inspect_codebase(target_path: str):
    report = {
        "total_violations": 0,
        "files_checked": 0,
        "files_with_violations": 0,
        "details": {} # filepath -> list of violations
    }
    
    logs = [f"👮 Starting Code Police Scan on: {target_path}"]

    for root, dirs, files in os.walk(target_path):
        for ignore in ['node_modules', 'dist', 'build', '.git', 'venv']:
            if ignore in dirs:
                dirs.remove(ignore)

        for file in files:
            if not file.endswith('.tsx'): # Проверяем только компоненты (пока)
                continue
                
            if file in IGNORE_FILES:
                continue

            report["files_checked"] += 1
            full_path = os.path.join(root, file)
            
            rel_path = os.path.relpath(full_path, target_path)
            
            file_violations = scan_file(full_path)
            
            if file_violations:
                report["total_violations"] += len(file_violations)
                report["files_with_violations"] += 1
                report["details"][rel_path] = file_violations

    if report["total_violations"] > 0:
        logs.append(f"❌ FOUND {report['total_violations']} VIOLATIONS. CODEBASE IS DIRTY.")
    else:
        logs.append("✅ Codebase is clean. Good job, Architect.")

    emit_success(data=report, logs=logs)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("target", help="Directory to scan")
    args = parser.parse_args()
    
    inspect_codebase(os.path.abspath(args.target))