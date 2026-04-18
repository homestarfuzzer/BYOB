// server.js — BYOB: Break Your Own Boxes
// Express backend that wraps Docker CLI calls and serves the dashboard.
// All Docker ops use argument arrays — never string interpolation.

import express from 'express'
import { execa } from 'execa'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import open from 'open'
import { createServer } from 'http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 1337
const HOST = '127.0.0.1'
const NETWORK_NAME = 'cyberlab-net'
const NETWORK_SUBNET = '172.20.0.0/24'

// Lab definitions — source of truth is labs/labs.json
const labs = JSON.parse(readFileSync(join(__dirname, 'labs', 'labs.json'), 'utf8'))

app.use(express.json())
app.use(express.static(join(__dirname, 'public')))

// ─── Docker Helpers ────────────────────────────────────────────────────────

// Returns names of all currently running byob containers
async function getRunningContainers() {
  try {
    const { stdout } = await execa('docker', ['ps', '--format', '{{.Names}}', '--filter', 'name=byob-'])
    return stdout.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Returns all locally cached Docker image refs
async function getLocalImages() {
  try {
    const { stdout } = await execa('docker', ['images', '--format', '{{.Repository}}'])
    return stdout.split('\n').filter(Boolean)
  } catch {
    return []
  }
}

// Gets a container's IP on a specific Docker network
async function getContainerIP(containerName, network) {
  try {
    const fmt = `{{(index .NetworkSettings.Networks "${network}").IPAddress}}`
    const { stdout } = await execa('docker', ['inspect', containerName, '--format', fmt])
    return stdout.trim() || null
  } catch {
    return null
  }
}

// Creates cyberlab-net if it doesn't exist — idempotent, takes milliseconds
async function ensureNetwork() {
  try {
    await execa('docker', ['network', 'inspect', NETWORK_NAME])
  } catch {
    await execa('docker', [
      'network', 'create',
      '--driver', 'bridge',
      '--subnet', NETWORK_SUBNET,
      NETWORK_NAME
    ])
    console.log(`  ✓ Created isolated network: ${NETWORK_NAME}`)
  }
}

// Checks if a host port is already in use by a non-byob process
async function isPortInUse(port) {
  try {
    const { stdout } = await execa('docker', ['ps', '--format', '{{.Ports}}'])
    // If docker is fine, we trust docker run to surface port conflicts
    return false
  } catch {
    return false
  }
}

// ─── API Routes ────────────────────────────────────────────────────────────

// GET /api/labs — all labs with live status from docker ps
app.get('/api/labs', async (req, res) => {
  try {
    const running = await getRunningContainers()
    const cachedImages = await getLocalImages()

    const result = await Promise.all(labs.map(async lab => {
      const containerName = `byob-${lab.id}`
      const isRunning = running.includes(containerName)
      const isCached = cachedImages.some(img =>
        img === lab.image || img === lab.image.split(':')[0]
      )

      let ip = null
      if (isRunning && lab.networkMode === 'isolated') {
        ip = await getContainerIP(containerName, NETWORK_NAME)
      }

      return { ...lab, status: isRunning ? 'running' : 'stopped', cached: isCached, ip }
    }))

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Could not reach Docker — is it running?' })
  }
})

// POST /api/labs/:id/start — start a lab container (image must already be pulled)
app.post('/api/labs/:id/start', async (req, res) => {
  const lab = labs.find(l => l.id === req.params.id)
  if (!lab) return res.status(404).json({ error: 'Lab not found' })

  const containerName = `byob-${lab.id}`

  try {
    if (lab.networkMode === 'isolated') {
      await ensureNetwork()
    }

    const args = ['run', '-d', '--rm', '--name', containerName]

    if (lab.networkMode === 'isolated') {
      args.push('--network', NETWORK_NAME)
    } else {
      // Map ports to localhost only — never expose on the LAN
      for (const port of (lab.ports || [])) {
        args.push('-p', `127.0.0.1:${port.host}:${port.container}`)
      }
    }

    args.push(lab.image)

    await execa('docker', args)
    res.json({ success: true })
  } catch (err) {
    const msg = String(err.stderr || err.message || '')
    if (msg.includes('port is already allocated') || msg.includes('address already in use')) {
      const port = lab.ports?.[0]?.host
      res.status(409).json({
        error: `Port ${port} is already in use. Stop another lab using that port and try again.`
      })
    } else if (msg.includes('No such image')) {
      res.status(400).json({ error: 'Image not pulled yet — pull it first.' })
    } else if (msg.includes('already in use by container')) {
      res.status(409).json({ error: `${lab.name} is already running.` })
    } else {
      res.status(500).json({ error: `Could not start ${lab.name}. Check Docker is running.` })
    }
  }
})

// POST /api/labs/:id/stop — stop container (image stays cached for fast relaunch)
app.post('/api/labs/:id/stop', async (req, res) => {
  const lab = labs.find(l => l.id === req.params.id)
  if (!lab) return res.status(404).json({ error: 'Lab not found' })

  const containerName = `byob-${lab.id}`

  try {
    await execa('docker', ['stop', containerName])
    // --rm on the container means Docker auto-removes it after stop
    res.json({ success: true, message: `${lab.name} stopped. Container removed, image cached.` })
  } catch (err) {
    res.status(500).json({ error: `Could not stop ${lab.name} — it may have already stopped.` })
  }
})

// GET /api/labs/:id/pull-progress — SSE stream of docker pull output
// Frontend connects here, receives layer-by-layer progress, then calls /start when done
app.get('/api/labs/:id/pull-progress', async (req, res) => {
  const lab = labs.find(l => l.id === req.params.id)
  if (!lab) return res.status(404).end()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering if behind proxy

  const send = data => res.write(`data: ${JSON.stringify(data)}\n\n`)

  try {
    const pull = execa('docker', ['pull', lab.image])

    pull.stdout.on('data', chunk => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        send({ line })
      }
    })
    pull.stderr.on('data', chunk => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        send({ line })
      }
    })

    await pull
    send({ done: true })
    res.end()
  } catch (err) {
    const detail = String(err.stderr || err.message || '').trim()
    send({ error: detail || 'Pull failed — check your internet connection and try again.' })
    res.end()
  }
})

