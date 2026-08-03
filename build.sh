#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

header() {
  echo -e "\n${CYAN}╔══════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║  Multi-Channel Overlay Service  Setup   ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}\n"
}

section() { echo -e "\n${GREEN}▸ $1${NC}"; }

ask() {
  local __var=$1 prompt=$2 default=${3:-}
  local value
  if [[ -n "$default" ]]; then
    read -rp "$(echo -e "  ${YELLOW}${prompt}${NC} [${default}]: ")" value
    value="${value:-$default}"
  else
    read -rp "$(echo -e "  ${YELLOW}${prompt}${NC}: ")" value
    while [[ -z "$value" ]]; do
      echo -e "  ${RED}Required.${NC}"
      read -rp "$(echo -e "  ${YELLOW}${prompt}${NC}: ")" value
    done
  fi
  printf -v "$__var" '%s' "$value"
}

ask_yn() {
  local answer
  read -rp "$(echo -e "  ${YELLOW}$1${NC} [y/N]: ")" answer
  [[ "$answer" =~ ^[Yy]$ ]]
}

# ─────────────────────────────────────────────────────────────────────────────
header

section "Twitch App Credentials"
echo -e "  Register at: ${CYAN}https://dev.twitch.tv/console${NC}"
ask TWITCH_CLIENT_ID     "Client ID"
ask TWITCH_CLIENT_SECRET "Client Secret"
ask TWITCH_OWNER_ID      "Your Twitch user ID (numeric)"

section "Server Configuration"
ask DOMAIN        "Domain or server IP" "localhost"
ask BACKEND_PORT  "Backend port"        "3000"
ask FRONTEND_PORT "Frontend (nginx) port" "80"
ask JWT EXPIRY      "JWT expiry (e.g. 7d, 12h)" "7d"

PROTOCOL="http"
if ask_yn "Use HTTPS?"; then
  PROTOCOL="https"
fi

BACKEND_URL="${PROTOCOL}://${DOMAIN}:${BACKEND_PORT}"
FRONTEND_URL="${PROTOCOL}://${DOMAIN}:${FRONTEND_PORT}"

# Strip standard ports for cleaner URLs
[[ "$BACKEND_PORT"  == "443" || "$BACKEND_PORT"  == "80" ]] && BACKEND_URL="${PROTOCOL}://${DOMAIN}"
[[ "$FRONTEND_PORT" == "443" || "$FRONTEND_PORT" == "80" ]] && FRONTEND_URL="${PROTOCOL}://${DOMAIN}"

TWITCH_CALLBACK_URL="${BACKEND_URL}/api/v1/twitch/auth"

echo -e "\n  ${CYAN}Register this as OAuth Redirect URL in your Twitch app:${NC}"
echo -e "  ${BOLD}${TWITCH_CALLBACK_URL}${NC}"

section "Security"
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null \
  || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
echo -e "  JWT secret generated ✓"

EVENTSUB_WEBHOOK_SECRET=$(openssl rand -hex 16 2>/dev/null \
  || tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
echo -e "  EventSub webhook secret generated ✓"

# ── backend/.env ──────────────────────────────────────────────────────────────
section "Writing backend/.env"
cat > backend/.env << EOF
BACKEND_HOST=0.0.0.0
BACKEND_PORT=${BACKEND_PORT}
BACKEND_PUBLIC_ORIGIN=${BACKEND_URL}

TWITCH_CLIENT_ID=${TWITCH_CLIENT_ID}
TWITCH_CLIENT_SECRET=${TWITCH_CLIENT_SECRET}
TWITCH_OWNER_ID=${TWITCH_OWNER_ID}
TWITCH_REDIRECT_URI=api/v1/twitch/auth
TWITCH_AUTH_REDIRECT_URL=${TWITCH_CALLBACK_URL}
TWITCH_SCOPES=user:read:chat channel:read:redemptions moderator:read:moderators user:read:moderated_channels moderation:read bits:read channel:read:subscriptions user:bot
EVENTSUB_WEBHOOK_SECRET=${EVENTSUB_WEBHOOK_SECRET}

FRONTEND_ORIGIN=${FRONTEND_URL}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=${JWT_EXPIRY}

DB_PATH=/app/data/db.sqlite
EOF
echo -e "  backend/.env written ✓"

# ── frontend/.env ─────────────────────────────────────────────────────────────
section "Writing frontend/.env"
cat > frontend/.env << EOF
VITE_API_BASE_URL=${BACKEND_URL}
VITE_BASE_OVERLAY_API_URL=/api/v1/overlay
VITE_BASE_OVERLAY_SERVICE_URL=/overlay-service
EOF
echo -e "  frontend/.env written ✓"

# ── .env for docker-compose variable substitution ─────────────────────────────
cat > .env << EOF
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
VITE_API_BASE_URL=${BACKEND_URL}
EOF
echo -e "  .env (compose) written ✓"

# ── Build & start ─────────────────────────────────────────────────────────────
section "Building and starting containers"
mkdir -p data overlays

docker compose build --no-cache
docker compose up -d

echo -e "\n${GREEN}✓ Setup complete!${NC}"
echo -e "  Frontend:  ${CYAN}${FRONTEND_URL}${NC}"
echo -e "  Backend:   ${CYAN}${BACKEND_URL}${NC}"
echo -e "  Overlays:  place your overlay folders inside ${BOLD}./overlays/${NC}"
echo -e "  Database:  persisted in ${BOLD}./data/db.sqlite${NC}"
