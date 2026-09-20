package obsidian

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

const defaultGoogleOAuthKeychainService = "justindfuller.com/obsidian-google-drive"

var errKeychainUnavailable = errors.New("macOS Keychain credential unavailable")

func readKeychainSecret(ctx context.Context, account, service string) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", errKeychainUnavailable
	}
	if account == "" {
		account = os.Getenv("USER")
	}
	if account == "" || service == "" {
		return "", fmt.Errorf("%w: account and service are required", errKeychainUnavailable)
	}

	output, err := exec.CommandContext(ctx, "/usr/bin/security", "find-generic-password", "-a", account, "-s", service, "-w").Output()
	if err != nil {
		return "", fmt.Errorf("%w: item lookup failed", errKeychainUnavailable)
	}
	secret := strings.TrimSpace(string(output))
	if secret == "" {
		return "", fmt.Errorf("%w: item is empty", errKeychainUnavailable)
	}
	return secret, nil
}
