#!/usr/bin/env bash
# Creates a private root CA for the local platform and signs a single server
# certificate shared by every HTTPS service (showroom, previews, demo API,
# backend). Installing the CA into the system trust store means every origin
# is trusted after a ONE-TIME setup — the same trust model production uses
# (a CA signs certs for all services), without per-port certificate warnings.
#
# Usage: bash scripts/local-ca.sh [--no-install]
#
# Regenerated leaf certs are copied to every place the services read them:
#   design-stock/ssl/{cert,key}.pem          -> previews server + mock API
#   apps/showroom/{cert,key}.pem             -> showroom dev server
#   apps/dashboard/{cert,key}.pem            -> merchant dashboard dev server
#   ../platform-server/{cert,key}.pem        -> Django backend (runserver_plus)
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSL="$REPO/ssl"
mkdir -p "$SSL"

CA_CN="Storefront Platform Local CA"
LEAF_CN="storefront.local"

SAN="DNS:localhost,DNS:*.localhost,IP:127.0.0.1"
while IFS= read -r address; do
  SAN+=",IP:$address"
done < <(ip -4 -o address show scope global | awk '{split($4, parts, "/"); print parts[1]}' | sort -u)

INSTALL_TRUST=true
if [ "${1:-}" = "--no-install" ]; then
  INSTALL_TRUST=false
fi

if [ ! -f "$SSL/ca.pem" ]; then
  echo "== generating root CA =="
  openssl req -x509 -newkey rsa:3072 -sha256 -nodes \
    -keyout "$SSL/ca.key" -out "$SSL/ca.pem" -days 3650 \
    -subj "/CN=$CA_CN" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign"
else
  echo "== reusing existing CA ($SSL/ca.pem) =="
fi

echo "== signing shared server certificate =="
openssl req -newkey rsa:2048 -sha256 -nodes \
  -keyout "$SSL/key.pem" -out "$SSL/leaf.csr" \
  -subj "/CN=$LEAF_CN"

cat > "$SSL/leaf.ext" <<EOF
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=$SAN
EOF

openssl x509 -req -sha256 -days 825 \
  -in "$SSL/leaf.csr" -CA "$SSL/ca.pem" -CAkey "$SSL/ca.key" -CAcreateserial \
  -out "$SSL/cert.pem" -extfile "$SSL/leaf.ext"

rm -f "$SSL/leaf.csr" "$SSL/leaf.ext"

echo "== distributing leaf certificate =="
cp "$SSL/cert.pem" "$REPO/apps/showroom/cert.pem"
cp "$SSL/key.pem" "$REPO/apps/showroom/key.pem"
echo "  copied to apps/showroom/"
cp "$SSL/cert.pem" "$REPO/apps/dashboard/cert.pem"
cp "$SSL/key.pem" "$REPO/apps/dashboard/key.pem"
echo "  copied to apps/dashboard/"
BACKEND_REPO="$(dirname "$REPO")/platform-server"
if [ -f "$BACKEND_REPO/manage.py" ]; then
  cp "$SSL/cert.pem" "$BACKEND_REPO/cert.pem"
  cp "$SSL/key.pem" "$BACKEND_REPO/key.pem"
  echo "  copied to $BACKEND_REPO/"
fi

if $INSTALL_TRUST; then
  echo "== installing CA into system trust store (needs sudo) =="
  sudo cp "$SSL/ca.pem" /usr/local/share/ca-certificates/storefront-local-ca.crt
  sudo update-ca-certificates

  echo "== installing CA into Chrome (NSS) trust store =="
  # Chrome/Chromium on Linux read ~/.pki/nssdb (NOT the system store), so the
  # system install above does not make Chrome trust our certs. certutil ships in
  # libnss3-tools and needs sudo to install; the import itself runs as the user.
  if ! command -v certutil >/dev/null 2>&1; then
    echo "  certutil missing -> installing libnss3-tools (needs sudo)"
    sudo apt-get update -qq && sudo apt-get install -y libnss3-tools
  fi
  NSS_DIR="$HOME/.pki/nssdb"
  mkdir -p "$NSS_DIR"
  if [ ! -f "$NSS_DIR/cert9.db" ]; then
    certutil -d "sql:$NSS_DIR" -N --empty-password
  fi
  if certutil -d "sql:$NSS_DIR" -L | grep -q "Storefront Platform Local CA"; then
    certutil -d "sql:$NSS_DIR" -D -n "Storefront Platform Local CA"
  fi
  certutil -d "sql:$NSS_DIR" -A -n "Storefront Platform Local CA" -t "C,," -i "$SSL/ca.pem"
  echo "  imported into $NSS_DIR"
else
  echo "== skipping trust-store installation (--no-install) =="
fi

echo "== done =="
echo "Every local HTTPS origin now uses one trusted certificate."
openssl x509 -in "$SSL/cert.pem" -noout -subject -ext subjectAltName
