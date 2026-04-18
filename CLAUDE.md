# CLAUDE.md — BYOB: Break Your Own Boxes

> This file is the source of truth for AI assistants and contributors working on this project.
> Read it fully before making any changes. The north star is always end-user experience.

---

## Project Overview

**BYOB (Break Your Own Boxes)** is a locally-hosted dashboard that lets students and security enthusiasts spin up intentionally vulnerable lab environments with a single click — all free, all in one place, no CLI required after setup.

It pulls Docker images on demand, runs everything locally, and leaves no trace when you're done. Built for Linux, macOS, and Windows (WSL2). Accessible from any browser.

**The pitch:** Everything a beginner needs to start hacking is scattered across the internet, behind confusing docs, and requires manual Docker commands. BYOB collapses all of that into one beautiful, fast, foolproof interface. The user should open it and feel like they have a professional hacking lab at their fingertips.

**Session model:**
```
Open BYOB → Start a lab → Click the link → Hack → Stop → Container gone, image cached for fast relaunch → NUKE when done for session → Nothing left behind
```

---

## Goals & Non-Goals

### Goals
- One-click start / stop per lab
- Real-time status with live image pull progress (not a spinner — actual layer progress)
- Individual stop: container removed, image cached for fast relaunch
- NUKE: global kill — all containers stopped, all images removed, network destroyed
- Show disk size estimates before any image is pulled
- Auto-detect Docker; guide the user through install if missing
- Cross-platform: Linux, macOS, Windows WSL2
- 100% free and open-source — no accounts, no telemetry, no phone-home

### Non-Goals
- Not a tutorial platform — BYOB launches labs, it doesn't teach them (resource links are enough)
- No user auth, no cloud, no remote hosting
- No paid integrations (TryHackMe, HackTheBox live, etc.)
- No Electron — stays a local web server
- No labs that require user setup, login, or registration after launch — every lab must be immediately usable on click

---

## UX Principles — NON-NEGOTIABLE

Every design and engineering decision must pass these. When in doubt, choose the option that makes the user feel more capable, not the one that's easier to build.

### 1. First impression is everything
When the user opens `http://localhost:1337`, they should feel like they just opened a professional tool. Mission Control aesthetic: deep navy background, panel-style cards, sharp typography, clean status indicators. This should look *good* — not like a CLI wrapper slapped in a browser.

### 2. Status is always obvious
Every lab card shows its current state with a colored indicator:
- `◎ STANDBY` — grey, subdued
- `◈ LOADING` — amber, animated pulse, shows progress bar with layer details
- `◉ OPERATIONAL` — green, glowing left border, launch button appears

Never make the user wonder if something is working.

### 3. The lab link and controls live together on the card
Once a lab is running, the card shows:
```
◉ OPERATIONAL

  http://localhost:3000          ← clickable link, opens in new tab
  [ ■ Stop ]                     ← stop button, right next to the link

  Container removed on stop · image stays cached  ← subtle helper text
```
The user never has to search for a URL. The stop button is right there.

### 4. Disk size transparency
Before a user starts a lab for the first time (image not yet cached), show the estimated download size on the card. Example:
```
📦 ~650 MB · cached after first pull
```
Users with small disks should know what they're committing to before they click Start.

### 5. Network labs show the target IP prominently
When Metasploitable 2 is running, the card shows:

```
◉ OPERATIONAL  ·  Isolated network: cyberlab-net

  Target IP:  172.20.0.5    [ Copy IP ]   ← large, prominent, one-click copy

  [ ■ Stop ]    [ ⚔ Launch Attack Box ]
```

"Copy IP" shows a brief "Copied! ✓" confirmation. The IP is the most important piece of information.

### 6. NUKE is its own thing
NUKE lives in the top navigation bar, always visible, clearly separated from individual lab controls.

```
[ NUKE ]  Stop & Wipe Everything & Clean Exit
```

- Removes all running containers
- Wipes all pulled images (shows how much disk space will be freed before confirming)
- Destroys `cyberlab-net`
- Single confirmation step — NUKE is the only action with a confirmation

### 7. Errors are friendly
No raw stderr. No stack traces. If something goes wrong:
- "Port 3000 is already in use — try stopping another lab first"
- "Docker isn't running — click here to fix that"
- "Image pull failed — check your internet connection and try again"

### 8. Fast everywhere
The dashboard itself loads instantly — no heavy frameworks, no render-blocking JS. Labs start in seconds after images are cached. Pull progress is real and visible. Nothing should feel frozen or uncertain.

---

## Architecture

