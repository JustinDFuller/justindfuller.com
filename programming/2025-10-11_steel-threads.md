---
title: "Steel Threads"
subtitle: "How Bridge Engineering Inspired a Software Practice"
date: 2025-10-11
draft: false
tags: [Programming]
---

Two towering steel giants stand sentinel on opposite sides of a bay. The challenge? Bridging the expanse between with enormous suspension cables—an engineering feat that defies simple solutions. How do you thread steel across the sky?

As if the task weren’t daunting enough, these are no ordinary steel cables. They are 7,000-foot-long, three-foot-thick behemoths, each weighing a staggering 12,000 tons. And yet, even these giants are dwarfed by the 181,500 tons of road and traffic they must uphold.

![Golden Gate Bridge Towers (credit: goldengate.org)](/image/programming/steel-threads-golden-gate-towers.jpg)

In mid-1935, workers finished erecting the two towers of the Golden Gate Bridge. The next step—lifting a 7,000-foot, 12,000-ton steel beam 700 feet above the water—would be impossible. So they turned to the “steel thread” method: rather than hoist the entire beam at once, they moved it across one thread at a time. Instead of a single cable, they carried 27,572 individual steel threads over the water, each no thicker than a pencil.

The first way of getting those threads across was slow, but there was no alternative. Workers tied them to boats that towed them through the channel. As the boats moved, crews clipped the threads to temporary supports so they could be raised into place. Once enough threads were raised, the team shifted to a far more efficient method.

![Steel Thread Spinner (credit: goldengate.org)](/image/programming/steel-threads-golden-gate-spinner.jpg)

With this sufficiently strong set of initial cables, workers could use a spinning wheel to ferry the remaining wires across the bay. What would be impossible—hoisting a 12,000-ton steel beam over the San Francisco Bay—became feasible, though still tedious and exacting. Running a mile from one “strand shoe” to the other, the main cables were built one strand at a time.

![Hydraulic Press (credit: goldengate.org)](/image/programming/steel-threads-golden-gate-press.jpg)

Once complete, a hydraulic jack compressed them into a single beam. When John A. Roebling invented the process, he called it “Cable Spinning.” I can’t say whether the Golden Gate Bridge’s steel threads inspired the software engineering term. Still, it feels right that such a pivotal technique, born in San Francisco, would inspire software engineers.

![Completed Cables (credit: goldengate.org)](/image/programming/steel-threads-golden-gate-beams.jpg)

## Software Engineering

In software engineering, the concept of “steel threads” breaks work into incremental slices.

### The Traditional Approach

A traditional implementation plan builds entire systems or components in sequence—for example: first the frontend, then the backend, then the database.

![The Traditional Approach](/image/programming/steel-threads-traditional-approach.png)

Building each layer can take time. In this example, assume each system takes a month: one week for infrastructure, three for features. Only at the end are the systems connected and tested.

That long runway is risky. You won’t know whether it works as a whole until the finish. You may discover you built the wrong thing—or used the wrong approach—but only at the end.

### Steel Threads

With Steel Threads, we split the project into end-to-end threads. Each thread is small but complete—a working, shippable unit. Where a traditional approach might release a bundle of big features at once, Steel Threads ships small features over time.

![Steel Threads Approach](/image/programming/steel-threads-one-feature-at-a-time.png)

The traditional path builds one system at a time; Steel Threads builds one feature at a time. You may still start with the frontend, then implement the backend, then the database. The critical difference is that you’re not implementing every feature—you’re implementing a single feature end to end across all necessary systems.

Because the basic infrastructure remains necessary, you often front-load setup work. That creates what I call the **reverse snowball effect**: the first Steel Threads are larger because of the initial setup, and each subsequent thread grows smaller as you accumulate a toolkit of basic, reusable capabilities to build on.

![The Reverse Snowball Effect](/image/programming/steel-threads-reverse-snowball-effect.png)

### Incremental Architecture

This iterative approach lets you shape the architecture step by step. The first feature may need only a simple stack—front end, back end, and database. The next might call for a cache in front of the database to handle its request volume. Later, another feature could benefit from a CDN because its assets are static or costly to compute.

![Incremental Architecture](/image/programming/steel-threads-incremental-architecture.png)

In a traditional approach, you might define and build the full architecture upfront. In the example above, setting up the cache would have slowed the first feature, which didn’t need it. Likewise, configuring the CDN would have delayed the second feature, which wouldn’t benefit from it. Instead, you add each layer to the architecture only when it becomes useful.