// GET /api/nuke/preview — returns what NUKE will destroy, before confirming
app.get('/api/nuke/preview', async (req, res) => {
  try {
    // Count running byob containers
    const { stdout: psOut } = await execa('docker', [
      'ps', '-q', '--filter', 'name=byob-'
    ]).catch(() => ({ stdout: '' }))
    const containers = psOut.split('\n').filter(Boolean)

    // Sum disk usage of all lab images that are locally cached
    const { stdout: imagesOut } = await execa('docker', [
      'images', '--format', '{{.Repository}}\t{{.Size}}'
    ]).catch(() => ({ stdout: '' }))

    const labImageNames = labs.map(l => l.image.split(':')[0])
    const matchedImages = imagesOut.split('\n').filter(line =>
      labImageNames.some(name => line.startsWith(name))
    )

    // Also check for local attackbox image
    const { stdout: attackboxCheck } = await execa('docker', [
      'images', '-q', 'byob-attackbox'
    ]).catch(() => ({ stdout: '' }))
    const attackboxExists = attackboxCheck.trim().length > 0

    const totalImages = matchedImages.length + (attackboxExists ? 1 : 0)

    // Get a rough disk total from docker system df
    let diskNote = 'some disk space'
    try {
      const { stdout: dfOut } = await execa('docker', ['system', 'df', '--format', '{{json .}}'])
      // Just use image count — df output varies
    } catch {}

    res.json({
      containers: containers.length,
      images: totalImages,
      diskNote
    })
  } catch {
    res.json({ containers: 0, images: 0, diskNote: 'unknown' })
  }
})

