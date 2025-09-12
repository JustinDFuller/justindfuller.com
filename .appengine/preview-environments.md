# Preview Environments for Pull Requests

This repository is configured to automatically deploy preview environments for pull requests to Google App Engine.

## How It Works

1. **Automatic Deployment**: When you open a pull request, GitHub Actions automatically:
   - Builds the application
   - Deploys it to a preview service named `pr-{PR_NUMBER}`
   - Comments on the PR with the preview URL

2. **Preview URL**: Your preview will be available at:

   ```text
   https://pr-{PR_NUMBER}-dot-justindfuller.uc.r.appspot.com
   ```

3. **Updates**: Every time you push new commits to the PR branch, the preview environment is automatically updated.

4. **Cleanup**: When the PR is closed or merged, the preview environment is automatically deleted.

## Technical Details

### Service Isolation

- Each PR gets its own App Engine service (`pr-{PR_NUMBER}`)
- Preview environments are completely isolated from production
- Production deployment remains on the `default` service

### Files Involved

- `.github/workflows/deploy-preview.yml` - Handles PR preview deployments
- `.github/workflows/cleanup-preview.yml` - Cleans up closed PR environments
- `.github/workflows/deploy.yml` - Production deployment (unchanged)
- `.appengine/dispatch-preview.yaml` - Template for preview dispatch rules

### Security

- Preview deployments only work for PRs from the same repository (not forks)
- Uses the same Google Cloud credentials as production deployments
- Each preview has its own version history

### Limitations

- Preview environments share the same Google Cloud project as production
- Database and other backend services are shared (be careful with data modifications)
- Custom domains are not available for preview environments

## Troubleshooting

### Preview Not Deploying

- Check that the PR is from a branch in this repository (not a fork)
- Verify GitHub Actions are passing
- Check the Deploy PR Preview workflow logs

### Preview Not Accessible

- Wait a few minutes after deployment for DNS propagation
- Check the PR comments for the correct URL
- Verify the service exists in Google Cloud Console

### Cleanup Issues

- If a preview isn't cleaned up automatically, you can manually delete it:

  ```bash
  gcloud app services delete pr-{PR_NUMBER} --project=justindfuller
  ```
