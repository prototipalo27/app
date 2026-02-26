#!/bin/bash
set -e

echo "=== Setup servidor Prototipalo (n8n + Evolution API) ==="

# 1. Actualizar sistema
apt update && apt upgrade -y

# 2. Instalar Docker
curl -fsSL https://get.docker.com | sh

# 3. Crear directorio
mkdir -p /opt/prototipalo
cd /opt/prototipalo

echo ""
echo "=== Docker instalado. Ahora:"
echo "1. Sube los archivos a /opt/prototipalo/"
echo "   scp docker-compose.yml Caddyfile init-db.sh .env root@TU_IP:/opt/prototipalo/"
echo ""
echo "2. Configura el .env:"
echo "   nano /opt/prototipalo/.env"
echo ""
echo "3. Levanta todo:"
echo "   cd /opt/prototipalo && docker compose up -d"
echo ""
echo "4. Verifica:"
echo "   docker compose ps"
echo "   docker compose logs -f"
echo "==="