### Thinking Creatively

This approach doesn’t come for free. Planning a Steel Threads strategy can be harder in two ways. First, breaking a large task into small, working pieces is tricky—especially if you haven’t done it before. Second, when you use steel threads to replace an existing system, you must plan a gradual shift from old to new.

It’s rarely obvious how to carve a big project into small, meaningful tasks. The key is to see that each piece doesn’t need to be useful on its own. Suppose you’re building a new web-based product. Your first steel thread might be a simple authentication flow that ends on a blank page. It’s not useful, but it’s complete: an end-to-end path for a logged-in user that future features can build on. You could go smaller still. If you plan to support several sign-in methods, start with the simplest—maybe a username and password or Google OAuth. The aim is to slice as finely as you can while keeping each slice “complete.”

If you’re replacing a system, how do you move from the old to the new? The answer is simple when the new system is complete. But what if you’re replacing only a single thread? Then the shift demands some finesse. You might begin by checking the new system, falling back to the old when necessary. Or, if you already know which cases the new system can handle, route only those features to it. This approach isn’t always easy, but it lets you replace the old piece by piece—ideal when the legacy system still needs maintenance or even the occasional new feature.

## Real-World Example

Let's take a look at this strategy through a case study: modernizing The New York Times paywall (and other marketing assets, like landing pages).

![Examples of what we needed to re-architect.](/image/programming/steel-threads-nytimes-article.png)

Several years ago, I set out to migrate the system powering The Times on-site marketing from a third-party tool. This would require updating how we build our paywall, landing pages, and more across all of our web and mobile products. This would not be an easy undertaking.

In [Things You Should Never Do](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/) Joel Spolsky describes the downfall of netscape: they rewrote their code from scratch. In [Why do we fall into the rewrite trap?](/programming/why-do-we-fall-into-the-rewrite-trap) I outlined several reasons we choose to rewrite code, the worst of which is when we don't understand the code, so we rewrite it. But, this situation was different. We weren't rewriting because we didn't understand the code. We were rewriting because we didn't have full control of the code. That third-party tool prevented us from making the changes we needed, so had to replace it. But as Joel points out, we were running a big risk: making no progress while doing a huge rewrite would put us signficantly behind. Either the new project would fail to catch up, and eventually die off. Or we would waste a ton of time rewriting while producing no business value. The solution to both of these problems? Steel Threads.

Early on, it became clear that we needed a solution that would allow for a few things to be true:

1. We needed to rewrite this system incrementally.
2. We needed to be able to continue adding to the old system.
3. When areas were ready, teams needed to be able to switch to the new system.

Steel Threads were perfect for this incremental rewrite and rollout strategy. 

### Thread One

We chose to break down the migration by component. For the first thread, we chose the simplest component: a little blue button that lives on the top right corner of the page. We call it, "Bar One." 

![Moving one message over at a time.](/image/programming/steel-threads-migration-one-button.png)

This first Steel Thread would require us to set up:

1. The basic infrastructure of the new system
2. The core data structure and message selection algorithm.
3. Basic subscription targeting.
4. The "Bar One" component and targeted messages.
5. An mechanism to safely switch between the old and new implementation of Bar One.

As you can tell, there was a lot of work in the first Steel Thread. We could have chosen to break it down even further. However, we wanted to follow a **core principle:** every steel thread should result in a new experience for readers. As you use Steel Threads, you may not choose to follow this principal. However, choosing to revolve our work around shipping to end-users kept us focused on moving toward production. After this thread we would have the systems, structures, processes, and targeting in-place, causing **The Reverse Snowball Effect** which would make subsequent threads smaller.

Internally to the Steel Thread, we broke the work down further. Once the infrastructure and algorithm were ready, we began migrating each message. For each message, we integrated any data sources required to target the message. For example, the first message targeted at subscribers required an integration with our subscription system. We did not attempt to integrate with all the necessary systems up-front. Instead, we only integrated what was needed for each message. This kept us moving quickly, shipping only what was required to fulfill the Steel Thread. It also prevented us from speculating about what would be needed later, which could potentially lead to writing unnecessary code.

### Alternate Options

We considered other approaches to breaking down this work into Steel Threads. 

1. Message-by-Message
2. Page-by-Page

Ultimately, we landing on what a Component-by-Component approach, which led to migrating all messages within a particular component. This was the best tradeoff between size of work and meaningful difference shipped to end-users.
