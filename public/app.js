// app.js — BYOB: Break Your Own Boxes
// Vanilla JS — no framework, no build step.

// ── State ──────────────────────────────────────────────────────────────
let labs = []
let pullingSources = {}
let currentSort = 'difficulty'

// Difficulty order for sorting
const DIFFICULTY_ORDER = {
  'Beginner':                0,
  'Beginner – Intermediate': 1,
  'Beginner–Intermediate':   1,
  'Intermediate':            2,
  'Intermediate – Advanced': 3,
  'Beginner – Advanced':     3,
  'Advanced':                4,
  'Platform':                5,
  'Tool':                    5,
}

const NETWORK_NAME = 'cyberlab-net'

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
      Or with Homebrew: <code>brew install --cask docker</code>
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
    document.getElementById('sortBar').hidden = false
    document.getElementById('loadingState').hidden = true
    renderDashboard()
  } catch {}
}

// ── Sort ────────────────────────────────────────────────────────────────
function setSort(type) {
  currentSort = type
  document.querySelectorAll('.sort-btn').forEach(b => {
    b.classList.toggle('sort-btn--active', b.dataset.sort === type)
  })
  renderDashboard()
}

function sortedLabs(labList) {
  return [...labList].sort((a, b) => {
    if (currentSort === 'difficulty') {
      const da = DIFFICULTY_ORDER[a.difficulty] ?? 3
      const db = DIFFICULTY_ORDER[b.difficulty] ?? 3
      return da !== db ? da - db : a.name.localeCompare(b.name)
    }
    if (currentSort === 'alpha') return a.name.localeCompare(b.name)
    if (currentSort === 'size') {
      const sa = parseFloat((a.imageSize || '0').replace(/[^0-9.]/g, '')) || 0
      const sb = parseFloat((b.imageSize || '0').replace(/[^0-9.]/g, '')) || 0
      return sa - sb
    }
    return 0
  })
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
    const sorted = sortedLabs(catLabs)

    // Network category: split labs vs tools (attackbox is a tool, not a lab)
    let countLabel
    if (cat === 'Network') {
      const labCount = catLabs.filter(l => l.id !== 'attackbox').length
      const toolCount = catLabs.filter(l => l.id === 'attackbox').length
      const parts = []
      if (labCount) parts.push(`${labCount} Lab${labCount > 1 ? 's' : ''}`)
      if (toolCount) parts.push(`${toolCount} Tool${toolCount > 1 ? 's' : ''}`)
      countLabel = parts.join(' · ')
    } else {
      countLabel = `${catLabs.length} Lab${catLabs.length > 1 ? 's' : ''}`
    }

    // Check if this section is collapsed
    const isCollapsed = localStorage.getItem(`byob-collapsed-${cat}`) === 'true'

    html += `
      <section class="category-section" id="section-${cat}">
        <div class="category-section__header" onclick="toggleSection('${cat}')">
          <span style="font-size:1rem">${meta.emoji}</span>
          <h2 class="category-section__title">${cat}</h2>
          <div class="category-section__line"></div>
          <span class="category-section__count">${countLabel}</span>
          <span class="category-section__chevron ${isCollapsed ? 'category-section__chevron--collapsed' : ''}">▾</span>
        </div>
        <div class="category-section__grid ${isCollapsed ? 'category-section__grid--collapsed' : ''}" id="grid-${cat}">
          ${sorted.map(lab => renderLabCard(lab, meta)).join('')}
        </div>
      </section>
    `
  }

  grid.innerHTML = html
}

// ── Collapsible sections ─────────────────────────────────────────────────
function toggleSection(cat) {
  const grid = document.getElementById(`grid-${cat}`)
  const chevron = document.querySelector(`#section-${cat} .category-section__chevron`)
  const isCollapsed = grid.classList.toggle('category-section__grid--collapsed')
  chevron.classList.toggle('category-section__chevron--collapsed', isCollapsed)
  localStorage.setItem(`byob-collapsed-${cat}`, isCollapsed)
}

