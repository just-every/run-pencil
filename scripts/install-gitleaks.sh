#!/usr/bin/env bash
set -euo pipefail
readonly version=8.30.1
case "$(uname -s):$(uname -m)" in
  Darwin:arm64) platform=darwin_arm64; checksum=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5 ;;
  Darwin:x86_64) platform=darwin_x64; checksum=dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709 ;;
  Linux:arm64|Linux:aarch64) platform=linux_arm64; checksum=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;;
  Linux:x86_64) platform=linux_x64; checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
  *) printf 'Gitleaks: unsupported platform\n' >&2; exit 1 ;;
esac
install_dir=${GITLEAKS_INSTALL_DIR:-"$HOME/.local/bin"}
mkdir -p "$install_dir"
scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
archive="gitleaks_${version}_${platform}.tar.gz"
curl --fail --silent --show-error --location --retry 5 --retry-all-errors --retry-delay 5 --proto '=https' --proto-redir '=https' \
  "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}" -o "$scratch/$archive"
if command -v sha256sum >/dev/null; then actual=$(sha256sum "$scratch/$archive");
else actual=$(shasum -a 256 "$scratch/$archive"); fi
[[ ${actual%% *} == "$checksum" ]] || { printf 'Gitleaks: checksum mismatch\n' >&2; exit 1; }
tar -xzf "$scratch/$archive" -C "$scratch" gitleaks
install -m 755 "$scratch/gitleaks" "$install_dir/gitleaks"
printf 'Installed Gitleaks %s (%s), SHA-256 verified\n' "$version" "$platform"
