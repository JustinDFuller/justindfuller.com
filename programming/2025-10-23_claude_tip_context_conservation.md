---
title: "Claude Code Tip: Conserving Context"
subtitle: "Using Sub-Agents to prevent auto-compaction"
date: 2025-10-23
draft: false
tags: [Programming]
---

Here's a quick tip for anyone using [Claude Code](https://docs.claude.com/en/docs/claude-code): if you want to conserve your context window and avoid auto-compact, ensure _everything_ runs in a sub-agent.

## Why?

For several months now, I've been [using Claude Code to write 100% of my code](/programming/my-claude-code-setup). Recently I've been working on a project with huge files and long command output. I found that working in this project brought Claude to a halt because of constant auto-compaction.

After complaining about this to a colleague, they reminded me that [sub-agents have their own context window](https://docs.claude.com/en/docs/claude-code/sub-agents).

> **Context preservation**
>
> Each subagent operates in its own context, preventing pollution of the main conversation and keeping it focused on high-level objectives.

Now, I had already been using sub-agents for all code writing and complex debugging tasks. However, I had a ton of other "routine" tasks that were not using sub-agents. This included reading files during the planning phase and executing git operations once work completed.

So, I immediately did a few things that solved the issue.

## Sub-Agents

I created three sub-agents that were tasked at running certain tasks and providing a summarized output.

1. Created a `code-researcher` sub-agent.
2. Created a `command-runner` sub-agent.
3. Created a specialized `git-expert` sub-agent.

They are clearly instructed to provide smaller outputs to prevent the main context window from filling.

## Instructions

I updated instructions in various places to ensure Claude Code knows to use these sub-agents.

1. Instructed CLAUDE.md to use `code-researcher` for all research/file reading tasks, including any time I ask it a question or to make a plan.
2. Instructed CLAUDE.md to use `git-expert` to run all git commands.
3. Instructed CLAUDE.md to use `command-runner` for any command that does not have a more specific sub-agent to run it with.
4. Instructed my slash commands like `/ship`, `/push`, `/git-merge` etc. to use the `git-expert` sub-agent for all tasks.

## Results

![Using 150k tokens without auto-compacting](/image/programming/claude-commands.png)

As seen in the screenshot above, I am now able to execute much longer workflows without dealing with auto-compacting. Overall, this seems to be leading to shorter task completion times and more consistent output from Claude.

Previously, the above workflow would have required a clean context or would have caused an auto-compact.
