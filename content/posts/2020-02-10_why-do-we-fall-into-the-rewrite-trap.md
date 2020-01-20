---
author: "Justin Fuller"
date: 2020-02-10
linktitle: "Why do we fall into the rewrite trap?"
menu:
  main:
    parent: posts
next: /posts/why-do-we-fall-into-the-rewrite-trap
title: "Why do we fall into the rewrite trap?"
weight: 1
draft: true
images:
  - /learning-to-code.png
---

One of my favorite reads is Joel Spolsky's [Things You Should Never Do](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/). He wrote this post almost twenty years ago, outlining the downfall of Netscape and others because they spent years rewriting working code. His solution is, unsurprisingly, to refactor. About a year before Joel wrote _Things You Should Never Do_, Martin Fowler published his popular book, [Refactoring: Improving the Design of Existing Code](https://amzn.to/2R6rFkP).

So, my question is, if we as a community figured out — twenty years ago — that we should stop rewriting programs, why is it still commonly done today?

<!--more-->

![Learning To Code](/learning-to-code.png)

## My History

To answer this question, I want to first step back through a few points in my history. 

### Cold–what?

My first job was with a fun, scrappy startup called [SignUpGenius](www.signupgenius.com). Most of SignUpGenius's code had been written before I was even thinking of becoming a web developer, on a platform called Coldfusion (you've probably never heard of it), with a sprinkling of Angular.js. We had no microservices, no Node.js, no React, Go, Docker, or Kubernetes. Our production deployment consisted of arriving early in the morning to manually copy over files and debug issues (I told you we were scrappy).

Yes, this situation is not ideal and, no, I am not advocating for anyone to manually FTP files for their production deploys. However, one thing that cannot be denied is that we were very productive. Granted, the Coldfusion code was old, but it was constantly improved. There was never talk of a rewrite; instead, the code was improved, little by little, each time we worked on adding a feature or fixing a bug.

The results were clear: in my time at SignUpGenius I was able to see the company gain market share; with increased traffic, revenue, and even a buyout of a competitor. 

The code wasn't perfect — far from it, as any codebase would be after ten years — but if we had stopped to rewrite the whole thing we would have been dead in the water and the company would have suffered. Just like in Joel's post, where Netscape took years to rewrite its already working code, if we had rewritten just because Coldfusion was "dead" or "inferior" would have served little business purpose. 

There are plenty of counter-arguments to be made here. First and foremost, it gets harder every day to find a Coldfusion developer. Those who know the platform are most likely looking to give a facelift to their skillset, rather than prolonging the inevitable drying-up of the proverbial job pool. More, it may be harder to implement functionality in Coldfusion, particularly the kind we were dealing with, than, say, in .Net, Ruby on Rails, or even Go. 

### Taking advantage of new technologies

If I think SignUpGenius was doing the right thing by not rewriting, how, then, how does one take advantage of new technologies? 

