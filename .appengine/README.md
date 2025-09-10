# App Engine Deployment Configuration

This directory contains the unified deployment configuration for both production and preview environments.

## Structure

### Core Files (Unified)
- `app.yaml` - App Engine configuration used by both production and preview
- `main.go` - Single Go application that serves static files with proper caching
- `dispatch.yaml` - URL routing rules for production services
- `build.sh` - Build script that generates static files

### How It Works

1. **Build Process**: The `build.sh` script runs the main application to generate static HTML files into `.build/` directory
2. **Deployment**: 
   - Production: Uses `app.yaml` with `service: default` appended
   - Preview: Uses `app.yaml` with `service: pr-{number}` appended
3. **Serving**: `main.go` serves static files from `.build/` with proper caching headers

### Key Improvements

- **No Duplication**: Single `main.go` and `app.yaml` base for both environments
- **Consistent Caching**: Same caching strategy for both production and preview
- **Simplified Maintenance**: Changes to serving logic only need to be made in one place
- **ETag Support**: Automatic ETag generation and 304 responses for unchanged content

### Deployment Workflows

#### Production (main branch)
1. Builds static files with `make build`
2. Copies `.appengine/main.go` to root
3. Copies `.appengine/app.yaml` to root with `service: default` appended
4. Deploys to App Engine

#### Preview (pull requests)
1. Builds static files with `make build`
2. Copies `.appengine/main.go` to root
3. Copies `.appengine/app.yaml` to root with `service: pr-{number}` appended
4. Deploys to App Engine with preview URL

### Cache Strategy

- HTML: 5 minutes (quick updates)
- CSS/JS: 1 hour (moderate caching)
- Images: 30 days (rarely change)
- Fonts: 1 year (almost never change)
- All responses include ETags for efficient 304 responses

### Cleanup

After verifying the unified setup works, run `./cleanup-duplicates.sh` to remove old duplicate files.