import * as fs from "fs";
import * as path from "path";

// === CONFIGURATION ===
const CONFIG = {
  rootDir: process.cwd(),
  aiDir: path.join(process.cwd(), ".ai"),
  outputFile: path.join(process.cwd(), ".ai", "GEMINI_PROMPT.txt"),
  rulesFile: path.join(process.cwd(), ".ai", "RULES.md"),

  includeDirs: ["src", "electron", "scripts", "python_src"],

  includeRootFiles: [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "electron.vite.config.ts",
    "tailwind.config.ts",
    "drizzle.config.ts",
    "repomix.config.json",
  ],

  ignorePatterns: [
    "node_modules",
    ".git",
    "dist",
    "out",
    "build",
    ".idea",
    ".vscode",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "*.log",
    "*.sqlite",
    "*.db",
    "*.png",
    "*.ico",
    "*.svg",
    "assets",
    "public",
    "context-packer.ts",
  ],

  // GEMINI 2.5 FLASH LIMITS (1M Input Tokens)
  // 1 Token ~= 4 chars. 1M tokens ~= 4MB text.
  // Avg line length ~= 60 chars.
  // Safe limit: ~65,000 - 100,000 lines.
  maxLinesPerFile: 5000,
  maxTotalLines: 100000,
};

// === HELPERS ===

const isIgnored = (filePath: string): boolean => {
  const relative = path.relative(CONFIG.rootDir, filePath);
  if (
    CONFIG.ignorePatterns.some(
      (p) => relative.includes(p) || filePath.endsWith(p)
    )
  )
    return true;

  const parts = relative.split(path.sep);
  if (parts.length === 1 && !CONFIG.includeRootFiles.includes(parts[0]))
    return true;
  if (parts.length > 1 && !CONFIG.includeDirs.includes(parts[0])) return true;

  return false;
};

const minifyAndTruncate = (content: string, filePath: string): string => {
  let lines = content.split("\n");
  lines = lines.filter((l) => l.trim().length > 0);

  if (lines.length > CONFIG.maxLinesPerFile) {
    const head = lines.slice(0, 100).join("\n");
    const tail = lines.slice(-100).join("\n");
    return `${head}\n\n... [SNIPPED ${
      lines.length - 200
    } LINES] ...\n\n${tail}`;
  }
  return lines.join("\n");
};

const generateTree = (dir: string, prefix = ""): string => {
  let tree = "";
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return "";
  }

  files.sort((a, b) => {
    const aPath = path.join(dir, a);
    const bPath = path.join(dir, b);
    try {
      const aStat = fs.statSync(aPath);
      const bStat = fs.statSync(bPath);
      if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
      if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
      return a.localeCompare(b);
    } catch {
      return 0;
    }
  });

  const filteredFiles = files.filter((file) => {
    const fullPath = path.join(dir, file);
    return !CONFIG.ignorePatterns.some(
      (p) => file === p || fullPath.includes("node_modules")
    );
  });

  filteredFiles.forEach((file, index) => {
    const fullPath = path.join(dir, file);
    const isLast = index === filteredFiles.length - 1;
    tree += `${prefix}${isLast ? "└── " : "├── "}${file}\n`;

    try {
      if (fs.statSync(fullPath).isDirectory()) {
        tree += generateTree(fullPath, prefix + (isLast ? "    " : "│   "));
      }
    } catch {}
  });
  return tree;
};

// === MAIN ===

const run = () => {
  console.log("🔪 Surgical Context Packer v3 (High Capacity Mode)...");

  if (!fs.existsSync(CONFIG.aiDir))
    fs.mkdirSync(CONFIG.aiDir, { recursive: true });

  let userRules = "";
  if (fs.existsSync(CONFIG.rulesFile)) {
    userRules = fs.readFileSync(CONFIG.rulesFile, "utf-8");
    console.log("📜 Rules found.");
  } else {
    userRules = "No specific user rules defined.";
  }

  const treeString = generateTree(CONFIG.rootDir);

  let output = `
=== IDENTITY ===
You are a Senior Software Architect (Gemini 2.5 Flash).
Goal: Prevent "UI drift" and spaghetti code.

=== USER RULES ===
${userRules}

=== PROJECT STRUCTURE ===
\`\`\`
${treeString}
\`\`\`

=== SOURCE CODE ===
`;

  let totalLines = 0;
  let fileCount = 0;

  const processFile = (filePath: string) => {
    if (isIgnored(filePath)) return;

    const ext = path.extname(filePath);
    if (
      ![
        ".ts",
        ".tsx",
        ".js",
        ".cjs",
        ".json",
        ".py",
        ".css",
        ".sql",
        ".md",
        ".html",
      ].includes(ext)
    )
      return;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const relative = path.relative(CONFIG.rootDir, filePath);
      const processed = minifyAndTruncate(content, filePath);

      output += `\n<file path="${relative}">\n${processed}\n</file>\n`;
      totalLines += processed.split("\n").length;
      fileCount++;
    } catch (e) {
      console.warn(`⚠️ Failed to read ${filePath}`);
    }
  };

  const traverseDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach((f) => {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) traverseDir(fullPath);
      else processFile(fullPath);
    });
  };

  CONFIG.includeRootFiles.forEach((f) => {
    const p = path.join(CONFIG.rootDir, f);
    if (fs.existsSync(p)) processFile(p);
  });

  CONFIG.includeDirs.forEach((d) => traverseDir(path.join(CONFIG.rootDir, d)));

  output += `
\n=== INSTRUCTION ===
Await my next command.
`;

  fs.writeFileSync(CONFIG.outputFile, output);

  const sizeMB = (fs.statSync(CONFIG.outputFile).size / (1024 * 1024)).toFixed(
    2
  );

  console.log(`✅ GEMINI PROMPT GENERATED: ${CONFIG.outputFile}`);
  console.log(`   Files: ${fileCount} | Lines: ~${totalLines}`);
  console.log(`   Size: ${sizeMB} MB`);

  if (totalLines > CONFIG.maxTotalLines) {
    console.warn(`⚠️  OVERFLOW: ${totalLines} lines. Might exceed 1M tokens.`);
  } else {
    console.log(`✨ Fits comfortably within Gemini 2.5 Flash context.`);
  }
};

run();
