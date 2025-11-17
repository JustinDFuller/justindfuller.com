---
title: "Daily Dash"
subtitle: "How I Vibe Coded my Kids' Morning Routine"
date: 2025-11-09
draft: false
tags: [Programming]
---

Listen, I love my kids. I truly, unequivocally do. But if I'm honest, getting them to _brush_ their teeth is often like _pulling_ their teeth. Sometimes, I think they'd genuinely prefer the latter. At least there would be no further brushing.

A while back, I discovered a magical app, [School Morning Routine](https://schoolmorningroutine.com/), that actually made our routine fun. We primarily used it for our bedtime routine, despite the app's name. However, at some point the app stopped working. It seems you can no longer log in or create an account. Once again, our bedtime routine fell into dysfunction.

I would have loved to create an app to replace it. But, did I mention I have kids? Three of them, to be precise. I also have a full-time job, a spouse, and the usual gamut of small tasks that drain the remaining time from the day like sand slipping between fingers. In other words, I had no time.

Then along came GenAI. I started using Cursor and Claude Code at work. I wondered, could I vibe-code my way into a functional bedtime routine with my kids?

## Daily Dash

The answer is yes! Say hello to [Daily Dash](https://daily-dash.justindfuller.com).

![Welcome to Daily Dash](/image/programming/daily_dash/1_landing_page.png)

Before I talk about _how_ I did this, let’s take a quick stroll through the website. You start at the Dashboard. Here, you can either start a routine or configure all the “boring parent stuff.”

![Daily Dashboard](/image/programming/daily_dash/2_dashboard.png)

“Boring parent stuff” means adding your kids and their routines.

![Parent Desk](/image/programming/daily_dash/3_parent_desk.png)

You can choose from pre-defined tasks or create your own.

![Set Kid's Tasks](/image/programming/daily_dash/4_parent_desk_tasks.png)

Once an adult (or a smart child—in my view, the Venn diagram contains significant overlap) takes care of the boring stuff, you can start a routine!

One area I wanted to improve was allowing for multiple routines. Now, we can have morning and evening routines. You could even add more, like an after-school routine, if you wanted.

![Choose a Routine](/image/programming/daily_dash/5_choose_routine.png)

On the task page, kids tap each task as they complete it. They are instantly rewarded with a fun check mark and celebratory sound.

![Complete Your Tasks](/image/programming/daily_dash/6_task_page.png)

When each kid completes their tasks, they are rewarded with a cute animal GIF.

![Celebrate!](/image/programming/daily_dash/7_celebrations.png)

Kids can customize their colors, avatars, and check marks.

![Customize](/image/programming/daily_dash/8_customize.png)

## Vibe Coding

We've all heard a lot about vibe coding. Depending on who you ask, it's somewhere between actively harmful and literal magic.

Based on my experience using GenAI coding assistants both at work and at home, I'd place myself squarely in the middle. At this point, I'm using Claude Code and similar tools to [write 100% of the code I ship to production](/programming/my-claude-code-setup). I've learned that it is a powerful tool that, when used in the right way, can consistently yield quality results.

Yet, not all use of GenAI coding assistants is vibe coding. At work, I use Claude Code to generate all my code, but due to my rigorous process and careful review of each line, I would _not_ say I am vibe coding there. For this project, I did not look at the code at all. I only looked at the agent's plan and the final result in the browser. The code was a black box that I did not peek inside. I still have not looked at the code for Daily Dash.

### Tool

For this project, I decided to give [OpenAI Codex](https://openai.com/codex/) a try. I headed over to OpenAI's website, gave them $20 of my hard-earned money, and got access to Codex for one month.

![ChatGPT Plus includes Codex](/image/programming/daily_dash/9_chatgpt_plus.png)

The only configuration I changed was setting the model to [gpt-5 codex](https://platform.openai.com/docs/models/gpt-5-codex). This is a version of GPT-5 optimized for Codex.

With that done, it was vibe-coding time!

![Codex in my terminal](/image/programming//daily_dash/10_terminal_codex.png)

If you look at the [very first commit](https://github.com/JustinDFuller/daily-dash/commit/1637c223299a78ba32ae11497c1ba906876f78a3), you'll see two primary files: `REQUIREMENTS.md` and `IMPLEMENTATION_PLAN.md`.

### Requirements

[REQUIREMENTS.md](https://github.com/JustinDFuller/daily-dash/blob/1637c223299a78ba32ae11497c1ba906876f78a3/REQUIREMENTS.md) contains a detailed set of plain-English descriptions of the application. This document says nothing about _how_ the application will be built. Instead, it focuses on _what_ the application should be.

I had Codex generate these requirements by analyzing what it could see from the School Morning Routine app. I also manually provided some requirements. Codex took these inputs and generated REQUIREMENTS.md. I'm really glad I started here, because it was clear Codex and I had very different ideas about what, exactly, we were building. It took several rounds of back-and-forth before I had a set of requirements I agreed with.

__The lesson:__ before jumping into an implementation plan—especially when vibe coding—take the time to clearly articulate the requirements.

### Implementation Plan

Once the requirements were in place, I had Codex generate an [IMPLEMENTATION_PLAN.md](https://github.com/JustinDFuller/daily-dash/blob/1637c223299a78ba32ae11497c1ba906876f78a3/IMPLEMENTATION_PLAN.md). I knew this project would take more than a single session, so I wanted a holistic plan that could guide development across days and weeks.

Just like with REQUIREMENTS.md, the implementation plan required several rounds of feedback. The feedback primarily focused on technology choices. Codex initially proposed an overly complex architecture. For example, it used [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), which felt unnecessary for such a simple use case. After several rounds of refinement, I simplified the plan to something I felt was realistic.

__The lesson:__ actually read the implementation plan. Even if you plan to vibe-code the application, ensuring the plan and tech stack are reasonable is worth the effort.

### Problems

With the plan in place, Codex began implementing the app. As you saw earlier, the end result turned out pretty decent. Still, it ran into several issues along the way. Reflecting on these errors can help us use such tools more effectively in the future.

#### Consistent Styles

The design requires roughly five button types: the yellow start button, the blue primary button, the white secondary button, the round secondary button, and the customizable task buttons.

Early on, I noticed that when I requested global button changes, they applied inconsistently. Codex’s initial implementation didn't use any shared classes.

The short-term fix was simple: instruct Codex to reuse classes across all buttons.

The long-term fix may require updating AGENTS.md to provide a clearer framework for when and how to share code.

#### Choosing Tasks & Icons

The application required icons to represent various tasks—like a toothbrush for brushing teeth and clothing for getting dressed. Younger kids can't read yet, so they need clear, intuitive icons.

For the first round of icon selection, I let Codex choose them.

![The original Icons were ... interesting.](/image/programming/daily_dash/11_original_icons.png)

The results were… interesting. Notably—and to my horror—Codex chose scissors to represent “Do Hair.” I decided I needed a more hands-on approach that wouldn’t accidentally encourage a three-year-old to give themselves an impromptu haircut.

My eventual approach was to explicitly tell Codex which tasks to include and which icons to use for each one. In hindsight, it's not surprising that a software-engineering-focused model may lack intuition about what is appropriate for children.

#### Finding Celebration GIFs

This was the first task Codex completely failed at. I tried multiple times to instruct it to retrieve “fun, cute, kid-appropriate animal GIFs” for celebrations. Without fail, Codex refused to retrieve GIFs from the internet. Even when I told it to use `giphy.com` and provided an example GIF, it wouldn’t.

Instead, it decided it would _generate_ the celebration GIFs itself.

![Nonsensical Celebration GIF](/image/programming/daily_dash/12_nonsensical_celebration_gif.png)

The generated GIFs were nonsensical. I’ll give it this: some shapes vaguely resembled animals—or parts of them.

At this point, I manually retrieved GIFs and uploaded them as numbered files. Codex then used those numbers to map celebration choices.

#### The Bug It Couldn't Fix

Codex failed at the final task, and I still don’t fully understand why.

After adding support for multiple routines, I tested it by creating morning and evening routines. I added tasks to the morning routine. When I switched to the evening routine, the morning tasks were there. I deleted them, switched back, and—unsurprisingly—they were gone from morning as well.

I explained the bug to Codex. It immediately described the cause and attempted a fix. But the problem persisted. This happened several times.

Since I wasn’t reading the code, I resorted to inspecting the data in localStorage, where the app stores its state. I noticed there was only one location where tasks were stored, instead of separate task lists for each routine. Armed with this, I told Codex exactly what it was doing wrong and what data structure it needed. Only then was it able to fix the bug.

## Takeaways

There are three areas worth reflecting on: vibe coding as a practice, Codex as an agentic tool, and GPT-5 as a model.

### Vibe Coding

I'll state this plainly: if you are making something important, a qualified human _must_ still read, understand, and take responsibility for the code these tools generate. Vibe coding was fine for this small toy app that streamlined my kids' morning routine. I would not trust it for anything more important.

In [my professional AI workflow](/programming/my-claude-code-setup), I rigorously review all AI-generated code. I recommend a similar human-in-the-loop process for anything nontrivial.

### Codex

Codex was a decent experience. However, I wouldn’t choose it over Claude Code or Cursor, both of which feel more full-featured and easier to use.

The thing I missed most was slash commands. I repeatedly had to write prompts like `git add commit and push, remember to include yourself as a co-author`. It would have been nice to wrap this in a command. You’ll see many commits where Codex is not the co-author, simply because I forgot to include that reminder.

Additionally, the main benefit of Codex—optimizing GPT-5’s thinking time across low, medium, and high—went unused. I never bothered to switch modes. This feature would be far better if Codex automatically selected the appropriate level based on task complexity.

### GPT-5 (Codex)

Overall, the model performed well and eventually built a solid UI and a working application. Responses were quick, and most changes worked on the first attempt.

I have no hard proof, but I believe Claude Sonnet 4.5 would not have struggled with the bug that GPT-5 failed to fix. This is based on the much more complex issues I routinely see Sonnet solve in my professional workflow. This bug felt comparatively simple.
