#!/usr/bin/env bash
set -euo pipefail

# ── Repository settings (update REPO_RAW to your GitHub raw URL) ─────────────
REPO_RAW="https://raw.githubusercontent.com/Yinks87/multi-channel-overlay-service/refs/heads"
DEFAULT_BRANCH="main"
SELECTED_BRANCH="${DEFAULT_BRANCH}"
SCRIPT_PATH="$0"

# ── Branch helpers ────────────────────────────────────────────────────────────
get_branch()              { echo "${SELECTED_BRANCH}"; }
get_branch_display_name() {
  case "${SELECTED_BRANCH}" in
    "main") echo "Main (stable)" ;;
    "dev")  echo "Development (unstable)" ;;
    *)      echo "${SELECTED_BRANCH}" ;;
  esac
}

# ── Colors ────────────────────────────────────────────────────────────────────
setup_colors() {
  if [[ -t 1 ]] && command -v tput &>/dev/null && tput colors &>/dev/null && [[ $(tput colors) -ge 8 ]]; then
    RED='\033[1;31m'; GREEN='\033[1;32m'; YELLOW='\033[1;33m'
    CYAN='\033[1;36m'; BOLD='\033[1m'; MUTED='\033[0;37m'; NC='\033[0m'
  else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; MUTED=''; NC=''
  fi
}
setup_colors

# ── Output helpers ────────────────────────────────────────────────────────────
header() {
  echo -e "\n${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║   Multi-Channel Overlay Service — Setup      ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}\n"
}
section() { echo -e "\n${GREEN}▸ $1${NC}"; }
info()    { echo -e "  ${CYAN}$*${NC}"; }
warn()    { echo -e "  ${YELLOW}⚠  $*${NC}"; }
err()     { echo -e "  ${RED}✗  $*${NC}" >&2; }
ok()      { echo -e "  ${GREEN}✓  $*${NC}"; }
muted()   { echo -e "  ${MUTED}$*${NC}"; }

ask() {
  local __var=$1 prompt=$2 default=${3:-}
  local value
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "  ${YELLOW}${prompt}${NC} [${default}]: ")" value || true
    value="${value:-$default}"
  else
    read -rp "$(echo -e "  ${YELLOW}${prompt}${NC}: ")" value || true
    while [[ -z "$value" ]]; do
      err "Required."
      read -rp "$(echo -e "  ${YELLOW}${prompt}${NC}: ")" value || true
    done
  fi
  printf -v "$__var" '%s' "$value"
}

ask_yn() {
  local answer
  read -rp "$(echo -e "  ${YELLOW}$1${NC} [y/N]: ")" answer || true
  [[ "$answer" =~ ^[Yy]$ ]]
}

