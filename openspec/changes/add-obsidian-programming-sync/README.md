# add-obsidian-programming-sync

Runtime Obsidian/Google Drive overlay for programming posts and image assets

Local Drive access uses a macOS Keychain generic password rather than a service-account key or local ADC file. The default item uses account `$USER` and service `justindfuller.com/obsidian-google-drive`. Its value is a single-line `authorized_user` JSON payload containing `type`, `client_id`, `client_secret` when required, and a Drive-read-scoped `refresh_token`.

The Keychain item can be created without putting the value in shell history by allowing `security` to prompt:

```sh
security add-generic-password \
  -a "$USER" \
  -s "justindfuller.com/obsidian-google-drive" \
  -U \
  -w
```

The application reads the item at runtime through `/usr/bin/security`. `OBSIDIAN_GOOGLE_OAUTH_KEYCHAIN_SERVICE` and `OBSIDIAN_GOOGLE_OAUTH_KEYCHAIN_ACCOUNT` override the defaults for local development. Preview and production use their hosted ADC identity instead.
