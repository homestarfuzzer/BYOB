// app.js — BYOB: Break Your Own Boxes
// Vanilla JS — no framework, no build step. Reads clearly so curious users can learn.

// ── State ──────────────────────────────────────────────────────────────
let labs = []
let pullingSources = {} // id → EventSource during active pulls

// ── Boot ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkDocker()
  document.getElementById('nukeBtn').addEventListener('click', openNukeModal)
})

// ── Docker Check ────────────────────────────────────────────────────────
async function checkDocker() {
  try {
    const res = await fetch('/api/docker/check')
    const data = await res.json()

    const statusEl = document.getElementById('dockerStatus')

    if (data.ok) {
      statusEl.innerHTML = `
        <span class="status-dot status-dot--ok"></span>
        <span>Docker running</span>
      `
      hideSetupScreen()
      startPolling()
    } else {
      statusEl.innerHTML = `
        <span class="status-dot status-dot--error"></span>
        <span>${data.installed ? 'Docker not running' : 'Docker not installed'}</span>
      `
      showSetupScreen(data)
    }
  } catch {
    // Server might still be booting — retry
    setTimeout(checkDocker, 2000)
  }
}

// ── Setup Screen ────────────────────────────────────────────────────────
function showSetupScreen(data) {
  document.getElementById('loadingState').hidden = true
  document.getElementById('setupScreen').hidden = false
  document.getElementById('setupMessage').textContent = data.message

  const platform = detectPlatform()
  document.getElementById('setupSteps').innerHTML = getInstallInstructions(platform, data.installed)
}

function hideSetupScreen() {
  document.getElementById('setupScreen').hidden = true
}

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'mac'
  return 'linux'
}

function getInstallInstructions(platform, installed) {
  if (installed && platform !== 'windows') {
    return `
      <strong>Start the Docker daemon:</strong><br>
      Linux: <code>sudo systemctl start docker</code><br>
      macOS: Open <strong>Docker Desktop</strong> from Applications
    `
  }

  const guides = {
    linux: `
      <strong>Install Docker on Linux:</strong><br>
      <code>curl -fsSL https://get.docker.com | sh</code><br>
      Then: <code>sudo systemctl start docker</code><br>
      <a href="https://docs.docker.com/engine/install/" target="_blank" rel="noopener">→ Official docs</a>
    `,
    mac: `
      <strong>Install Docker Desktop for macOS:</strong><br>
      <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener">→ Download Docker Desktop</a><br>
      Or with Homebrew: <code>brew install --cask docker</code><br>
      Then launch Docker Desktop from Applications.
    `,
    windows: `
      <strong>Install Docker Desktop for Windows:</strong><br>
      Requires <strong>WSL2</strong> + <strong>Docker Desktop</strong><br>
      1. <a href="https://aka.ms/wsl2" target="_blank" rel="noopener">Enable WSL2</a><br>
      2. <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener">Download Docker Desktop</a><br>
      3. Launch Docker Desktop and wait for the whale icon.
    `
  }
  return guides[platform] || guides.linux
}

// ── Polling ─────────────────────────────────────────────────────────────
function startPolling() {
  loadLabs()
  setInterval(loadLabs, 3000)
}

async function loadLabs() {
  try {
    const res = await fetch('/api/labs')
    if (!res.ok) return
    labs = await res.json()
    renderDashboard()
    document.getElementById('loadingState').hidden = true
  } catch {
    // Silently retry on next interval
  }
}

// ── Rendering ────────────────────────────────────────────────────────────
function renderDashboard() {
  const grid = document.getElementById('labsGrid')

  const categories = ['Web', 'API', 'Network', 'CTF']
  const categoryMeta = {
    Web:     { emoji: '🌐', badgeClass: 'badge--web' },
    API:     { emoji: '⚡', badgeClass: 'badge--api' },
    Network: { emoji: '🔗', badgeClass: 'badge--network' },
    CTF:     { emoji: '🚩', badgeClass: 'badge--ctf' }
  }

  let html = ''

  for (const cat of categories) {
    const catLabs = labs.filter(l => l.category === cat)
    if (!catLabs.length) continue

    const meta = categoryMeta[cat]
    html += `
      <section class="category-section">
        <div class="category-section__header">
          <span style="font-size:1rem">${meta.emoji}</span>
          <h2 class="category-section__title">${cat}</h2>
          <div class="category-section__line"></div>
          <span class="category-section__count">${catLabs.length} lab${catLabs.length > 1 ? 's' : ''}</span>
        </div>
        <div class="category-section__grid">
          ${catLabs.map(lab => renderLabCard(lab, meta)).join('')}
        </div>
      </section>
    `
  }

  grid.innerHTML = html
}

