---
author: "Justin Fuller"
date: 2020-07-31
linktitle: "I'm joining the Architecture Review Board at The New York Times."
menu:
  main:
    parent: posts
next: /posts/joining-the-architecture-review-board
title: "I'm joining the Architecture Review Board at The New York Times."
weight: 1
draft: true
images:
  - /learning-to-code.png
---

I'm excited to announce that I'll be joining the Architecture Review Board (ARB) at The New York Times. I want to share why we have this group and why it's an important, useful part of our organization.

<!--more-->

![Learning To Code](/learning-to-code.png)

## What is the Architecture Review Board?

The ARB is a group of engineers who volunteer to help teams research, validate, and refine their plans. The board doesn't make or enforce architecture plans; we leave that to each team. Because each engineer at The Times is also an architect, the plans come from the engineers closest to the problem domain. We can help improve those plans by bringing engineers and experience together from across our company. That's what the ARB does.

At other companies I've worked at there was a central architecture team who made all the plans and decisions, handing them down to the engineers to implement, and checking back in once it's done. This caused engineers to feel left out and architects to be blinded from the realities of implementation. It did, however, create a central team to contact for plans and questions.

In another system I experiened, each group has an architect who makes and designs the plans, sometimes with the help of the other engineers. This benefits from engineer involvement but can result in disparate architectures across an organization.

The review board attempts to combine the best of both strategies. We have a central group that architecture plans are submitted to; at the same time, each team designs and implements their solution. We have a central repository of architecture designs and one team to corrall feedback, but all teams participate and contribute to the architecture.

## Architecture Tools

We harness several tools to facilate architecting, all of which are designed to encourage feedback from our fellow engineers. Again, we don't see this review board as the arbiter of what to do or how to do it, but as the connector between many independent teams. 

## Request For Comments

Our primary tool is the Request For Comments document, know as an RFC. RFCs were [first used back in the 1960s](https://www.nytimes.com/2009/04/07/opinion/07crocker.html) when [Stephen Crocker](https://en.wikipedia.org/wiki/Steve_Crocker) decided to put together some research notes. He wanted to present them in a way that didn't sound like a presumptious final decision, so he labeled it "Request For Comments". Engineers have been using this format ever since.

The Times has used RFCs for around six years. The process evolved from a simple code review meeting into to today's full architecture process.

Writing the RFC is one of the first steps in our software development lifecycle. If you aren't sure what to build, you should write an RFC before you start engineering efforts; you'll be less likely to accept feedback if you've already written code. To help engineers stay open to feedback, we encourage engineers to start writing an RFC as soon as they know they have a problem that can't be solved with existing methods.

To make the process easier, we provide an RFC template ([see this Rust example](https://github.com/rust-lang/rfcs/blob/master/0000-template.md) and [this template provided by SquareSpace](https://static1.squarespace.com/static/56ab961ecbced617ccd2461e/t/5d792e5a4dac4074658ce64b/1568222810968/Squarespace+RFC+Template.pdf)) so that all engineers follow the same format. The ARB also offers office hours — that anyone can attend — to discuss engineering questions.

The most important part of any RFC is the feedback you receive. Ideally, it should be easy for an engineer to give feedback and for an author to ask follow-up questions. Google docs has been working well for us, with its commenting and suggestion features. It's also convenient to be able to see a complete history of the document, to reference changes during the discussion. Others haven't felt the same about Google, so there are many tools out there. If you use another tool

Some important topics you may want to cover in your RFC: What you are building, why you are building it, when you want to build it, how you want to build it, and why you aren't building something else. This last one is extremely important. Many good RFC questions look like, "this solution makes sense, but have you considered this other thing instead?" When you show what you've already considered, and why you aren't going to use that solution, you focus the discussion on only what you've already found to be viable.

At the end of the process you shouldn't be waiting for a stamp of approval. Our RFC board, and I believe any group that wants people to voluntarily come to them for help, shouldn't act as the gatekeepers of what is and isn't allowed to be done. You should walk away with some helpful feedback and a clear statement that your solution does or does not line up with accepted standards.

But if you want to try something new, at least you are aware of the risks and alternatives.

## Request For Proposals

The Request For Proposals, or RFP, is like an RFC; except, instead of comments, you are asking for solutions. You should use an RFP when you know you want to build something, but you don't know how you should do it. It should be OK to say, "I don't have all the answers. I want to leverage the combined knowledge of our company to come up with something I can't on my own."

In an RFP you should outline the problem you're facing, why existing solutions won't work, and ideas you have (no matter how rough). Once submitted, the ARB can give suggestions, but the primary goal is to get suggestions from engineers across the company, with the ARB acting as a broadcaster for your request.

## Memos and Decisions



---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!

---
