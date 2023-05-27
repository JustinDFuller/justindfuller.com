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
