import sys
import json
from typing import Any, List, Optional

def emit_log(message: str):
    """
    Prints a log message to stdout. 
    Node.js bridge captures this as a log line (non-JSON).
    """
    print(message)
    sys.stdout.flush()

def emit_success(data: Any = None, logs: Optional[List[str]] = None):
    """
    Finalizes execution by printing a JSON object to the last line of stdout.
    Exits with code 0.
    """
    # Если передали накопленные логи массивом — выводим их перед JSON
    if logs:
        for log in logs:
            print(log)
            
    response = {
        "status": "success",
        "data": data
    }
    # Flush stdout to ensure previous prints are handled
    sys.stdout.flush()
    # Print JSON strictly on the last line
    print(json.dumps(response))
    sys.exit(0)

def emit_error(message: str, details: Any = None):
    """
    Finalizes execution with an error state.
    Exits with code 1.
    """
    # Пишем в stderr, чтобы Node.js мог отличить поток ошибок
    sys.stderr.write(message + "\n")
    if details:
        sys.stderr.write(json.dumps(details) + "\n")
    sys.exit(1)