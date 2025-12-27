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

Each team enacted these principles differently. For example, at a startup, we pursued speed with long hours and manual testing. At the banks, we stuck to tried-and-true tech stacks and rigorous testing protocols. Now, at The Times, my teams attempt to balance speed and correctness with developer tooling, such as robust CI pipelines.

Yet, regardless of each team's appetite for mistakes, they had one thing in common: the desire to move *faster*. There was always an ever-growing backlog of JIRA tickets. Those JIRA backlogs always grew faster than tickets closed. Ideas have always been cheaper to articulate than to implement. At least, until recently. Now, articulation and implementation are converging.

Even though the bottleneck was different for each team, it basically came down to one thing: the engineering time. Occasionally engineers would be stuck waiting on a product spec or a visual design, but that was rare. Even when this happened, the engineers typically had enough business context and design savvy to create a working MVP while waiting on the real specs and designs. In my career, I've only seen an engineer waiting around with nothing to do a few times. When all else fails, there's always some tech debt to clean up.

So, in my experience, the bottleneck has always been engineering. This is not an insult to any engineer's ability. These were teams of knowledgeable, efficient, highly-capable engineers. Yet, we were always the bottleneck. This is because the process of engineering non-trivial software has historically taken a long time. Time spent hands-to-keyboard comprised only a small fraction of that time.

On any given project, engineers need to: understand the change, understand relevant parts the code, determine how to implement the change, write the code, debug the code, test the code, optimize the code, deploy, and monitor. Code review and meetings occasionally (or often) disrupt these tasks.

Of course, some engineers and teams have fewer steps than these. Some have even more. But, in general, the shape of a project is roughly like that. It takes a lot of time.

![A rough sketch of typical Software Engineering teams.](/image/programming/twilight/old-team.png)

Or, at least, it _took_ a lot of time. Recently, our industry created (and parts of it have embraced) what can only be called dynamite for the old way of operating. This new technology can automate, to varying extents (based on both who you ask and where and how you use it) nearly all of the above tasks. And it's only getting better. New releases go out each month proclaiming that they are achieving even better results. More services are integrating with agentic coding assistants. The effectiveness and reach of the dynamite's blast only grows.

In my experience, these claims are valid. [I have written](/programming/my-claude-code-setup) about how I am producing all of my production, user-facing, business-critical software with agentic coding assistants tools like Claude Code. I am able to generate far, far more code than I could before. I now have a new problem: I can generate more code than either myself or my team can handle. It's now the humans who are slowing down the agents.

Software engineers producing code is no longer the bottleneck.

The very structure of our teams needs to change to accommodate this new world.

I believe this is the twilight of the software engineering team.

## The Dawn of the Agentic Team

Now that we can produce 10x and potentially even 100x more code than we could before, we have a new problem. How can we manage such gargantuan quantities of code while maintaining quality? Every time I log in to LinkedIn I see warnings about the perils of low-quality AI-generated code, "slop." It is clear many are running into the same problem.

One option is to arbitrarily slow down the teams to the pace they are currently capable of. This may be due to individuals rejecting the technology advancement, fear, or moral concerns. These fears and concerns are valid. They should be talked about and treated seriously. The moral concerns should be addressed, primarily politically but also by consumers voting with their wallets. 

Right now, both politically and economically, the broad consensus appears to be that AI is the future (despite predictions of an imminent bubble pop). This applies to professional and personal settings. Claude Code is on my work computer, generating code with the blessing and funding of my employer. ChatGPT is on my phone, answering questions in my personal life. To be clear, this is not to say we should stop pursuing solutions to copyright, economic, and environmental issues. However, it does suggest those solutions will need to happen within the context of an AI-centered world. Abandonment seems to be a non-starter.

If ignoring AI won't work, the other option is to adapt. We must enable our teams to effectively manage increased output. Both options intend to maintain the level of quality. Only one attempts to maintain quality while increasing output.

What would this new team look like? For starters, it would need fewer people producing code. With Claude Code or similar tools, a single engineer can work on multiple projects at once. Personally, I've been able to effectively manage up to six simultaneous projects with agentic coding assistants. Beyond six, it can be quite difficult to manage. I believe with improved models and better tooling, our coding agents will requires less babysitting. The number of concurrent projects per engineer will only increase.

So, we’ll need fewer Software Engineers focused on code output. That neither means we need fewer Software Engineers nor smaller teams. To the contrary, our ability to generate more code suggests we could use more people. We will produce more software than ever before. However, those same people will carry out vastly different tasks.

![One idea for a new agent-centric Software team.](/image/programming/twilight/ai-team.png)

Before, the primary bottleneck was generating correct code. The new bottlenecks will be: identifying work, designing changes, creating technical specs, reviewing the sheer quantity of code produced, and managing the agent's supporting tools. These problems still require deep technical expertise — applied to different areas.

An experienced engineer on the team may now need to focus more on providing high-quality technical specs. These may take the form of JIRA tickets or similar. Those specs will be an important part of the agent’s prompt.

Another engineer (or multiple) may need to focus on reviewing the enourmous volume of code. Agents could use their feedback to iterate on a PR. These engineers would not generate code but spend the bulk of their time reading, validating, and articulating feedback for the agents to act on.

Other engineers may need to focus on building tools for agents, much like some engineers today may focus on building pipelines and developer tooling. These engineers may connect the agent to other tools like JIRA, Github, Slack, PagerDuty, Google Docs/Sheets, and DataDog. The possibilities are endless. The goal of this engineer would be to continually streamline the use of agentic coding assistants.

This is still a highly-skilled, technical team. However, the shift in focus would reflect moving bottlenecks caused by evolving technology.

## Alternatives

In reality, AI may produce teams that are very different than what I’ve described above. I do not feel confident about any particular team shape. Instead, I feel confident about two things.

First, I believe teams that do not adjust to this new world will continually feel frustrated. They will experience the volume of output created by agentic tools as a detriment, and rightfully so! The current shape of Software Engineering teams are *not* equipped to handle this volume. Imagine a hose designed to output 20 liters of water per minute. You’re going to have a bad time if you suddenly try to 10x that volume.

Second, I believe the evolution will be messy. This is a rapidly evolving technology. Teams should continually experiment with new structures. Some will fail. Some will work for a time, then stop working when the technology advances further. I believe this will be an uncomfortable but healthy part of the industry’s evolution. Engineering leaders should embrace this discomfort and adopt an experimentation mindset with their teams. They should try five different structures in five different teams, then adopt whatever works best, wherever it works best.

Some teams may need to stack heavily on code review. Others may need to focus on automation. Still others, testing. The bottleneck has shifted, but we do not yet understand how to best adapt to it. My intention with the description above is to articulate just one possibility and to encourage the industry to imagine what teams could be like in this new world.
