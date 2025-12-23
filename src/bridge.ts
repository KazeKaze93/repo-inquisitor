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

    // Стратегия поиска venv:
    // 1. Сначала смотрим в корень проекта (development mode)
    // 2. Потом смотрим относительно dist (production/installed mode)
    const potentialRoots = [
      path.resolve(__dirname, ".."), // Development: src/..
      path.resolve(__dirname, "..", ".."), // Production: dist/..
    ];

    for (const root of potentialRoots) {
      const venvPath = isWindows
        ? path.join(root, "venv", "Scripts", "python.exe")
        : path.join(root, "venv", "bin", "python");

      if (fs.existsSync(venvPath)) {
        return venvPath;
      }
    }

    // Fallback
    return isWindows ? "python" : "python3";
  }

  // 👇 ВОТ ЭТОТ МЕТОД, КОТОРЫЙ ТЫ ПОТЕРЯЛ
  public async executeScript<T>(
    scriptPath: string,
    args: string[] = []
  ): Promise<PythonExecutionResult<T>> {
    return new Promise((resolve) => {
      // Защита от пробелов в путях (хотя spawn обычно справляется, но лучше проверить)
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

        // Разбиваем вывод на строки
        const lines = stdoutData
          .trim()
          .split("\n")
          .filter((line) => line.length > 0);

        // Пытаемся распарсить последнюю строку как JSON
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          try {
            parsedData = JSON.parse(lastLine);
            // Если успех, удаляем JSON из логов, чтобы не дублировать
            lines.pop();
          } catch (e) {
            // Если последняя строка не JSON, значит скрипт вернул только текст/логи
            // Или упал так, что даже JSON не отдал.
            if (success) {
              // Если код 0, но JSON нет — это странно, но не фатально, если мы не ждем данных
              // Но для нашей архитектуры это warning
            }
          }
        }

        // Всё остальное — логи
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
