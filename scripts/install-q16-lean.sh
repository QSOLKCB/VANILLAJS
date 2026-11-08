#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Use exact official release bytes; never accept an unverified downloaded tool.
set -euo pipefail
: "$RUNNER_TEMP"
ELAN_VERSION=v4.2.4
ELAN_SHA256=42b94d4244e8353142c456ec0e4ca6528fd898a6c604d4059f494e706e431f63
LEAN_VERSION=4.35.0
LEAN_TOOLCHAIN=leanprover/lean4:v4.35.0
LEAN_TAR_SHA256=7289597a44543246c9227b8cae501767e095ce17f6d448b95fc4a8dc97268f6d
LEAN_ZIP_SHA256=c8531faaa4a93d5a4dae0c742cbc1bd42a2993594d02f93a9d629ebf299fb2c8
scratch="$(mktemp -d "$RUNNER_TEMP/q16-elan.XXXXXXXX")"
trap 'rm -rf "$scratch"' EXIT

checked_download() {
  local url="$1" destination="$2" digest="$3"
  curl --fail --silent --show-error --location \
    --connect-timeout 15 --max-time 300 \
    --retry 4 --retry-delay 4 --retry-max-time 600 --retry-all-errors \
    "$url" -o "$destination"
  printf '%s  %s\n' "$digest" "$destination" | sha256sum --check --status
}

checked_download \
  "https://github.com/leanprover/elan/releases/download/$ELAN_VERSION/elan-x86_64-unknown-linux-gnu.tar.gz" \
  "$scratch/elan.tar.gz" "$ELAN_SHA256"
tar -xzf "$scratch/elan.tar.gz" -C "$scratch"
test -f "$scratch/elan-init"
chmod 700 "$scratch/elan-init"
"$scratch/elan-init" -y --default-toolchain none --no-modify-path
tool="$HOME/.elan/bin/elan"
test -x "$tool"

installed=false
# First try normal elan toolchain resolution. The official Lean distribution
# endpoint may return HTTP 504 even when GitHub release artifacts are reachable.
for attempt in 1 2; do
  echo "Checking pinned $LEAN_TOOLCHAIN distribution (attempt $attempt/2)"
  if "$tool" toolchain install "$LEAN_TOOLCHAIN"; then
    installed=true
    break
  fi
  if [ "$attempt" -lt 2 ]; then sleep 4; fi
done

if [ "$installed" = true ]; then
  "$tool" default "$LEAN_TOOLCHAIN"
  echo "$HOME/.elan/bin" >> "$GITHUB_PATH"
  lean_bin="$HOME/.elan/bin/lean"
  lake_bin="$HOME/.elan/bin/lake"
else
  echo "::warning::Lean distribution endpoint unavailable; using verified official GitHub release archive."
  asset_base="https://github.com/leanprover/lean4/releases/download/v$LEAN_VERSION"
  if command -v zstd >/dev/null 2>&1; then
    checked_download \
      "$asset_base/lean-$LEAN_VERSION-linux.tar.zst" \
      "$scratch/lean.tar.zst" "$LEAN_TAR_SHA256"
    tar --use-compress-program=zstd -xf "$scratch/lean.tar.zst" -C "$scratch"
  elif command -v unzip >/dev/null 2>&1; then
    checked_download \
      "$asset_base/lean-$LEAN_VERSION-linux.zip" \
      "$scratch/lean.zip" "$LEAN_ZIP_SHA256"
    unzip -q "$scratch/lean.zip" -d "$scratch"
  else
    echo "::error::Neither zstd nor unzip available to extract the verified Lean archive; proof NOT RUN."
    exit 1
  fi
  release_dir="$scratch/lean-$LEAN_VERSION-linux"
  test -x "$release_dir/bin/lean"
  test -x "$release_dir/bin/lake"
  # Move installed, checksum-verified toolchain outside the scratch directory.
  target="$RUNNER_TEMP/q16-lean-$LEAN_VERSION"
  test ! -e "$target"
  mv "$release_dir" "$target"
  echo "$target/bin" >> "$GITHUB_PATH"
  lean_bin="$target/bin/lean"
  lake_bin="$target/bin/lake"
fi

observed="$("$lean_bin" --version)"
printf '%s\n' "$observed"
case "$observed" in
  *"4.35.0"*) ;;
  *) echo "::error::Pinned Lean toolchain mismatch, proof NOT RUN"; exit 1 ;;
esac
"$lake_bin" --version
