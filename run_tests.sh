#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  scripts/run_tests.sh (macOS only — uses AppleScript/Terminal)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ───────── 1) BUILD / CODE‑GEN STEPS ─────────
echo "🚀 cargo build-sbf"
cargo build-sbf

echo "📜 shank idl"
shank idl

echo "🛠 npx codama run js"
npx codama run js

# ───────── 2) START SURFPOOL IN A NEW TERMINAL WINDOW ─────────
echo "🌊 Launching surfpool in its own Terminal window…"

# Get current directory
CURRENT_DIR=$(pwd)

# Create new Terminal window and run surfpool
SURF_WIN_ID=$(osascript <<APPLESCRIPT
tell application "Terminal"
    -- Create a new window
    set newWindow to do script "cd ${CURRENT_DIR} && surfpool start"
    -- Get the window ID
    set windowID to id of window 1
    return windowID
end tell
APPLESCRIPT
)

echo "ℹ️  Surfpool running in Terminal window id ${SURF_WIN_ID}"
sleep 3  # give Surfpool a moment to boot (change if needed)

# ───────── 3) RUN E2E TESTS ─────────
echo "✅ Running e2e tests…"
npx tsx e2e/e2e.ts
TEST_EXIT=$?

# ───────── 4) CLOSE THE SURFPOOL WINDOW ─────────
echo "🧹 Closing Surfpool window…"
osascript <<APPLESCRIPT
tell application "Terminal"
    try
        -- Send ESC key to the window
         tell application "System Events"
            tell process "Terminal"
                set frontmost to true
                key code 53 -- ESC key
            end tell
        end tell
        -- First, send Ctrl+C to terminate the process
        do script "exit" in window id ${SURF_WIN_ID}
        delay 0.5
        -- Then close the window without confirmation
        close window id ${SURF_WIN_ID} saving no
    end try
end tell
APPLESCRIPT