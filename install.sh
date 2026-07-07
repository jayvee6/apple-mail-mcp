#!/usr/bin/env bash
# apple-mail-mcp installer
# Usage (fresh install):  curl -fsSL https://raw.githubusercontent.com/jayvee6/apple-mail-mcp/master/install.sh | bash
# Usage (local):          ./install.sh

set -euo pipefail

REPO_URL="https://github.com/jayvee6/apple-mail-mcp.git"
DEFAULT_INSTALL_DIR="$HOME/apple-mail-mcp"
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# ── colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${BLUE}▸${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

echo -e "\n${BOLD}apple-mail-mcp installer${NC}\n"

# ── 1. platform check ─────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || error "This MCP server requires macOS."

# ── 2. find (or install) Node.js ──────────────────────────────────────────────
find_node() {
  # Prefer stable system/homebrew locations over version-manager shims.
  # Version-manager shims (nvm/volta/fnm) work too, but the path will be
  # version-locked — a note is printed below.
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.volta/bin/node" \
    "$(command -v node 2>/dev/null || true)"; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
}

NODE_BIN="$(find_node)"
if [[ -z "$NODE_BIN" ]]; then
  error "Node.js not found. Install it from https://nodejs.org or via Homebrew: brew install node"
fi

NODE_VERSION="$("$NODE_BIN" --version 2>/dev/null)"
MAJOR="${NODE_VERSION#v}"; MAJOR="${MAJOR%%.*}"
(( MAJOR >= 18 )) || error "Node.js 18+ required (found $NODE_VERSION). Upgrade at https://nodejs.org"

success "Node.js $NODE_VERSION at $NODE_BIN"

# Warn nvm/volta users whose path is version-locked
if [[ "$NODE_BIN" == *".nvm"* ]] || [[ "$NODE_BIN" == *"versions/node"* ]]; then
  warn "nvm detected. The Claude config will point to this exact Node.js version."
  warn "Re-run this script after upgrading Node.js to update the path."
fi

# ── 3. locate or clone the repo ───────────────────────────────────────────────
# If we're already inside the repo (e.g. ./install.sh), use the current directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
if [[ -f "$SCRIPT_DIR/package.json" ]] && grep -q '"apple-mail-mcp"' "$SCRIPT_DIR/package.json" 2>/dev/null; then
  INSTALL_DIR="$SCRIPT_DIR"
  info "Using existing repo at $INSTALL_DIR"
else
  INSTALL_DIR="$DEFAULT_INSTALL_DIR"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Updating existing install at $INSTALL_DIR..."
    git -C "$INSTALL_DIR" pull --ff-only
  else
    info "Cloning into $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
fi

# ── 4. build ──────────────────────────────────────────────────────────────────
info "Installing dependencies..."
(cd "$INSTALL_DIR" && npm install --silent)
info "Building..."
(cd "$INSTALL_DIR" && npm run build --silent)
success "Build complete"

# ── 5. patch claude_desktop_config.json ───────────────────────────────────────
DIST_PATH="$INSTALL_DIR/dist/index.js"

patch_config() {
  python3 - "$CLAUDE_CONFIG" "$NODE_BIN" "$DIST_PATH" <<'PYEOF'
import sys, json, os

config_path, node_bin, dist_path = sys.argv[1], sys.argv[2], sys.argv[3]

# Read existing config (create if absent)
os.makedirs(os.path.dirname(config_path), exist_ok=True)
config = {}
if os.path.exists(config_path):
    with open(config_path) as f:
        try:
            config = json.load(f)
        except json.JSONDecodeError:
            print("WARNING: claude_desktop_config.json is not valid JSON — creating a fresh one.", file=sys.stderr)

if "mcpServers" not in config:
    config["mcpServers"] = {}

# Point Claude at the local build we just produced. This is the authoritative
# artifact: the installer cloned + built the current source, so dist_path always
# matches this repo's HEAD.
#
# Do NOT use `npx @jdot6/apple-mail-mcp` here — npx fetches the last *published*
# npm release, which can lag the source (e.g. a merged PR that was never
# `npm publish`ed) and would silently start an older build missing newer tools.
# npx also buys no portability: it lives next to node_bin, so it is exactly as
# path-bound as node_bin itself.
if not os.path.isfile(dist_path):
    print(f"ERROR: built artifact not found at {dist_path}", file=sys.stderr)
    sys.exit(1)

config["mcpServers"]["apple-mail"] = {
    "command": node_bin,
    "args": [dist_path]
}

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PYEOF
}

info "Patching Claude Desktop config..."
if patch_config; then
  success "Added apple-mail to $CLAUDE_CONFIG"
else
  warn "Could not auto-patch the config. Add this manually to $CLAUDE_CONFIG:"
  echo ""
  echo '  "mcpServers": {'
  echo '    "apple-mail": {'
  echo "      \"command\": \"$NODE_BIN\","
  echo "      \"args\": [\"$DIST_PATH\"]"
  echo '    }'
  echo '  }'
  echo ""
fi

# ── 6. done ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Done!${NC}"
echo ""
echo "  Next steps:"
echo "  1. Restart Claude Desktop"
echo "  2. Open Apple Mail (it must be running for the tools to work)"
echo "  3. When prompted, allow Claude to control Mail (System Settings → Privacy & Security → Automation)"
echo ""
echo "  Try asking: \"What folders do I have in my mail?\""
echo ""
