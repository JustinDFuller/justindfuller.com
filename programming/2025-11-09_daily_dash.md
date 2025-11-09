---
title: "Daily Dash"
subtitle: "How I Vibe Coded my Kids' Morning Routine"
date: 2025-11-09
draft: false
tags: [Programming]
---

Listen, I love my kids. I truly, unequivocally do. But if I'm perfectly honest, getting them to _brush_ their teeth is often like _pulling_ their teeth. Sometimes, I honestly think they'd prefer the latter. At least there would be no further brushing.

A while back, I discovered a magical app, [School Morning Routine](https://schoolmorningroutine.com/) that actually made our routine fun. We actually ended up using it for our bedtime routine, despite the app's name. However, at some point the app stopped working. It seems you can no longer log in or create an account. Once again, our bedtime routine fell into dysfunction.

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

### Tool

For this project, I decided to give [OpenAI Codex](https://openai.com/codex/) a try. I headed over to OpenAI's website, gave them $20 of my hard-earned money, and got access to Codex for one month.

![ChatGPT Plus includes Codex](/image/programming/daily_dash/9_chatgpt_plus.png)

The only configuration I changed was setting the model to [gpt-5 codex](https://platform.openai.com/docs/models/gpt-5-codex). This is a version of GPT-5 which is optimized for Codex.

With this done, it was vibe-coding time!

![Codex in my terminal](/image/programming//daily_dash/10_terminal_codex.png)

### Process

