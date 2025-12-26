---
title: "Twilight of the Software Engineering Team"
date: 2025-12-16
draft: false
tags: [Code]
---

Does the advancement of AI-driven development call for a new type of team?

So far in my career, each of my teams has been staffed with some combination of: product manager, engineering manager, designer, data analyst, QA tester, and software engineer. Usually, a lot of software engineers.

![Gemini's interpretation of this post. Nothing weird here.](/image/programming/twilight/twilight.jpg)

Every one of those teams had two broad principles: first, move fast; second, make few mistakes. 

Each team enacted these principles slightly differently. For example, at a startup, we pursued speed with long hours and manual testing. At the banks, we stuck to tried-and-true tech stacks and rigorous testing protocols. At The Times, my teams attempt to balance speed and correctness with developer tooling, such as robust CI pipelines.

Yet, regardless of the team's appetite for mistakes, they had one thing in common: they wanted to move *faster*. I know this was the case for two reasons. First, because the teams had more engineers than any other function. Second, because there was always an ever-growing backlog of JIRA tickets. Those JIRA backlogs always grow at a rate faster than tickets close. Ideas have always been cheaper to articulate than to implement. At least, until recently. Now, articulation and implementation are converging.

Even though the bottleneck was slightly different for each team, it basically came down to one thing: the engineering time. Occasionally engineers would be stuck waiting on a product spec or a visual design, but that was rare. Even when this happened, the engineers typically had enough business context and design savvy to create a working MVP while waiting on the real specs and designs. In my career, I've only seen an engineer waiting around with nothing to do a few times. There's always some tech debt to clean up, when all else fails.

So, in my experience, the bottleneck has always been engineering. This is not an insult to any engineer's ability. These were teams of knowledgeable, efficient, highly-capable engineers. Yet, we are always the bottleneck. This is because the process of engineering non-trivial software has historically taken a large amount of time. Time spent hands-to-keyboard was only a small fraction of that time.

On any given project, an engineer will need to: understand the relevant parts of one or more codebases, spend time understanding the change they need to make, determine the best way to implement the change, hands-to-keyboard coding time, debugging, testing, optimizing, deploying, and monitoring. These tasks would occasionally be disrupted for code review and (often) meetings.

Of course, some engineers and teams have fewer steps than these and some have even more. But, in general, the shape of a project is roughly like that. It takes a lot of time.

![A rough sketch of typical Software Engineering teams.](/image/programming/twilight/old-team.png)

Until recently. Recently, our industry has created (and parts of it have embraced) what can only be called dynamite for the old way of operating. This new technology can automate, to varying extents (based on both who you ask and where and how you use it) nearly all of the above tasks. And it's only getting better. New releases of AI go out each month proclaiming that they are achieving even better results. More services are integrating with AI. The effectiveness and reach of the dynamite's blast only grows.

In my experience, these claims are valid. [I have written](/programming/my-claude-code-setup) about how I am producing all of my production, user-facing, business-critical software with AI tools like Claude Code. I am able to generate far, far more code than I could before. I now have a new problem: I can generate more code than either myself or my team can handle. It's now the humans who are slowing down the AI.

Software engineers producing code is no longer the bottleneck.

The very structure of our teams needs to change to accommodate this new world.

I believe this is the twilight of the software engineering team.

## The Dawn of the AI Team

Now that we can produce 10x and potentially even 100x more code than we could before, we have a new problem. How can we manage such gargantuan quantities of code while maintaining quality? Every time I log in to LinkedIn I see warnings about the perils of low-quality AI-generated code, "slop." It is clear many are running into the same problem.

One option is to arbitrarily slow down the teams to the pace they are currently capable of managing. This may be due to individuals rejecting the technology advancement, due to fear or moral concerns. These fears and concerns are valid. They should be talked about and treated seriously. The moral concerns should be addressed, primarily politically but also by consumers voting with their wallets. Right now (near the end of 2025), both politically and economically, it appears the broad consensus is that AI is the future (despite predictions of an imminent bubble pop). This applies both in professional and personal settings. Claude Code is on my work computer, generating code for me, with the blessing (and funding) of my organization. ChatGPT is on my phone, answering questions for my personal life. To be clear, this is not to say we should stop pursuing solutions to copyright, economic, and environmental issues caused by AI. However, it is suggesting that those solutions will likely need to happen within the context of an AI-centered world and that abandonment of AI seems to be a non-starter.

If ignoring AI won't work, the other option is to restructure our teams. We must enable them to handle new levels of output effectively. Both options intend to maintain or increase the level of quality. Only one attempts to maintain quality while exponentially increasing output.

What would this new team look like? For starters, it would need fewer people producing code. With Claude Code or similar tools, a single engineer can work on multiple projects at once. Personally, I've been able to effectively manage up to six simultaneous projects with AI agents. Beyond six, it can be quite difficult to manage. I believe with improved models and better tooling, our coding agents will requires less babysitting. The number of concurrent projects per engineer will only increase.

So, we’ll need fewer Software Engineers focused on code output. That neither means we need fewer Software Engineers nor smaller teams. To the contrary, our ability to generate more code suggests we could use more people. We will produce more software than ever before. However, those same people will carry out vastly different tasks.

![One idea for a new AI-centric Software team.](/image/programming/twilight/ai-team.png)

Before, the primary bottleneck was generating correct code. New bottlenecks will be producing enough clear specifications, reviewing the sheer quantity of code produced, and managing the AI tooling itself. These problems still require deep technical expertise — only applied to new areas.

An experienced engineer on the team may now need to focus more on providing high-quality technical specifications. These may take the form of JIRA tickets or similar. They would become an important part of the AI’s prompt.

Another engineer (or multiple) may need to focus on reviewing the code output by the AI. Their feedback could be used by the AI to iterate on a PR. They would not generate code themselves but spend the bulk of their time reading, validating approaches, and articulating feedback for the AI to act on.

Still other engineers may need to focus on building AI tools, much like some engineers today may focus on building pipelines or other developer tooling. These engineers may work to connect the AI agent of choice to the relevant tools of the team (JIRA, Github, Slack, PagerDuty, Google Docs/Sheets, DataDog, the possibilities are endless). The goal of this engineer would be to continually streamline the use of AI to generate code.

This is still a highly-skilled, technical team. However, the shift in time would reflect moving bottlenecks caused by evolving technology.

## Alternatives

In reality, AI may produce teams that are very different than what I’ve described above. I do not feel confident about any particular shape of teams after AI. Instead, I feel confident about two things.

First, I believe teams that do not adjust to this new world will continually feel frustrated by AI. They will experience the volume of output created by AI tools as a detriment, and rightfully so! The current shape of Software Engineering teams are *not* equipped to handle this volume of production. Imagine a hose designed to output 20 liters of water per minute. You’re going to have a bad time if you suddenly try to shove 100 liters of water per minute through it.

Second, I believe that the evolution will be messy. This is a rapidly evolving technology. Teams should try new structures to adapt to this new technology. Some of those structures will fail. Some will work for a time, then stop working when the technology advances further. I believe this will be an uncomfortable but healthy part of the industry’s AI evolution. I believe engineering leaders should embrace this discomfort and adopt an experimentation mindset with their teams. They should try five different structures in five different teams, then adopt whatever works best, wherever it works best.

Some teams may need to stack heavily on code review. Others may need to focus on automation. Still others, testing. The bottleneck has shifted, but we do not yet understand how to best adapt to it. My intention with the description above is to articulate just one possibility and to encourage the industry to imagine what teams could be like in this new world.
