#!/usr/bin/env bash
# Sobe um PostgreSQL 16 local para desenvolvimento (idempotente).
# Uso: bash scripts/banco-local.sh   →  postgresql://sentinella:sentinella@127.0.0.1:5433/sentinella
# Em máquinas com Docker, o docker-compose.yml na raiz faz o mesmo papel.
set -euo pipefail

PGBIN=/usr/lib/postgresql/16/bin
DADOS=/home/user/pgdata
PORTA=5433

if [ ! -d "$DADOS" ]; then
  mkdir -p "$DADOS"
  chown postgres:postgres "$DADOS"
  su postgres -s /bin/bash -c "$PGBIN/initdb -D $DADOS --auth=trust --username=postgres -E UTF8 --locale=C" >/dev/null
fi

if ! su postgres -s /bin/bash -c "$PGBIN/pg_ctl -D $DADOS status" >/dev/null 2>&1; then
  su postgres -s /bin/bash -c "$PGBIN/pg_ctl -D $DADOS -o '-p $PORTA -k /tmp -c listen_addresses=127.0.0.1' -l /tmp/pg-sentinella.log start" >/dev/null
fi

su postgres -s /bin/bash -c "psql -h /tmp -p $PORTA -tc \"SELECT 1 FROM pg_roles WHERE rolname='sentinella'\" | grep -q 1 || psql -h /tmp -p $PORTA -c \"CREATE ROLE sentinella LOGIN PASSWORD 'sentinella'\"" >/dev/null
# CREATEDB: o Prisma Migrate usa um shadow database em desenvolvimento.
su postgres -s /bin/bash -c "psql -h /tmp -p $PORTA -c 'ALTER ROLE sentinella CREATEDB'" >/dev/null
su postgres -s /bin/bash -c "psql -h /tmp -p $PORTA -tc \"SELECT 1 FROM pg_database WHERE datname='sentinella'\" | grep -q 1 || createdb -h /tmp -p $PORTA -O sentinella sentinella" >/dev/null

echo "PostgreSQL pronto em postgresql://sentinella:sentinella@127.0.0.1:$PORTA/sentinella"
