#!/usr/bin/env node
/**
 * Cross-platform Python environment setup script.
 * Detects OS, checks Python availability, creates venv, and installs dependencies.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const IS_WINDOWS = os.platform() === 'win32';
const PYTHON_CMD = IS_WINDOWS ? 'python' : 'python3';
const VENV_DIR = path.join(__dirname, '..', 'venv');
const VENV_PYTHON = IS_WINDOWS 
  ? path.join(VENV_DIR, 'Scripts', 'python.exe')
  : path.join(VENV_DIR, 'bin', 'python');
const REQUIREMENTS = path.join(__dirname, '..', 'requirements.txt');

/**
 * Check if Python is available in PATH.
 * @returns {Promise<boolean>}
 */
function checkPython() {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_CMD, ['--version'], {
      stdio: 'pipe',
      shell: IS_WINDOWS
    });

    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Found Python: ${output.trim()}`);
        resolve(true);
      } else {
        console.error(`✗ Python not found. Please install Python 3.10+ and ensure it's in PATH.`);
        resolve(false);
      }
    });

    proc.on('error', () => {
      console.error(`✗ Failed to execute '${PYTHON_CMD}'. Is Python installed?`);
      resolve(false);
    });
  });
}

/**
 * Create virtual environment.
 * @returns {Promise<boolean>}
 */
function createVenv() {
  return new Promise((resolve) => {
    if (fs.existsSync(VENV_DIR)) {
      console.log(`✓ Virtual environment already exists at ${VENV_DIR}`);
      resolve(true);
      return;
    }

    console.log(`Creating virtual environment at ${VENV_DIR}...`);
    const proc = spawn(PYTHON_CMD, ['-m', 'venv', VENV_DIR], {
      stdio: 'inherit',
      shell: IS_WINDOWS
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Virtual environment created`);
        resolve(true);
      } else {
        console.error(`✗ Failed to create virtual environment (exit code: ${code})`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      console.error(`✗ Failed to spawn venv creation: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Install Python dependencies from requirements.txt.
 * @returns {Promise<boolean>}
 */
function installDependencies() {
  return new Promise((resolve) => {
    if (!fs.existsSync(REQUIREMENTS)) {
      console.log(`⚠ requirements.txt not found, skipping dependency installation.`);
      resolve(true);
      return;
    }

    const requirementsContent = fs.readFileSync(REQUIREMENTS, 'utf8').trim();
    if (!requirementsContent) {
      console.log(`⚠ requirements.txt is empty, skipping dependency installation.`);
      resolve(true);
      return;
    }

    if (!fs.existsSync(VENV_PYTHON)) {
      console.error(`✗ Virtual environment Python not found at ${VENV_PYTHON}`);
      resolve(false);
      return;
    }

    console.log(`Installing Python dependencies from ${REQUIREMENTS}...`);
    const proc = spawn(VENV_PYTHON, ['-m', 'pip', 'install', '-r', REQUIREMENTS], {
      stdio: 'inherit',
      shell: IS_WINDOWS,
      cwd: path.join(__dirname, '..')
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✓ Python dependencies installed`);
        resolve(true);
      } else {
        console.error(`✗ Failed to install dependencies (exit code: ${code})`);
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      console.error(`✗ Failed to spawn pip install: ${err.message}`);
      resolve(false);
    });
  });
}

/**
 * Main installation flow.
 */
async function main() {
  console.log('🔧 Setting up Python environment...\n');

  if (!(await checkPython())) {
    process.exit(1);
  }

  if (!(await createVenv())) {
    process.exit(1);
  }

  if (!(await installDependencies())) {
    process.exit(1);
  }

  console.log('\n✓ Python environment setup complete!');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { checkPython, createVenv, installDependencies };






