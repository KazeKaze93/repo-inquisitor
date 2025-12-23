import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { PythonExecutionResult, BridgeOptions } from "./types";

/**
 * Python Bridge for executing Python scripts from TypeScript.
 * Auto-discovers venv path and handles execution with proper error handling.
 */
export class PythonBridge {
  private readonly venvPath: string;
  private readonly pythonExecutable: string;
  private readonly isWindows: boolean;

  /**
   * Creates a new PythonBridge instance.
   * @param options Configuration options for the bridge
   * @throws Error if venv is not found or Python executable is missing
   */
  constructor(options: BridgeOptions = {}) {
    this.isWindows = os.platform() === "win32";
    this.venvPath = this.discoverVenvPath(options.venvPath);
    this.pythonExecutable = this.resolvePythonExecutable();
    this.validatePythonExecutable();
  }

  /**
   * Discovers the venv path from the project structure.
   * @param customPath Optional custom venv path
   * @returns Resolved venv path
   * @throws Error if venv directory is not found
   */
  private discoverVenvPath(customPath?: string): string {
    if (customPath) {
      const resolved = path.resolve(customPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Custom venv path does not exist: ${resolved}`);
      }
      return resolved;
    }

    // Auto-discover: look for venv relative to project root
    // Try common locations: project root, or one level up (if src/ is the entry point)
    const possiblePaths = [
      path.join(process.cwd(), "venv"),
      path.join(process.cwd(), "..", "venv"),
      path.join(__dirname, "..", "venv"),
    ];

    for (const venvPath of possiblePaths) {
      const resolved = path.resolve(venvPath);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }

    throw new Error(
      `Virtual environment not found. Tried: ${possiblePaths.join(", ")}`
    );
  }

  /**
   * Resolves the Python executable path based on the platform.
   * @returns Path to the Python executable
   */
  private resolvePythonExecutable(): string {
    if (this.isWindows) {
      return path.join(this.venvPath, "Scripts", "python.exe");
    }
    return path.join(this.venvPath, "bin", "python");
  }

  /**
   * Validates that the Python executable exists.
   * @throws Error if Python executable is not found
   */
  private validatePythonExecutable(): void {
    if (!fs.existsSync(this.pythonExecutable)) {
      throw new Error(
        `Python executable not found at: ${this.pythonExecutable}. Ensure venv is properly set up.`
      );
    }
  }

  /**
   * Executes a Python script and returns the result.
   * @param scriptPath Path to the Python script to execute
   * @param args Command-line arguments to pass to the script
   * @param options Execution options (cwd, env, timeout)
   * @returns Promise resolving to the execution result
   */
  async execute(
    scriptPath: string,
    args: string[] = [],
    options: Omit<BridgeOptions, "venvPath"> = {}
  ): Promise<PythonExecutionResult> {
    const resolvedScriptPath = path.resolve(scriptPath);
    
    if (!fs.existsSync(resolvedScriptPath)) {
      return {
        success: false,
        logs: [],
        error: `Python script not found: ${resolvedScriptPath}`,
      };
    }

    const cwd = options.cwd || process.cwd();
    const env = {
      ...process.env,
      ...options.env,
    };

    return new Promise<PythonExecutionResult>((resolve) => {
      const childProcess: ChildProcess = spawn(
        this.pythonExecutable,
        [resolvedScriptPath, ...args],
        {
          cwd,
          env,
          shell: this.isWindows,
        }
      );

      let stdout = "";
      let stderr = "";
      let hasResolved = false;

      // Collect stdout
      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      // Collect stderr
      childProcess.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on("close", (code: number | null) => {
        if (hasResolved) return;
        hasResolved = true;

        const result = this.parseOutput(stdout, stderr, code ?? -1);
        resolve(result);
      });

      // Handle spawn errors
      childProcess.on("error", (error: Error) => {
        if (hasResolved) return;
        hasResolved = true;

        resolve({
          success: false,
          logs: [],
          error: `Failed to spawn Python process: ${error.message}`,
          exitCode: -1,
        });
      });

      // Handle timeout if specified
      if (options.timeout && options.timeout > 0) {
        setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            childProcess.kill();
            resolve({
              success: false,
              logs: stdout.split("\n").filter((line) => line.trim().length > 0),
              error: `Execution timeout after ${options.timeout}ms`,
              exitCode: -1,
            });
          }
        }, options.timeout);
      }
    });
  }

  /**
   * Parses the output from Python execution.
   * Last line of stdout is treated as JSON, previous lines as logs.
   * @param stdout Standard output from the process
   * @param stderr Standard error from the process
   * @param exitCode Process exit code
   * @returns Parsed execution result
   */
  private parseOutput(
    stdout: string,
    stderr: string,
    exitCode: number
  ): PythonExecutionResult {
    const stdoutLines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // If there's stderr, treat it as an error
    const stderrTrimmed = stderr.trim();
    if (stderrTrimmed.length > 0) {
      return {
        success: false,
        logs: stdoutLines,
        error: stderrTrimmed,
        exitCode,
      };
    }

    // If exit code is non-zero, treat as failure
    if (exitCode !== 0) {
      return {
        success: false,
        logs: stdoutLines,
        error: `Process exited with code ${exitCode}`,
        exitCode,
      };
    }

    // Try to parse the last line as JSON
    if (stdoutLines.length === 0) {
      return {
        success: true,
        logs: [],
        data: null,
        exitCode,
      };
    }

    const lastLine = stdoutLines[stdoutLines.length - 1];
    const logs = stdoutLines.slice(0, -1);

    try {
      const data = JSON.parse(lastLine);
      return {
        success: true,
        logs,
        data,
        exitCode,
      };
    } catch (parseError) {
      // If JSON parsing fails, treat the entire output as logs
      return {
        success: false,
        logs: stdoutLines,
        error: `Failed to parse JSON from last line: ${(parseError as Error).message}`,
        exitCode,
      };
    }
  }

  /**
   * Gets the resolved Python executable path.
   * @returns Path to the Python executable
   */
  getPythonPath(): string {
    return this.pythonExecutable;
  }

  /**
   * Gets the resolved venv path.
   * @returns Path to the virtual environment
   */
  getVenvPath(): string {
    return this.venvPath;
  }
}

