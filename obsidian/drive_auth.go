package obsidian

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
)

type keychainOAuthCredentials struct {
	Type         string `json:"type"`
	ClientID     string `json:"client_id"`
	ClientSecret string `json:"client_secret"`
	RefreshToken string `json:"refresh_token"`
}

func newDriveHTTPClient(ctx context.Context, config Config) (*http.Client, error) {
	if config.Environment != EnvironmentLocal {
		return nil, nil
	}

	service := config.GoogleOAuthKeychainService
	if service == "" {
		service = defaultGoogleOAuthKeychainService
	}
	account := config.GoogleOAuthKeychainAccount
	if account == "" {
		account = os.Getenv("USER")
	}
	reader := config.KeychainReader
	if reader == nil {
		reader = readKeychainSecret
	}
	secret, err := reader(ctx, account, service)
	if err != nil {
		return nil, err
	}

	var credentials keychainOAuthCredentials
	if err := json.Unmarshal([]byte(secret), &credentials); err != nil {
		return nil, errors.New("invalid Keychain OAuth credentials")
	}
	if credentials.Type != "authorized_user" {
		return nil, errors.New("Keychain OAuth credentials must be authorized_user credentials")
	}
	if credentials.ClientID == "" || credentials.RefreshToken == "" {
		return nil, errors.New("Keychain OAuth credentials are missing required fields")
	}

	oauthConfig := &oauth2.Config{
		ClientID:     credentials.ClientID,
		ClientSecret: credentials.ClientSecret,
		Scopes:       []string{drive.DriveReadonlyScope},
		Endpoint:     google.Endpoint,
	}
	tokenSource := oauthConfig.TokenSource(ctx, &oauth2.Token{RefreshToken: credentials.RefreshToken})
	return oauth2.NewClient(ctx, tokenSource), nil
}
