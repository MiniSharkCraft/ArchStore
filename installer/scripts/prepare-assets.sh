#!/usr/bin/env bash
# Copies the ArchStore app icon into the installer assets folder.
# Run this script once before `npm run build`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALLER_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$INSTALLER_DIR")"

SRC="$PROJECT_DIR/build/appicon.png"
DST="$INSTALLER_DIR/assets/icon.png"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: Source icon not found at $SRC" >&2
  echo "  Build the Wails app first ('wails build') or ensure build/appicon.png exists." >&2
  exit 1
fi

mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
echo "Copied icon: $SRC → $DST"
