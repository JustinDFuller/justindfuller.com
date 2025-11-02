---
title: "My Claude Code Setup"
subtitle: ""
date: 2025-09-13
draft: false
tags: [Programming]
---

This post explains how I use Claude Code to write 100% of my code without sacrificing quality.

## Principles

1. Accomplish 100% of code-related tasks (ex. writing code, research) with AI.  
1. I am still 100% responsible for every line of code I ship.  
1. I will not sacrifice quality for speed.

---

## Context

It is important to understand the context I use this setup in. The code I write with Claude ships to production. It is user-facing code. This comes with all the expectations you might expect: it must be correct, deal with edge cases, security, accessibility, performance, etc.

You can learn more about the context I work in on my [About Me](/about) page.

## Results

Quality: I am able to consistently get results that *I* am happy with. I believe the code Claude outputs is similar to or better than what I would have written by hand.

Speed: By one measure, I am closing as many or more JIRA tickets compared to before Claude Code. By another measure, I am able to tackle additional "tech debt" tasks that I would not have been able to before.

## High-level Workflow

* I do my work in the terminal, not an IDE.  
* Two primary ways of interacting with the code:  
  * Claude  
  * Github PRs  
* I have my model [configured](https://docs.anthropic.com/en/docs/claude-code/model-config) to only use Sonnet 4.5.  
* I typically have between 1-4 instances of Claude running at a given time.  
  * I’ve found that more than 4 instances I cannot keep track of effectively.  
* Steps  
  1. **Worktree**  
    Create a git worktree to allow multiple simultaneous instances of Claude Code to run against a single project.  
  1. **Plan**  
    I always start with my custom /plan command that instructs Claude to generate a plan for the task I’ve given. See below for details about what the command enforces.  
  1. **Review Plan**  
    Carefully review Claude’s plan – often requires multiple back-and-forth steps before the plan is ready for execution.  
  1. **Execute Plan**  
    Once aligned, allow Claude to execute the plan with “accept edits” on. I can still see each step it takes but it is generally free to make its edits autonomously and run common commands (ex. `go test`).  
  1. **Review Summary**  
    At the end of each session, Claude outputs a summary of its work. I carefully review the summary and either loop back to Plan or continue forward to Ship.  
  1. **Ship**  
    I have a custom Claude command that ships code to a draft PR. It adds relevant files, creates a comprehensive commit message, pushes commits to a branch, opens a draft PR, and ensures the JIRA ticket is in-progress, assigned to me, and has the “GenAI” label.  
  1. **AI PR Review**  
    Before manually reviewing the PR, I clear the context and use the /review slash command to allow Claude to review the PR. It does often find mistakes it made.  
  1. **Human PR Review**  
    Now, the Github PR is my main interaction with the code Claude outputs. Here, I carefully read through line-by-line the code Claude produced. To give feedback to Claude, I leave comments on the PR itself. Then, I ask Claude to retrieve the comments and create a plan to address them.

---

## Detailed Workflow

For all steps, I keep "Thinking" enabled ([enabled with tab](https://claudelog.com/faqs/how-to-toggle-thinking-in-claude-code/)).

### Setup

Each task requires about a minute of setup to ensure I can use Claude code optimally.

1. **Worktree:** Always have Claude create a worktree to enable concurrent sessions.  
   * Use my custom `/worktree` slash command that automates this process.  
   * Starts with JIRA ticket ID  
   * Ends with a brief description of the change  
   * Claude:  
      * Creates a worktree in the `.tree` directory.  
      * Creates a git branch.  
      * Ensures [`CLAUDE.md`](http://CLAUDE.md) and the `.claude/` directory is set up in the worktree.

    ![Using /worktree to create the worktree.](/image/programming/my-claude-code-workflow-worktree-1.png)
    ![Claude creates the branch and worktree folder.](/image/programming/my-claude-code-workflow-worktree-2.png)

2. I exit Claude and manually `cd` into the worktree.  
   * Claude keeps history based on the directory it opens in.  
   * By `cd`’ing into the work tree, this keeps Claude’s history separate, making `/resume` and `--continue` more effective.

### Plan

I ensure Claude creates a plan and I carefully review it before I let it write any code.

3. **Prompt**: Once in the worktree, I enter [`plan` mode](https://docs.anthropic.com/en/docs/claude-code/common-workflows#use-plan-mode-for-safe-code-analysis), so Claude cannot make any changes.  
   * I give a detailed prompt about the task to be completed.  
   * I [provide relevant files](https://docs.anthropic.com/en/docs/claude-code/common-workflows#reference-files-and-directories) using the `@file/path.ext` syntax to reduce the amount of searching Claude needs to do.  
   * If the task is complex, I sometimes prompt Claude to `ultrathink` about the task to enable [extended thinking](https://www.anthropic.com/engineering/claude-code-best-practices).  
   * I prompt Claude to suggest optimal [subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) for each task and to also use optimal subagents during planning.

    ![Writing a prompt.](/image/programming/my-claude-code-workflow-prompt-1.png)

4. **Review Plan:** Claude produces a plan, which I carefully review.  

* While it might be exciting that Claude can generate an implementation plan, it is crucial that you carefully review the plan.  
* Often, you’ll find the plan does not align with your expectations. This could be because of unclear directions, missing details, or Claude’s inability to recognize what options are available.

    ![Claude was right here. My next prompt will lead it down a path that is not optimal (attempts to use span attributes instead of metrics). This shows how Claude will not put up a fight if you ask it to do the wrong thing.](/image/programming/my-claude-code-workflow-review-plan-1.png)

5. **Iterate on Plan**: You can give Claude follow-up instructions that it will use to adjust the plan.  
   * Unless the task is extremely straightforward, I often have 1-2 rounds of feedback for Claude.  
   * If I find myself going 3+ rounds of feedback on the plan, I often start over with a new prompt or a smaller scope.

    ![Prompting Claude to redo its plan.](/image/programming/my-claude-code-workflow-iterate-1.png)
    ![Claude's updated plan.](/image/programming/my-claude-code-workflow-iterate-2.png)

### Execute

I allow Claude to work “agentically,” meaning that it executes the plan independently. It still requires oversight for any actions that are not pre-approved.

6. Once I accept the plan, I typically choose to `Auto-Accept Edits` to allow Claude to edit freely.  
   * I’ve also updated my [User Settings](https://docs.anthropic.com/en/docs/claude-code/settings#permission-settings) to grant permissions to common tasks.  
      * Running tests, linters, builds, etc.  
      * Read files in the current project.  
      * Access certain documentation websites.  
   * This allows Claude to work independently and with freedom but without the risk of enabling [\--dangerously-skip-permissions](https://docs.anthropic.com/en/docs/claude-code/cli-reference#cli-flags).

    ![I accept the plan with auto-accept edits.](/image/programming/my-claude-code-workflow-execute-1.png)

### Review

Since I am still 100% responsible for this code, and since LLMs can be unpredictable and unreliable, I carefully review all AI-generated code.

7. **Review Summary**: When Claude completes its work, it prints a summary of its changes.  
   * If it does not, I prompt it to.  
   * I carefully review the summary.  
   * Sometimes, I immediately find something unexpected or wrong. In this case, I immediately prompt Claude to fix it (or ask why it did that) without any further review.

    ![Claude's summary of its work.](/image/programming/my-claude-code-workflow-summary-1.png)

8. **Ship**: If the summary looks good, I use my `/ship` slash command to have Claude create a draft PR.  
   * Ship will use git to push the changes to a remote branch, create a draft PR, and update the JIRA ticket.

    ![Running my custom /ship slash command.](/image/programming/my-claude-code-workflow-ship-1.png)
    ![It creates the Pull Request and updates JIRA.](/image/programming/my-claude-code-workflow-ship-2.png)
    ![Auto-Generated Pull Request](/image/programming/my-claude-code-workflow-ship-3.png)
    ![Jira Ticket Comment](/image/programming/my-claude-code-workflow-ship-4.png)

9. **AI PR Review**: I have Claude do the first round of PR reviews.  
   * I clear the context so Claude is starting fresh.  
   * I use the `/review <pr-link>` command to instruct Claude to review the PR.  
   * I often do this multiple times prompting Claude to review the PR with different agents (ex. `/review <pr-link> with @agent-go-expert`.  
   * I always run the review in plan mode so that Claude outputs a plan to fix anything it finds.  
   * The PR review often finds:  
      * Inconsistencies between the PR or Ticket description and the actual code.  
      * Bugs in the code.

    ![Use the SRE engineer to review the code.](/image/programming/my-claude-code-workflow-ai-review-1.png)
    ![It correctly determines metrics were not used when they should have been.](/image/programming/my-claude-code-workflow-ai-review-2.png)
    ![Running another code review with the golang-pro.](/image/programming/my-claude-code-workflow-ai-review-3.png)

10. **Human PR Review**: After Claude has reviewed and iterated on the PR, I do a manual PR review.  
    * It is critical that a human read, understand, and agree with all code that is written by an AI.
    * I consider myself 100% responsible for any code Claude writes, the same as if I wrote it myself.  
    * This step may yield multiple iterations through the above process.

---

## Commands

[Slash commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands) are one of my favorite features in Claude. They are incredibly helpful for optimizing workflows.

Here are the custom commands I use to automate my workflow:

* `/worktree <branch>`  
  * Create or move to a git worktree for the specified branch  
  * Ensure that .claude/ and CLAUDE.md are copied over from the main branch (they aren’t checked in).  
* `/plan`  
  * Ensures the plan is broken down into steps that can be committed with passing builds.  
  * Ensures each step has a pre-defined commit message so that progress is saved incrementally.  
  * Ensures each step of the plan identifies the optimal subagent to use.  
  * Ensures the plan includes things like testing, linting, building, etc.  
  * Ensures the plan includes an escape hatch so that if Claude runs into issues it will stop and report them instead of going off the rails.  
* `/ship`  
  * Git  
    * Adds relevant files  
    * Commits with a detailed commit message  
    * Ensures Claude is the co-author of the commit  
  * Pull Request  
    * Creates a Draft PR  
    * Includes the JIRA ticket in the title \[TEAM-123\]  
    * Includes a brief summary in the title  
    * Includes a detailed description  
    * Calls out at the top of the PR description that Claude generated the code  
    * Adds the GenAI label to the PR  
  * Jira  
    * Ensures the ticket is at least “in development” (ex. if it is in backlog)  
    * Ensures the ticket is assigned to me  
    * Adds the GenAI label to the ticket  
    * Adds a comment with the link to the PR  
* `/review <pr-link>`  
  * Do a code review on the specified Github Pull Request  
  * Evaluate the title, description, and code changes.  
  * Suggest improvements and make a plan to implement them.  
  * Note: This is useful to run multiple times with different agents (code-reviewer, go-engineer, typescript-expert, etc.)  
* `/github-comments <pr-link>`  
  * Evaluate the Github PR for all unresolved comments.  
  * Determine if the comment should be addressed or resolved.  
  * If addressed, make a plan to address it.  
  * If resolved, explain why.  
* `/worktree-cleanup`  
  * Cleans up the worktree when I am done with development  
* `/drone-analyze`
  * Uses the [Drone CLI](https://docs.drone.io/cli/install/) to access and analyze build logs.  
  * This ensures I do not have to copy \+ paste failed builds into Claude.

---

## Subgents

[Subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) are a powerful tool in Claude. They allow Claude to run with specific expertise, which may yield better results in certain focused areas.

I recommend copying the agents from [this project](https://github.com/VoltAgent/awesome-claude-code-subagents/tree/main) into your `~/.claude/agents` directory.

I have also updated my agents configurations to inherit the parent model so that they do not default to sonnet.

Once you’ve created an agent, you can reference it with `@agent-{AGENT_NAME}`.

---

## MCP Servers & other Integrations

MCP servers allow Claude Code to gain access to other resources.

* Browser: [https://browsermcp.io/](https://browsermcp.io/)  
  * This MCP server allows me to connect Claude with the browser.  
  * Capabilities:  
    * Navigate to pages  
    * Interact with pages  
    * Take screenshots (and view them)  
    * See console logs  
* JIRA: [https://support.atlassian.com/rovo/docs/setting-up-claude-ai/](https://support.atlassian.com/rovo/docs/setting-up-claude-ai/)  
  * This MCP server allows me to automate JIRA workflows.  
  * Capabilities:  
    * See ticket related to current branch  
    * See/set assignee  
    * See/set current state (backlog, in progress, etc.)  
    * See/add comments (link to PR)  
* Github: [https://cli.github.com/](https://cli.github.com/)

---

## FAQ

### Is this workflow actually faster?

It depends on the task. I have found that in some tasks Claude can do the work so much faster than I can, that even with the extra work in this workflow, it yields a large time improvement.

For other tasks, either due to my inability to correctly prompt Claude, Claude's inability to complete the task, or the extra overhead caused by this workflow, the time is neutral or negative.

Although I have not carefully measured it, I would say it yields on overall time improvement because of two reasons:

1. The ability to run multiple sessions of Claude at the same time, concurrently executing multiple projects.
2. The huge time savings I get on a couple of projects where Claude can quickly implement something that would have taken me a long time manually.

### Are these automations safe?

I believe so. You can choose which commands are automatically allowed and which are not. So, for example, you can ensure that Claude always has to ask before interacting with JIRA or Github.

### What languages and tools are you using Claude with?

Primarily Go and Typescript (React). I’ve also used it to work on GraphQL, Kubernetes, Drone pipelines, Terraform (for example in Fastly).

### Why don’t you use the IDE integration?

I wanted to see how far I could go allowing Claude to be the primary interaction with the code. The IDE integration works well and is somewhat similar to Cursor, though\!
