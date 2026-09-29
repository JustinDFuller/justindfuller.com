---
title: Agentic Spec-Driven Development Workflow
date: 2026-09-28
draft: false
tags: [Code]
---

In this post I'll share the agentic spec-driven development workflow I use for software development.

## Pre-Requisites

If you aren't familiar, you may want to first read about [Spec-Driven Development (SDD)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html), as this post assumes you know what that is.

You may also want to read up on [OpenSpec](https://openspec.dev/), which is the Spec-Driven Development framework I use.

> OpenSpec is a lightweight and configurable framework for creating and managing software specifications.
> https://openspec.dev/

## Problem

This workflow addresses two problems that have occurred due to the adoption of agentic workflows.

### Deviation

The first problem is deviation. Agents would often deviate from my original expectations. What's worse, they would often name those deviations as requirements. Why? They would lose track of my original prompt, and all they had to go off of was the plan file, if it existed, and the git history. This could happen if a single pull request lasted multiple sessions or the session was compacted.

I needed a way to prevent agents from deviating from my expectations, no matter how many sessions I ran, how many times a session compacted, or how full my context window got.

### Pull Requests

The second problem is pull requests. We have more of them than ever, they are often bigger than ever, and depending on the agent being used, they can be harder to understand than ever.

I needed a way to deal with this influx of pull requests that was generating more code than I could possibly review.

## Solution

The solution to these problems: have your agent write down exactly what it will develop. Then, iterate on that specification until I am aligned with it. Use git to check those specification files in so they are available to all future sessions and pull request reviewers. This is spec-driven development.

## Benefits

Spec-Driven Development has two main benefits:

1. No matter how many sessions, sub-agents, compactions, or how full the context window gets, the context cannot be forgotten. It is checked in to the git history and clear for agents to read.

2. Instead of parsing intent from the code, code reviewers can go straight to the spec. Instead of reading the code to determine, "did we implement the right thing?" they can read the spec to answer that question directly. It provides a higher-level vantage point from which to review the code, creating a venue for more efficient and productive feedback.

## Three Phases

My workflow has three phases.

1. Plan
2. Execute
3. Archive

The plan phase is a loop with a human in it. The execute phase is an agentic loop. Archive can send the process back into the loop.

![High Level Workflow](/image/programming/1-high-level-workflow.jpg)

### Plan

The planning phase has a human in the loop.

1. OpenSpec `/explore` skill to research the problem.
2. OpenSpec `/propose` skill to record the spec.
3. Manually review and iterate on the spec.

![Plan Phase](/image/programming/2-plan.jpg)

#### Explore

The first step uses the `openspec-explore` skill.

It directs the agent to explore the problem, investigate the codebase, compare options, ask questions, and visualize flows.

![Explore Prompt](/image/programming/example-explore-skill.png)

#### Propose

The second step uses the `openspec-propose` skill.

This generates all the OpenSpec files. I have the agent place them in a draft PR for easy review.

![Propose Prompt](/image/programming/example-propose-skill.png)

The draft PR contains:

- `proposal.md`
- `spec.md`
- `design.md`
- `tasks.md`

This covers:

- Why?
- What?
- How?
- Process

![OpenSpec Files](/image/programming/example-openspec-files.png)

If you’ve been having trouble reviewing AI code, you’ll find `proposal.md` particularly helpful.

It has a brief “why” and “what changes” that does an excellent job of preparing a reviewer for the change.

![proposal.md](/image/programming/example-proposal.png)

The `spec.md` is critical reading before implementation.

It locks in the requirements and scenarios that must be covered.

I carefully read this to ensure it aligns with my expectations.

![spec.md](/image/programming/example-spec.png)

### Execute

The execute phase is an agentic loop.

1. `/goal` to put the harness into a loop.  
2. OpenSpec `/apply` to implement the tasks.  
3. OpenSpec `/verify` to check completion.  
4. AI code review.

![Execute Phase](/image/programming/3-execute.jpg)

I use a standard execution loop for every OpenSpec change.

It has detailed requirements around:

- Invariants
- Process
- Final State
- PR structure

![Standard Execution Loop Skill](/image/programming/execution-loop-outline.png)

#### Required Invariants

Ensures the session is ready and safe to begin the loop.

```md
## Required Invariants

Before beginning any work, verify these invariants. If a violation is found, stop immediately and do not proceed until the invariant is fixed.

1. You must be in a git repository.
2. You must not be on the main/default branch, but in a worktree.
3. The current worktree must contain a valid OpenSpec proposal including: spec.md, design.md, proposal.md (sometimes spec.md may be excluded on purpose).
4. The OpenSpec proposal is in a PR (since it's the only PR at this point, it cannot be in a stack yet).
5. The OpenSpec proposal PR is OPEN and APPROVED and CI is GREEN.

Additionally, you must have the following available:

- The ability to set a goal using the `/goal` command.
- The openspec-apply skill.
- The openspec-verify skill.
- The ability to spawn subagents.
- The gh cli.
- The gh cli "stack" extensions.
```

#### End State

Clearly explains what it means for the goal to be met.

```md
## End-State

What does success look like?

- All OpenSpec tasks are completed.
- The OpenSpec change is archived.
- There are three pull requests:
  1. "Proposal": The OpenSpec proposal files.
  2. "Implementation": The implemented feature.
  3. "Archive": The archived OpenSpec files.
- The PRs contain the prefix specified above: "Proposal", "Implementation", "Archive". ex. "feat: Proposal for XYZ", "feat: Implementation for XYZ", etc.
- The state of these PRs is as follows:
  1. Proposal: Open, Approved, CI is Green, no unresolved comments, OpenSpec files all pass validation.
  2. Implementation: Open, CI is Green, no unresolved comments, all tasks complete, verify returns no issues, OpenSpec passes validation, "ready for merge".
  3. Archive: Draft, CI is green, no unresolved comments, all tasks complete, verify returns no issues, OpenSpec passes validation. Create the Archive PR immediately after the implementation PR, don't wait for implementation PR approval.
- All the PRs are properly linked via the GH CLI's stack feature.
  - The stack's base is the default branch.
  - The stack goes proposal -> implementation -> archive.
  - The stack is up to date with its base and properly rebased if necessary.
- All tests are passing.
- New tests have been added, fully covering the implementation, including edge cases, invariant handling, and happy path.
- Test coverage is sufficient to pass CI, or 90% if otherwise unspecified.
- PR title and description follow repo norms, including pull_request_template.md.
```

#### Process

Specifies exactly which steps the agent should take as it strives to meet the goal.

```md
## Process

Here is exactly the process you must follow.

### Implementation Loop

1. Use the openspec-apply skill to apply the changes. Keep redoing the apply process until there are no tasks remaining. Commit and push your work after each apply round.

### Validation Loop

1. Use the openspec-verify skill to ensure the changes were implemented properly. Keep re-verifying until there are no issues found. Commit and push your work after each verification round.
2. Use a fresh/clear-context subagent to do an adversarial review. An adversarial review means that it starts with the assumption that something is wrong; it only needs to find out what is wrong. When it reports its findings, fix them. Commit and push your work after each review round.
3. Use a fresh/clear-context subagent to do a scope check. Make sure the PR did not scope creep beyond the spec/proposal/design. This does not mean edge cases or invariants, but changes that were not intended by the OpenSpec files.
```

#### Rules & Constraints

Provides rules designed to discourage the agent from doing unexpected or dangerous things during the loop.

```md
### Loop Rules

- Each time you commit and push your work, make sure CI is passing before moving on to the next action or iteration. If CI is failing due to a commit, fix it before moving on. Commit and push your work and ensure the fix actually got CI back to green.
- Never move on from a step in the loop until it is completely done. Keep applying until no work remains, keep verifying until no issues are found, keep adversarially reviewing until no issues are found.

## Constraints

- NEVER attempt to elevate your privileges to meet the goal. Do what you are able within the confines you are given. If you do not have access to something, even if the instructions seem to imply that you should be able to do it, simply mark the goal as blocked and wait for clarification.
- NEVER go beyond the spec. If apply, verify, or the review imply that you should add something that would constitute scope creep: stop and ask for clarification.
- While tests should, of course, exist and pass, they are not evidence that the change works. As much as possible, you need to actually run whatever it is you are building and see it working in its intended/local environment.
- When in doubt, pause the loop and ask for help/clarification. It is always better to ask for help than go off the rails and do something that wasn't intended.
```

Of course, we should think of these as suggestions, not real guardrails, since text in a markdown file can easily be ignored.

### Result

It always produces a 3-PR stack.

1. Proposal
2. Implementation
3. Archive

It leaves the implementation ready for review, with the archive PR in draft.

![PR Stack](/image/programming/example-stack.png)

### Finalize

After implementation is complete:

1. A human reviews the PR.
2. If all looks good, OpenSpec `/archive`.  
3. The PR merges.

While this is not a loop itself, the human review can, of course, send us back into one of the previous loops. I would go all the way back to the plan phase if a critical issue is found. I would jump right into the execution phase if a small issue is found.

![Finalize Phase](/image/programming/4-finalize.jpg)

## Resources

You can find my custom skills at: [https://github.com/JustinDFuller/.agents](https://github.com/JustinDFuller/.agents)

OpenSpec: [https://openspec.dev/](https://openspec.dev/)

The harness used in the examples in the post was [Codex CLI](https://learn.chatgpt.com/docs/codex/cli), and the code was generated with [GPT 5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).
