#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  cat <<'USAGE'
Usage: backend_deploy.sh --domain <example.com> --service <service_name> --binary </absolute/path/to/binary> --port <port>

Creates/updates an Nginx server config for the given domain, starts the backend binary with pm2, and reloads Nginx.

Arguments:
  --domain   The domain to serve (server_name)
  --service  The pm2 process name and nginx site name
  --binary   Absolute path to the backend binary on the server
  --port     Port where the backend binary listens (proxied by nginx)
USAGE
}

DOMAIN=""
SERVICE=""
BINARY=""
PORT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain)
      DOMAIN="$2"; shift 2 ;;
    --service)
      SERVICE="$2"; shift 2 ;;
    --binary)
      BINARY="$2"; shift 2 ;;
    --port)
      PORT="$2"; shift 2 ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      echo "Unknown argument: $1" >&2
      print_usage
      exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$SERVICE" || -z "$BINARY" || -z "$PORT" ]]; then
  echo "ERROR: Missing required arguments" >&2
  print_usage
  exit 1
fi

if [[ $EUID -ne 0 ]]; then
  echo "This script must be run as root (use sudo)." >&2
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "ERROR: nginx is not installed" >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: pm2 is not installed (npm i -g pm2)." >&2
  exit 1
fi

if [[ ! -x "$BINARY" ]]; then
  if [[ -f "$BINARY" ]]; then
    chmod +x "$BINARY"
  else
    echo "ERROR: Binary not found at $BINARY" >&2
    exit 1
  fi
fi

NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
SITE_CONF_PATH="${NGINX_SITES_AVAILABLE}/${SERVICE}.conf"

mkdir -p "$NGINX_SITES_AVAILABLE" "$NGINX_SITES_ENABLED"

cat > "$SITE_CONF_PATH" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf "$SITE_CONF_PATH" "${NGINX_SITES_ENABLED}/${SERVICE}.conf"

nginx -t

if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx
else
  nginx -s reload
fi

export PORT

if pm2 describe "$SERVICE" >/dev/null 2>&1; then
  pm2 restart "$SERVICE" --update-env
else
  pm2 start "$BINARY" --name "$SERVICE"
fi

pm2 save

echo "Deployment completed: service=$SERVICE domain=$DOMAIN port=$PORT"