function renderLabCard(lab, meta) {
  const isRunning = lab.status === 'running'
  const isPulling = !!pullingSources[lab.id]

  let cardClass = 'lab-card'
  if (isRunning) cardClass += ' lab-card--running'
  else if (isPulling) cardClass += ' lab-card--pulling'

  // Status indicator
  let statusDot, statusText
  if (isPulling) {
    statusDot = 'pulling'
    statusText = 'Pulling image...'
  } else if (isRunning) {
    statusDot = 'running'
    statusText = 'Running'
  } else {
    statusDot = 'stopped'
    statusText = 'Stopped'
  }

  // Size / cache line
  const sizeMeta = `
    <div class="lab-card__meta">
      ${lab.imageSize ? `<span>📦 ${lab.imageSize}</span>` : ''}
      ${lab.cached ? `<span class="cached-chip">✓ cached</span>` : ''}
    </div>
  `

  // Controls section — changes based on state
  let controls = ''

  if (isPulling) {
    controls = `
      <div class="lab-card__pull">
        <div class="lab-card__pull-fill"></div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-dim)" id="pull-status-${lab.id}">
        Downloading layers...
      </div>
    `
  } else if (isRunning) {
    // Network lab (no URL — show IP block)
    if (lab.networkMode === 'isolated' && lab.id !== 'attackbox') {
      controls = renderNetworkControls(lab)
    } else if (lab.url) {
      // Web/API lab — show link + stop
      controls = `
        <div class="lab-card__running-info">
          <div class="lab-card__url-row">
            <a href="${lab.url}" target="_blank" rel="noopener" class="lab-card__url">
              ↗ ${lab.url}
            </a>
            <div class="lab-card__controls">
              <button class="btn btn--stop" onclick="stopLab('${lab.id}')">■ Stop</button>
            </div>
          </div>
          <div class="lab-card__hint">Container removed on stop · image stays cached</div>
        </div>
      `
    } else {
      // attackbox running — just show stop
      controls = `
        <div class="lab-card__running-info">
          <div class="lab-card__url-row">
            <a href="http://localhost:7681" target="_blank" rel="noopener" class="btn btn--link">
              ↗ Open Terminal
            </a>
            <button class="btn btn--stop" onclick="stopLab('${lab.id}')">■ Stop</button>
          </div>
          <div class="lab-card__hint">Browser terminal · type <code style="font-size:0.7rem;color:var(--green)">nmap target</code> to start</div>
        </div>
      `
    }
  } else {
    // Stopped
    const isAttackBox = lab.id === 'attackbox'
    const metaPartner = labs.find(l => l.id === lab.pairedWith)
    const partnerRunning = metaPartner?.status === 'running'

    let startDisabled = false
    let startTitle = ''

    if (isAttackBox && !partnerRunning) {
      startDisabled = true
      startTitle = 'Start Metasploitable 2 first'
    }

    controls = `
      <button
        class="btn btn--start${startDisabled ? ' btn--disabled' : ''}"
        onclick="startLab('${lab.id}')"
        ${startDisabled ? 'disabled' : ''}
        title="${startTitle}"
      >
        ▶ ${lab.buildLocal && !lab.cached ? 'Build & Start' : 'Start'}
      </button>
    `
  }

  // Resource links
  const resources = lab.resources?.length ? `
    <div class="lab-card__resources">
      ${lab.resources.map(r => `
        <a href="${r.url}" target="_blank" rel="noopener" class="resource-link">
          ↗ ${r.label}
        </a>
      `).join('')}
    </div>
  ` : ''

  return `
    <div class="${cardClass}" id="card-${lab.id}">
      <div class="lab-card__header">
        <div class="lab-card__name">${lab.name}</div>
        <div class="lab-card__badges">
          <span class="badge ${meta.badgeClass}">${lab.category}</span>
          <span class="badge badge--difficulty">${lab.difficulty}</span>
        </div>
      </div>

      <p class="lab-card__desc">${lab.description}</p>

      <div class="lab-card__tags">
        ${lab.tags.map(t => `<span class="tag">${t}</span>`).join('')}
      </div>

      ${sizeMeta}

      <div class="lab-card__status lab-card__status--${statusDot}">
        <span class="pulse-dot pulse-dot--${statusDot}"></span>
        <span>${statusText}</span>
      </div>

      ${controls}
      ${resources}
    </div>
  `
}

