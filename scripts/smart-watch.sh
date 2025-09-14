#!/bin/bash

# Smart watch that only rebuilds when Go files change
# For content-only changes, use: make content-watch

echo "=== Smart Watch Mode ==="
echo "• Rebuilds and restarts on .go file changes"
echo "• Just restarts on content file changes"
echo ""
echo "Tip: Use 'make content-watch' if you're only editing content files"
echo ""

# Build initially if binary doesn't exist
if [ ! -f ./justindfuller.com ]; then
    echo "Building initial binary..."
    if ! go build -race -o justindfuller.com .; then
        echo "Initial build failed"
        exit 1
    fi
fi

# Use reflex to watch all relevant files
# The command checks what changed and acts accordingly
reflex -s --decoration=none \
    -r '\.(go|md|html|css|js|json|yaml|yml|template\.html)$' \
    -- bash -c '
        # Simple detection: if any .go file was modified recently (within last 2 seconds)
        # we rebuild. Otherwise, we just restart.

        if find . -name "*.go" -newermt "2 seconds ago" 2>/dev/null | grep -q .; then
            clear
            echo "=== Go files changed - Rebuilding ==="
            if go build -race -o justindfuller.com .; then
                echo "Build successful, starting server..."
                exec ./justindfuller.com
            else
                echo "Build failed"
                sleep 2
                exit 1
            fi
        else
            clear
            echo "=== Content files changed - Restarting ==="
            exec ./justindfuller.com
        fi
    '