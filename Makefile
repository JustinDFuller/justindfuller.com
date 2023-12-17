export GOOGLE_CLOUD_PROJECT=justindfuller
export GAE_DEPLOYMENT_ID=localhost/$(shell date --iso=seconds)
export PORT=9000

generate:
	@echo "Begin go generate.";
	@go generate ./...;

vet:
	@echo "Begin go vet.";
	@go vet ./...;

format:
	@echo "Begin go fmt.";
	@go fmt ./...;
	@echo "Begin npm test.";
	@npm run test;

server: generate vet format
	@echo "Begin go run.";
	@go run main.go;

server-watch:
	@reflex -s -- sh -c "$(MAKE) server";

format-watch:
	@reflex -s -- sh -c "$(MAKE) format";

deploy: build
	@gcloud app deploy;

build: generate vet format
	@rm -rf ./.build;
	@mkdir ./.build;
	@curl "http://localhost:9000/" > ./.build/index.html;
	@curl "http://localhost:9000/site.webmanifest" > ./.build/site.webmanifest;
	@curl "http://localhost:9000/make" > ./.build/make.html;
	@curl "http://localhost:9000/nature" > ./.build/nature.html;
	@curl "http://localhost:9000/grass" > ./.build/grass.html;
	@curl "http://localhost:9000/grass/worker.js" > ./.build/grass-service-worker.js;
	@curl "http://localhost:9000/kit" > ./.build/kit.html;
	@curl "http://localhost:9000/aphorism" > ./.build/aphorism.html;
	@curl "http://localhost:9000/poem" > ./.build/poem.html;
	@curl "http://localhost:9000/story" > ./.build/story.html;
	@curl "http://localhost:9000/story/the_philosophy_of_trees" > ./.build/the_philosophy_of_trees.html;
	@curl "http://localhost:9000/story/the_philosophy_of_lovers" > ./.build/the_philosophy_of_lovers.html;
	@curl "http://localhost:9000/story/bridge" > ./.build/bridge.html;
	@curl "http://localhost:9000/story/nothing" > ./.build/nothing.html;
	@curl "http://localhost:9000/review" > ./.build/review.html;
	@curl "http://localhost:9000/review/zen-and-the-art-of-motorcycle-maintenance" > ./.build/zen-and-the-art-of-motorcycle-maintenance.html;
	@curl "http://localhost:9000/review/living-on-24-hours-a-day" > ./.build/living-on-24-hours-a-day.html;
	@curl "http://localhost:9000/word" > ./.build/word.html;
	@curl "http://localhost:9000/word/quality" > ./.build/quality.html;
	@curl "http://localhost:9000/word/equipoise" > ./.build/equipoise.html;
	@curl "http://localhost:9000/word/flexible" > ./.build/flexible.html;
	@cp -r ./image ./.build

build-watch:
	@reflex -s -- sh -c "$(MAKE) build";
