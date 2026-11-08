#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Official pinned installer: checksum verified and bounded retry; fail closed.
set -euo pipefail
: "$RUNNER_TEMP"
ELAN_VERSION=v4.2.4
ELAN_SHA256=42b94d4244e8353142c456ec0e4ca6528fd898a6c604d4059f494e706e431f63
LEAN_TOOLCHAIN=leanprover/lean4:v4.35.0
url="https://github.com/leanprover/elan/releases/download/$ELAN_VERSION/elan-x86_64-unknown-linux-gnu.tar.gz"
scratch="$(mktemp -d "$RUNNER_TEMP/q16-elan.XXXXXXXX")"
trap 'rm -rf "$scratch"' EXIT

curl --fail --silent --show-error --location \
  --connect-timeout 15 --max-time 120 \
  --retry 5 --retry-delay 4 --retry-max-time 240 --retry-all-errors \
  "$url" -o "$scratch/elan.tar.gz"
printf '%s  %s\n' "$ELAN_SHA256" "$scratch/elan.tar.gz" | sha256sum --check --status
tar -xzf "$scratch/elan.tar.gz" -C "$scratch"
test -f "$scratch/elan-init"
chmod 700 "$scratch/elan-init"

# Install elan without coupling bootstrap to a potentially failing Lean download.
"$scratch/elan-init" -y --default-toolchain none --no-modify-path
tool="$HOME/.elan/bin/elan"
test -x "$tool"
installed=false
for attempt in 1 2 3 4; do
  echo "Installing $LEAN_TOOLCHAIN, attempt $attempt/4"
  if "$tool" toolchain install "$LEAN_TOOLCHAIN"; then
    installed=true
    break
  fi
  if [ "$attempt" -lt 4 ]; then
    sleep $((attempt * 5))
  fi
done
if [ "$installed" != true ]; then
  echo "::error::Pinned Lean toolchain download failed after bounded retry; proof NOT RUN."
  exit 1
fi
"$tool" default "$LEAN_TOOLCHAIN"
echo "$HOME/.elan/bin" >> "$GITHUB_PATH"
version="$("$HOME/.elan/bin/lean" --version)"
printf '%s\n' "$version"
case "$version" in
  *"4.35.0"*) ;;
  *) echo "::error::Lean toolchain version mismatch"; exit 1 ;;
esac
"$HOME/.elan/bin/lake" --version
