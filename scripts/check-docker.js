// scripts/check-docker.js
// Run standalone: `node scripts/check-docker.js`
// Also called by server.js on startup to surface friendly guidance.

import { execa } from 'execa'
import os from 'os'

const platform = os.platform() // 'linux' | 'darwin' | 'win32'

async function check() {
  console.log('\n  Checking Docker...\n')

  let installed = false
  let running = false

  // 1. Is Docker installed?
  try {
    await execa('docker', ['--version'])
    installed = true
  } catch (err) {
    if (err.code !== 'ENOENT') installed = true // installed but erroring for other reasons
  }

  // 2. Is the daemon running?
  if (installed) {
    try {
      await execa('docker', ['info'])
      running = true
    } catch {}
  }

  if (installed && running) {
    console.log('  ✓ Docker is installed and running.\n')
    process.exit(0)
  }

  // Not ok — print helpful guidance
  console.log('  ✗ Docker issue detected.\n')

  if (!installed) {
    console.log('  Docker is not installed.\n')
    printInstallGuide(platform)
  } else {
    console.log('  Docker is installed but the daemon is not running.\n')
    printStartGuide(platform)
  }

  process.exit(1)
}

function printInstallGuide(platform) {
  if (platform === 'linux') {
    console.log('  Install Docker on Linux:')
    console.log('  ─────────────────────────────────────────────')
    console.log('  curl -fsSL https://get.docker.com | sh')
    console.log('  sudo usermod -aG docker $USER   # run without sudo')
    console.log('  sudo systemctl start docker')
    console.log('')
    console.log('  Docs: https://docs.docker.com/engine/install/')
  } else if (platform === 'darwin') {
    console.log('  Install Docker on macOS:')
    console.log('  ─────────────────────────────────────────────')
    console.log('  Option 1: https://www.docker.com/products/docker-desktop/')
    console.log('  Option 2: brew install --cask docker')
    console.log('  Then launch Docker Desktop from Applications.')
  } else if (platform === 'win32') {
    console.log('  Install Docker on Windows:')
    console.log('  ─────────────────────────────────────────────')
    console.log('  1. Enable WSL2: https://aka.ms/wsl2')
    console.log('  2. Install Docker Desktop: https://www.docker.com/products/docker-desktop/')
    console.log('  3. Launch Docker Desktop and wait for the whale in your taskbar.')
    console.log('')
    console.log('  Note: BYOB should be run inside WSL2, not native Windows.')
  }
  console.log('')
}

function printStartGuide(platform) {
  if (platform === 'linux') {
    console.log('  Start the Docker daemon:')
    console.log('  sudo systemctl start docker')
  } else if (platform === 'darwin') {
    console.log('  Open Docker Desktop from your Applications folder.')
    console.log('  Wait for the whale icon in your menu bar.')
  } else if (platform === 'win32') {
    console.log('  Launch Docker Desktop from the Start menu.')
    console.log('  Wait for the whale icon in your taskbar.')
  }
  console.log('')
}

check()