// POST /api/nuke — NUKE: stop everything, wipe all images, destroy network
app.post('/api/nuke', async (req, res) => {
  const errors = []

  // 1. Stop all byob containers
  try {
    const { stdout } = await execa('docker', ['ps', '-q', '--filter', 'name=byob-'])
    const ids = stdout.split('\n').filter(Boolean)
    for (const id of ids) {
      await execa('docker', ['stop', id]).catch(e => errors.push(e.message))
    }
  } catch {}

  // 2. Remove all lab images (no caching — this is a full wipe)
  for (const lab of labs) {
    await execa('docker', ['rmi', '-f', lab.image]).catch(() => {})
  }
  // Also remove the local attackbox build
  await execa('docker', ['rmi', '-f', 'byob-attackbox:latest']).catch(() => {})

  // 3. Destroy cyberlab-net
  await execa('docker', ['network', 'rm', NETWORK_NAME]).catch(() => {})

  if (errors.length > 0) {
    res.status(207).json({ success: true, warnings: errors })
  } else {
    res.json({ success: true })
  }
})

// GET /api/docker/check — is Docker installed and the daemon running?
app.get('/api/docker/check', async (req, res) => {
  try {
    await execa('docker', ['info'])
    res.json({ ok: true })
  } catch (err) {
    const notInstalled = err.code === 'ENOENT'
    res.json({
      ok: false,
      installed: !notInstalled,
      message: notInstalled
        ? 'Docker is not installed on this machine.'
        : 'Docker is installed but the daemon is not running.'
    })
  }
})

// GET /api/network/status — info about cyberlab-net and connected containers
app.get('/api/network/status', async (req, res) => {
  try {
    const { stdout } = await execa('docker', [
      'network', 'inspect', NETWORK_NAME,
      '--format', '{{json .Containers}}'
    ])
    const raw = JSON.parse(stdout)
    const containers = Object.values(raw).map(c => ({
      name: c.Name,
      ip: c.IPv4Address ? c.IPv4Address.split('/')[0] : null
    }))
    res.json({ exists: true, containers })
  } catch {
    res.json({ exists: false, containers: [] })
  }
})

// ─── Start Server ──────────────────────────────────────────────────────────

async function main() {
  // Pre-create cyberlab-net at startup — idempotent, near-instant
  // If Docker isn't running yet, this silently fails; /api/docker/check handles guidance
  await ensureNetwork().catch(() => {})

  app.listen(PORT, HOST, () => {
    console.log('')
    console.log('  💀 BYOB: Break Your Own Boxes')
    console.log('  ──────────────────────────────────────')
    console.log(`  Dashboard  →  http://localhost:${PORT}`)
    console.log('  Press Ctrl+C to stop\n')
    setTimeout(() => open(`http://localhost:${PORT}`), 800)
  })
}

main()

// POST /api/shutdown — gracefully stop Docker and exit the BYOB server
// Called after NUKE when user wants a full clean exit
app.post('/api/shutdown', async (req, res) => {
  res.json({ ok: true })

  // Small delay so the response makes it back to the browser
  setTimeout(async () => {
    console.log('\n  💀 BYOB shutting down...')

    // Stop the Docker daemon if we can (platform-specific)
    const platform = process.platform
    try {
      if (platform === 'linux') {
        await execa('sudo', ['systemctl', 'stop', 'docker']).catch(() => {
          // May not have sudo — try without
          execa('systemctl', ['stop', 'docker']).catch(() => {})
        })
      } else if (platform === 'darwin') {
        // Docker Desktop on Mac
        await execa('osascript', ['-e', 'quit app "Docker"']).catch(() => {})
      }
      // Windows: Docker Desktop is a GUI app — just exit BYOB and let user close it
    } catch {}

    console.log('  Goodbye.\n')
    process.exit(0)
  }, 300)
})
