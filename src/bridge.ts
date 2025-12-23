import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { PythonExecutionResult, BridgeOptions } from "./types";

export class PythonBridge {
  private pythonPath: string;

  constructor(options: BridgeOptions = {}) {
    this.pythonPath = options.pythonPath || this.resolvePythonPath();
  }

  private resolvePythonPath(): string {
    const isWindows = os.platform() === "win32";

    const potentialRoots = [
      path.resolve(__dirname, ".."),
      path.resolve(__dirname, "..", ".."),
    ];

    for (const root of potentialRoots) {
      const venvPath = isWindows
        ? path.join(root, "venv", "Scripts", "python.exe")
        : path.join(root, "venv", "bin", "python");

      if (fs.existsSync(venvPath)) {
        return venvPath;
      }
    }

    return isWindows ? "python" : "python3";
  }

  public async executeScript<T>(
    scriptPath: string,
    args: string[] = []
  ): Promise<PythonExecutionResult<T>> {
    return new Promise((resolve) => {
      if (!fs.existsSync(scriptPath)) {
        resolve({
          success: false,
          error: `Python script not found at path: ${scriptPath}`,
        });
        return;
      }

      const proc = spawn(this.pythonPath, [scriptPath, ...args]);

      let stdoutData = "";
      let stderrData = "";

      proc.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderrData += data.toString();
      });

      proc.on("close", (code) => {
        const logs: string[] = [];
        let parsedData: T | undefined;
        let success = code === 0;
        let error = stderrData.trim();

        const lines = stdoutData
          .trim()
          .split("\n")
          .filter((line) => line.length > 0);

        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          try {
            parsedData = JSON.parse(lastLine);
            lines.pop();
          } catch (e) {
            // Ignore if last line is not JSON
          }
        }

        logs.push(...lines);

        resolve({
          success,
          data: parsedData,
          error: success ? undefined : error,
          logs,
        });
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: `Process spawn error: ${err.message}`,
        });
      });
    });
  }
}