// ── Lab Card ─────────────────────────────────────────────────────────────
function renderLabCard(lab, meta) {
  const isRunning = lab.status === 'running'
  const isPulling = !!pullingSources[lab.id]

  let cardClass = 'lab-card'
  if (isRunning) cardClass += ' lab-card--running'
  else if (isPulling) cardClass += ' lab-card--pulling'

  let statusDot, statusText
  if (isPulling)       { statusDot = 'pulling'; statusText = 'Pulling image...' }
  else if (isRunning)  { statusDot = 'running'; statusText = 'Running' }
  else                 { statusDot = 'stopped'; statusText = 'Stopped' }

  const sizeMeta = `
    <div class="lab-card__meta">
      ${lab.imageSize ? `<span>📦 ${lab.imageSize}</span>` : ''}
      ${lab.cached ? `<span class="cached-chip">✓ cached</span>` : ''}
    </div>
  `

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
    if (lab.networkMode === 'isolated' && lab.id !== 'attackbox') {
      controls = renderNetworkControls(lab)
    } else if (lab.url) {
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
    const isAttackBox = lab.id === 'attackbox'
    const metaPartner = labs.find(l => l.id === lab.pairedWith)
    const partnerRunning = metaPartner?.status === 'running'
    const startDisabled = isAttackBox && !partnerRunning
    const startTitle = startDisabled ? 'Start Metasploitable 2 first' : ''

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

  const resources = lab.resources?.length ? `
    <div class="lab-card__resources">
      ${lab.resources.map(r => `
        <a href="${r.url}" target="_blank" rel="noopener" class="resource-link">↗ ${r.label}</a>
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
      <div class="lab-card__ip-label">Target IP · ${NETWORK_NAME}</div>
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
        <button class="btn btn--attack" onclick="startLab('attackbox')">
          ⚔ Launch Attack Box
        </button>
      ` : `
        <button class="btn btn--stop" onclick="stopLab('attackbox')">■ Stop Attack Box</button>
      `}
    </div>
    <div class="lab-card__hint">Container removed on stop · image stays cached</div>
  `
}

// ── Actions ──────────────────────────────────────────────────────────────
async function startLab(id) {
  const lab = labs.find(l => l.id === id)
  if (!lab) return

  if (!lab.cached) {
    await pullImage(lab)
    await loadLabs()
  }

  try {
    const res = await fetch(`/api/labs/${id}/start`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      toast(data.error || 'Could not start lab', 'error')
    } else {
      toast(`${lab.name} started`, 'success')
      await loadLabs()
      if (lab.url) setTimeout(() => window.open(lab.url, '_blank'), 1500)
      else if (id === 'attackbox') setTimeout(() => window.open('http://localhost:7681', '_blank'), 2000)
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

    if (!res.ok) toast(data.error || 'Could not stop lab', 'error')
    else {
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
        document.getElementById('pullModal').hidden = false
        lab.cached = true
        resolve()
      }
      if (data.error) {
        source.close()
        delete pullingSources[lab.id]
        document.getElementById('pullModal').hidden = true
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
    toast('Copy failed — browser may not support clipboard access', 'error')
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
      await loadLabs()
      // Show post-nuke shutdown options
      document.getElementById('shutdownModal').hidden = false
    } else {
      toast('Nuke incomplete — some items may remain', 'error')
    }
  } catch {
    closeNukeModal()
    toast('Nuke failed — try again', 'error')
  }
}

// ── Post-NUKE Shutdown ────────────────────────────────────────────────────
function closeShutdownModal() {
  document.getElementById('shutdownModal').hidden = true
  toast('💀 Nuked. Everything gone. Fresh start.', 'success')
}

async function shutdownEverything() {
  document.getElementById('shutdownModal').hidden = true
  toast('Shutting down BYOB and Docker...', 'info')

  try {
    // Tell the server to shut down Docker and exit
    await fetch('/api/shutdown', { method: 'POST' })
  } catch {
    // Expected — server is shutting down so the fetch will fail
  }

  // Show a clean goodbye screen and close the tab
  document.body.innerHTML = `
    <div style="
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;background:var(--bg);color:var(--text-muted);gap:1rem;font-family:var(--font)
    ">
      <div style="font-size:3rem">💀</div>
      <div style="font-size:1.2rem;color:var(--text)">Session ended.</div>
      <div style="font-size:0.85rem">Docker stopped. BYOB closed. Nothing left behind.</div>
      <div style="font-size:0.75rem;color:var(--text-dim);margin-top:0.5rem">You can close this tab.</div>
    </div>
  `

  // Attempt to close the tab (works if BYOB opened it)
  setTimeout(() => window.close(), 2000)
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

// ── Close modals on overlay click ─────────────────────────────────────────
document.addEventListener('click', e => {
  if (e.target.id === 'nukeModal') closeNukeModal()
})
