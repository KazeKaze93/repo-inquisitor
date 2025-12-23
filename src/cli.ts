#!/usr/bin/env node
import path from "path";
import { fork } from "child_process";
import { PythonBridge } from "./bridge";

type CommandType = "python" | "node";

interface CommandDef {
  type: CommandType;
  file: string; // Relative to package root
  description: string;
}

const COMMANDS: Record<string, CommandDef> = {
  analyze: {
    type: "python",
    file: "python_src/analyzer.py",
    description: "Analyze file statistics and types (Python)",
  },
  police: {
    type: "python",
    file: "python_src/police.py",
    description: "Scan for forbidden patterns & styles (Python)",
  },
  audit: {
    type: "node",
    file: "src/analysis/anti_abstractor.cjs",
    description: "Find dead code and over-abstractions (Node)",
  },
  detox: {
    type: "node",
    file: "src/analysis/dependency_detox.cjs",
    description: "Analyze and clean unused dependencies (Node)",
  },
  viz: {
    type: "node",
    file: "src/viz/server.cjs",
    description: "Start interactive dependency visualizer (Node)",
  },
};

function printHelp() {
  console.log(`
🕵️  \x1b[1mREPO INQUISITOR\x1b[0m - The Hybrid Audit Tool

\x1b[33mUsage:\x1b[0m
  inquisitor <command> [arguments]

\x1b[33mCommands:\x1b[0m`);

  const maxLen = Math.max(...Object.keys(COMMANDS).map((k) => k.length));

  for (const [name, def] of Object.entries(COMMANDS)) {
    const paddedName = name.padEnd(maxLen + 2);
    const icon = def.type === "python" ? "🐍" : "🟢";
    console.log(`  ${paddedName} ${icon} ${def.description}`);
  }

  console.log(`
\x1b[33mExamples:\x1b[0m
  inquisitor analyze ./src
  inquisitor police ./components
  inquisitor viz
`);
}

async function main() {
  const args = process.argv.slice(2);
  const commandName = args[0];

  if (!commandName || args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  const command = COMMANDS[commandName];
  if (!command) {
    console.error(`❌ Unknown command: "${commandName}"`);
    console.error(`Run "inquisitor --help" to see available commands.`);
    process.exit(1);
  }

  const scriptArgs = args.slice(1);
  const projectRoot = path.resolve(__dirname, ".."); // Up from dist/ to root

  console.log(
    `🚀 Executing \x1b[36m${commandName}\x1b[0m [${command.type}]...`
  );

  if (command.type === "python") {
    const bridge = new PythonBridge();
    const scriptPath = path.join(projectRoot, command.file);

    try {
      const result = await bridge.executeScript(scriptPath, scriptArgs);

      if (result.logs && result.logs.length > 0) {
        console.log("\n--- Logs ---");
        result.logs.forEach((l) => console.log(l));
      }

      if (result.success) {
        if (result.data) {
          console.log("\n--- Result ---");
          console.log(JSON.stringify(result.data, null, 2));
        }
      } else {
        console.error("\n💥 Python Error:");
        console.error(result.error);
        process.exit(1);
      }
    } catch (err) {
      console.error("💀 Bridge Crash:", err);
      process.exit(1);
    }
  } else {
    const scriptPath = path.join(projectRoot, command.file);

    // Forking allows the script to have its own process.argv and isolation
    const child = fork(scriptPath, scriptArgs, {
      stdio: "inherit",
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    child.on("exit", (code) => {
      process.exit(code ?? 0);
    });
  }
}

main();