function renderNetworkControls(lab) {
  const ip = lab.ip

  const attackBox = labs.find(l => l.id === 'attackbox')
  const attackRunning = attackBox?.status === 'running'

  return `
    <div class="lab-card__ip-block">
      <div class="lab-card__ip-label">Target IP · ${NETWORK_NAME || 'cyberlab-net'}</div>
      <div class="lab-card__ip-row">
        <span class="lab-card__ip-value ${ip ? '' : 'lab-card__ip-value--loading'}">
          ${ip || 'Assigning...'}
        </span>
        ${ip ? `
          <button class="btn btn--copy" id="copy-btn-${lab.id}" onclick="copyIP('${ip}', '${lab.id}')">
            Copy IP
          </button>
        ` : ''}
      </div>
      <div class="lab-card__network-badge">🔒 Isolated · safe from your LAN</div>
    </div>
    <div class="lab-card__controls" style="display:flex;gap:0.5rem;flex-wrap:wrap">
      <button class="btn btn--stop" onclick="stopLab('${lab.id}')">■ Stop</button>
      ${!attackRunning ? `
        <button class="btn btn--attack" onclick="startLab('attackbox')" title="Start the Attack Box to hack this target">
          ⚔ Launch Attack Box
        </button>
      ` : `
        <button class="btn btn--stop" onclick="stopLab('attackbox')">■ Stop Attack Box</button>
      `}
    </div>
    <div class="lab-card__hint">Container removed on stop · image stays cached</div>
  `
}

const NETWORK_NAME = 'cyberlab-net'

// ── Actions ──────────────────────────────────────────────────────────────
async function startLab(id) {
  const lab = labs.find(l => l.id === id)
  if (!lab) return

  // If image not cached, pull first with SSE progress
  if (!lab.cached) {
    await pullImage(lab)
    // After pull, check if we should bail (pull failed)
    if (!labs.find(l => l.id === id)?.cached) {
      await loadLabs() // refresh to get updated cached state
    }
  }

  // Start the container
  try {
    const res = await fetch(`/api/labs/${id}/start`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      toast(data.error || 'Could not start lab', 'error')
    } else {
      toast(`${lab.name} started`, 'success')
      await loadLabs()

      // Auto-open the URL if there is one (short delay for container to boot)
      if (lab.url) {
        setTimeout(() => window.open(lab.url, '_blank'), 1500)
      } else if (id === 'attackbox') {
        setTimeout(() => window.open('http://localhost:7681', '_blank'), 2000)
      }
    }
  } catch {
    toast('Could not start lab — is Docker running?', 'error')
  }
}

async function stopLab(id) {
  const lab = labs.find(l => l.id === id)
  if (!lab) return

  try {
    const res = await fetch(`/api/labs/${id}/stop`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      toast(data.error || 'Could not stop lab', 'error')
    } else {
      toast(`${lab.name} stopped · image cached`, 'info')
      await loadLabs()
    }
  } catch {
    toast('Stop failed — try again', 'error')
  }
}