```
byob/
├── CLAUDE.md                        ← you are here
├── README.md
├── package.json
├── server.js                        ← Express backend: Docker control API + SSE
├── public/
│   ├── index.html                   ← Single-page dashboard
│   ├── style.css                    ← Mission Control theme, panel layout, animations
│   └── app.js                       ← Status polling, SSE pull progress, UI logic
├── labs/
│   └── labs.json                    ← All lab definitions — edit here to add labs
├── containers/
│   └── attackbox/
│       └── Dockerfile               ← Lightweight attack container (custom Kali)
└── scripts/
    ├── check-docker.js              ← Docker detection + OS-specific install guidance
    ├── start.sh                     ← Unix: starts server, opens browser
    └── start.bat                    ← Windows: launches in WSL context
```

### Backend (`server.js`)
- **Node.js 18+** + Express
- All Docker operations via `execa` with argument arrays (never string interpolation)
- Pull progress streamed to frontend via **SSE** (Server-Sent Events) — users see layer-by-layer download progress
- State is always derived live from `docker ps` — no database, no state files
- `getContainerIP` uses `{{(index .NetworkSettings.Networks "cyberlab-net").IPAddress}}` — the index function is required because the hyphen in `cyberlab-net` breaks Go template dot notation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/labs` | All labs with live status + cached image info |
| POST | `/api/labs/:id/start` | Pull image if needed, start container |
| POST | `/api/labs/:id/stop` | Stop + remove container (image stays) |
| GET | `/api/labs/:id/pull-progress` | SSE: layer-by-layer pull progress |
| POST | `/api/nuke` | Stop all containers, remove all images, destroy network |
| GET | `/api/nuke/preview` | Returns: container count, image count, disk space to be freed |
| GET | `/api/docker/check` | Docker installed + daemon running? |
| GET | `/api/network/status` | cyberlab-net exists? IPs of connected containers? |

- Binds to `127.0.0.1:1337` only — never `0.0.0.0`
- All containers started with `--rm` — auto-removed when stopped

### Frontend (`public/`)
- **Vanilla HTML/CSS/JS** — zero build step, zero framework, zero dependencies
- Polls `/api/labs` every 3s for status updates
- Subscribes to SSE for pull progress on active downloads
- Cards grouped by category (Web Application Labs, API Security Labs, Lab Environment)
- Mission Control theme — deep navy, panel-style cards, monospace typography
- Fully responsive — works on laptop, tablet, wide monitor

### Lab Definitions (`labs/labs.json`)

**Standard lab (web/api):**
```json
{
  "id": "juice-shop",
  "name": "OWASP Juice Shop",
  "category": "Web",
  "difficulty": "Beginner – Advanced",
  "description": "The most complete insecure web app for security training. Covers the full OWASP Top 10 and over 100 scored challenges.",
  "image": "bkimminich/juice-shop",
  "imageSize": "~380 MB",
  "networkMode": "bridge",
  "ports": [{ "host": 3000, "container": 3000 }],
  "url": "http://localhost:3000",
  "tags": ["OWASP", "XSS", "SQLi", "Auth", "API"],
  "resources": [
    { "label": "Official Guide", "url": "https://pwning.owasp-juice.shop" }
  ]
}
```

**Isolated network lab:**
```json
{
  "id": "metasploitable2",
  "name": "Metasploitable 2",
  "category": "Lab Environment",
  "difficulty": "Beginner – Intermediate",
  "description": "The classic vulnerable Linux target. Over 20 exploitable services including FTP, SSH, Telnet, SMB, HTTP, and MySQL. Pair it with the Attack Box.",
  "image": "tleemcjr/metasploitable2",
  "imageSize": "~1.2 GB",
  "networkMode": "isolated",
  "network": "cyberlab-net",
  "ports": [],
  "url": null,
  "tags": ["FTP", "SSH", "Telnet", "SMB", "HTTP", "MySQL", "Metasploit"],
  "pairedWith": "attackbox",
  "resources": [
    { "label": "Rapid7 Guide", "url": "https://docs.rapid7.com/metasploit/metasploitable-2/" }
  ]
}
```

---

## Supported Labs

### Web Application
| ID | Name | Image | Host Port | Est. Size |
|----|------|-------|-----------|-----------|
| `juice-shop` | OWASP Juice Shop | `bkimminich/juice-shop` | 3000 | ~380 MB |
| `dvwa` | DVWA | `vulnerables/web-dvwa` | 8081 | ~350 MB |
| `webgoat` | WebGoat | `webgoat/webgoat` | 8080 | ~500 MB |
| `bwapp` | bWAPP | `raesene/bwapp` | 8082 | ~300 MB |
| `nodegoat` | OWASP NodeGoat | `owasp/nodegoat` | 4000 | ~250 MB |
| `dvga` | Damn Vulnerable GraphQL | `dolevf/dvga` | 5013 | ~150 MB |
| `altoro` | Altoro Mutual | `ibmcom/altoro-mutual` | 8083 | ~200 MB |

### API Security
| ID | Name | Image | Host Port | Est. Size |
|----|------|-------|-----------|-----------|
| `crapi` | crAPI | `owasp/crapi` | 8888 | ~600 MB |
| `vampi` | VAmPI | `erev0s/vampi` | 5000 | ~120 MB |
| `pixi` | Pixi (42Crunch) | `42crunch/pixi` | 8090 | ~180 MB |

### Lab Environment
| ID | Name | Est. Size | Notes |
|----|------|-----------|-------|
| `metasploitable2` | Metasploitable 2 | ~1.2 GB | Isolated on `cyberlab-net` |
| `attackbox` | Attack Box | ~900 MB | Custom Kali; pairs with Metasploitable |

> **Adding a lab = editing `labs/labs.json` only.** No code changes needed.

---

## Isolated Lab Network (`cyberlab-net`)

### Setup
Created at server startup — instantaneous, idempotent:
```bash
docker network create --driver bridge --subnet 172.20.0.0/24 cyberlab-net
```

### Why isolated?
Metasploitable 2 exposes ~20 services. Mapping them all to host ports is messy and potentially exposes them on the user's LAN. Instead, the container lives entirely on `cyberlab-net` — reachable from other containers on that network but invisible to the outside world.

### Attack Box (Lightweight Kali)
Custom `Dockerfile` at `containers/attackbox/Dockerfile`. Based on `kalilinux/kali-rolling` (base image only) with a curated toolset:

**Installed tools:** `nmap`, `metasploit-framework`, `sqlmap`, `hydra`, `nikto`, `gobuster`, `dirb`, `curl`, `wget`, `python3`, `ttyd`

**Target size: ~900 MB** (vs 4 GB+ for full Kali). Shown on card before first pull.

When running:
- `ttyd` serves a terminal on `localhost:7681`
- Dashboard opens it automatically in a new tab
- `/etc/hosts` inside container: `target` → Metasploitable 2's `cyberlab-net` IP
- User types `nmap target` immediately — no config, no IP lookup needed

---

## NUKE — Full Spec

**Location:** Top navigation bar, always visible, right side.

**Behavior:**
1. User clicks NUKE
2. Frontend calls `GET /api/nuke/preview` — gets: running container count, total image count, disk space to be freed
3. Confirmation dialog:
   ```
   ☠ Nuke BYOB?

   This will:
   · Stop 2 running containers
   · Remove 4 cached images
   · Destroy cyberlab-net

   [ Yes, nuke it ]    [ Cancel ]
   ```
4. On confirm: `POST /api/nuke` — backend stops all containers, removes all images, destroys network
5. All cards return to STANDBY state

---

## Coding Conventions

- **Node.js 18 LTS+** — minimum version, document clearly
- **No TypeScript** — plain JS with JSDoc comments; lower barrier to contribution
- **Approved dependencies:** `express`, `execa`, `open` — nothing else without discussion
- **No database** — state derived live from `docker ps`
- **No minification** — source stays readable; learners should be able to read the code
- **Error handling:** Translate all Docker errors to plain English before they reach the UI
- **Style:** 2-space indent, single quotes, no semicolons (StandardJS)
- **CSS:** Custom properties for theming, BEM class naming (`.lab-card__status--running`)
- **Comments:** Explain *why*, not *what*. Assume JS knowledge, not Docker knowledge.
- **Lab descriptions:** No em dashes. One or two sentences. Lead with what the student will *practice*, not just what the app is. No redundancy with the lab name itself.
- **Lab inclusion rule:** Only add labs that are immediately usable after clicking Start. No setup screens, no registration, no configuration required.

---

## Security Notes

> BYOB runs intentionally vulnerable software. Document this prominently.

- Server binds to `127.0.0.1` only
- Web labs: bridge network, named host ports only
- Network labs: `cyberlab-net` isolated bridge — never exposed to host LAN
- All `docker` commands use argument arrays — no shell string interpolation
- README must open with a clear security warning

---

## README Requirements

1. **Name + tagline** — "BYOB: Break Your Own Boxes — one-click vulnerable lab launcher"
2. **Security warning** — styled warning block, top of page
3. **Prerequisites** — Node 18+, Docker, WSL2 (Windows only)
4. **Quick start** — 3 commands max → opens at `http://localhost:1337`
5. **Adding a lab** — point to `labs/labs.json`, show the schema snippet
6. **Disk space note** — mention cumulative image sizes if running everything
7. **Contributing** — link `CONTRIBUTING.md`
8. **License** — MIT

---

## Out-of-Scope

Do not implement without explicit discussion:
- User accounts or auth
- Remote/cloud lab hosting
- Automatic image version updates
- Telemetry or analytics
- Paid lab integrations
- Electron packaging
- Labs requiring post-launch setup or login (e.g. CTFd-style platforms)
