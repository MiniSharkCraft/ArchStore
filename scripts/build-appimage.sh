#!/usr/bin/env bash
# scripts/build-appimage.sh
# Đóng gói ArchStore thành .AppImage để chạy trực tiếp trên bất kỳ distro Linux nào.
#
# Cách dùng:
#   bash scripts/build-appimage.sh
#   bash scripts/build-appimage.sh --skip-wails   # nếu đã build binary rồi
#
# Yêu cầu:
#   - wails (go install github.com/wailsapp/wails/v2/cmd/wails@latest)
#   - appimagetool (tải tự động nếu chưa có)
#   - wget hoặc curl

set -euo pipefail

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
APP_NAME="ArchStore"
APP_ID="com.archstore.app"
APP_VERSION="1.0.0"
BINARY_NAME="archstore"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ROOT_DIR/build"
APPDIR="$BUILD_DIR/${APP_NAME}.AppDir"
OUTPUT="$BUILD_DIR/bin/${APP_NAME}-${APP_VERSION}-x86_64.AppImage"

SKIP_WAILS=false
for arg in "$@"; do
  [[ "$arg" == "--skip-wails" ]] && SKIP_WAILS=true
done

# ─────────────────────────────────────────────
# STEP 1: Build Wails binary
# ─────────────────────────────────────────────
if [[ "$SKIP_WAILS" == false ]]; then
  echo "▸ Building ArchStore với wails..."
  cd "$ROOT_DIR"
  wails build -platform linux/amd64
  echo "✓ Wails build xong"
else
  echo "⟳ Bỏ qua wails build (--skip-wails)"
fi

BINARY_PATH="$BUILD_DIR/bin/$BINARY_NAME"
if [[ ! -f "$BINARY_PATH" ]]; then
  echo "✗ Không tìm thấy binary tại $BINARY_PATH"
  exit 1
fi

# ─────────────────────────────────────────────
# STEP 2: Tải appimagetool nếu chưa có
# ─────────────────────────────────────────────
APPIMAGETOOL="$BUILD_DIR/bin/appimagetool"
if [[ ! -x "$APPIMAGETOOL" ]]; then
  echo "▸ Đang tải appimagetool..."
  APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"
  if command -v wget &>/dev/null; then
    wget -q "$APPIMAGETOOL_URL" -O "$APPIMAGETOOL"
  elif command -v curl &>/dev/null; then
    curl -fsSL "$APPIMAGETOOL_URL" -o "$APPIMAGETOOL"
  else
    echo "✗ Cần wget hoặc curl để tải appimagetool"
    exit 1
  fi
  chmod +x "$APPIMAGETOOL"
  echo "✓ appimagetool đã sẵn sàng"
fi

# ─────────────────────────────────────────────
# STEP 3: Tạo AppDir
# ─────────────────────────────────────────────
echo "▸ Tạo AppDir..."
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin"
mkdir -p "$APPDIR/usr/share/applications"
mkdir -p "$APPDIR/usr/share/icons/hicolor/256x256/apps"

# Binary
cp "$BINARY_PATH" "$APPDIR/usr/bin/$BINARY_NAME"
chmod +x "$APPDIR/usr/bin/$BINARY_NAME"

# Icon
ICON_SRC="$BUILD_DIR/appicon.png"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$APPDIR/usr/share/icons/hicolor/256x256/apps/$BINARY_NAME.png"
  cp "$ICON_SRC" "$APPDIR/$BINARY_NAME.png"
else
  # Tạo icon placeholder nếu không có
  echo "⚠ Không tìm thấy icon, dùng placeholder"
  touch "$APPDIR/$BINARY_NAME.png"
fi

# .desktop file
cat > "$APPDIR/usr/share/applications/$BINARY_NAME.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=$APP_NAME
GenericName=Arch Linux App Store
Comment=Khám phá, cài đặt và đánh giá các gói phần mềm trên Arch Linux
Exec=$BINARY_NAME
Icon=$BINARY_NAME
Categories=System;PackageManager;
Terminal=false
Keywords=arch;linux;package;aur;pacman;store;
StartupNotify=true
DESKTOP

# Symlink .desktop ở root AppDir (yêu cầu của AppImage spec)
cp "$APPDIR/usr/share/applications/$BINARY_NAME.desktop" "$APPDIR/$BINARY_NAME.desktop"

# AppRun script
cat > "$APPDIR/AppRun" << 'APPRUN'
#!/bin/bash
# AppRun — entry point cho AppImage
HERE="$(dirname "$(readlink -f "${0}")")"

# Xuất env vars cần thiết
export PATH="$HERE/usr/bin:$PATH"
export LD_LIBRARY_PATH="$HERE/usr/lib:$LD_LIBRARY_PATH"

# Wails app cần DISPLAY hoặc WAYLAND_DISPLAY
if [[ -z "$DISPLAY" && -z "$WAYLAND_DISPLAY" ]]; then
  echo "Lỗi: Cần chạy trong môi trường đồ họa (X11 hoặc Wayland)" >&2
  exit 1
fi

exec "$HERE/usr/bin/archstore" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"

echo "✓ AppDir đã tạo tại $APPDIR"

# ─────────────────────────────────────────────
# STEP 4: Đóng gói thành AppImage
# ─────────────────────────────────────────────
echo "▸ Đang đóng gói thành AppImage..."
mkdir -p "$(dirname "$OUTPUT")"

# ARCH=x86_64 để tránh auto-detect sai
ARCH=x86_64 "$APPIMAGETOOL" "$APPDIR" "$OUTPUT" 2>&1

if [[ -f "$OUTPUT" ]]; then
  chmod +x "$OUTPUT"
  SIZE=$(du -sh "$OUTPUT" | cut -f1)
  echo ""
  echo "╔═══════════════════════════════════════════════════╗"
  echo "║  ✓ AppImage đã sẵn sàng!                         ║"
  echo "╠═══════════════════════════════════════════════════╣"
  printf "║  📦 File  : %-37s║\n" "$(basename "$OUTPUT")"
  printf "║  📁 Path  : %-37s║\n" "$(dirname "$OUTPUT")/"
  printf "║  💾 Size  : %-37s║\n" "$SIZE"
  echo "╠═══════════════════════════════════════════════════╣"
  echo "║  Cách chạy:                                       ║"
  echo "║    chmod +x ArchStore-*.AppImage                  ║"
  echo "║    ARCHSTORE_API_KEY=yourkey ./ArchStore-*.AppImage ║"
  echo "╚═══════════════════════════════════════════════════╝"
else
  echo "✗ Build thất bại"
  exit 1
fi