// ── Pull Progress via SSE ─────────────────────────────────────────────────
function pullImage(lab) {
  return new Promise((resolve) => {
    // Show pull modal
    document.getElementById('pullModalTitle').textContent = `Pulling ${lab.name}...`
    document.getElementById('pullModalIcon').textContent = '⬇'
    document.getElementById('pullLog').innerHTML = ''
    document.getElementById('pullModal').hidden = false

    const logEl = document.getElementById('pullLog')

    const source = new EventSource(`/api/labs/${lab.id}/pull-progress`)
    pullingSources[lab.id] = source

    source.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.line) {
        const line = document.createElement('div')
        line.className = 'log-line'
        line.textContent = data.line
        logEl.appendChild(line)
        logEl.scrollTop = logEl.scrollHeight
      }

      if (data.done) {
        source.close()
        delete pullingSources[lab.id]
        document.getElementById('pullModal').hidden = true

        // Mark as cached optimistically before next poll
        lab.cached = true
        resolve()
      }

      if (data.error) {
        source.close()
        delete pullingSources[lab.id]
        document.getElementById('pullModal').hidden = true

        const line = document.createElement('div')
        line.className = 'log-line log-line--error'
        line.textContent = data.error
        logEl.appendChild(line)

        toast(data.error, 'error')
        resolve()
      }
    }

    source.onerror = () => {
      source.close()
      delete pullingSources[lab.id]
      document.getElementById('pullModal').hidden = true
      toast('Pull failed — check your connection and try again', 'error')
      resolve()
    }
  })
}

// ── Copy IP ───────────────────────────────────────────────────────────────
async function copyIP(ip, labId) {
  try {
    await navigator.clipboard.writeText(ip)
    const btn = document.getElementById(`copy-btn-${labId}`)
    if (btn) {
      btn.textContent = 'Copied! ✓'
      btn.classList.add('btn--copy--success')
      setTimeout(() => {
        btn.textContent = 'Copy IP'
        btn.classList.remove('btn--copy--success')
      }, 2000)
    }
  } catch {
    toast('Copy failed — your browser may not support clipboard access', 'error')
  }
}

// ── NUKE ──────────────────────────────────────────────────────────────────
async function openNukeModal() {
  document.getElementById('nukeModal').hidden = false
  document.getElementById('nukeModalBody').innerHTML = `<div class="spinner" style="margin:0 auto"></div>`
  document.getElementById('nukeConfirmBtn').disabled = true

  try {
    const res = await fetch('/api/nuke/preview')
    const data = await res.json()

    const lines = []
    if (data.containers > 0) lines.push(`Stop ${data.containers} running container${data.containers > 1 ? 's' : ''}`)
    lines.push(`Remove ${data.images} cached image${data.images !== 1 ? 's' : ''}`)
    lines.push('Destroy cyberlab-net')

    document.getElementById('nukeModalBody').innerHTML = `
      <p>This will:</p>
      <ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>
      <br>
      <p style="font-size:0.78rem;color:var(--text-dim)">
        Images will be re-downloaded next time you start a lab.
      </p>
    `
    document.getElementById('nukeConfirmBtn').disabled = false
    document.getElementById('nukeConfirmBtn').onclick = confirmNuke
  } catch {
    document.getElementById('nukeModalBody').textContent = 'Could not get preview. Proceed anyway?'
    document.getElementById('nukeConfirmBtn').disabled = false
    document.getElementById('nukeConfirmBtn').onclick = confirmNuke
  }
}

function closeNukeModal() {
  document.getElementById('nukeModal').hidden = true
}

async function confirmNuke() {
  document.getElementById('nukeConfirmBtn').disabled = true
  document.getElementById('nukeConfirmBtn').textContent = 'Nuking...'

  try {
    const res = await fetch('/api/nuke', { method: 'POST' })
    closeNukeModal()

    if (res.ok) {
      toast('💀 Nuked. Everything gone. Fresh start.', 'success')
    } else {
      toast('Nuke incomplete — some items may remain', 'error')
    }

    await loadLabs()
  } catch {
    closeNukeModal()
    toast('Nuke failed — try again', 'error')
  }
}

// ── Toast Notifications ───────────────────────────────────────────────────
function toast(message, type = 'info') {
  const icons = { success: '✓', error: '✗', info: 'ℹ' }
  const container = document.getElementById('toastContainer')

  const el = document.createElement('div')
  el.className = `toast toast--${type}`
  el.innerHTML = `<span>${icons[type]}</span> <span>${message}</span>`

  container.appendChild(el)
  setTimeout(() => el.remove(), 4000)
}

// ── Close modal on overlay click ──────────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.id === 'nukeModal') closeNukeModal()
  if (e.target.id === 'pullModal') {} // don't close pull modal by clicking overlay
})
