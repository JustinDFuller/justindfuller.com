# FROM alpine:latest
FROM golang:1.21.5-alpine AS golang

FROM alpine as main

COPY --from=golang /usr/local/go/ /usr/local/go/
 
ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /usr/src/app

# pre-copy/cache go.mod for pre-downloading dependencies and only redownloading them in subsequent builds if they change
COPY go.mod go.sum ./
RUN go mod download
RUN go mod verify

COPY . .
