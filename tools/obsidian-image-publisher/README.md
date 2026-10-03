# Obsidian Image Publisher

This Mac-only Obsidian plugin watches `Blog/image/` and publishes supported images to every configured S3 destination. It leaves source files and Markdown links unchanged. Objects use immutable content-addressed keys such as `v1/<sha256>.png`; the plugin uses conditional create-only uploads and verifies object length, content type, and digest metadata before updating `Blog/asset-manifest.json`.

The manifest has `version: 1` and an `images` map keyed by paths relative to `Blog/`. Each record contains `sha256`, `md5`, `size`, `contentType`, and `key`. The website reads this manifest and emits public CloudFront URLs; the S3 bucket remains private. The website source scan must ignore exactly `asset-manifest.json` at the source root, because its ordinary inputs are root Markdown and images under `image/`.

## AWS setup

The current deployment uses one private S3 bucket behind CloudFront for both preview and production. `media.justindfuller.com` is the CloudFront hostname, not the S3 bucket name. Use the `MediaBucketName` output from the infrastructure stack and its AWS region when configuring the plugin. The plugin does not change bucket policies, ACLs, public-access settings, or CloudFront configuration; the CloudFront origin remains private.

Use a dedicated IAM access key scoped to the dedicated bucket and `v1/*` objects. The policy needs `s3:PutObject` and `s3:GetObject` on the bucket's `v1/*` object resources, plus `s3:ListBucket` on the dedicated bucket. S3 `HeadObject` reports a missing key as 404 only when the caller has `s3:ListBucket`; without that permission the plugin cannot distinguish a missing object from access denial. The current policy grants `ListBucket` on the dedicated bucket without a prefix condition. Do not grant `DeleteObject`, ACL, or bucket-policy permissions. Configure Object Lock or an equivalent bucket policy if immutability must also hold against other clients using the credential.

The plugin stores the access-key ID and secret together in the macOS Keychain through the N-API keyring binding; neither value is written to Obsidian plugin settings, the manifest, logs, or process arguments. Credentials are static IAM keys; AWS SSO is not supported. Every configured destination must verify before a manifest record is committed. A partial success leaves an unreferenced object at the successful destination and retries safely on the next pass. Keep a single destination for the current shared preview/production bucket.

## Validation and reconciliation

Startup performs a full reconciliation. Create, modify, delete, and rename events under `Blog/image/` schedule a debounced scan, and a five-minute scan catches missed events. The plugin never deletes remote objects; obsolete content-addressed objects may remain after local files are removed. Keep the manifest entry for an old path if existing Markdown may still refer to it.

Only lowercase `.jpg`, `.png`, and `.svg` extensions are accepted. Raster files must match their file signatures. SVG files are limited to a static XML subset: scripts, event attributes, styles, external URLs, external entities, embedded media, and unsupported elements are rejected. Each file is capped at 20 MiB and files are read and uploaded sequentially, bounding working memory to one image. A changed file is hashed again when Obsidian emits its event even if size and modification time are unchanged.

The publisher manifest is a normal file at `Blog/asset-manifest.json`, so the currently configured Google Sync backend can carry it with the notes and images. Google Sync is currently Drive-backed; the publisher does not depend on GCS or change that configuration. The website source scan must ignore exactly this root manifest file. The publisher itself watches only `Blog/image/`, so manifest updates do not trigger another upload pass. The manifest becomes visible to the website through the next configured Google Sync cycle.

## Build and tests

Run `npm install`, `npm test`, and `npm run package`. Packaging produces a ready-to-copy `release/` folder with `main.js`, `manifest.json`, and the current Mac architecture's native Keychain binding. Packaging verifies that the native binding loads without accessing Keychain entries. Build on the same Mac architecture that will run Obsidian, then copy the contents into `.obsidian/plugins/obsidian-image-publisher/`.

Tests use in-memory vault and S3 fakes. They do not read credentials, contact AWS, or mutate remote buckets.
