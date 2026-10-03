# Obsidian Programming Sync

The target runtime reads programming Markdown and source image metadata from the private Google Cloud Storage prefix `gs://justindfuller-obsidian-prd/Documents/Blog/`. It overlays valid posts onto the Git-backed programming section while preserving additive, overwrite, draft, validation, and last-known-good behavior. Runtime reads use Google Application Default Credentials with read-only access. This is the current checkout's target configuration; it does not establish that the live site or Obsidian sync has migrated.

The site lists source objects and their generation, size, MD5, and content type once per minute. It downloads the version-1 asset manifest only when that manifest's GCS generation changes and caches parsed Markdown while its revision and the shared image revision epoch remain unchanged. A change to the manifest or any supported image object's metadata invalidates that shared epoch. GCS image bytes are not downloaded by the Go application.

## Manifest and image publishing

The Obsidian Image Publisher source is in `tools/obsidian-image-publisher/`. It watches `Blog/image/`, validates supported JPG, PNG, and safe SVG files, uploads immutable SHA-256-keyed objects to configured S3 destinations, verifies destination metadata, and updates `Blog/asset-manifest.json`. The Obsidian Google Sync configuration must sync that manifest and the Markdown/image source into the private GCS prefix `Documents/Blog/`; the expected mapping is `Blog/` in the vault to `Documents/Blog/` in GCS. The live sync configuration has not been changed as part of this documentation update.

Manifest version 1 has the shape `{"version":1,"images":{"image/path.png":{"sha256":"<64 lowercase hex>","md5":"<32 lowercase hex>","size":123,"contentType":"image/png","key":"v1/<sha256>.png"}}}`. The `images` keys are paths relative to `Blog/`. The runtime checks the record against the GCS image object's MD5 and size and rewrites references to `https://media.justindfuller.com/v1/<sha256>.<extension>`. A missing, malformed, or unreadable manifest makes the source snapshot unavailable and preserves the last-known-good overlay. A missing or mismatched image record affects only that image reference; the post and other references remain available.

The S3 bucket stays private and CloudFront reads the published `v1/*` objects through Origin Access Control. The browser receives a public immutable CloudFront URL; anyone who knows the URL can fetch that image. The URL is public delivery, not authorization. The Go app emits image URLs directly and has no synchronized-image download route.

## Runtime configuration

The current checkout's `.appengine/app.yaml` and Makefile define `OBSIDIAN_GCS_BUCKET`, `OBSIDIAN_GCS_PREFIX`, and `OBSIDIAN_MEDIA_BASE_URL`. The preview workflow inherits those values and changes only `OBSIDIAN_ENVIRONMENT` to `pr`. Production and preview App Engine runtime identities need read access to the private GCS bucket; deployments use ADC and do not read local AWS or Google credentials. IAM grants and deployed runtime configuration remain rollout prerequisites.

Local runs use ADC for GCS as well. Set up the developer's local ADC using the Google Cloud CLI with read-only access to the configured bucket. Do not use a service-account key file in the repository or environment. `OBSIDIAN_ENVIRONMENT` remains `local`, `pr`, or `prd` and controls the existing promotion matrix. The currently observed live Obsidian Google Sync settings still have Drive enabled and GCS disabled; the existing GCS objects do not yet include `asset-manifest.json`.

## Media infrastructure and rollout prerequisites

The CloudFront/S3 stack is defined under `infra/media/`; its deployment sequence and change-set review steps are in [`infra/media/README.md`](../../../infra/media/README.md). Before publishing images, provision and review the stack, request and validate the ACM certificate in `us-east-1`, attach the distribution CNAME for `media.justindfuller.com` at the existing DNS provider, configure the plugin's S3 destination, and verify the GCS reader identities have bucket access. No AWS stack execution, DNS change, IAM attachment, plugin credential setup, or live synchronization is implied by this proposal.

The publisher currently stores an S3 access key ID and secret in the macOS Keychain. Use a dedicated, least-privilege uploader identity restricted to `v1/*`; never use the account root identity. The plugin performs `HeadObject` verification as well as immutable uploads, so its IAM policy must allow the corresponding object read/metadata check in addition to `PutObject`. Short-lived IAM Identity Center profiles are not supported by the current plugin credential path.

The CloudFront `FREE` plan has a $0/month subscription and published baseline allowances of 1 million viewer requests, 100 GB transfer, and 5 GB S3 Standard storage credit per month. It is not a guarantee that the complete image workflow costs $0: S3 API requests, uploads, and storage beyond the credit can incur charges. The stack's `$1/month` budget sends alerts and is not a spending cap. Confirm plan eligibility, allowance behavior, budget delivery, and actual costs before rollout; see the infrastructure README for details.
