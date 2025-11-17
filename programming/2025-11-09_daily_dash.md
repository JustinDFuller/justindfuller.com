---
title: "Daily Dash"
subtitle: "How I Vibe Coded my Kids' Morning Routine"
date: 2025-11-09
draft: false
tags: [Programming]
---

Listen, I love my kids. I truly, unequivocally do. But if I'm perfectly honest, getting them to _brush_ their teeth is often like _pulling_ their teeth. Sometimes, I honestly think they'd prefer the latter. At least there would be no further brushing.

A while back, I discovered a magical app, [School Morning Routine](https://schoolmorningroutine.com/) that actually made our routine fun. We primarily used it for our bedtime routine, despite the app's name. However, at some point the app stopped working. It seems you can no longer log in or create an account. Once again, our bedtime routine fell into dysfunction.

I would have loved to create an app to replace it. But, did I mention I have kids? Three of them, to be precise. I also have a full time job, a spouse, and the usual gambit of small tasks that drain the remaining time from the day like sand sliding through fingers. In other words, I had no time.

Yet, along came GenAI. I started using Cursor and Claude Code at work. I wondered, could I vibe-code my way into a functional bedtime routine with my kids?

## Daily Dash

The answer is yes! Say hello to [Daily Dash](https://daily-dash.justindfuller.com).

![Welcome to Daily Dash](/image/programming/daily_dash/1_landing_page.png)

Before I talk about _how_ I did this. Let's take a quick stroll through the website. You start at the Dashboard. Here, you can either start a routine or configure all the "boring parent stuff."

![Daily Dashboard](/image/programming/daily_dash/2_dashboard.png)

Boring parent stuff means adding your kids and their routines.

![Parent Desk](/image/programming/daily_dash/3_parent_desk.png)

You can choose from pre-defined tasks or even create your own.

![Set Kid's Tasks](/image/programming/daily_dash/4_parent_desk_tasks.png)

Once an adult (or a smart child, in my view, the ven-diagram contains signficant overlap) takes care of the boring stuff, you can start a routine!

One area I wanted to improve was allowing for multiple routines. Now, we can have morning and evening routines. You could even add more, like an after-school routine, if you wanted.

![Choose a Routine](/image/programming/daily_dash/5_choose_routine.png)

On the task page, kids tap each task as they complete it. They are instantly rewarded with a fun check-mark and celebratory sound.

![Complete Your Tasks](/image/programming/daily_dash/6_task_page.png)

When each kid completes their tasks, they are rewarded with a cute animal Gif.

![Celebrate!](/image/programming/daily_dash/7_celebrations.png)

Kids can customize their colors, avatars, and check marks.

![Customize](/image/programming/daily_dash/8_customize.png)

## Vibe Coding

We've all heard a lot about vibe coding. Depending on who you ask, it's somewhere between actively harmful and literal magic.

Based on my experience using GenAI coding assistants both at work and at home, I'd place myself squarely in the middle. At this point, I'm using Claude Code and similar tools to [write 100% of the code I ship to production](/programming/my-claude-code-setup). I've learned that is a powerful tool that, if used in the right way, can consistently yield quality results.

Yet, not all use of GenAI Coding Assistants is Vibe Coding. At work, I use Claude Code to generate all my code. But due to my rigorous process and careful review of each line, I would _not_ say I am vibe coding there. For this project, I did not look at the code at all. I only looked at the agent's plan and the end result in the browser. The code was a black box that I did not look inside. I still have not looked at the code for Daily Dash.

### Tool

For this project, I decided to give [OpenAI Codex](https://openai.com/codex/) a try. I headed over to OpenAI's website, gave them $20 of my hard-earned money, and got access to Codex for one month.

![ChatGPT Plus includes Codex](/image/programming/daily_dash/9_chatgpt_plus.png)

The only configuration I changed was setting the model to [gpt-5 codex](https://platform.openai.com/docs/models/gpt-5-codex). This is a version of GPT-5 which is optimized for Codex.

With this done, it was vibe-coding time!

![Codex in my terminal](/image/programming//daily_dash/10_terminal_codex.png)

If you look at the [very first commit](https://github.com/JustinDFuller/daily-dash/commit/1637c223299a78ba32ae11497c1ba906876f78a3) you'll see two primary files: `REQUIREMENTS.md` and `IMPLEMENTATION_PLAN.md`.

### Requirements

[REQUIREMENTS.md](https://github.com/JustinDFuller/daily-dash/blob/1637c223299a78ba32ae11497c1ba906876f78a3/REQUIREMENTS.md) contains a very detailed set of plain-english descriptions of the application. This document says nothing about _how_ the application will be built. Instead, it focuses on _what_ the application is.

I had Codex generate these requirements by analyzing what it could see from the School Morning Routine. I also manually provided some requirements. Codex took these inputs and generated REQUIREMENTS.md. I'm really glad I started here, because it was clear Codex and I had vastly different explanations for what, exactly, we were building. It required several back-and-forth rounds with Codex before I had a set of requirements I agreed with.

__The lesson:__ before jumping into an implementation plan, particularly when vibe-coding, take the time to clearly and completely articulate the requirements before jumping in to implementation plans.

### Implementation Plan

Once requirements were in place, I had Codex generate an [IMPLEMENTATION_PLAN.md](https://github.com/JustinDFuller/daily-dash/blob/1637c223299a78ba32ae11497c1ba906876f78a3/IMPLEMENTATION_PLAN.md). I knew this project would take more than a single session. So, I wanted to create a holistic implementation plan that could be used across sessions over the days and weeks it would take to implement the website.

Just like with REQUIREMENTS.md, the IMPLEMENTATION_PLAN.md required several rounds of feedback before I was happy with it. This means I actually read the implementation plan, even though I planned to vibe-code the application itself. The feedback primarily focused on technology choices. In my view, Codex initially chose an overly complex architecture. For example, it used [IndexDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API). While we can debate the merits and flaws of that Web API, I felt it was totally unnecessary for this simple use-case. After several rounds of feedback, I simplified the implementation plan to a point I felt it was realistic to implement.

__The lesson:__ Actually read the implementation plan. Even if you plan to vibe-code the application, it is helpful to ensure the plan and technology stack are realistic.

### Problems

At this point, Codex began implementing the app. As you saw in the above section, it turned out pretty decent in the end. However, it ran into several issues along the way. Reflecting on the types of errors encounted by an agent can help prepare us to use them more effectively and to mitigate these errors in the future.

#### Consistent Styles

The design requires roughly five buttons: the yellow start button, the blue primary button, the white secondary button, the round secondary button, and the customizable task buttons.

Early on, I noticed that when I requested a global button changes, it would apply sporatically. This is because Codex's initial implementation didn't use any shared classes.

The short-term fix was simple: instruct Codex to re-use classes across all buttons.

The long-term fix may require carefully updating AGENTS.md to provide a framework for when and how to share code.

#### Choosing Tasks & Icons

The application required icons to represent the various tasks. For example, a tooth brush to represent brushing teeth and clothes to represent get dressed. Younger kids will not be able to read yet, so they require clear icons representing the task.

For the first round of icon selection, I attempted to let Codex find them on its own.

![The original Icons were ... interesting.](/image/programming/daily_dash/11_original_icons.png)

This yielded interesting results. Notably, and to the horror of this parent, Codex chose the scissors icon for "Do Hair." I decided I needed to take a more proactive approach that wouldn't lead to any three-year-olds cutting their hair during their morning routine.

My approach eventually consisted of explicitly telling Codex which tasks to create and which icons to use for each task. On reflection, it is not entirely surprising that models focused on software engineering may lack insight into what is appropriate for children. However, this seems like an important warning for anyone using Codex for apps related to children.

#### Finding Celebration Gifs

This is the first task Codex completely failed at. I tried instructing Codex in multiple ways that it should retrieve "fun, cute, kid-appropriate animal gifs to use as a celebration when each kid's tasks are complete." Without fail, Codex refused to retrieve GIFs from the internet. Even when I directly told it to use `giphy.com` and gave it an example GIF, it wouldn't.

Instead, it decided it would create a script to _generate_ the celebration GIFs.

![Nonsensical Celebration GIF](/image/programming/daily_dash/12_nonsensical_celebration_gif.png)

The generated GIFs were completely nonsensical. Although, I'll give it credit, the images contained items that at least _appeared_ to resemble animals (or at least parts of them).

Here, I resorted to manually retrieving GIFs and uploading them as numbered files. Codex then used these numeric entries to map them to available GIFs to show in the celebration modal.

#### The Bug it Couldn't Fix

Codex failed at the last task, but I could kind-of understand it. It required going outside of the code to another website and evaluating images. However, I still do not understand why Codex couldn't solve this problem.

Here's what happened. I eventually added the feature to support multiple routines. I wanted to have the ability to set up a morning and evening routine for my kids. I instructed Codex to implement the features and explained it detail how it should work. Codex implemented the feature. When testing the feature, I made two routines: morning and evening. Then I added tasks to the morning routine: get dressed, eat breakfast, etc. When I switched over to the evening routine, the morning tasks were there! I removed them. I went back to the morning routine and, surprise, they were removed there as well.

I explained the bug to Codex. It immediately explained what was wrong and went on to fix it. I tested again and the problem persisted. I tried this about three more times before giving up. Since I wasn't looking at the code (still haven't) I resorted to looking at my data in localstorage, which is where the app stores data. I noticed there was only 1 location the tasks were stored (instead of having separate tasks associated with each routine). With this information, I was able to explain to Codex exactly what it was doing wrong and what data structure it needed to use. Only then was it finally able to fix the bug.

## Takeaways

There are three parts of this project I would like to reflect on: vibe-coding as a practice, Codex as an agentic coding tool, and GPT-5 as a model.

### Vibe Coding

I'll state this as plainly as I can: if you are making something important, a qualified human _must_ still reading, understanding, and taking responsibility for the code these tools generate. Vibe coding was fine for this small toy app that streamlined my kids' morning routine. I would not trust it for anything more important than that.

In [my professional AI workflow](/programming/my-claude-code-setup), I have a robust process for reviewing all AI-generated code. I recommend others focus on a similar human-in-the-loop workflow for all important use-cases.

### Codex

Codex was a decent experience. However, I would not adopt if I had the choice of either Claude Code or Cursor, as both are more full featured and easy to use than Codex.

The thing I missed most were slash commands. I found myself repeating prompts, like `git add commit and push, remember to include yourself as a co-author`. These would have been nice to wrap in a slash commands. You can see many commits where Codex is not the co-author, since I forgot to include that addendum.

Additionally, the main benefit of Codex (optimizing GPT-5's thinking time in low, medium, and high) went unused by me. I never bothered to switch between low/medium/high. This feature would be far better if Codex automatically switched settings based on the complexity of the task.

### GPT-5 (Codex)

Overall, the model performed well and eventually built a decent UI and a working application. Typically, responses felt quick and most changes worked the first time I requested them.

I have no solid proof, but I believe Claude Sonnet 4.5 would not have struggled with the bug that GPT-5 was unable to fix. This is based on having it fix complicated problems in my professional workflow. This sort of bug was much simpler than what it typically solves for me.