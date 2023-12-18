#!/bin/bash
export go1.21.5=go
make server & (sleep 60 && make build)
