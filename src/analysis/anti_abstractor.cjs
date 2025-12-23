const fs = require("fs");
const path = require("path");

const IGNORED_SUFFIXES = [
  "Props",
  "State",
  "DTO",
  "Response",
  "Request",
  "Params",
  "Config",
  "Option",
  "Item",
];
const IGNORED_FILES = [".d.ts"];

class AntiAbstractor {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.registry = new Map();
    this.filesContent = new Map();
  }

  scan() {
    if (!fs.existsSync(this.rootDir)) {
      console.error(`❌ Путь не найден: ${this.rootDir}`);
      process.exit(1);
    }

    console.log(`🔍 Сканируем (v2) TypeScript файлы в ${this.rootDir}...`);

    this.walk(this.rootDir, (filePath, content) => {
      this.findDefinitions(filePath, content);
      this.filesContent.set(filePath, content);
    });

    console.log(
      `📊 Найдено ${this.registry.size} сущностей. Проверяем использование...`
    );

    for (const [name, info] of this.registry) {
      const regex = new RegExp(`\\b${name}\\b`, "g");

      for (const [filePath, content] of this.filesContent) {
        const matches = content.match(regex);
        if (matches) {
          info.count += matches.length;
        }
      }
    }

    this.judge();
  }

  walk(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (
          file !== "node_modules" &&
          file !== ".git" &&
          file !== "dist" &&
          file !== "out"
        ) {
          this.walk(filePath, callback);
        }
      } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
        const content = fs.readFileSync(filePath, "utf-8");
        callback(filePath, content);
      }
    }
  }

  findDefinitions(filePath, content) {
    const defRegex =
      /(?:export\s+)?(?:interface|type|class|enum|abstract\s+class)\s+([A-Z][a-zA-Z0-9_]*)/g;

    let match;
    while ((match = defRegex.exec(content)) !== null) {
      const name = match[1];

      if (IGNORED_SUFFIXES.some((suffix) => name.endsWith(suffix))) continue;

      if (!this.registry.has(name)) {
        this.registry.set(name, {
          defPath: filePath,
          count: 0,
        });
      }
    }
  }

  judge() {
    let foundGuilty = false;
    console.log("\n--- ОТЧЕТ ИНКВИЗИЦИИ (V2) ---\n");

    for (const [name, info] of this.registry) {
      if (info.defPath.endsWith(".d.ts")) continue;

      if (info.count <= 1) {
        console.log(`💀 МЕРТВЫЙ КОД:`);
        console.log(`   Сущность: ${name}`);
        console.log(`   Файл: ${info.defPath}`);
        console.log(`   Статус: 0 использований.`);
        console.log(`   👉 \x1b[31m«Ты не Google, удали это.»\x1b[0m\n`);
        foundGuilty = true;
      } else if (info.count === 2 && name.startsWith("I")) {
        console.log(`⚠️ ПРЕЖДЕВРЕМЕННАЯ АБСТРАКЦИЯ:`);
        console.log(`   Интерфейс: ${name}`);
        console.log(`   Файл: ${info.defPath}`);
        console.log(`   Статус: Используется всего в 1 месте.`);
        console.log(
          `   👉 \x1b[33m«YAGNI. Зачем тебе интерфейс ради одного класса?»\x1b[0m\n`
        );
        foundGuilty = true;
      }
    }

    if (!foundGuilty) {
      console.log("✅ Теперь честно. Явного мусора не найдено.");
    }
  }
}

const targetDir = process.argv[2];
if (!targetDir) {
  console.log("Usage: node scripts/anti_abstractor.cjs <path_to_src>");
  process.exit(1);
}

new AntiAbstractor(targetDir).scan();
