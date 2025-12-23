/**
 * Result of a Python script execution.
 */
export interface PythonExecutionResult {
  /** Whether the execution was successful */
  success: boolean;
  /** Parsed JSON data from the last line of stdout (if successful) */
  data?: unknown;
  /** Log lines from stdout (all lines except the last) */
  logs: string[];
  /** Error message from stderr or execution failure */
  error?: string;
  /** Exit code from the Python process */
  exitCode?: number;
}

/**
 * Options for configuring the Python Bridge.
 */
export interface BridgeOptions {
  /** Custom path to the venv directory. If not provided, auto-discovers from project root. */
  venvPath?: string;
  /** Working directory for Python script execution. Defaults to process.cwd(). */
  cwd?: string;
  /** Environment variables to pass to the Python process */
  env?: NodeJS.ProcessEnv;
  /** Timeout in milliseconds. If not set, no timeout is applied. */
  timeout?: number;
}


