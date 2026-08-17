#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "error: run this backup as root" >&2
  exit 1
fi

ENV_FILE="/etc/learning-style-assessment-v2.env"
BACKUP_DIR="/var/backups/learning-style-assessment"
RETENTION_DAYS=30

if [[ -r "${ENV_FILE}" ]]; then
  # The production environment file is root-owned and contains simple KEY=VALUE lines.
  # shellcheck disable=SC1091
  source "${ENV_FILE}"
fi

DB_PATH="${DATABASE_PATH:-/var/lib/learning-style-assessment/assessment.sqlite}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="${BACKUP_DIR}/assessment-${TIMESTAMP}.sqlite"
TEMP_PATH="${FINAL_PATH}.tmp"

if [[ ! -f "${DB_PATH}" ]]; then
  echo "error: database not found: ${DB_PATH}" >&2
  exit 1
fi

install -d -o root -g lsa -m 0750 "${BACKUP_DIR}"
umask 0027

cleanup() {
  rm -f "${TEMP_PATH}"
}
trap cleanup EXIT

# SQLite's online backup API produces a consistent snapshot, including WAL content.
sqlite3 "${DB_PATH}" ".timeout 10000" ".backup '${TEMP_PATH}'"

if [[ "$(sqlite3 "${TEMP_PATH}" 'PRAGMA integrity_check;')" != "ok" ]]; then
  echo "error: backup integrity check failed" >&2
  exit 1
fi

chown root:lsa "${TEMP_PATH}"
chmod 0640 "${TEMP_PATH}"
mv "${TEMP_PATH}" "${FINAL_PATH}"
trap - EXIT

find "${BACKUP_DIR}" -type f -name 'assessment-*.sqlite' -mmin "+$((RETENTION_DAYS * 24 * 60))" -delete

echo "backup created: ${FINAL_PATH}"
