---
title: Agentic OpenSpec Workflow
date: 2026-07-10
draft: false
tags: [Code]
---

In this post I'll share my agentic OpenSpec workflow that I use for software development.

## Pre-Requisites

If you aren't familiar, you may want to first read about [Spec-Driven Development (SDD)](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) as this post assumes you know what that is.

You may also want to read up on [OpenSpec](https://openspec.dev/), which is the Spec-Driven Development framework I use.

> OpenSpec is a lightweight and configurable framework for creating and managing software specifications.
> https://openspec.dev/

![High Level Workflow](/image/programming/1-high-level-workflow.png)

## Three Phases

My workflow has three phases.

1. Plan
2. Execute
3. Archive

The plan phase is a loop with a human in it. The execute phase is an agentic loop. Archive can send the process back into the loop.

## Plan

The planning phase has a human in the loop.

![High Level Workflow](/image/programming/2-plan.png)

1. OpenSpec `/explore` skill to research the problem.
2. OpenSpec `/propose` skill to record the spec.
3. Manually review and iterate on the spec.


