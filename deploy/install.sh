#!/bin/bash
mkdir -p /opt/prototipalo
cd /opt/prototipalo

# .env
cat > .env << 'ENVEOF'
DB_PASSWORD=de2defe10316afd58e424e6afe6db8c0f5cf8978c20808d1
EVOLUTION_API_KEY=cf98481b38f0555c6024b7a86386917246766fdda1aac133
ENVEOF

# init-db.sh
cat > init-db.sh << 'DBEOF'
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE n8n;"
DBEOF
chmod +x init-db.sh

# docker-compose.yml
cat > docker-compose.yml << 'DCEOF'
services:
  evolution-api:
    image: atendai/evolution-api:v2.2.3
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=http://89.167.107.241:8080
      - SERVER_PORT=8080
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evolution:${DB_PASSWORD}@postgres:5432/evolution
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379/0
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - CACHE_LOCAL_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
      - QRCODE_LIMIT=30
      - QRCODE_COLOR=#198754
      - LOG_LEVEL=ERROR,WARN
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      - postgres
      - redis
    networks:
      - internal
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=89.167.107.241
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://89.167.107.241:5678/
      - N8N_SECURE_COOKIE=false
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=evolution
      - DB_POSTGRESDB_PASSWORD=${DB_PASSWORD}
      - GENERIC_TIMEZONE=Europe/Madrid
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    networks:
      - internal
  postgres:
    image: postgres:15-alpine
    container_name: postgres
    restart: always
    environment:
      - POSTGRES_USER=evolution
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=evolution
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    networks:
      - internal
  redis:
    image: redis:7-alpine
    container_name: redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - internal
volumes:
  evolution_instances:
  n8n_data:
  pgdata:
  redis_data:
networks:
  internal:
    driver: bridge
DCEOF

echo "Archivos creados en /opt/prototipalo"
echo "Arrancando servicios..."
docker compose up -d
echo "Listo. Espera 1-2 minutos y comprueba:"
echo "  docker compose ps"
