# 📦 Hybrid Node/Python Core Library

> **WARNING:** This package requires a working Python 3 environment. Yes, you read that right—we're mixing Node.js and Python in 2024. Because why choose one runtime when you can have both?

This library serves as the core logic layer, bridging TypeScript interfaces with Python automation scripts. It is designed to be installed directly from Git, because npm registries are for peasants.

## 🏗 Architecture (The Hybrid Hell)

- **Frontend Interface:** TypeScript (Node.js/Electron compatible). Because JavaScript wasn't enough.
- **Backend Logic:** Python 3 + `pydantic` + `playwright` (Sidecar pattern). Because reinventing wheels is fun.
- **Communication:** `stdio` (JSON-RPC style) or Child Process execution. Because IPC is overrated.

**Why this architecture?** Because we can. And because sometimes Python libraries are just better than their Node.js counterparts. Deal with it.

## 🚀 Installation

Since this is a private Git dependency (or public, we don't judge), install it via:

```bash
npm install git+ssh://git@github.com:YOUR_ORG/YOUR_REPO.git
```

The package will **automatically** attempt to set up the Python environment via the `postinstall` script. If it fails (because Python isn't installed, or you're on a restricted system, or the stars aren't aligned), you can manually trigger the setup:

```bash
node node_modules/@your-scope/your-package/scripts/install.js
```

Or if you're developing locally:

```bash
npm run setup:python
```

**What does it do?**

1. Checks if Python 3.10+ is available in your PATH (because we're not psychic).
2. Creates a `venv` in the project root (because global Python packages are chaos).
3. Installs dependencies from `requirements.txt` (if it exists and isn't empty).

## 🛠 Usage

```TypeScript
import { PythonBridge } from '@your-scope/your-package';

const bridge = new PythonBridge();

async function run() {
  try {
    const result = await bridge.execute('some_script.py', { arg: 'value' });
    console.log('Python says:', result);
  } catch (error) {
    console.error('Bridge collapse:', error);
  }
}
```

## 🐍 Requirements

- **Node.js:** v18+ (because we use modern features and don't care about legacy)
- **Python:** v3.10+ (Must be in PATH, because we're not going to hunt for it)
- **OS:** Windows, macOS, Linux (we support all platforms, but Windows users get extra sympathy)

## 🤝 Contribution

1. Clone the repo.
2. Run `npm install` (installs JS deps and triggers Python setup).
3. If Python setup fails, run `npm run setup:python` manually.
4. **Don't commit `venv` or `__pycache__`.** Seriously. Don't.

## ⚠️ Known Issues

- If Python isn't in PATH, the installation will fail. This is by design—we're not going to search your entire filesystem.
- Windows users: Make sure `python` (not just `py`) is in your PATH, or the script will cry.
- The venv is created in the project root. If you don't like it, modify `scripts/install.js` (but you probably won't).
