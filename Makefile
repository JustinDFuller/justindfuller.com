export COLOR_NC='\e[0m' # No Color
export COLOR_GRAY='\e[1;30m'
export COLOR_RED='\e[0;31m'
export COLOR_GREEN='\e[0;32m'
export COLOR_YELLOW='\e[1;33m'
export COLOR_BLUE='\e[0;34m'

export GAE_DEPLOYMENT_ID=localhost/$(shell date --iso=seconds)
export PORT=9000

.PHONY: validate
validate:
	@echo ${COLOR_GRAY}Validating files.${COLOR_NC};
	@echo ${COLOR_GRAY}Validating package.json${COLOR_NC};
	@python3 -mjson.tool "package.json" > /dev/null;
	@echo ${COLOR_GRAY}Validating .markdownlint-cli2.jsonc${COLOR_NC};
	@python3 -mjson.tool ".markdownlint-cli2.jsonc" > /dev/null;
	@echo ${COLOR_GRAY}Validating .golangci.yml${COLOR_NC};
	@yamllint .golangci.yml;
	@echo ${COLOR_GRAY}Validating .devcontainer/devcontainer.json${COLOR_NC};
	@python3 -mjson.tool ".devcontainer/devcontainer.json" > /dev/null;
	@echo ${COLOR_GRAY}Validating .stylelintrc.json${COLOR_NC};
	@python3 -mjson.tool ".stylelintrc.json" > /dev/null;
	@echo ${COLOR_GRAY}Validating Yaml Files${COLOR_NC};
	@yamllint .;

.PHONY: tidy
tidy:
	@echo ${COLOR_GRAY}Begin go mod tidy.${COLOR_NC};
	@go mod tidy;

.PHONY: generate
generate:
	@echo ${COLOR_GRAY}Begin go generate.${COLOR_NC};
	@go generate ./...;

.PHONY: vet
vet:
	@echo ${COLOR_GRAY}Begin go vet.${COLOR_NC};
	@go vet ./...;

.PHONY: lint
lint:
ifeq ($(CI), true)
	@echo ${COLOR_GRAY}Skipping golangci-lint in CI.${COLOR_NC};
else	
	@echo ${COLOR_GRAY}Begin golangci-lint run${COLOR_NC};
	@golangci-lint run;
endif

.PHONY: format
format:
	@echo ${COLOR_GRAY}Begin go fmt.${COLOR_NC};
	@go fmt ./...;
	@echo ${COLOR_GRAY}Begin npm test.${COLOR_NC};
	@npm run test --silent;

.PHONY: server
server: validate tidy generate vet format lint
	@echo ${COLOR_GRAY}Begin go run.${COLOR_NC};
	@go run -race .;

.PHONY: server-fast
server-fast:
	@echo ${COLOR_GRAY}Begin go run.${COLOR_NC};
	@go run -race .;


.PHONY: build
build: validate tidy generate vet format lint
	@echo "$${COLOR_GRAY}Building binary.$${COLOR_NC}";
	@go build -race -o justindfuller.com .;

.PHONY: build-fast
build-fast:
	@echo "$${COLOR_GRAY}Building binary (fast).$${COLOR_NC}";
	@go build -race -o justindfuller.com .;

.PHONY: server-watch-smart
server-watch-smart:
	@./scripts/smart-watch.sh;

.PHONY: format-watch
format-watch:
	@reflex -s --decoration=none --inverse-regex=".md" -- sh -c "clear && $(MAKE) -s format";

.PHONY: lint-md
lint-md:
	@echo ${COLOR_GRAY}Begin markdownlint.${COLOR_NC};
	@NODE_OPTIONS='--no-deprecation' npx markdownlint-cli2 **/*.md "#node_modules" --config .markdownlint-cli2.jsonc --fix | sed --expression='s/markdownlint-cli2 v0.17.2 (markdownlint v0.37.4)//g';

.PHONY: lint-md-watch
lint-md-watch:
	@reflex -s --decoration=none --regex="\.md$$" -- sh -c "clear && $(MAKE) -s lint-md";

.PHONY: deploy
deploy:
	@echo ${COLOR_GRAY}Begin gcloud app deploy.${COLOR_NC};
	@gcloud app deploy --appyaml=./.appengine/app.yaml;
