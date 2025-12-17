---
title: "Twilight of the Software Engineering Team"
date: 2025-12-16
draft: false
tags: [Code]
---

Since the dawn of man (or thereabouts) the typical software engineering teams have been staffed with a standard cross-functional makeup.

For those of you who don’t speak corporate, that means there is often some combination of product manager, engineering manager, designer, data analyst, QA tester, and software engineer.

The team typically has more software engineers than any other function.

Everything I’m saying is typical or average. Please don’t complain to me if your team is different. Where there are rules, there are exceptions. Some exceptional folks live their whole exceptional lives as exceptions. That doesn’t change the norm.

Software engineering teams want to move as fast as possible.

Well, most do. Some will say they don’t, because they want to move carefully and correctly. This just means they want to move fast but don’t think they can.

Today, they cannot move as fast as they want to.

The bottleneck is often (but not always) how fast teams can get code to production.

You can see this because teams often have more tickets than they complete, with the number of tickets growing faster than they complete tickets.

You know it’s growing faster than they can complete because teams often have to spend time “cleaning up” old tickets that will never get done.

They can produce ideas faster than they can produce production code.

Often this bottleneck is because of how fast engineers can write code.

- This includes more than fingers to keyboard.
- Figuring out what code to write.
- Planning architecture & system designs.
- Designing algorithms.
- Figuring out where to make changes.

Sometimes it is because of how fast they can test and deploy code.

Occasionally it is because they cannot get designs or requirements fast enough.

Rarely, it is because they can’t come up with ideas fast enough. Those teams should probably be reassigned to something else.

Things are changing, the bottleneck is shifting.

AI allows engineers to write code faster than ever.

The quality of AI-generated code is continually increasing with each new model release.

As the quality of AI-generated code increases, engineers can more reliably increase their code quality output.

For some teams, the bottleneck will no longer be how long it takes them to write code.

Instead, the bottleneck will be:

- How fast they can review it.
- How fast they can test it.
- How fast they can release it.

Some teams will be comfortable throwing the AI-generated code out there, regardless of the quality and without updated quality controls.

This will be unacceptable for many teams. They will want to benefit from the increased pace of code production but will need protections against its pitfalls.

Teams will need a new shape.

One engineer will output what ten previously could.

That one engineer will specialize in managing agentic coding tools.

The team will develop a new set of support staff.

- JIRA (or equivalent) tickets will benefit even more from having high-quality instructions produced by product managers and senior engineers. (They can be the prompt or part of it.)
- Code reviewers to review the huge volume of code being output (Also working with AI assistance and manual checks).
- SREs to monitor constant releases, then proactively identify and resolve issues.
- Potentially test automaters exclusively focused on automating tests (with AI assistance) to keep up with the huge volume of productivity.
- Meta-roles to build tooling and pipelines for these AI-centric workflows and teams.
    - Building MCP servers
    - Ensuring all internal tooling has Claude code skills, agents, slash commands, etc.
    - Run Claude Code (or similar tools) on a loop optimized for the team’s workflow (pull reqs form JIRA, push changes to Github, check the Datadog profiler for the preview env, etc.)

This new team may be the same size but with a very different shape.

This new team could potentially produce multiple times the amount of code previous software teams did.

If the controls and tooling are put in place, the quality could even go up (suddenly we have time to write tests, hook everything up to observability, run changes through the profiler and optimize, etc.)
