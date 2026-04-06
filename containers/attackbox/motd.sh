#!/bin/bash
# Shown every time a bash session starts in the attack box

cat << 'EOF'

  ██████╗ ██╗   ██╗ ██████╗ ██████╗
  ██╔══██╗╚██╗ ██╔╝██╔═══██╗██╔══██╗
  ██████╔╝ ╚████╔╝ ██║   ██║██████╔╝
  ██╔══██╗  ╚██╔╝  ██║   ██║██╔══██╗
  ██████╔╝   ██║   ╚██████╔╝██████╔╝
  ╚═════╝    ╚═╝    ╚═════╝ ╚═════╝
  Break Your Own Boxes — Attack Box

  ┌─────────────────────────────────────┐
  │  Quick Start                        │
  │                                     │
  │  nmap -sV target     → scan target  │
  │  msfconsole          → Metasploit   │
  │  sqlmap -u <url>     → SQL inject   │
  │  nikto -h target     → web scan     │
  │  gobuster dir -u ... → dir enum     │
  │                                     │
  │  "target" = Metasploitable 2 IP     │
  └─────────────────────────────────────┘

EOF
