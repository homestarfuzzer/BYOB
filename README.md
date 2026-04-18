# BYOB: Break Your Own Boxes

#### *A one-click vulnerable lab launcher. No CLI required. No accounts. No cloud. Just hacking.*

---

> [!WARNING]
> **Security Warning:** BYOB runs intentionally vulnerable applications on your machine.
> These labs contain real exploits and weaknesses by design.
> **Run BYOB on a trusted network only. Never expose these labs to the internet.**

---

## What is BYOB?

BYOB is a locally hosted dashboard that lets you spin up intentionally vulnerable apps with a single click. Everything a beginner needs to practice web hacking, API security, and network pentesting — all in one place, running locally, completely free.

**Session model:** Start a lab → hack it → stop it (container removed, image cached for fast relaunch) → NUKE when done (everything wiped, nothing left behind).

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 18 LTS or higher | [nodejs.org](https://nodejs.org) |
| **Docker** | Latest | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **WSL2** | — | Windows only |

If Docker is not installed, BYOB will detect it and show you the right install steps for your OS.

---

## Quick Start

```bash
git clone https://github.com/homestarfuzzer/BYOB.git
cd BYOB
npm install && npm start
```

Open **http://localhost:1337** in your browser. That's it.

**Windows users:** Run inside WSL2, or double-click `scripts/start.bat`.

---

## What's Included

### Web Application Labs
| Lab | Skills | Size |
|-----|--------|------|
| OWASP Juice Shop | OWASP Top 10, XSS, SQLi, Auth, API | ~380 MB |
| DVWA | SQLi, XSS, File Inclusion, Command Injection | ~350 MB |
| WebGoat | Guided lessons, XXE, Deserialization, JWT | ~500 MB |
| bWAPP | SSRF, IDOR, Clickjacking, 100+ vulns | ~300 MB |
| OWASP NodeGoat | Node.js stack, Prototype Pollution | ~250 MB |
| Damn Vulnerable GraphQL | GraphQL introspection, injection, batching | ~150 MB |
| Altoro Mutual | Realistic banking app, SQLi, XSS | ~200 MB |

### API Security Labs
| Lab | Skills | Size |
|-----|--------|------|
| crAPI | OWASP API Top 10, BOLA, BFLA | ~600 MB |
| VAmPI | REST API, Mass Assignment, OpenAPI | ~120 MB |
| Pixi | API Auth bypass, BOLA | ~180 MB |

### Lab Environment
| Lab | Skills | Size |
|-----|--------|------|
| Metasploitable 2 | Multi-service exploitation, Metasploit | ~1.2 GB |
| Attack Box | Pre-built Kali attack toolkit (see below) | ~900 MB |

> **Disk note:** Running everything at once is roughly 5 GB. Images are downloaded once and cached.
> NUKE wipes all images and frees that space instantly.

---

## The Metasploitable 2 + Attack Box Pair

These two labs work together on an **isolated Docker network** (`cyberlab-net`):

- **Metasploitable 2** — the target. Over 20 exploitable services (FTP, SSH, Telnet, HTTP, MySQL, and more).
- **Attack Box** — a lightweight Kali container (~900 MB) with: `nmap`, `metasploit`, `sqlmap`, `hydra`, `nikto`, `gobuster`, and a browser-based terminal.

Start Metasploitable 2 → dashboard shows the target IP → click **Launch Attack Box** → browser terminal opens → type `nmap target` and go.

Everything is isolated from your real LAN. Safe to run anywhere.

---

## Adding a Lab

Edit `labs/labs.json`. No code changes needed.

```json
{
  "id": "my-lab",
  "name": "My Vulnerable App",
  "category": "Web",
  "difficulty": "Beginner",
  "description": "What this lab teaches.",
  "image": "docker/image:tag",
  "imageSize": "~200 MB",
  "networkMode": "bridge",
  "ports": [{ "host": 9000, "container": 9000 }],
  "url": "http://localhost:9000",
  "tags": ["XSS", "SQLi"],
  "resources": [
    { "label": "Docs", "url": "https://example.com" }
  ]
}
```

Restart BYOB and your lab appears in the dashboard.

---

## How It Works

```
Browser  ────→ Vanilla HTML/CSS/JS (no framework)
   │
   │  REST + SSE
   ▼
Node.js (localhost:1337)
   │
   │  docker CLI (execa, argument arrays only)
   ▼
Docker Engine
   ├── Web labs   → bridge network, localhost ports
   └── Net labs  → cyberlab-net (isolated bridge, 172.20.0.0/24)
```

No database. State is derived live from `docker ps`. Container logs do not persist. When you stop a lab, the container is gone.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Adding a new lab is the easiest contribution — it's just a `labs.json` entry and a PR.

---

## License

MIT: free to use, modify, and share.

---

<p align="center">Built for learners. Break things safely.</p>
