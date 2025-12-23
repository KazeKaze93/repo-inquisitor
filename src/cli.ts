#!/usr/bin/env node
// 👆 ЭТА СТРОКА ОБЯЗАТЕЛЬНА. Она говорит системе: "Запусти меня через Node".

import path from "path";
import { PythonBridge } from "./bridge";

async function main() {
  // Аргументы:
  // [0] - node binary
  // [1] - путь к скрипту
  // [2] - ПЕРВЫЙ аргумент пользователя (название команды)
  // [3...] - остальные флаги
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("❌ Error: No command provided.");
    console.error("Usage: my-tool <script-name> [args...]");
    process.exit(1);
  }

  const commandName = args[0]; // Например: "analyze", "parse", "destroy"
  const scriptArgs = args.slice(1); // Всё, что идет после команды

  // Маппинг команд на реальные Python файлы
  // Это защищает тебя от выполнения произвольных файлов
  const scriptMap: Record<string, string> = {
    analyze: "analyzer.py",
    setup: "setup_db.py",
    // добавь свои скрипты сюда
  };

  const scriptFile = scriptMap[commandName];

  if (!scriptFile) {
    console.error(`❌ Unknown command: "${commandName}"`);
    console.error(`Available commands: ${Object.keys(scriptMap).join(", ")}`);
    process.exit(1);
  }

  // Инициализируем мост
  const bridge = new PythonBridge();

  // Находим абсолютный путь к питон-скрипту внутри пакета
  // Предполагаем, что .py лежат в папке python_src в корне пакета
  // __dirname в продакшене будет указывать на /dist
  const pythonScriptPath = path.resolve(
    __dirname,
    "..",
    "python_src",
    scriptFile
  );

  console.log(`🚀 Executing: ${commandName}...`);

  try {
    const result = await bridge.executeScript(pythonScriptPath, scriptArgs);

    if (result.success) {
      // Если Python вернул JSON, выводим его красиво
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error("💥 Python Error:");
      console.error(result.error);
    }

    // Выводим логи, если они были
    if (result.logs && result.logs.length > 0) {
      console.log("\n--- Logs ---");
      result.logs.forEach((l) => console.log(l));
    }

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error("💀 Fatal Bridge Error:", err);
    process.exit(1);
  }
}

main();
