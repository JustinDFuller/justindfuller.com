---
title: "My Custom GPTs"
date: 2026-01-02
draft: false
tags: [Code]
---

Here is a collection of [custom GPTs](https://openai.com/index/introducing-gpts/) I made on ChatGPT. These GPTs are designed to do a single, focused task.

![ChatGPT's interpretation of this post.](https://github.com/user-attachments/assets/b4329acb-3b07-41ea-86dd-6f5890f3b828)

## Typo Fixer

[Link to GPT](https://chatgpt.com/g/g-69501aed8e848191ad530db23c86d563-typo-fixer)

This GPT takes your written text as its only input. It's output is a version of your text with typos fixed. It _only_ fixes typos and makes no other changes. With no conversational output, the fixes are easier to copy and paste back into your editor.

What counts as a typo?

- Mis-spelled words
- Obviously missing words (and, the, etc.)
- Incorrect plurality (unnecessary or missing ending -s)
- Incorrect punctuation

What doesn't it change?

- Links/URLs are never changed, even if they have a typo.
- It doesn't swap, add, or re-arrange words.

### Example Input

> Hwllo my name is <a href="https://exmpl.cm">Jstin</a>

### Example Output

> Hello my name is <a href="https://exmpl.cm">Justin</a>

## Write Tight Coach

[Link to GPT](https://chatgpt.com/g/g-6957257ef5e881919ca5c1514f4d7488-write-tight-coach)

This GPT teaches you how to apply [Write Tight](https://amzn.to/44R77SP)'s advice to the input text. Given an input text, it will output how to apply "Write Tight" advice.

### Example input

> The bottleneck came down to one thing: engineering time. Rarely did a product spec or visual design delay engineering. Even when this happened, the engineers typically had enough business context and design savvy to create a working MVP while waiting on the real specs and designs. In my career, I've only seen an engineer waiting around with nothing to do a few times. When all else fails, there's always some tech debt to clean up.

### Example output

> 1. Cut the “came down to” ramp
>   - Phrase: “came down to one thing:”
>   - Why cut: It’s a throat-clearing lead-in that delays the point; strong verbs beat verb-plus-prep padding.
>   - Example swap: “was:” / “boiled to:”

## Blog Post Visualizer

[Link to GPT](https://chatgpt.com/g/g-69571dc683a48191b7319951a0c1c163-blog-post-visualizer)

This GPT takes your blog post and outputs a black and white, 16:9 image for use as a banner.

The image is:

- A methaphor for the input text (the blog post)
- Grayscale
- Flat
- 16:9
- Mostly negative space

### Example Input

The content of [Twilight Of the Software Engineering Team](https://www.justindfuller.com/programming/twilight-of-the-software-engineering-team).

### Example Output

![](https://github.com/user-attachments/assets/b6b56bf9-313f-4a6a-8b9f-08229ec8768f)

