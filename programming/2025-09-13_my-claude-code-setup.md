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
2. I am still 100% responsible for every line of code I ship.  
3. I will not sacrifice quality for speed.

---

## High-level Workflow

* I do my work in the terminal, not an IDE.  
* Two primary ways of interacting with the code:  
  * Claude  
  * Github PRs  
* I have my model [configured](https://docs.anthropic.com/en/docs/claude-code/model-config) to only use Opus.  
* I typically have between 1-4 instances of Claude running at a given time.  
  * I’ve found that more than 4 instances I cannot keep track of effectively.  
* Steps  
  1. **Worktree**  
    Create a git worktree to allow multiple simultaneous instances of Claude Code to run against a single project.  
  2. **Plan**  
    I always start with my custom /plan command that instructs Claude to generate a plan for the task I’ve given. See below for details about what the command enforces.  
  3. **Review Plan**  
    Carefully review Claude’s plan – often requires multiple back-and-forth steps before the plan is ready for execution.  
  4. **Execute Plan**  
    Once aligned, allow Claude to execute the plan with “accept edits” on. I can still see each step it takes but it is generally free to make its edits autonomously and run common commands (ex. `go test`).  
  5. **Review Summary**  
    At the end of each session, Claude outputs a summary of its work. I carefully review the summary and either loop back to Plan or continue forward to Ship.  
  6. **Ship**  
    I have a custom Claude command that ships code to a draft PR. It adds relevant files, creates a comprehensive commit message, pushes commits to a branch, opens a draft PR, and ensures the JIRA ticket is in-progress, assigned to me, and has the “GenAI” label.  
  7. **AI PR Review**  
    Before manually reviewing the PR, I clear the context and use the /review slash command to allow Claude to review the PR. It does often find mistakes it made.  
  8. **Human PR Review**  
    Now, the Github PR is my main interaction with the code Claude outputs. Here, I carefully read through line-by-line the code Claude produced. To give feedback to Claude, I leave comments on the PR itself. Then, I ask Claude to retrieve the comments and create a plan to address them.

---

## Detailed Workflow

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

![](/image/programming/my-claude-code-workflow-worktree-1.png)
![](/image/programming/my-claude-code-workflow-worktree-2.png)

2. I exit Claude and manually `cd` into the worktree.  
   * Claude keeps history based on the directory it opens in.  
   * By `cd`’ing into the work tree, this keeps Claude’s history separate, making `/resume` and `--continue` more effective. 

### Plan

I ensure Claude creates a plan and I carefully review it before I let it write any code.

3. **Prompt**: Once in the worktree, I enter [`plan` mode](https://docs.anthropic.com/en/docs/claude-code/common-workflows#use-plan-mode-for-safe-code-analysis), so Claude cannot make any changes.  
   * I give a detailed prompt about the task to be completed.  
   * I [provide relevant files](https://docs.anthropic.com/en/docs/claude-code/common-workflows#reference-files-and-directories) using the `@file/path.ext` syntax to reduce the amount of searching Claude needs to do.  
   * If the task is complex, I often prompt code to `think deeply` about the task to enable [extended thinking](https://docs.anthropic.com/en/docs/claude-code/common-workflows#use-extended-thinking).  
   * I prompt Claude to suggest optimal [subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents) for each task and to also use optimal subagents during planning.

![](/image/programming/my-claude-code-workflow-prompt-1.png)

4.  **Review Plan:** Claude produces a plan, which I carefully review.  
   * While it might be exciting that Claude can generate an implementation plan, it is crucial that you carefully review the plan.  
   * Often, you’ll find the plan does not align with your expectations. This could be because of unclear directions, missing details, or Claude’s inability to recognize what options are available.

![](/image/programming/my-claude-code-workflow-review-plan-1.png)

*Note: Claude was right here. My next prompt will lead it down a path that is not optimal (attempts to use span attributes instead of metrics). This shows how Claude will not put up a fight if you ask it to do the wrong thing.*

<br />

5. **Iterate on Plan**: You can give Claude follow-up instructions that it will use to adjust the plan.  
   * Unless the task is extremely straightforward, I often have 1-2 rounds of feedback for Claude.  
   * If I find myself going 3+ rounds of feedback on the plan, I often start over with a new prompt or a smaller scope.

![](/image/programming/my-claude-code-workflow-iterate-1.png)
![](/image/programming/my-claude-code-workflow-iterate-2.png)

### Execute

I allow Claude to work “agentically,” meaning that it executes the plan independently. It still requires oversight for any actions that are not pre-approved.

6. Once I accept the plan, I typically choose to `Auto-Accept Edits` to allow Claude to edit freely.  
   * I’ve also updated my [User Settings](https://docs.anthropic.com/en/docs/claude-code/settings#permission-settings) to grant permissions to common tasks.  
      * Running tests, linters, builds, etc.  
      * Read files in the current project.  
      * Access certain documentation websites.  
   * This allows Claude to work independently and with freedom but without the risk of enabling [\--dangerously-skip-permissions](https://docs.anthropic.com/en/docs/claude-code/cli-reference#cli-flags).

![](/image/programming/my-claude-code-workflow-execute-1.png)

### Review

Since I am still 100% responsible for this code, and since LLMs can be unpredictable and unreliable, I carefully review all AI-generated code.

7. **Review Summary**: When Claude completes its work, it prints a summary of its changes.  
   * If it does not, I prompt it to.  
   * I carefully review the summary.  
   * Sometimes, I immediately find something unexpected or wrong. In this case, I immediately prompt Claude to fix it (or ask why it did that) without any further review.

![](/image/programming/my-claude-code-workflow-summary-1.png)

8. **Ship**: If the summary looks good, I use my `/ship` slash command to have Claude create a draft PR.  
   * Ship will use git to push the changes to a remote branch, create a draft PR, and update the JIRA ticket.

![](/image/programming/my-claude-code-workflow-ship-1.png)
![](/image/programming/my-claude-code-workflow-ship-2.png)
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

![](/image/programming/my-claude-code-workflow-ai-review-1.png)
![](/image/programming/my-claude-code-workflow-ai-review-2.png)
![](/image/programming/my-claude-code-workflow-ai-review-3.png)

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
  * Instructs Claude to “Think Deeply” to ensure it enters extended thinking mode.  
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

## 100% AI Pull Requests

So, how’s it going? You should judge the quality for yourself.

### Offer Eligibility

* [\[OFFERS-FIX\] Remove maximum bound check for in-memory cache TTL](https://github.com/nytimes/offer-eligibility/pull/1358)   
*  [Enable in-memory ARC cache for Omelette datasource in all environments](https://github.com/nytimes/offer-eligibility/pull/1357)   
* [\[OFFERS-1975\] Enable in-memory cache for Omelette datasource](https://github.com/nytimes/offer-eligibility/pull/1354)    
* [\[OFFERS-1975\] Add in-memory ARC cache for Omelette datasource](https://github.com/nytimes/offer-eligibility/pull/1350)    
* [\[OFFERS-1975\] Update JKIDD API endpoints for all environments](https://github.com/nytimes/offer-eligibility/pull/1352)    
* [\[OFFERS-1975\] Add dataloader for Omelette datasource](https://github.com/nytimes/offer-eligibility/pull/1348)   
* [\[OFFERS-1975\] Make all Redis configuration values configurable via environment variables](https://github.com/nytimes/offer-eligibility/pull/1344)   
* [\[OFFERS-1975\] Add configurable HTTP timeout for Omelette requests](https://github.com/nytimes/offer-eligibility/pull/1347)   
* [\[OFFERS-1975\] Remove Redis dependency from decision logs](https://github.com/nytimes/offer-eligibility/pull/1327)   
* [\[OFFERS-1975\] Optimize Redis connection pool configuration](https://github.com/nytimes/offer-eligibility/pull/1343)   
* [\[OFFERS-1975\] Fix Redis error handling to prevent SETX on operational failures](https://github.com/nytimes/offer-eligibility/pull/1341)   
* [\[OFFERS-CHORE\] Add explicit RollingUpdate strategy to Kubernetes deployment](https://github.com/nytimes/offer-eligibility/pull/1342)   
* [\[OFFERS-1975\] Optimize Redis Connection Settings](https://github.com/nytimes/offer-eligibility/pull/1339)   
* [\[OFFERS-1932\] Add canceled subscriber regression test](https://github.com/nytimes/offer-eligibility/pull/1336)   
* [\[OFFERS-CHORE\] Add DataDog tracing configuration to Redis client](https://github.com/nytimes/offer-eligibility/pull/1338)   
* [\[OFFERS-1931\] Fix nil matcher panic in strategy criteria evaluation](https://github.com/nytimes/offer-eligibility/pull/1334)   
* [\[OFFERS-1975\] Migrate Redis client from redigo to go-redis/v9](https://github.com/nytimes/offer-eligibility/pull/1332)  
* [\[OFFERS-BUG\] Add configurable cache operation timeouts to prevent 502 errors](https://github.com/nytimes/offer-eligibility/pull/1331)   
* [\[OFFERS-1931\] Fix debug mode bug in strategy resolver](https://github.com/nytimes/offer-eligibility/pull/1326)   
* [\[OFFERS-1931\] OES Iteration Criteria](https://github.com/nytimes/offer-eligibility/pull/1285)   
* [\[OFFERS-1977\] Reduce rule evaluated logs to debug level](https://github.com/nytimes/offer-eligibility/pull/1325)   
* [\[OFFERS-1631\] Replace logrus and kitlog with dv-go logger](https://github.com/nytimes/offer-eligibility/pull/1304)   
* [\[OFFERS-1855\] Add hourly regression tests with backup strategy validation](https://github.com/nytimes/offer-eligibility/pull/1301)   
* [\[OFFERS-1855\] Continuous Scoop Backup Restore Testing in Production.](https://github.com/nytimes/offer-eligibility/pull/1291) 

### Offer Presentation

* [\[OFFERS-1632\] OPS dvgo logger implementation](https://github.com/nytimes/offer-presentation/pull/750) 

### Onsite Messaging

* [\[OMA-CHORE\] Update Offers Mocks and Related Snapshots](https://github.com/nytimes/onsite-messaging/pull/9829)    
* [\[OFFERS-1975\] Fix OES to use actual Abra data for Games ProductSwitch rule](https://github.com/nytimes/onsite-messaging/pull/9765)   
* [\[ACCT-6883\] Safe rollout of ProductSwitch OES rule for Games clients behind AB test](https://github.com/nytimes/onsite-messaging/pull/9693)    
* [\[OFFERS-1942\] Offer Strategy in Offer Patterns](https://github.com/nytimes/onsite-messaging/pull/9599)   
* [\[OMA-4613\] Generate Types.](https://github.com/nytimes/onsite-messaging/pull/9201)

### Samizdat Supergraph Router

* [Add IAP authentication for offer-presentation and offer-eligibility subgraphs](https://github.com/nytimes/samizdat-supergraph-router/pull/727) 

### Fastly mktg

* [\[OFFERS-CHORE\] Remove BQ Stream](https://github.com/nytimes/fastly-mktg/pull/62) 

### Personal Projects

* [https://github.com/JustinDFuller/ai-plans.dev](https://github.com/JustinDFuller/ai-plans.dev)

### Still in-progress

* [\[OFFERS-1600\] Refactor offer-eligibility to use dv-go observability/tracing](https://github.com/nytimes/offer-eligibility/pull/1305)    
* [\[OFFERS-1600\] Refactor tracing to use dv-go observability](https://github.com/nytimes/offer-presentation/pull/757)   
* [\[OFFERS-CHORE\] Add Apollo Federation support with prefixed types](https://github.com/nytimes/offer-presentation/pull/758)    
* [\[OFFERS-1805\] Refactor to use pass-by-value for Offer structs](https://github.com/nytimes/offer-presentation/pull/759)   
* [\[OFFERS-CHORE\] Add Apollo Federation support with OfferEligibility prefix](https://github.com/nytimes/offer-eligibility/pull/1321)   
* [\[OFFERS-1974\] Add cancel before date to ARL language](https://github.com/nytimes/offer-presentation/pull/763)   
* [\[OFFERS-1696\] Add Offer Strategy variant for All Access Promo in Bar One](https://github.com/nytimes/onsite-messaging/pull/9785)    
* [\[OFFERS-1975\] Remove GAMES\_OES\_PRODUCT\_SWITCH\_RULE AB test](https://github.com/nytimes/onsite-messaging/pull/9828)    
* [\[OFFERS-1926\] Add SubGatewayBillingCountry field for geolocation\_acquisition rule](https://github.com/nytimes/offer-eligibility/pull/1355)    
* [\[OFFERS-1926\] Exclude Paused Subscribers from Geolocation Acquisition Rule (By Product)](https://github.com/nytimes/offer-eligibility/pull/1356)    
* [\[OMA-4613\] Complete TypeScript migration to auto-generated GraphQL types](https://github.com/nytimes/onsite-messaging/pull/9857)    
* [\[OFFERS-1975\] Disable Redis CLIENT SETINFO for GCP Memorystore compatibility](https://github.com/nytimes/offer-eligibility/pull/1360)   
* [\[OFFERS-1975\] Add trace span attributes to distinguish Omelette data sources](https://github.com/nytimes/offer-eligibility/pull/1361)  

---

## FAQ

### Are these automations safe?

I believe so. You can choose which commands are automatically allowed and which are not. So, for example, you can ensure that Claude always has to ask before interacting with JIRA or Github.

### What languages and tools are you using Claude with?

Primarily Go and Typescript (React). I’ve also used it to work on GraphQL, Kubernetes, Drone pipelines, Terraform (for example in Fastly).

### Why don’t you use the IDE integration?

I wanted to see how far I could go allowing Claude to be the primary interaction with the code. The IDE integration works well and is somewhat similar to Cursor, though\!
