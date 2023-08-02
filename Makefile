export GAE_DEPLOYMENT_ID=localhost/$(shell date --iso=seconds)
export PORT=9000

server:
	@go run main.go;

server-watch:
	@reflex -r '\.go' -s -- sh -c "$(MAKE) server";

deploy:
	@gcloud app deploy;

format:
	@go fmt ./...;
	@npx prettier -w **/*;

build:
	@rm -rf ./.build;
	@mkdir ./.build;
	@curl "http://localhost:9000/" > ./.build/index.html;
	@curl "http://localhost:9000/make" > ./.build/make.html;
	@curl "http://localhost:9000/aphorism" > ./.build/aphorism.html;
	@curl "http://localhost:9000/poem" > ./.build/poem.html;
	@curl "http://localhost:9000/story" > ./.build/story.html;
	@curl "http://localhost:9000/story/the_philosophy_of_trees" > ./.build/the_philosophy_of_trees.html;
	@curl "http://localhost:9000/story/bridge" > ./.build/bridge.html;
	@curl "http://localhost:9000/story/nothing" > ./.build/nothing.html;
	@curl "http://localhost:9000/review" > ./.build/review.html;
	@curl "http://localhost:9000/review/zen-and-the-art-of-motorcycle-maintenance" > ./.build/zen-and-the-art-of-motorcycle-maintenance.html;
	@curl "http://localhost:9000/word" > ./.build/word.html;
	@curl "http://localhost:9000/word/quality" > ./.build/quality.html;
	@curl "http://localhost:9000/word/equipoise" > ./.build/equipoise.html;
	@cp -r ./image ./.build
