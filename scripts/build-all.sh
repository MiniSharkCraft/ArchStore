#!/usr/bin/env bash
# scripts/build-all.sh
# Build tất cả artifacts: ArchStore binary, AppImage, và Installer AppImage
#
# Cách dùng:
#   bash scripts/build-all.sh
#   bash scripts/build-all.sh --skip-wails     # bỏ qua wails build
#   bash scripts/build-all.sh --skip-installer  # bỏ qua installer
#
# Output:
#   build/bin/archstore                       — binary thô
#   build/bin/ArchStore-*.AppImage            — app AppImage (chạy trực tiếp)
#   build/bin/ArchStore-Installer-*.AppImage  — installer AppImage

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALLER_DIR="$ROOT_DIR/installer"

SKIP_WAILS=false
SKIP_INSTALLER=false
for arg in "$@"; do
  [[ "$arg" == "--skip-wails" ]]     && SKIP_WAILS=true
  [[ "$arg" == "--skip-installer" ]] && SKIP_INSTALLER=true
done

echo "╔════════════════════════════════════╗"
echo "║     ArchStore — Build All          ║"
echo "╚════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────
# 1. Build ArchStore AppImage
# ─────────────────────────────────────────────
echo "━━━ [1/2] ArchStore AppImage ━━━━━━━━━━━━━━━━━━━━━━━━━"
ARGS=""
[[ "$SKIP_WAILS" == true ]] && ARGS="--skip-wails"
bash "$SCRIPT_DIR/build-appimage.sh" $ARGS
echo ""

# ─────────────────────────────────────────────
# 2. Build Installer AppImage
# ─────────────────────────────────────────────
if [[ "$SKIP_INSTALLER" == false ]]; then
  echo "━━━ [2/2] Installer AppImage ━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ ! -d "$INSTALLER_DIR" ]]; then
    echo "⚠ Không tìm thấy thư mục installer/, bỏ qua..."
  else
    cd "$INSTALLER_DIR"

    # Chuẩn bị icon
    if [[ -f "$ROOT_DIR/build/appicon.png" && ! -f "$INSTALLER_DIR/assets/icon.png" ]]; then
      mkdir -p "$INSTALLER_DIR/assets"
      cp "$ROOT_DIR/build/appicon.png" "$INSTALLER_DIR/assets/icon.png"
      echo "✓ Icon đã copy"
    fi

    # Cài npm dependencies nếu chưa có
    if [[ ! -d "node_modules" ]]; then
      echo "▸ Cài npm dependencies..."
      npm install
    fi

    echo "▸ Build Installer AppImage..."
    npm run build

    # Tìm file output của electron-builder
    INSTALLER_OUTPUT=$(find "$INSTALLER_DIR/dist" -name "*.AppImage" 2>/dev/null | head -1)
    if [[ -n "$INSTALLER_OUTPUT" ]]; then
      cp "$INSTALLER_OUTPUT" "$ROOT_DIR/build/bin/ArchStore-Installer-x86_64.AppImage"
      chmod +x "$ROOT_DIR/build/bin/ArchStore-Installer-x86_64.AppImage"
      echo "✓ Installer AppImage: build/bin/ArchStore-Installer-x86_64.AppImage"
    fi
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ Build hoàn tất! Các file trong build/bin/:        ║"
echo "╠══════════════════════════════════════════════════════╣"
ls -lh "$ROOT_DIR/build/bin/" 2>/dev/null | grep -E "AppImage|archstore$" | \
  awk '{printf "║  %-52s║\n", $NF" ("$5")"}'
echo "╚══════════════════════════════════════════════════════╝"
