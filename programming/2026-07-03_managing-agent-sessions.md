---
title: Managing Agent Sessions
date: 2026-07-03
draft: false
tags: [Code]
---

In this post, I'll walk through how I manage multiple simultaneous agent sessions. I use this workflow across the three harnesses I commonly use at work and at home: Claude Code, Cursor, and Codex. Theoretically, this workflow should extend to any other agent harness.

I'll start by showing how I did this manually with Iterm2. After a while, I decided I wanted to codify the workflow as an application. I'll show how that app works and how I built it.

## The old way: Iterm2

First, I would open up Iterm2.

<img width="1392" height="914" alt="1-startup-iterm2" src="https://github.com/user-attachments/assets/fd103128-24cf-4489-8cde-a6b3ec35ca55" />

Then, I would open up a single project directory.

<img width="1392" height="914" alt="2-single-project" src="https://github.com/user-attachments/assets/cc9d7654-971b-4c80-89ae-def6f4b583f0" />

Then, I would use `claude --worktree <name>` to create a worktree for claude to work within.

<img width="1392" height="914" alt="3-manual-worktree" src="https://github.com/user-attachments/assets/a32d3220-9169-41e1-aa49-c105d7da43e1" />

Once I was ready for another session, I would "Split vertically" to create a new window.

<img width="1392" height="914" alt="4-two-sessions" src="https://github.com/user-attachments/assets/164ea9f9-aad5-4840-9f50-15e51dae5a3f" />

One of the pain-points that came with multiple aget sessions was tracking which one I was looking at. Recently, Claude added a label to its sessions to improve this experience. But I typically used "Badges" which adds huge red text to each window.

<img width="1392" height="914" alt="5-add-badges" src="https://github.com/user-attachments/assets/7c0f6713-bbdc-4ec5-ad96-be2e1e440503" />

From there, as I needed more windows, I would split the window further using "Split Horizontally" and "Split Vertically". I would typically never go above 6 sessions in a window at the most.

<img width="1392" height="914" alt="6-multi-row-sessions" src="https://github.com/user-attachments/assets/cad90390-c4aa-4dd1-900f-6e38e504a5f1" />

I would sometimes work on multiple, separate codebases at the same time. When that happened, I would open a new tab for each project. This kept the work separate.

<img width="1392" height="914" alt="7-multi-project-tabs" src="https://github.com/user-attachments/assets/65792b65-1192-40bf-a6d5-7065bfa55ab9" />

From there, I would repeat the same process for each tab.

## The new way: Agent Session Manager

This worked but required a lot of manual work to maintain. I would often forget to update the badge or forget to set a badge. This led to me (pretty often) entering the wrong prompt into the wrong session.

I decided to create my own app to codify this process and automate the parts I often forgot.

The app automatically splits my work in tabs for each project, panes for each session, and presents updates as notifications.

<img width="1280" height="802" alt="8-agent-session-manager-tab" src="https://github.com/user-attachments/assets/9908a872-df4d-4ba8-b4c2-b6bd32a5a2af" />

Here, you can see what multiple panes look like.

<img width="1280" height="802" alt="9-agent-session-manager-panes" src="https://github.com/user-attachments/assets/9ab136aa-466b-4f62-9b53-5c2b75579d99" />

It even tracks the status of the pull request associated with each pane.

<img width="1280" height="802" alt="10-agent-session-manager-pr-status" src="https://github.com/user-attachments/assets/84742c11-6d39-4b43-8f26-fea472acd15e" />

When creating a pane, you select a profile and enter the name of the worktree. The app takes care of everything else for you: creating the worktree, setting the correct model and other settings in the harness, and presenting it all clearly.

<img width="1280" height="802" alt="11-agent-session-manager-new-pane" src="https://github.com/user-attachments/assets/806b65ee-38f3-4a29-9df9-825482f22f52" />

The profile manager allows me to quickly switch between various presets. A profile can include things like the model, CLI flags, environment variables, etc. I often have profiles for different combinations of models + effort. For example, I might have `Claude Sonnet 5 Max` or `OpusPlan Medium`. The profile even controls the harness, so I'll have a profile for `Cursor Composer 2.5` allowing me to easily switch between Claude and Cursor.

<img width="1280" height="802" alt="12-agent-session-manager-profiles" src="https://github.com/user-attachments/assets/7935d067-2a31-449b-9e53-c2c583010e5a" />

Whenever a harness needs my attention, it is presented as an in-app and desktop notification. This includes things like: the harness finished its work, the harness needs me to approve a command, there is a plan ready for review, etc.

<img width="1280" height="802" alt="13-agent-session-manager-notifications" src="https://github.com/user-attachments/assets/1f7aa084-8b60-4115-94bf-81339ec66047" />

It also proactively offers to clean up the pane/worktree once the pull request merges. This helps keep things nice and neat, without me having to remember to clean up manually.

<img width="1280" height="802" alt="14-agent-session-manager-pr-merged" src="https://github.com/user-attachments/assets/8224e227-d1fb-4e69-b624-5d25f209249a" />

## How I built it

Now, I'm not going to pretend that I gave these instructions to Claude Code and it perfectly 1-shot the prompt. That would give a false impression of both how to effectively use these tools. Worse, it would give you the wrong idea about how to effectively build an application.

Let's start with some stats. I landed the first commit in the Github repo on May 1st 2026. Today, July 3rd, the app works pretty well and is beginning to be what I would called, "polished," at least in terms of how well it works (I'm no designer). This work included 190 pull requests to the main branch.

Back in April, I briefly began using Claude Code to write an electron app to encapsulate the workflow. However, I quickly threw it away for a few reasons:

1. It felt slow and clunky.
2. It didn't feel like a native mac app.
3. It required dealing with the web ecosystem to write a desktop/terminal app.

From there, I scrapped the app and restarted building a Native MacOS App built in Swift. 
