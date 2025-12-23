export interface PythonExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  logs?: string[]; // 👈 Должно быть string[]
}

export interface BridgeOptions {
  pythonPath?: string;
  cwd?: string;
  env?: Record<string, string>;
}
