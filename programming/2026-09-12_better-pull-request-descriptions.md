---
title: Better Pull Request Descriptions
subtitle: From Your Agents
date: 2026-09-12
draft: false
tags: [Code]
---

If you've been noticing your agents write terrible pull request descriptions, you aren't alone. We all know agents tend to write verbosely, and to share information that assumes the wrong context. If you've been using Claude to write pull request descriptions, you may have noticed that it tends to merely regurgitate what you can already find by reading the diff yourself. It doesn't provide an explanation for _why_ a change was needed or what will be different after it merges. It just summarizes the changed code and lists the files it touched.

<!--more-->

This is why I've started using a new pull request template both on personal and work projects. This template guides all agents to write pull request descriptions that actually set a reviewer up for success.

## The Template

You can drop this template in `.github/pull_request_template.md`.

```markdown
<!--
Rules:
- 300 words max.
- Do not regurgitate what can be found by reading the code.
- Brevity. Be concise. Be terse.
- Avoid jargon. Use human-readable language.
- Assume the reader has not seen the contents of the pull yet.
-->

## Why?

<!--
Why are we making this change?
This is not a summary of the change.
It explains the external factors that bred the need for this change.
If you do not know, stop. Go find out why this PR is needed.

ex:
- "A user recently entered an incomplete URL in the repository text box. This led the entire cron job to stop processing, rather than simply rejecting and ignoring that particular entry. This caused the entire cron job to go down until the entry was corrected."
- "Feedback indicates the summary comment is too verbose. Authors simply ignore it, rather than engaging with it. So, rather than improving the experience, it clutters the interface."
-->

TODO

## Results

<!--
What about the system's behavior or qualities will change due to this PR?
This is not a list of lines, files, methods, etc. that changed.
This is what will be different for users, what will be available, what will go away once this PR merges.

ex:
- "When an invalid input is entered, only that row is rejected. The rest of the entries process and the invalid row is ignored."
- "The summary will be more concise. It will have a clear color indicator of the status. It will have a 1-2 sentence summary of the results. Detailed information is still available, but it is hidden by default."
-->

- TODO
- TODO

## Demonstrate

<!--
What have you done to prove that this works?
How can a reviewer see for themselves that it actually works?
This does not include "I ran the unit/integration/e2e tests".
This is something you have done manually to see for yourself that the change does exactly what it intends.
It includes a copy/paste of an output, a screenshot, a video, a link, etc. that allows the reviewer to see what happened.
These are not "steps for you to test" but are "here's what I did to test and here were the actual results".
-->

TODO
```

See the results for yourself:

![Before/After Example 1](/image/programming/pr-descriptions-example-1.png)

![Before/After Example 2](/image/programming/pr-descriptions-example-2.png)

## Configuration

I highly recommend adjusting the exact guidelines to suit your particular needs for descriptions. Personally, I want to know what sparked the need for this PR and what differences I should expect to see after. I also want to know how the author knows the change will actually work. I want to see proof.

I also am a slow reader, so I like things to be concise. I force the agents to stick to 300 words. This seems to generally give it enough room to explain itself properly, while also preventing it from going overboard with detail.
