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
	@echo ${COLOR_GRAY}Validating .golangci.json${COLOR_NC};
	@python3 -mjson.tool ".golangci.json" > /dev/null;
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

.PHONY: server-watch
server-watch:
	@reflex -s --decoration=none --inverse-regex=".md" --inverse-regex=".build" -- sh -c "clear && $(MAKE) -s server";

.PHONY: server-watch-fast
server-watch-fast:
	@reflex -s --decoration=none --inverse-regex=".md" --inverse-regex=".build" -- sh -c "clear && $(MAKE) -s server-fast";

.PHONY: format-watch
format-watch:
	@reflex -s --decoration=none --inverse-regex=".md" --inverse-regex=".build"-- sh -c "clear && $(MAKE) -s format";

.PHONY: deploy
deploy: build
	@echo ${COLOR_GRAY}Begin gcloud app deploy.${COLOR_NC};
	@gcloud app deploy --appyaml=./.appengine/app.yaml;

.PHONY: build
build: validate tidy generate vet format lint
	@echo ${COLOR_GRAY}Begin build process.${COLOR_NC};
	@rm -rf ./.build;
	@mkdir ./.build;
	@curl -s "http://localhost:9000/" > ./.build/index.html;
	@curl -s "http://localhost:9000/site.webmanifest" > ./.build/site.webmanifest;
	@curl -s "http://localhost:9000/make" > ./.build/make.html;
	@curl -s "http://localhost:9000/nature" > ./.build/nature.html;
	@curl -s "http://localhost:9000/grass" > ./.build/grass.html;
	@curl -s "http://localhost:9000/grass/worker.js" > ./.build/grass-service-worker.js;
	@curl -s "http://localhost:9000/kit" > ./.build/kit.html;
	@curl -s "http://localhost:9000/weeks-remaining" > ./.build/weeks-remaining.html;
	@curl -s "http://localhost:9000/avatar" > ./.build/avatar.html;
	@curl -s "http://localhost:9000/aphorism" > ./.build/aphorism.html;
	@curl -s "http://localhost:9000/poem" > ./.build/poem.html;
	@curl -s "http://localhost:9000/poem/deep-blue-subaru" > ./.build/poem-deep-blue-subaru.html;
	@curl -s "http://localhost:9000/story" > ./.build/story.html;
	@curl -s "http://localhost:9000/story/the_philosophy_of_trees" > ./.build/the_philosophy_of_trees.html;
	@curl -s "http://localhost:9000/story/the_philosophy_of_lovers" > ./.build/the_philosophy_of_lovers.html;
	@curl -s "http://localhost:9000/story/bridge" > ./.build/bridge.html;
	@curl -s "http://localhost:9000/story/nothing" > ./.build/nothing.html;
	@curl -s "http://localhost:9000/review" > ./.build/review.html;
	@curl -s "http://localhost:9000/review/zen-and-the-art-of-motorcycle-maintenance" > ./.build/zen-and-the-art-of-motorcycle-maintenance.html;
	@curl -s "http://localhost:9000/review/living-on-24-hours-a-day" > ./.build/living-on-24-hours-a-day.html;
	@curl -s "http://localhost:9000/review/howards-end" > ./.build/howards-end.html;
	@curl -s "http://localhost:9000/review/walden" > ./.build/walden.html;
	@curl -s "http://localhost:9000/review/the-history-of-modern-political-philosophy" > ./.build/the-history-of-modern-political-philosophy.html;
	@curl -s "http://localhost:9000/word" > ./.build/word.html;
	@curl -s "http://localhost:9000/word/quality" > ./.build/quality.html;
	@curl -s "http://localhost:9000/word/equipoise" > ./.build/equipoise.html;
	@curl -s "http://localhost:9000/word/flexible" > ./.build/flexible.html;
	@cp -r ./image ./.build

.PHONY: build-watch
build-watch:
	@reflex -s -- sh -c "$(MAKE) build";
