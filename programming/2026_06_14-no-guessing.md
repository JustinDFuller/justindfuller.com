---
title: "No Guessing"
subtitle: "LLM hallucinations hate this one simple trick"
date: 2026-06-18
draft: false
tags: [Code]
---

If you ask the current generation of models (up to GPT 5.5 and Opus 4.8) to answer a difficult question or do complex research, they will likely give you a good answer. Or, they'll give you a plausible sounding, but completely wrong, guess.

![No Guessing](/image/programming/no-guessing.png)

While using any AI-based tool for research, I typically include a section like this:

> Do not guess. Do not jump to conclusions. Focus on gathering and presenting facts. <br />
> Understand that a wrong guess or made up conclusion is far more harmful than stating, "I do not know." <br />
> If you cannot find an answer with great certainty, instead, focus on presenting these things: <br />
> 1. What you *were* able to determine with certainty. <br />
> 2. What you *weren't* able to determine. <br />
> 3. What was blocking you from being able to determine all the necessary facts. (ex. missing data, missing access, missing context, etc.) <br />
>
> By doing this, I will be able to help you get the necessary tools to adequately answer the question. <br />
> If you guess, you will provide a red herring that will send me on a wild goose chase, wasting precious time. <br />

You can go shorter if you want. You can simply say, "No guessing. State facts only." and that often works too. You'll just get more variable output formats.

Hopefully future models will obviate the need for this. But today, if you don't do this, and you ask it to answer a question or do non-trivial research, it will give you its best guess, and that best guess will sometimes be conjecture based on flimsy evidence, wasting your time and tokens.

You can create a [skill](https://agentskills.io/) to wrap this prompt, saving you from repeatedly typing it out. I have it saved as part of a `/research` skill.
