export PORT=9000

server:
	@go run main.go;

server-watch:
	@reflex -s -- sh -c "$(MAKE) server";

deploy:
	@gcloud app deploy;

format:
	@go fmt ./...;
	@npx prettier -w **/*;
