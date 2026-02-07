---
title: "Lack of Comprehension of AI-Generated Code"
date: 2026-02-07
draft: false
tags: [Code]
---

There is an often-repeated criticism of AI-generated code: “You may be able to generate more code than before, but now no one on your team can understand and maintain it.”

![Are you inspecting your AI-generated code?](/image/programming/lack-of-comprehension-in-ai-generated-code.png)

This criticism is often delivered as if it is a decisive blow to the use of AI. If you generate your code with AI, you won’t understand it.

Of course, this is not true. Shipping code that engineers don’t understand is not a given for AI-generated code. It is a choice (a bad one) that teams who use these tools can make.

Since it is a choice, there is also an alternative. Teams can choose not to ship code that they do not understand. They can choose to only ship code they stand fully behind.

## Better Code Review

What’s more, since AI can both generate the code for us and can help us review the code, we can actually use AI to increase our confidence in the code we ship.

How? When engineers are spending less time hands-to-keyboard, they can spend more time thinking carefully about the code they are reviewing. They don’t have to rush the review to get back to coding. They are still coding (or, their agents are) while they are reviewing.

Additionally, they can have their agents research questions they have during the code review. You can spin up multiple concurrent research projects as you walk through a code review. You can allow agents to do deep research on questions while you continue to read through the code: “Is there a standard library option for this?” “Is it possible to optimize this algorithm?”

As a result, and if used thoughtfully, these tools can result in higher quality code that engineers understand more deeply.

## Over-Reliance on Engineering Memory

This speaks to a general problem in software engineering. We over-value a single engineer’s memory.

That’s really what this objection comes down to. “No one on the team understands how the code works.” We say this because previously we could say, “The engineer who wrote the code understands how it works.”

As anyone who has worked in the industry for more than a few weeks understands, teams change. Engineers leave and their memory leaves with them.

When teams become over-reliant on one engineer (the one who wrote the code) understanding how something works, they put the team's future at risk.

Thankfully, there is a tried and true solution to this: documentation and tests.

Rather than relying on a human to understand how the system works, we should *write down* how it works. We should first write it down in a way that is enforced by the system (tests) and then we should write it down in a way that humans can easily understand (documentation).

This is another area where AI can help us. You can instruct agents to always write tests and documentation. The tool doesn’t get tired or lazy or feel rushed.

In this way, too, these tools can increase the long-term understanding of the code for the entire team.

## The Choice

So, is it *potentially* a problem that using AI will decrease understanding? Yes.

But, this is a choice. Teams have a choice about *how* they will use AI.

If they choose to generate the code, not look at it, not document it, not test it; then, yes, their understanding (and the quality of the code) will decrease.

But, this is not the only way to use these tools. I have written about [my AI workflow](/programming/my-claude-code-setup), which builds a robust workflow around these tools — ensuring I am not shipping random AI slop but the same quality code I would otherwise. I’ve also written about [how our teams need to evolve](/programming/twilight-of-the-software-engineering-team) to make the most (and guard against the pitfalls) of these tools.