This brings me to the next chapter of my professional career, when I found myself at [FIS Global](https://www.fisglobal.com/) (the biggest company you've never heard of), working on user experiences with the wealth and retirement division.

Our team found a very specific problem: the websites for 401k plan participants and sponsors were horrendous. Not just in how they looked (but they did look pretty terrible) but also in how participants could interact with them.

The company had built heavily around .NET, which, while it has its merits, did not provide the type of experience that was best for this environment.

You see, interactions with your 401k plan are not like your interactions with, say, Amazon. On Amazon, you are probably going to a specific shopping page that you want to load very quickly. You're also probably not very likely to use more than a couple of pages of the website (possibly a search page, a few products, and the checkout). The pages are, on the whole, not necessarily related to each other. There's no reason to load them all up at once, in fact, there's plenty of reasons not to.

However, your retirement website is very different. When you go to it you are not trying to load it as quickly as possible to make an impulsive purchase of some ETFs — you're probably doing your yearly check-in or enrolling for the first time. You'll probably check your balance, your contributions, the performance of your holdings, and maybe even download a few tax documents.

We found that users were coming less often, while spending far more time on the website, using many parts of it — the perfect use-case for a single-page web application.

What did we do? Did we rewrite the whole application? No.

Existing applications' UI code was refactored, reorganized, and maybe even rewrapped with a framework like Angular. New applications were kept separate and had new code written with the new paradigm. 

This allowed for a quick, gradual, and seamless transition from old technology to new, with very little loss of all those years worth of things like tests and bug fixes.

## Contempt Culture

Unfortunately, some developers and institutions bank hard on convincing others that a rewrite is the best use of their money. To do this they rely on convincing others of the inferiority of older, battle-tested languages like Java and PHP to newly popular technologies like Node.js or Go.

This is [contempt culture](https://blog.aurynn.com/2015/12/16-contempt-culture) and it's prevalent in software development communities. I know this because I was one of the developers who called old languages terrible, clunky, slow.

That is until I started learning about and using them.

When I read through [Robert Martin's Clean Code Series](https://amzn.to/3amlznX) I was struck by how easy it was to understand the Java and [C++](https://amzn.to/2TFnMF5) code that he wrote. I realized that the Java and C++ he was writing was far easier to understand than the JavaScript and Go that I had been writing for a few years. I know I keep bringing it up, but the same thing happened when I read through [Martin Fowler's Refactoring](https://amzn.to/2R6rFkP) — he transformed hard to understand, hard to change Java into code that is clear and easy to change to meet new requirements.

After starting a new job at [The New York Times](https://open.nytimes.com) — which has amazing code quality, and not just for an organization that is over 150 years old — I found that the company still has some legacy Java and PHP services. I was scared when I heard that I needed to research how to interact with these APIs — until I saw the code. It turns out that these services are so well-factored, with such well-established patterns, that they were incredibly easy to understand. Less than two months into the job and I was able to traverse multiple of these codebases to find exactly what I needed.

So much for contempt culture, these older languages can be great.

## The rewrite

Back to rewrites. I mentioned earlier that some developers rely on convincing their manages that a rewrite is necessary; in some cases, even multiple-year, large team efforts to completely rewrite existing codebases. I've even seen it and heard of it happen where there are multiple rewrites in a row — if you didn't get it right the first few times, why would you get it right this time?

No, you don't _finally_ have the right programming language. Maybe you finally have the right team, but probably not.

I think Joel is exactly right with his fundamental, cardinal rule of programming:

> It's harder to read code than to write it.

I recently experienced this first-hand. In the codebase I'm currently working with, I encountered an error handling pattern that I didn't like; it seemed cumbersome and convoluted. 

My initial thought was to ignore this pattern, rewrite it, maybe even replace it with a better solution. That was until I found that the original author put together an entire talk about this error handling pattern. It turns out that, while it may be a little confusing, it gives incredible transparency when you need to debug with application logs.

The real problem is that I hadn't taken the time to understand how the error pattern worked. I was confused, which led me to dismiss it, rather than to improve it.

---

👋 Want to learn more about programming? [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about.

---

## Refactoring

So, if rewrites are so bad, how can you avoid them?

Here's a rule of thumb: If your reason for rewriting the code is that you don't understand it, you should not rewrite it. Instead, you should spend the time trying to understand the code. Once you understand it, refactor the code to make it easier for the next person to understand.

Instead of rewriting the error handling pattern I will probably try to improve a few method names. This brings me back to Martin Fowler's [Refactoring](https://amzn.to/2R6rFkP). Most of the time, if you feel that a rewrite is needed, you can probably just refactor a few pieces of the program and you'll be in great shape. 

> If your reason for rewriting the code is that you don't understand it, you should not rewrite it.

Sure, refactoring may have more pieces now than it did when he write it — moving an endpoint to another service may be a modern extension to moving a method to another class — but the base concepts are still the same.

More importantly, the benefits are still the same. You will retain all the bugs that were fixed, all the edge-cases that were handled, all the sparsely-documented features that you don't even know about, they'll still be there when you're done refactoring.

If you rewrite, you'll likely lose all of that. It's an idealistic view of ourselves to think that we understand any large codebase, probably rewritten by several or dozens of developers over months or years, well enough to cover all of these cases in a rewrite. Much of it will be lost.

## When to rewrite

As always, things aren't always so black-and-white. There are a few times when a rewrite might be necessary.

The golden opportunity to rewrite less-than-stellar code is when the business wants to re-think how the product works. If the business is unhappy with the product and the developers are unhappy with the code, this may be the perfect opportunity to rewrite. Rewrite for better functionality, rather than better code. However, unless you're in a fast-moving startup, this opportunity may not come very often as most companies that I've worked with prefer incremental change.

There's another opportunity, which, I hope, is even rarer than the last case. Sometimes a developer or development teams have written code that is so bad, so convoluted, that even they can't understand it enough to make a change without creating a slew of bugs. It might be that it was designed by an [architecture astronaut](https://www.joelonsoftware.com/2001/04/21/dont-let-architecture-astronauts-scare-you/), or that every variable is called `x`, `x1`, or `x2`. If this is the case, there might be no way around a rewrite.

> Rewrite for better functionality, rather than better code.

However, let me caution you even in this case. If the makeup of the team has not changed drastically; if there has not been a clearly defined cause and solution to the last iteration's problems; or there is not new leadership that provides clearer vision, principles, and guidance — you will likely fall into the same trap all over again. Because if the people haven't changed, the circumstances haven't changed, and the practices haven't changed, what makes you think you'll do better this time?

## Key Takeaways

Yes, this post was just to say that you should prefer refactoring of rewriting. If you couldn't tell by all the times I linked to it, I highly recommend [Martin Fowler's Refactoring](https://amzn.to/2R6rFkP) to learn more about the subject.

Here are the three key takeaways:

1. Prefer refactoring over rewriting.
2. If your reason for rewriting the code is that you don't understand it, you should not rewrite it.
3. Rewrite for better functionality, rather than better code.

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) or [Twitter](https://twitter.com/justin_d_fuller), or [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about. Thanks again for reading!

---