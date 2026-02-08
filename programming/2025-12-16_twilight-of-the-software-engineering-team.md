---
title: "Twilight of the Software Engineering Team"
date: 2025-12-16
draft: false
tags: [Code]
---

Does the advancement of AI-driven development call for a new type of team?

![Gemini's interpretation of this post. Nothing weird here.](/image/programming/twilight/twilight.jpg)

In my career, each of my teams has been staffed with: a product manager, engineering manager, designer, data analyst, QA tester, and software engineer. Usually, a lot of software engineers.

Every one of those teams had two broad principles: first, move fast; second, make few mistakes. Each team assigned these principles a different weight. At a startup, we moved fast with long hours and manual testing. Later, at the banks, we used established tech stacks and rigorous testing. Now, at The Times, my teams balance speed and correctness with developer tools and robust CI pipelines.

Regardless of each team's appetite for mistakes, they wanted to move *faster*. There was always a growing JIRA backlog. Those JIRA backlogs always grew faster than tickets closed. Ideas were cheaper to articulate than implement. Until recently. Now, articulation and implementation are converging.

The bottleneck was engineering throughput. Product specs and visual designs rarely delay engineering. Even when this happened, the engineers typically had enough business context and design savvy to create a working MVP. I've only seen an engineer waiting around a few times. When all else fails, there's always some tech debt to clean up.

So, in my experience, the bottleneck was always engineering. This is not an insult to any engineer's ability. These were teams of knowledgeable, efficient, capable engineers. Yet, we were the bottleneck. This is because engineering non-trivial software took a long time. Time spent hands-to-keyboard comprised only a small fraction of the total.

On any project, engineers: understand the change, understand relevant parts of the code, determine how to implement the change, write the code, debug the code, test the code, optimize, deploy, and monitor. Code review and meetings often disrupt these tasks.

Of course, some teams have fewer steps than these. Some have more. But, in general, the shape of a project is like that. It takes a lot of time.

![A rough sketch of typical Software Engineering teams.](/image/programming/twilight/old-team.png)

At least, it *took* a lot of time. Recently, our industry created (and parts of it have embraced) what can only be called dynamite for the old way of operating. This new technology can automate, to varying extents (based on both who you ask and where and how you use it), nearly all of the above tasks. And it's only getting better. New releases go out each month proclaiming that they are achieving even better results. More services are integrating with agentic coding assistants. The effectiveness and reach of the dynamite's blast only grows.

In my experience, these claims are valid. [I have written](/programming/my-claude-code-setup) about how I am producing all of my production, user-facing, business-critical software with agentic coding assistant tools like Claude Code. I am able to generate far, far more code than I could before. I now have a new problem: I can generate more code than either myself or my team can handle. It's now the humans who are slowing down the agents.

Software engineers producing code is no longer the bottleneck.

The very structure of our teams needs to change to accommodate this new world.

I believe this is the twilight of the software engineering team.

## The Dawn of the Agentic Team

Now that we can produce 10x and potentially even 100x more code than we could before, we have a new problem. How can we manage such gargantuan quantities of code while maintaining quality? Every time I log in to LinkedIn, I see warnings about the perils of low-quality AI-generated code, "slop." It is clear many are running into the same problem.

One option is to arbitrarily slow down the teams to the pace they are currently capable of. This may be due to individuals rejecting the technological advancement, fear, or moral concerns. These fears and concerns are valid. They should be talked about and treated seriously. The moral concerns should be addressed, primarily politically but also by consumers voting with their wallets.

Right now, both politically and economically, the broad consensus appears to be that AI is the future (despite predictions of an imminent bubble pop). This applies to professional and personal settings. Claude Code is on my work computer, generating code with the blessing and funding of my employer. ChatGPT is on my phone, answering questions in my personal life. To be clear, this is not to say we should stop pursuing solutions to copyright, economic, and environmental issues. However, it does suggest those solutions will need to happen within the context of an AI-centered world. Abandonment seems to be a non-starter.

If ignoring AI won't work, the other option is to adapt. We must enable our teams to effectively manage increased output. Both options intend to maintain the level of quality. Only one attempts to maintain quality while increasing output.

What would this new team look like? For starters, it would need fewer people producing code. With Claude Code or similar tools, a single engineer can work on multiple projects at once. Personally, I've been able to effectively manage up to six simultaneous projects with agentic coding assistants. Beyond six, it can be quite difficult to manage. I believe with improved models and better tooling, our coding agents will require less babysitting. The number of concurrent projects per engineer will only increase.

So, we’ll need fewer Software Engineers focused on code output. That neither means we need fewer Software Engineers nor smaller teams. To the contrary, our ability to generate more code suggests we could use more people. We will produce more software than ever before. However, those same people will carry out vastly different tasks.

![One idea for a new agent-centric Software team.](/image/programming/twilight/ai-team.png)

Before, the primary bottleneck was generating correct code. The new bottlenecks will be: identifying work, designing changes, creating technical specs, reviewing the sheer quantity of code produced, and managing the agent's supporting tools. These problems still require deep technical expertise — applied to different areas.

An experienced engineer on the team may now need to focus more on providing high-quality technical specs. These may take the form of JIRA tickets or similar. Those specs will be an important part of the agent’s prompt.

Another engineer (or multiple) may need to focus on reviewing the enormous volume of code. Agents could use their feedback to iterate on a PR. These engineers would not generate code but spend the bulk of their time reading, validating, and articulating feedback for the agents to act on.

Other engineers may need to focus on building tools for agents, much like some engineers today may focus on building pipelines and developer tooling. These engineers may connect the agent to other tools like JIRA, GitHub, Slack, PagerDuty, Google Docs/Sheets, and Datadog. The possibilities are endless. The goal of this engineer would be to continually streamline the use of agentic coding assistants.

This is still a highly skilled, technical team. However, the shift in focus would reflect moving bottlenecks caused by evolving technology.

## Short Term

Let's be realistic. In the short term, few, if any, teams will be ready for this change. So, what might this look like in the near future; in 2026?

Teams might begin to adjust how they spend their time.

1. **Code Review**: I believe the first change is a re-evaluation of the importance of code review. At the rate of a human developer, a team of 6 might see 6-10 code reviews per day. At the rate of an agentic developer, teams could easily see twice that volume. If the time allotted for code reviews is not doubled, **the quality of code reviews will drop by half**. So, teams must first allow for more code review time.

2. **Integrations**: One of the core principles of agentic coding is that **context matters**. It's not just about giving the agents *more* context. It's about giving them the *right* context. Teams must focus on getting their agents the best possible context, beyond files in a codebase. This might mean finding ways to safely connect agents to JIRA, Datadog, internal tools, etc. to ensure our agents aren't reliant on us feeding them the right information. This could constitute roadmapped work for the team, to improve their developers' velocity by integrating agentic coding assistants with more tools.

3. **Preparation**: Again, since context is so important, teams may want to renew their focus on generating high quality plans and ticketed work. This might mean allocating more of your engineer leads to providing high quality JIRA tickets. The goal here is to ensure tickets are close to (if not perfectly) suitable to be a prompt to an agent.

I'm sure there are many other short-term, small adjustments teams can make. Ideally, the adjustments can be subtle and continuous. In this way, teams may completely refactor themselves without ever experiencing a scary shift, as described above.

## Caveats

In reality, AI may produce teams that are very different from what I’ve described above. I do not feel confident about any particular team shape. Instead, I feel confident about two things.

First, I believe teams that do not adjust to this new world will continually feel frustrated. They will experience the volume of output created by agentic tools as a detriment, and rightfully so. The current shape of Software Engineering teams is *not* equipped to handle this volume. Imagine a hose designed to output 20 liters of water per minute. You’re going to have a bad time if you suddenly try to 10x that volume.

I am not saying those teams will not succeed. Just like there are successful teams still working with waterfall instead of agile, there will still be successful Software Engineering teams in the AI era. I am specifically warning against the mixing of high-output agentic coding assistants with a human-coder-centered team structure.

Second, I believe the evolution will be messy. This is a rapidly evolving technology. Teams should continually experiment with new structures. Some will fail. Some will work for a time, then stop working when the technology advances further. I believe this will be an uncomfortable but healthy part of the industry’s evolution. Engineering leaders should embrace this discomfort and adopt an experimentation mindset with their teams. They should try five different structures in five different teams, then adopt whatever works best, wherever it works best.

Some teams may need to stack heavily on code review. Others may need to focus on automation. Still others, testing. The bottleneck has shifted, but we do not yet understand how to best adapt to it. My intention with the description above is to articulate just one possibility and to encourage the industry to imagine what teams could be like in this new world.
