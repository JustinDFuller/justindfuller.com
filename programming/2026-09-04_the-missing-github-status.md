---
title: The Missing GitHub Status
date: 2026-09-04
draft: false
tags: [Code]
---

Today, a Pull Request on GitHub can have a few statuses: Draft, Open, Merged, or Closed.

![Accretive Editing](/image/programming/ready-for-ai-code-review.png)

A typical workflow might look like this:

1. Work locally.
2. Push to a branch.
3. Open a draft pull request (Draft).
4. Iterate on the code while in draft.
5. When the code seems ready, mark it "Ready for review" to get a human review (Open).
6. After some rounds of code review, merge the PR (Merged).

This all worked fine until AI Code Review came along.

AI code reviews are extremely helpful. They catch bugs, find inconsistencies, and more. If you're not using them, I highly recommend you give them a try.

They work best when you allow them to review after implementation is done and before your colleagues spend time reviewing your code. When used well, they help you remove issues that would slow a human reviewer down. This allows your colleagues to focus on higher impact questions such as: is this the right approach, does it align architecturally, etc.?

However, there is a problem: when should you run the AI code review?

- If you run it on a draft, you'll get reviews before your code is ready.
- If you wait until it is open, GitHub will notify humans while you are still iterating with your AI code review.

There are other options of course. Most of these tools allow you to manually request a review. However, that makes it harder to enter a loop where you receive feedback, iterate, push, and repeat until the AI code reviewer finds no more issues (or starts only finding nitpicks).

This is why I think tools like GitHub will need to evolve for the AI era. Not by slapping AI features on top of their existing workflows, but by rethinking them. Today's workflows are built around human actions, not agents.

The missing Github PR status: `Ready for AI Review`.

The new workflow would be: `Draft` -> `Ready for AI Review` -> `Ready for Human Review` -> `Merged`.

This would allow us to delay AI code reviews until the code is "ready", while also starting them before sending the PR to humans.

At The Times, I tried to solve this by adding a "Ready for AI Review" feature to our internal code review tool. It allows PR authors to add a `ready-for-ai-review` label to their PR. At that point, the code reviewer will begin reviewing, even if the PR is still in draft.

However, this is a bandaid solution at best. It requires authors to remember to add the label before marking the PR ready for review. Real solutions will require deeply rethinking our workflows to make them agentic.
