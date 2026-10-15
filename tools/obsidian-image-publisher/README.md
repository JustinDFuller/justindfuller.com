# Obsidian Cloudflare Publisher

This desktop plugin uploads root Markdown and `image/` originals to private Cloudflare R2 source storage. It activates a complete immutable snapshot after verifying its objects, then dispatches `cloudflare.yml` on `main`. Upload success and deployment verification are separate states. The installation ID remains `obsidian-image-publisher` so it can replace the previous image publisher.

Automatic publishing starts disabled. Keep it disabled until the Actions integration, protected staging and PR destinations, and production publication have passed hosted verification. The implementation is currently in progress.

## Build and package

Run `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run package` in this directory. Package on macOS to include the matching asynchronous Keychain native binding. The ignored `release/` directory contains `main.js`, `manifest.json`, and the native module for the current architecture. Packaging verifies that the module exposes `AsyncEntry`.

## Configuration

Select the Cloudflare account and private source/state bucket names. Leave Source folder blank when the Blog directory is itself the Obsidian vault; use `Blog` when it is a folder inside a larger vault. Old S3 destinations and credentials are not adopted automatically.

The three credentials are separate macOS Keychain entries under `com.justindfuller.obsidian-publisher.cloudflare`: `upload` holds private source R2 credentials, `dispatch` holds the dedicated GitHub Actions token, and `reports` holds state-bucket read-only credentials. Settings and local scheduler state contain no credentials or note bodies. The uploader never writes public media or accepted deployment state and has no object-delete operation.

Use the Publish content to Cloudflare command for a manual scan. Automatic scans use a 60-second quiet window, a two-minute maximum batch age, and five-minute reconciliation. A persisted dispatch survives restart; protected reports for both targets reconcile ambiguous dispatch success. Provider failures back off to five minutes, and dispatch authentication failures wait for a manual retry after credential replacement.

Reports and new issue/recovery notices are isolated by target. Private source upload or a successful GitHub dispatch does not establish that staging or production has published the revision.

## Publication issue notices

When a protected report for staging or production contains a blocking issue, the plugin keeps a notice on screen until the issue is resolved or dismissed. Blocking issues are Markdown validation failures, retained last-known-good fallbacks, route collisions, and overwrite-target conflicts. Each notice names the note, gives the reason from the protected report, and lists the targets still serving the previous version. A rejected note that also has a retained previous version shows one notice, not two. Reports written before reasons were retained show the category text instead. Other issues, such as an image that is not ready yet, keep their short transient notice.

The same issue reported by both targets produces one notice that names both targets. A notice does not repeat on later status checks, and it is shown again after a restart while the issue remains.

Click a notice to dismiss it. A dismissed issue stays hidden while its fingerprint and reason are unchanged. It is shown again if the issue changes or comes back after publication recovered.

The status bar shows the number of unresolved issues, including dismissed ones, and is hidden when there are none. Click it to open the details for every unresolved issue. When a later report no longer contains the issue, the notice clears and the count drops. The plugin reports `publication recovered` for a target when its last blocking issue clears. Reports that describe a source outage leave the notices and dismissals in place until a report from a healthy source replaces them.
