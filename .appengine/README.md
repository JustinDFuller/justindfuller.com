# App Engine Deployment Configuration

This directory contains the unified deployment configuration for both production and preview environments.

## Structure

### Core Files

- `app.yaml` - App Engine configuration used by both production and preview
- `dispatch.yaml` - URL routing rules for production services
- `preview-environments.md` - Documentation for PR preview deployment system

### How It Works

1. **Deployment**:
   - Production: Uses `app.yaml` with `service: default` appended
   - Preview: Uses `app.yaml` with `service: pr-{number}` appended
2. **Serving**: The main Go application (in project root) serves all content dynamically with proper caching headers

### Key Improvements

- **No Duplication**: Single `app.yaml` base for both environments
- **Consistent Caching**: Same caching strategy for both production and preview
- **Simplified Maintenance**: Changes to serving logic only need to be made in one place
- **ETag Support**: Automatic ETag generation and 304 responses for unchanged content

### Deployment Workflows

#### Production (main branch)

1. Builds static files with `make build`
2. Copies `.appengine/app.yaml` to root with `service: default` appended
3. Copies `.appengine/dispatch.yaml` to root
4. Deploys to App Engine

#### Preview (pull requests)

1. Builds static files with `make build`
2. Copies `.appengine/app.yaml` to root with `service: pr-{number}` appended
3. Deploys to App Engine with preview URL

### Cache Strategy

- HTML: 5 minutes (quick updates)
- CSS/JS: 1 hour (moderate caching)
- Images: 30 days (rarely change)
- Fonts: 1 year (almost never change)
- All responses include ETags for efficient 304 responses

### Notes

- The main.go application remains in the project root
- Service names are dynamically appended during deployment
- Configuration files are copied from .appengine/ during CI/CD
