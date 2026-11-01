#!/usr/bin/env bash
# ============================================================================
# Script: database/run-migrations.sh
# Proyecto: ShopCart - Tech Challenge 360 (Don Arturo / Grupo Pentandra)
# Descripción: Ejecuta de forma ordenada y reproducible todos los scripts SQL
#              versionados y numerados (01 al 11) dentro del contenedor
#              SQL Server (shopcart-sqlserver).
# Uso:
#   ./database/run-migrations.sh          # Ejecución idempotente
#   ./database/run-migrations.sh --reset  # Recrea ShopCartDB desde cero
# ============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

CONTAINER_NAME="${DB_CONTAINER_NAME:-shopcart-sqlserver}"
DB_USER="${DB_USER:-sa}"
DB_PASSWORD="${DB_PASSWORD:-ShopCart_Dev!2026}"

echo "============================================================================"
echo "Iniciando ejecución de migraciones y semillas en SQL Server (${CONTAINER_NAME})"
echo "============================================================================"

SQLCMD_BIN=$(docker exec "${CONTAINER_NAME}" sh -c 'if [ -x /opt/mssql-tools18/bin/sqlcmd ]; then echo /opt/mssql-tools18/bin/sqlcmd; else echo /opt/mssql-tools/bin/sqlcmd; fi')

if [[ "${1:-}" == "--reset" ]]; then
  echo "-> Recreando base de datos [ShopCartDB] desde cero (--reset)..."
  docker exec "${CONTAINER_NAME}" "${SQLCMD_BIN}" \
    -S localhost \
    -U "${DB_USER}" \
    -P "${DB_PASSWORD}" \
    -C -b \
    -Q "IF DB_ID(N'ShopCartDB') IS NOT NULL BEGIN ALTER DATABASE [ShopCartDB] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [ShopCartDB]; END"
fi

SCRIPTS=(
  "01_Database_And_Config.sql"
  "02_Tables_And_Constraints.sql"
  "03_Indexes.sql"
  "04_Triggers_Inmutabilidad.sql"
  "05_Functions_And_Views.sql"
  "06_SP_Auth_Usuarios_Direcciones.sql"
  "07_SP_Catalogo_Inventario.sql"
  "08_SP_Carrito_Cupones.sql"
  "09_SP_Pedidos_Devoluciones.sql"
  "10_SP_Dashboard_Bitacora.sql"
  "11_Seed_Data.sql"
)

for script in "${SCRIPTS[@]}"; do
  echo "-> Ejecutando /database/${script}..."
  docker exec "${CONTAINER_NAME}" "${SQLCMD_BIN}" \
    -S localhost \
    -U "${DB_USER}" \
    -P "${DB_PASSWORD}" \
    -C -b \
    -i "/database/${script}" > /dev/null
done

echo "============================================================================"
echo "✅ Migraciones y datos semilla completados exitosamente."
echo "============================================================================"