# numbered menu: ask_menu VARNAME "prompt" "opt1" "opt2" ...
ask_menu() {
  local __var=$1 prompt=$2; shift 2
  local options=("$@")
  echo -e "\n  ${YELLOW}${prompt}${NC}"
  for i in "${!options[@]}"; do
    echo -e "    ${CYAN}$((i+1))${NC}) ${options[$i]}"
  done
  local choice
  while true; do
    read -rp "$(echo -e "\n  Choice [1-${#options[@]}]: ")" choice || true
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#options[@]} )); then
      printf -v "$__var" '%s' "${options[$((choice-1))]}"
      return
    fi
    err "Invalid choice."
  done
}

# ── Docker ────────────────────────────────────────────────────────────────────
check_docker_status() {
  local docker_ok=false compose_ok=false group_ok=false
  command -v docker &>/dev/null && docker_ok=true
  { command -v docker-compose &>/dev/null || docker compose version &>/dev/null 2>&1; } && compose_ok=true
  groups 2>/dev/null | grep -q docker && group_ok=true
  echo "${docker_ok},${compose_ok},${group_ok}"
}

install_docker() {
  local os_id
  local kernel; kernel="$(uname -s)"
  if [[ "$kernel" == "Darwin" ]]; then
    err "macOS detected. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
  fi
  if [[ "$kernel" == MINGW* ]] || [[ "$kernel" == MSYS* ]] || [[ "$kernel" == CYGWIN* ]]; then
    err "Windows detected. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    err "Then use WSL2 or Git Bash and rerun this script."
    exit 1
  fi

  if command -v lsb_release &>/dev/null; then
    os_id=$(lsb_release -is | tr '[:upper:]' '[:lower:]')
  elif [[ -f /etc/os-release ]]; then
    . /etc/os-release; os_id="${ID:-unknown}"
  else
    err "Cannot determine Linux distribution."; exit 1
  fi

  if [[ "$os_id" != "debian" && "$os_id" != "ubuntu" ]]; then
    err "Auto-install only supports Debian/Ubuntu (detected: ${os_id})."
    err "Install Docker manually: https://docs.docker.com/engine/install/"
    exit 1
  fi

  IFS=',' read -r docker_ok compose_ok group_ok <<< "$(check_docker_status)"
  local needs_shell_restart=false

  section "Installing Docker components"
  if [[ "$docker_ok" == "true" ]]; then
    ok "Docker already installed ($(docker --version | cut -d' ' -f3 | tr -d ','))"
  else
    info "Installing Docker on ${os_id}..."
    sudo apt-get update -qq
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg software-properties-common
    curl -fsSL "https://download.docker.com/linux/${os_id}/gpg" \
      | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] \
https://download.docker.com/linux/${os_id} $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -qq
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    ok "Docker installed."
    needs_shell_restart=true
  fi

  if [[ "$compose_ok" == "true" ]]; then
    ok "Docker Compose already installed."
  else
    info "Installing Docker Compose plugin..."
    sudo apt-get update -qq
    sudo apt-get install -y docker-compose-plugin
    ok "Docker Compose installed."
  fi

  if [[ "$group_ok" == "true" ]]; then
    ok "User already in docker group."
  else
    sudo usermod -aG docker "$USER"
    ok "User ${USER} added to docker group."
    needs_shell_restart=true
  fi

  if [[ "$needs_shell_restart" == "true" ]]; then
    warn "Run 'newgrp docker' or log out/in to activate group changes."
  fi
}

require_docker() {
  if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null 2>&1; then
    err "Docker / Docker Compose not found. Run './build.sh install' first."
    exit 1
  fi
}

docker_compose_cmd() {
  if docker compose version &>/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

# ── Twitch owner ID lookup ────────────────────────────────────────────────────
lookup_twitch_owner_id() {
  local app_token user_id login_name

  # Get a short-lived app access token to call the Helix users endpoint
  local token_resp
  token_resp=$(curl -sf -X POST "https://id.twitch.tv/oauth2/token" \
    -d "client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials") || true
  app_token=$(echo "$token_resp" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4) || true

  if [[ -z "$app_token" ]]; then
    warn "Could not obtain a Twitch app token — check your Client ID / Secret."
    ask TWITCH_OWNER_ID "Your Twitch user ID (numeric)"
    return
  fi

  while true; do
    ask login_name "Your Twitch username (to look up your numeric ID)"
    local user_resp
    user_resp=$(curl -sf "https://api.twitch.tv/helix/users?login=${login_name}" \
      -H "Authorization: Bearer ${app_token}" \
      -H "Client-ID: ${TWITCH_CLIENT_ID}") || true
    user_id=$(echo "$user_resp" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4) || true

    if [[ -n "$user_id" ]]; then
      TWITCH_OWNER_ID="$user_id"
      ok "Found: ${login_name} → Twitch ID ${user_id}"
      break
    else
      err "User '${login_name}' not found on Twitch. Please try again."
    fi
  done
}

# ── Network / Protocol ────────────────────────────────────────────────────────
configure_network() {
  section "Network & Protocol"

  echo
  echo -e "  Twitch OAuth requires ${BOLD}HTTPS${NC} for any callback URL that is"
  echo -e "  ${BOLD}not${NC} ${CYAN}http://localhost${NC}."
  echo

  local proto_choice
  ask_menu proto_choice "Select protocol:" \
    "HTTP  — localhost only (Twitch OAuth only works on this machine / e.g. Docker Desktop)" \
    "HTTPS — any domain   (required for public / remote / multi-device access)"

  if [[ "$proto_choice" == HTTP* ]]; then
    PROTOCOL="http"
    echo
    warn "HTTP mode selected."
    warn "Twitch OAuth will ONLY work when you open the browser on the same machine"
    warn "that runs the containers (localhost). Fine for Docker Desktop or local Linux."
    echo

    DOMAIN="localhost"
    ask BACKEND_PORT  "Backend port"  "3003"
    ask FRONTEND_PORT "Frontend port" "4003"
    USE_NGINX_SSL=false
    SSL_METHOD="none"

    BACKEND_URL="http://localhost:${BACKEND_PORT}"
    FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
    if [[ "$FRONTEND_PORT" == "80" ]]; then FRONTEND_URL="http://localhost"; fi

  else
    PROTOCOL="https"
    echo
    info "HTTPS mode. You need a real domain (free: https://www.duckdns.org)."
    echo

    while true; do
      ask DOMAIN "Domain name (e.g. myoverlay.duckdns.org)"
      if [[ "$DOMAIN" == "localhost" ]] || [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        err "HTTPS requires a real domain — not 'localhost' or an IP."
        err "Get a free subdomain at https://www.duckdns.org"
      else
        break
      fi
    done

    BACKEND_PORT="3000"
    FRONTEND_PORT="443"
    USE_NGINX_SSL=true
    BACKEND_URL="https://${DOMAIN}"
    FRONTEND_URL="https://${DOMAIN}"

    local ssl_src_choice
    ask_menu ssl_src_choice "How will you provide the SSL certificate?" \
      "Let's Encrypt (certbot) — free, automatic renewal" \
      "I already have a certificate — provide file paths"

    if [[ "$ssl_src_choice" == "Let's"* ]]; then
      if [[ "$DOMAIN" == *.duckdns.org ]]; then
        SSL_METHOD="letsencrypt-duckdns"
        info "DuckDNS domain — using DNS-01 challenge (port 80 does not need to be public)."
        ask LE_EMAIL      "Email for Let's Encrypt expiry notices"
        ask DUCKDNS_TOKEN "DuckDNS token (top of https://www.duckdns.org)"
      else
        SSL_METHOD="letsencrypt"
        warn "HTTP-01 challenge: port 80 of ${DOMAIN} must be publicly reachable."
        ask LE_EMAIL "Email for Let's Encrypt expiry notices"
      fi
    else
      SSL_METHOD="manual"
      ask SSL_CERT_PATH "Path to certificate file (.crt / fullchain.pem)"
      ask SSL_KEY_PATH  "Path to private key file (.key / .pem)"
    fi
  fi
}

# ── nginx SSL reverse-proxy config ────────────────────────────────────────────
generate_nginx_ssl_conf() {
  cat > nginx-ssl.conf << 'NGINXEOF'
events { worker_processes auto; }

http {
  upstream frontend_app { server frontend:80; }
  upstream backend_app  { server backend:3000; }

  server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
  }

  server {
    listen 443 ssl;
    server_name DOMAIN_PLACEHOLDER;

    ssl_certificate     /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location /api/ {
      proxy_pass         http://backend_app;
      proxy_http_version 1.1;
      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
    }

    location / {
      proxy_pass         http://frontend_app;
      proxy_http_version 1.1;
      proxy_set_header   Host      $host;
      proxy_set_header   Upgrade   $http_upgrade;
      proxy_set_header   Connection "upgrade";
    }
  }
}
NGINXEOF
  # Replace placeholder with actual domain
  sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" nginx-ssl.conf
  ok "nginx-ssl.conf written"
}

generate_compose_ssl() {
  local certbot_block=""

  if [[ "${SSL_METHOD}" == "letsencrypt-duckdns" ]]; then
    certbot_block="
  certbot:
    image: infinityofspace/certbot_dns_duckdns:latest
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: >
      certonly --non-interactive --agree-tos
      --authenticator dns-duckdns
      --dns-duckdns-token ${DUCKDNS_TOKEN}
      --dns-duckdns-propagation-seconds 60
      -d ${DOMAIN} --email ${LE_EMAIL}"
  elif [[ "${SSL_METHOD}" == "letsencrypt" ]]; then
    certbot_block="
  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    command: >
      certonly --webroot -w /var/www/certbot
      --non-interactive --agree-tos
      -d ${DOMAIN} --email ${LE_EMAIL}"
  fi

  cat > docker-compose.ssl.yml << EOF
# Overlay — use with: docker compose -f docker-compose.yml -f docker-compose.ssl.yml
services:
  # Restrict frontend/backend to host-local access; nginx-ssl is the public entry point
  frontend:
    ports:
      - "127.0.0.1:8080:80"
  backend:
    ports:
      - "127.0.0.1:3001:3000"

  nginx-ssl:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-ssl.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
${certbot_block}
EOF
  ok "docker-compose.ssl.yml written"
}

# ── Write .env files ──────────────────────────────────────────────────────────
write_env_files() {
  local TWITCH_CALLBACK_URL="${BACKEND_URL}/api/v1/twitch/auth"

  echo
  echo -e "  ${CYAN}Register this as OAuth Redirect URL in your Twitch app:${NC}"
  echo -e "  ${BOLD}  ${TWITCH_CALLBACK_URL}${NC}"

  local JWT_SECRET EVENTSUB_WEBHOOK_SECRET
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
  EVENTSUB_WEBHOOK_SECRET=$(openssl rand -hex 16 2>/dev/null || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)

  section "Writing backend/.env"
  mkdir -p backend
  cat > backend/.env << EOF
BACKEND_HOST=0.0.0.0
BACKEND_PORT=3000
BACKEND_PUBLIC_ORIGIN=${BACKEND_URL}

TWITCH_CLIENT_ID=${TWITCH_CLIENT_ID}
TWITCH_CLIENT_SECRET=${TWITCH_CLIENT_SECRET}
TWITCH_OWNER_ID=${TWITCH_OWNER_ID}
TWITCH_REDIRECT_URI=api/v1/twitch/auth
TWITCH_AUTH_REDIRECT_URL=${TWITCH_CALLBACK_URL}
TWITCH_SCOPES=user:read:chat channel:bot channel:read:redemptions moderator:read:moderators user:read:moderated_channels moderation:read bits:read channel:read:subscriptions
EVENTSUB_WEBHOOK_SECRET=${EVENTSUB_WEBHOOK_SECRET}

FRONTEND_ORIGIN=${FRONTEND_URL}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=${JWT_EXPIRY}

DB_PATH=/app/data/db.sqlite
EOF
  ok "backend/.env written"

  section "Writing frontend/.env"
  mkdir -p frontend
  cat > frontend/.env << EOF
VITE_API_BASE_URL=${BACKEND_URL}
VITE_BASE_OVERLAY_API_URL=/api/v1/overlay
VITE_BASE_OVERLAY_SERVICE_URL=/overlay-service
VITE_PLATFORM=linux
EOF
  ok "frontend/.env written"

  section "Writing root .env"
  cat > .env << EOF
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
VITE_API_BASE_URL=${BACKEND_URL}
VITE_PLATFORM=linux
EOF
  ok ".env (compose) written"
}

# ── Compose file list helper ──────────────────────────────────────────────────
compose_files_args() {
  local args=("-f" "docker-compose.yml")
  if [[ -f "docker-compose.ssl.yml" ]]; then args+=("-f" "docker-compose.ssl.yml"); fi
  echo "${args[@]}"
}

# ═════════════════════════════════════════════════════════════════════════════
# COMMANDS
# ═════════════════════════════════════════════════════════════════════════════

cmd_install() {
  header
  info "Branch: $(get_branch_display_name)"

  section "Checking Docker"
  IFS=',' read -r docker_ok compose_ok _ <<< "$(check_docker_status)"
  if [[ "$docker_ok" == "true" && "$compose_ok" == "true" ]]; then
    ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') — ready"
  else
    if ask_yn "Docker is not installed. Install it now? (Debian/Ubuntu only)"; then
      install_docker
    else
      err "Docker is required. See https://docs.docker.com/engine/install/"
      exit 1
    fi
  fi

  section "Twitch App Credentials"
  info "Register your app at: https://dev.twitch.tv/console"
  ask TWITCH_CLIENT_ID     "Client ID"
  ask TWITCH_CLIENT_SECRET "Client Secret"
  lookup_twitch_owner_id

  section "JWT"
  ask JWT_EXPIRY "JWT token expiry (e.g. 7d, 12h)" "7d"

  configure_network
  write_env_files

  if [[ "${USE_NGINX_SSL}" == "true" ]]; then
    section "Generating nginx SSL configuration"
    generate_nginx_ssl_conf

    if [[ "${SSL_METHOD}" == "manual" ]]; then
      info "Copying certificates..."
      mkdir -p "certbot/conf/live/${DOMAIN}"
      cp "${SSL_CERT_PATH}" "certbot/conf/live/${DOMAIN}/fullchain.pem"
      cp "${SSL_KEY_PATH}"  "certbot/conf/live/${DOMAIN}/privkey.pem"
      ok "Certificates copied."
      generate_compose_ssl
    else
      generate_compose_ssl
      info "Obtaining SSL certificate via certbot..."
      docker_compose_cmd -f docker-compose.yml -f docker-compose.ssl.yml run --rm certbot
      ok "Certificate obtained."
    fi
  fi

  section "Building and starting containers"
  mkdir -p data overlays
  # shellcheck disable=SC2046
  docker_compose_cmd $(compose_files_args) build --no-cache
  # shellcheck disable=SC2046
  docker_compose_cmd $(compose_files_args) up -d

  echo
  echo -e "${GREEN}✓ Installation complete!${NC}"
  echo -e "  Frontend : ${CYAN}${FRONTEND_URL}${NC}"
  echo -e "  Backend  : ${CYAN}${BACKEND_URL}${NC}"
  echo -e "  Database : ${BOLD}./data/db.sqlite${NC}"
  echo -e "  Overlays : place overlay folders in ${BOLD}./overlays/${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
cmd_update() {
  header
  require_docker
  section "Updating Multi-Channel Overlay Service"
  warn "Data, overlays, and all .env files will NOT be modified."
  echo

  if [[ -d ".git" ]]; then
    info "Pulling latest code ($(get_branch_display_name))..."
    git pull origin "$(get_branch)"
    ok "Code updated."
  else
    warn "Not a git repository — skipping code pull."
  fi

  section "Rebuilding and restarting containers"
  # shellcheck disable=SC2046
  docker_compose_cmd $(compose_files_args) build --no-cache
  # shellcheck disable=SC2046
  docker_compose_cmd $(compose_files_args) up -d
  ok "Update complete."
}

# ─────────────────────────────────────────────────────────────────────────────
cmd_updateself() {
  header
  section "Updating build script"
  local url="${REPO_RAW}/$(get_branch)/build.sh"
  local tmp; tmp="$(mktemp)"
  info "Downloading from ${url}..."
  if curl -fsSL "$url" -o "$tmp"; then
    cp "${SCRIPT_PATH}" "${SCRIPT_PATH}.bak"
    mv "$tmp" "${SCRIPT_PATH}"
    chmod +x "${SCRIPT_PATH}"
    ok "Script updated. Backup saved as ${SCRIPT_PATH}.bak"
  else
    err "Download failed. Check that REPO_RAW is set correctly at the top of this script."
    rm -f "$tmp"
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
cmd_help() {
  header
  echo -e "  ${CYAN}Usage:${NC}  ./build.sh [--branch=BRANCH] <command>"
  echo
  echo -e "  ${BOLD}Commands:${NC}"
  echo -e "    ${GREEN}install${NC}      Full setup: Docker check, credentials, network, env files,"
  echo -e "                 nginx SSL config (if HTTPS), build + start."
  echo
  echo -e "    ${GREEN}update${NC}       Rebuild and restart containers."
  echo -e "                 ${BOLD}Preserves:${NC} ./data/  ./overlays/  backend/.env  frontend/.env  .env"
  echo -e "                 Pulls latest git commits if inside a git repository."
  echo
  echo -e "    ${GREEN}updateself${NC}   Replace this script with the latest version from the repo."
  echo -e "                 Previous version saved as build.sh.bak"
  echo
  echo -e "    ${GREEN}help${NC}         Show this message."
  echo
  echo -e "  ${BOLD}Branch options:${NC}"
  echo -e "    ${CYAN}--branch=main${NC}   stable (default)"
  echo -e "    ${CYAN}--branch=dev${NC}    development / unstable"
  echo
  echo -e "  ${BOLD}HTTP vs HTTPS:${NC}"
  echo -e "    ${YELLOW}HTTP${NC}   Twitch OAuth only works with ${BOLD}http://localhost${NC} callbacks."
  echo -e "           Perfect for Docker Desktop (Windows/macOS) or a local Linux machine."
  echo -e "           You ${BOLD}cannot${NC} use a remote IP or hostname with HTTP + Twitch OAuth."
  echo
  echo -e "    ${YELLOW}HTTPS${NC}  Required for any public or remote access."
  echo -e "           Needs a real domain — free option: ${CYAN}https://www.duckdns.org${NC}"
  echo -e "           install sets up an nginx reverse proxy + certbot (Let's Encrypt)."
  echo -e "           DuckDNS domains use DNS-01 challenge (no need to expose port 80 first)."
  echo
  echo -e "  ${BOLD}Docker Desktop (Windows / macOS):${NC}"
  echo -e "    Yes — both services run on Docker Desktop via docker compose."
  echo -e "    Use HTTP + localhost for local streaming / dev setups."
  echo -e "    For HTTPS on Docker Desktop you additionally need a public domain"
  echo -e "    and port-forwarding (80/443) from the internet to your machine."
  echo
  echo -e "  ${BOLD}Examples:${NC}"
  echo -e "    ${CYAN}./build.sh install${NC}"
  echo -e "    ${CYAN}./build.sh update${NC}"
  echo -e "    ${CYAN}./build.sh updateself && ./build.sh update${NC}"
  echo -e "    ${CYAN}./build.sh --branch=dev install${NC}"
}

# ═════════════════════════════════════════════════════════════════════════════
# Parse flags, then dispatch
# ═════════════════════════════════════════════════════════════════════════════
filtered_args=()
for arg in "$@"; do
  case "$arg" in
    --branch=*) SELECTED_BRANCH="${arg#*=}" ;;
    --use-dev)  SELECTED_BRANCH="dev" ;;
    --use-main) SELECTED_BRANCH="main" ;;
    *)          filtered_args+=("$arg") ;;
  esac
done
set -- "${filtered_args[@]+"${filtered_args[@]}"}"

case "${1:-help}" in
  install)        cmd_install ;;
  update)         cmd_update ;;
  updateself)     cmd_updateself ;;
  help|--help|-h) cmd_help ;;
  *)
    err "Unknown command: ${1:-}"
    cmd_help
    exit 1
    ;;
esac
exit 0