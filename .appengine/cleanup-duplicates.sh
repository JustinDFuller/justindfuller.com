#!/bin/bash

# This script removes duplicate deployment files after migrating to unified configuration
# Run this after verifying the unified setup works correctly

echo "This will remove the following duplicate deployment files:"
echo "  - .appengine/main-preview.go (replaced by main.go)" 
echo "  - .appengine/main-preview-cached.go (replaced by main.go)"
echo "  - .appengine/app-preview.yaml (replaced by app.yaml)"
echo "  - .appengine/app-preview-minimal.yaml (replaced by app.yaml)"
echo "  - .appengine/app-preview-dynamic.yaml (replaced by app.yaml)"
echo "  - .appengine/dispatch-preview.yaml (not needed)"
echo "  - .appengine/app.tmpl.yaml (not needed)"
echo ""
read -p "Are you sure you want to remove these files? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    rm -f .appengine/main-preview.go
    rm -f .appengine/main-preview-cached.go
    rm -f .appengine/app-preview.yaml
    rm -f .appengine/app-preview-minimal.yaml
    rm -f .appengine/app-preview-dynamic.yaml
    rm -f .appengine/dispatch-preview.yaml
    rm -f .appengine/app.tmpl.yaml
    
    echo "Duplicate files removed successfully!"
    echo ""
    echo "Remaining files in .appengine/:"
    ls -la .appengine/
else
    echo "Cleanup cancelled."
fi