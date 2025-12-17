---
title: "Twilight of the Software Engineering Team"
date: 2025-12-16
draft: false
tags: [Code]
---

For the brief decade that I've been a Software Engineer, the teams I've worked on were staffed with a standard cross-functional makeup. For me and my teams, that means there is often some combination of product manager, engineering manager, designer, data analyst, QA tester, and software engineer, _many_ software engineers. 

![Gemini's interpretation of this post. Nothing weird here.](/image/programming/twilight/twilight.jpg)

Every team I participated in had two goals: move as fast as possible while making as few mistakes as possible. What that meant in practice varied greatly based on the organization and the context within it. When it came to making mistakes, some teams had more wiggle room than others. Some could tolerate very few mistakes and thus, moved quite a bit slower. This is true for each team I worked on that handled any sort of financial transaction, both in and outside my time at banks.

Yet, regardless of the team's appetite for mistakes, they had one thing in common: they wanted to move _faster_. Faster was, of course, relative. It was also a moving goal post. Moving faster meant giving life to the idea that we can move even faster. I know this was the case because we always had a JIRA (or Trello) backlog of tickets that were never accomplished. That backlog grew at a rate faster than tickets were closed. Ideas were cheaper to articulate than to implement.

The bottleneck was a little different on each team, but it pretty much came down to the same thing in the end. The engineers' time. Occasionally engineers would be stuck waiting on a product spec or a visual design, but that was rare. Often, engineers had enough business context and design savvy to create a working MVP while waiting on the real specs and designs. In my career, I've only seen an engineer waiting around with nothing to do a few times.

So, in my experience, the bottleneck has been engineering. This is not an insult to any engineer's ability. These were teams of knowledgable, efficient, highly-capable engineers. Yet, they were still the bottleneck. This is because the process of software engineering takes a large amount of time. Time spent hands-to-keyboard was only a small fraction of that time.

On any given project, an engineer will need to: understand the relevant parts of one or even multiple code-bases, spend time understanding the change they need to make (asking questions about requirements and suggesting alternatives), determine the best way to imeplement the change (designing algoriths, researching standard and third-party libraries, consulting other engineers), actual hands-to-keyboard coding time, debugging, testing, optimizing (running benchmarks and profilers, analyzing traces), deploying, and monitoring. These tasks would be occasionally disrupted for code review. Or, code review would be done in the downtime between tasks.

Of course, some engineers and teams have fewer steps than these and some have even more. But, in general, the shape of a project is roughly like that. It takes a lot of time.

Until recently. Recently, our industry has created and parts of it have embraced what can only be called dynamite to the old way of operating. This new technology can automate, to varying extents (based on both who you ask and where and how you use it) all of the above tasks. And it's only getting better. New releases of AI go out each month proclaiming that they are achieving even better results. More services are integrating with AI. The effectiveness and reach of the dynamite's blast only grows.

This is born out in my experience, at least. I have written about how I have written all of my production, user-facing, business-critical software with AI tools like Claude Code. I am able to generate far, far more code than I could before. I now have a new problem: I can generate more code than either myself or my team can handle. It's now the humans who are slowing the AI down.

Software engineers producing code is no longer the bottleneck. 

The very structure of our teams needs to change to occomodate this new world.

I believe this is the twilight of the software engineering team.

## The Dawn of the AI Team

Now that we can produce 10x and potentially even 100x more code than we could before, we have a new problem. How can we manage such gargantuan quantities of code while maintaining quality? Every time I log in to LinkedIn I see warnings about the perils of low-quality AI-generated code, "slop." It is clear many are running into the same problem.

One option is to arbitrarily slow down the teams to the pace they are currently capable of managing. This may be due to individuals rejecting the technology advancement, due to fear or moral concerns. These fears and concerns are valid. They should be talked about and treated seriously. The moral concerns should be addressed, primarily politically but also by consumers voting with their wallets. Right now, both politically and economically, it appears to me that the broad consensus is that AI is the future (despite constant predictions of an immenent bubble pop). This applies both in professional and personal settings. Claude Code is on my work computer, generating code for me, with the blessing (and funding) of my organization. ChatGPT is on my phone, answering questions for my personal life. To be clear, this is not to say we should stop pursuing solutions to copyright, economic, and environmental issues caused by AI. However, it is suggesting that those solutions will likely need to happen within the context of an AI-centered world and that abandonment of AI seems to be a non-starter.

If that option won't work, the other option is to restructure our teams and enable them to effectively handle new levels of output. Both options intend to maintain or increase the level of quality. One intends to do it while increasing output exponentially.

What would this new team look like? For starters, it would need a lot fewer people producing code. With Claude Code or similar tools, a single engineer can work on multiple projects at once. Personally, I've been able to effectively manage up to six (around and beyond six, it can be quite difficult to manage) simultaneous projects with AI agents. I believe with better tooling that requires less babysitting, this number will only increase.
