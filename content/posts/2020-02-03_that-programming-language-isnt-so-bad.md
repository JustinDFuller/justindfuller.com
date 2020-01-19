---
ruthor: "Justin Fuller"
date: 2020-02-3
linktitle: "That programming language isn't so bad"
menu:
  main:
    parent: posts
next: /posts/that-programming-language-isnt-so-bad
title: "That programming language isn't so bad"
weight: 1
draft: true
images:
  - /learning-to-code.png
---

One of my favorite reads is Joel Spoelsky's [Things You Should Never Do](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/). He wrote this post almost twenty years ago, outlining the downfall of Netscape and others because they spent years rewriting working code. His solution is, unsurprisingly, to refactor. About a year before Joel wrote _Things You Should Never Do_, Martin Fowler published his popular book, [Refactoring: Improving the Design of Existing Code](https://amzn.to/2R6rFkP).

So, my question is, if we as a community figured out — twenty years ago — that we should stop rewriting programs, why is still commonly done today?

<!--more-->

![Learning To Code](learning-to-code.png)

## My History

To answer this question, I want to first step back through a few points in my own history. 

### Cold–what?

My first job was with a fun, scrappy startup called [SignUpGenius](www.signupgenius.com). Most of SignUpGenius's code had been written before I was even thinking of becoming a web developer, on a platform called Coldfusion (you've probably never heard of it), with a sprinkling of Angular.js. We had no microservices, no Node.js, no React, Go, Docker, or Kubernetes. Our production deployment consisted of arriving early in the morning to manually copy over files and debug issues (I told you we were scrappy).

Yes, this situation is not ideal and, no, I am not advocating for anyone to manually FTP files for their production deploys. However, one thing that cannot be denied is that we were very productive. Granted, the Coldfusion code was old, but it was constantly improved. There was never a talk of a rewrite; instead, the code was improved, little by little, each time we worked on adding a feature of fixing a bug.

The results were clear: in my time at SignUpGenius I was able to see the company clearly gain market share; with increased traffic, revenue, and even a buyout of a competitor. 

The code wasn't perfect — far from it, as any codebase would be after ten years — but if we had stopped to rewrite the whole thing we would have been dead in the water and the company would have suffered. Just like in Joel's post where Netscape took years to rewrite its already working code, if we had rewritten just because Coldfusion was "dead" or "inferior" would have served little business purpose. 

There are plenty of counter-arguments to be made here. First and foremost, it gets harder every day to find a Coldfusion developer. Those who know the platform are most likely looking to give a facelift to their skillset, rather than prolonging the enevitible drying-up of the proverbial job pool. More, it may be harder to implement functionality in Coldfusion, particularly the kind we were dealing with, than, say, in .Net, Ruby on Rails, or even Go. 

### Taking advantage of new technologies

So, clearly I think SignUpGenius was doing the right thing by not rewriting; so, then, how does one take advantage of new technologies? 

This brings me to the next chapter of my professional career, when I found myself at [FIS Global](https://www.fisglobal.com/) (you've also probably never heard of it), working on user experiences with the wealth and retirement division.

Our team found a very specific problem: the websites for 401k plan participants and sponsors were horrendous. Not just in how they looked (but they did look pretty terrible) but also in how you could interact with them.

The company had built heavily around .NET, which, while it has it's merits, did not provide the type of experience that was best for this environment.

You see, interactions with your 401k plan are not like your interactions with, say, Amazon. On Amazon you are probably going to a specific shopping page that you want to load very quickly. You're also probably not very likely to use more than a couple pages of the website (possibly a search page, a couple products, and the checkout). The pages are, on the whole, not necessarily related to each other. There's no reason to laod them all up at once, in fact, there's plenty of reasons not to.

However, your retirement website is very different. When you go to it you are not trying to load it as quickly as possible to make an impulsive purchase of some ETFs — you're probably doing your yearly check in or enrolling for the first time. You'll probably check your balance, your contributions, the performance of your holdings, and maybe even download a few tax related documents.

We found that user's were coming less often, while spending far more time on the website, using many parts of it — the perfect use-case for a single-page web application.

What did we do? Did we rewrite the whole application? No.

Existing applications' UI code was refactored, reorganized, and maybe even rewrapped with a framework like Angular. New applications were kept separate and got new code written with the new paradigm. 

This allowed for a quick, gradual, and seamless transition from old technology to new, with very little loss of all those years worth of things like tests and bug fixes.

## The Rewrite

Unfortunately, some developers and institutions bank hard on convincing others that a rewrite is the best use of their money. In some cases, even multiple-year, large team efforts to completely rewrite existing codebases. I've even seen it and heard of it happen where there are multiple rewrites in a row — if you didn't get it right the first two times, why would you get it right this time?

No, you don't _finally_ have the right programming language. Maybe you finally have the right team, but probably not.

I think Joel is exactly right with his fundamental, cardinal rule of programming:

> It's harder to read code than to write it.
