//go:build tools
// +build tools

/*
From: https://go.dev/wiki/Modules#how-can-i-track-tool-dependencies-for-a-module

How can I track tool dependencies for a module?

If you:
* want to use a go-based tool (e.g. stringer) while working on a module, and
* want to ensure that everyone is using the same version of that tool while tracking the tool’s version in your module’s go.mod file

Then one currently recommended approach is to add a tools.go file to your module that includes import statements for the tools of interest (such as import _ "golang.org/x/tools/cmd/stringer"), along with a //go:build tools build constraint. The import statements allow the go command to precisely record the version information for your tools in your module’s go.mod, while the //go:build tools build constraint prevents your normal builds from actually importing your tools.
*/

package tools

import (
	_ "github.com/golangci/golangci-lint/cmd/golangci-lint"
)
