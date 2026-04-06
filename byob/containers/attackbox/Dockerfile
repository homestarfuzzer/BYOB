# containers/attackbox/Dockerfile
# Lightweight Kali-based attack container for BYOB.
# Target size: ~900 MB (vs 4 GB+ for full Kali)
# Only installs tools relevant to the labs in BYOB — nothing extra.

FROM kalilinux/kali-rolling

# Avoid interactive prompts during apt installs
ENV DEBIAN_FRONTEND=noninteractive

# Single RUN layer to keep image size down
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      # Reconnaissance
      nmap \
      # Exploitation framework
      metasploit-framework \
      # Network utilities
      netcat-traditional \
      curl \
      wget \
      # Web + API attack tools
      sqlmap \
      nikto \
      gobuster \
      dirb \
      # Brute force
      hydra \
      # Scripting
      python3 \
      python3-pip \
      # Browser-based terminal server (what opens in the BYOB dashboard)
      ttyd \
      # Quality of life
      less \
      vim \
      git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy in a welcome banner and a quick-start help file
COPY motd.sh /etc/profile.d/byob-motd.sh
RUN chmod +x /etc/profile.d/byob-motd.sh

WORKDIR /root

# ttyd serves bash on port 7681 — BYOB maps this to localhost:7681
# --writable allows the terminal to accept input
# -t fontSize=16 sets a comfortable font size in the browser
EXPOSE 7681

CMD ["ttyd", "--port", "7681", "--writable", "-t", "fontSize=16", "-t", "fontFamily=monospace", "bash", "--login"]
