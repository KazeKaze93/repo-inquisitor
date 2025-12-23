## 📦 Repo Inquisitor

> **Hybrid Node + Python toolkit for repository analysis and code quality.**  
> TypeScript on the outside, Python on the inside.

`@kazekaze93/repo-inquisitor` is a comprehensive audit and analysis toolkit that:

- **Bridges Node ↔ Python** via a thin `child_process` wrapper (`PythonBridge`).
- **Bootstraps a Python venv** on install (`scripts/install.js` + `requirements.txt`).
- Exposes a **CLI entrypoint** `inquisitor` with multiple analysis commands.
- Provides **code analysis tools** (dead code detection, dependency cleanup, style checking).
- Includes **AI-powered code review** using Gemini API.
- Features **dependency visualization** and **context packing** for AI models.

The goal is to keep the integration minimal and explicit, not to build Yet Another Framework™.

## 🏗 Architecture

- **Node side:** TypeScript, compiled to `dist/`. Public surface is in `src/index.ts`.
- **Python side:** Plain Python scripts in `python_src/` (and subpackages), executed as child processes.
- **Bridge:** `PythonBridge` looks for a local `venv` first, then falls back to `python`/`python3` in `PATH`.
- **CLI:** `bin.inquisitor -> dist/cli.js` → resolves a command → picks a Python script → runs it via the bridge.

No hidden daemons, no sockets, just `spawn(python, script.py, args...)` and a bit of JSON parsing.

## 🚀 Installation

Install from npm (or from Git if you prefer):

```bash
npm install @kazekaze93/repo-inquisitor
# or
npm install git+ssh://git@github.com:YOUR_ORG/repo-inquisitor.git
```

On install, the `postinstall` hook will **try to set up Python** via `scripts/install.js`.  
If that fails (no Python, corporate laptop, etc.), you can run it manually:

```bash
npm run setup:python
```

The setup script will:

1. Check that Python 3 is available in `PATH`.
2. Create a `venv` in the project root.
3. Install dependencies from `requirements.txt` (if/when you add them).

## 🛠 Usage (as a library)

```ts
import { PythonBridge } from "@kazekaze93/repo-inquisitor";

const bridge = new PythonBridge();

async function run() {
  const result = await bridge.executeScript("/absolute/path/to/script.py", [
    "arg1",
    "arg2",
  ]);

  if (result.success) {
    console.log("Python data:", result.data);
  } else {
    console.error("Python error:", result.error);
  }
}

run().catch((err) => {
  console.error("Bridge failure:", err);
});
```

The bridge assumes that the Python script:

- Prints **logs** as normal stdout lines.
- Prints **JSON on the last line** (parsed into `result.data`).

## 🧰 Usage (CLI)

After installing, you get an `inquisitor` binary on your `PATH`:

```bash
npx inquisitor <command> [...args]
```

### Available Commands

#### 🐍 Python Tools

- **`analyze`** - Analyze file statistics and types (Python)

  ```bash
  inquisitor analyze ./src
  ```

- **`police`** - Scan for forbidden patterns & styles (Python)

  ```bash
  inquisitor police ./src
  ```

- **`review`** - AI Code Reviewer using Gemini + GitHub (Python)
  ```bash
  # Requires GEMINI_API_KEY and GITHUB_TOKEN environment variables
  inquisitor review
  ```

#### 🟢 Node Tools

- **`audit`** - Find dead code and over-abstractions (Node)

  ```bash
  inquisitor audit
  ```

- **`detox`** - Analyze and clean unused dependencies (Node)

  ```bash
  inquisitor detox
  ```

- **`viz`** - Start interactive dependency visualizer (Node)

  ```bash
  inquisitor viz
  ```

- **`ctx`** - Pack full project context for Gemini 2.5 (Node)
  ```bash
  inquisitor ctx:pack
  ```

Run `inquisitor --help` to see all available commands with descriptions.

## 🐍 Requirements

- **Node.js:** v18+
- **Python:** 3.10+ recommended, available in `PATH` as `python` (Windows) or `python3` (Unix).
- **OS:** Works on Windows, macOS, and Linux.

## 🤝 Development

1. Clone the repo.
2. Run `npm install` (installs TS deps and runs Python setup).
3. If Python setup fails, run `npm run setup:python` manually.
4. Build TypeScript:

   ```bash
   npm run build
   ```

5. **Do not commit** `venv/` or `__pycache__/`.

## 📁 Project Structure

```
repo-inquisitor/
├── src/              # TypeScript source
│   ├── cli.ts        # CLI entrypoint and command registry
│   ├── bridge.ts     # PythonBridge implementation
│   ├── ai/           # AI context packing utilities
│   ├── analysis/     # Node.js analysis tools (audit, detox)
│   └── viz/          # Dependency visualization server
├── python_src/       # Python scripts
│   ├── analyzer.py   # File statistics analyzer
│   ├── police.py     # Pattern/style scanner
│   └── reviewer/     # AI code reviewer
├── bin/              # Binary symlinks (inq-audit, inq-detox, etc.)
└── dist/             # Compiled TypeScript output
```

## ⚠️ Notes & Limitations

- If Python is not in `PATH`, the install/setup scripts will fail fast on purpose.
- The `review` command requires `GEMINI_API_KEY` and `GITHUB_TOKEN` environment variables.
- Commands can be extended or modified in `src/cli.ts` by updating the `COMMANDS` registry.
- `requirements.txt` should contain only the Python dependencies you actually use.
