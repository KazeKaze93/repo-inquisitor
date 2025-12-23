"""
I/O helper utilities for Python Bridge communication.
Provides standardized JSON output format for TypeScript bridge.
"""

import json
import sys
from typing import Any, Dict


def emit_success(data: Any) -> None:
    """
    Emits a successful result as JSON to stdout.
    The bridge will parse the last line as the return value.
    
    Args:
        data: The data to return (will be JSON-serialized)
    
    Example:
        emit_success({"result": "ok", "count": 42})
    """
    json_output = json.dumps(data, ensure_ascii=False)
    print(json_output, file=sys.stdout, flush=True)


def emit_error(msg: str) -> None:
    """
    Emits an error message to stderr and exits with code 1.
    
    Args:
        msg: Error message to display
    
    Example:
        emit_error("Invalid input parameter")
    """
    print(msg, file=sys.stderr, flush=True)
    sys.exit(1)


def emit_log(msg: str) -> None:
    """
    Emits a log message to stdout (before the final JSON line).
    These messages will be captured as logs in the bridge result.
    
    Args:
        msg: Log message to display
    
    Example:
        emit_log("Processing file: example.py")
    """
    print(msg, file=sys.stdout, flush=True)

