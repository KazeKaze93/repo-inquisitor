import sys
import json
from typing import Any, List

def emit_success(data: Any = None, logs: List[str] = None):
    """
    Finalizes execution by printing a JSON object to the last line of stdout.
    """
    if logs:
        for log in logs:
            print(log)
            
    response = {
        "status": "success",
        "data": data
    }
    # Flush stdout to ensure previous prints are handled
    sys.stdout.flush()
    print(json.dumps(response))
    sys.exit(0)

def emit_error(message: str, details: Any = None):
    """
    Finalizes execution with an error state.
    """
    sys.stderr.write(message + "\n")
    if details:
        sys.stderr.write(json.dumps(details) + "\n")
    sys.exit(1)