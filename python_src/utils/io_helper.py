import sys
import json
from typing import Any, List, Optional

def emit_log(message: str):
    print(message)
    sys.stdout.flush()

def emit_success(data: Any = None, logs: Optional[List[str]] = None):
    if logs:
        for log in logs:
            print(log)
            
    response = {
        "status": "success",
        "data": data
    }
    sys.stdout.flush()
    print(json.dumps(response))
    sys.exit(0)

def emit_error(message: str, details: Any = None):
    sys.stderr.write(message + "\n")
    if details:
        sys.stderr.write(json.dumps(details) + "\n")
    sys.exit(1)