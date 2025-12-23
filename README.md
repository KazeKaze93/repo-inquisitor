## 📦 Repo Inquisitor

> **Hybrid Node + Python toolkit for poking at repositories.**  
> TypeScript on the outside, Python on the inside.

`@kazekaze93/repo-inquisitor` is a small core library and CLI that:

- **Bridges Node ↔ Python** via a thin `child_process` wrapper (`PythonBridge`).
- **Bootstraps a Python venv** on install (`scripts/install.js` + `requirements.txt`).
- Exposes a **CLI entrypoint** `inquisitor` that delegates to Python scripts in `python_src`.
- Ships a few **internal helpers** (analysis/viz/reviewer/AI context tooling) used by higher-level tools.

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
  const result = await bridge.executeScript(
    "/absolute/path/to/script.py",
    ["arg1", "arg2"]
  );

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

After installing, you get a `inquisitor` binary on your `PATH`:

```bash
npx inquisitor <command> [...args]
```

Commands are mapped to Python scripts inside `python_src/` in `src/cli.ts`.  
Out of the box, the map looks like this (you’re expected to adapt it to your project):

- **analyze** → `python_src/analyzer.py` (you provide the script)
- **setup** → `python_src/setup_db.py` (you provide the script)

You can extend or change the map in `src/cli.ts` to wire new commands to your own Python entrypoints.

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

## ⚠️ Notes & Limitations

- If Python is not in `PATH`, the install/setup scripts will fail fast on purpose.
- The default CLI command mapping is intentionally minimal; treat it as a template, not a contract.
- `requirements.txt` is currently empty on purpose—add only what you actually use.
