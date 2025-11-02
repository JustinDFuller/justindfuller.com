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

In software engineering, the concept of “steel threads” breaks work into incremental slices. A traditional implementation plan builds entire systems or components in sequence—for example: first the frontend, then the backend, then the database.

![The Traditional Approach](/image/programming/steel-threads-traditional-approach.png)

Building each layer can take time. In this example, assume each system takes a month: one week for infrastructure, three for features. Only at the end are the systems connected and tested. That long runway is risky. You won’t know whether it works as a whole until the finish. You may discover you built the wrong thing—or used the wrong approach—but only at the end.

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

### Tradeoffs

This approach doesn’t come for free. Planning a Steel Threads strategy can be harder in two ways. First, breaking a large task into small, working pieces is tricky—especially if you haven’t done it before. Second, when you use steel threads to replace an existing system, you must plan a gradual shift from old to new.

It’s rarely obvious how to carve a big project into small, meaningful tasks. The key is to see that each piece doesn’t need to be useful on its own. Suppose you’re building a new web-based product. Your first steel thread might be a simple authentication flow that ends on a blank page. It’s not useful, but it’s complete: an end-to-end path for a logged-in user that future features can build on. You could go smaller still. If you plan to support several sign-in methods, start with the simplest—maybe a username and password or Google OAuth. The aim is to slice as finely as you can while keeping each slice “complete.”

If you’re replacing a system, how do you move from the old to the new? The answer is simple when the new system is complete. But what if you’re replacing only a single thread? Then the shift demands some finesse. You might begin by checking the new system, falling back to the old when necessary. Or, if you already know which cases the new system can handle, route only those features to it. This approach isn’t always easy, but it lets you replace the old piece by piece—ideal when the legacy system still needs maintenance or even the occasional new feature.

## Real-World Example

Let’s look at this strategy in practice through a case study: modernizing The New York Times paywall and related marketing assets, such as landing pages.

Several years ago, I set out to migrate the system powering The Times’s on-site marketing from a third-party tool. This meant rebuilding how we managed the paywall, landing pages, and other experiences across web and mobile. It wasn’t a small job.

![Examples of what we needed to re-architect.](/image/programming/steel-threads-nytimes-article.png)

In [*Things You Should Never Do*](https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/), Joel Spolsky recounts Netscape’s fatal decision to rewrite its codebase from scratch. In [*Why Do We Fall into the Rewrite Trap?*](/programming/why-do-we-fall-into-the-rewrite-trap), I explored why teams choose rewrites: often because they don’t understand the existing code. This wasn’t that. We understood the old system well; we just couldn’t control it. The third-party tool blocked essential changes. But Joel’s warning still applied: if we spent months rebuilding without shipping value, we’d fall behind. Either the rewrite would fail to catch up and die off, or we’d waste time delivering nothing to the business.

We knew we couldn’t stop work in the old system—that would hurt the business. Yet we also needed a way to catch up to it, even as multiple teams built new messaging there every day.

What we needed was a way to gradually close the gap. The key was to migrate all new development to the new system, one step at a time. This was the perfect opportunity to use Steel Threads.

### Breaking It Down

These concerns limited how we could divide the work. Clearly, we couldn’t rewrite the entire system and switch all at once. So how would we break it down?

We had a lot to consider. The old system...

1. covered many pages: from the NYT home page, to articles, landing pages, and more.
2. powered many different areas on each page and sometimes even the whole page.
3. integrated with many other systems to provide targeting data.

How could we slice this into steel threads? We considered going page-by-page (migrating everything on the home page, for instance), capability-by-capability (for example, migrating all messages requiring subscriber targeting), or component-by-component (migrating all messages within a single component, such as the Paywall).

![Moving one component over at a time.](/image/programming/steel-threads-component-by-component.png)

We decided to migrate component-by-component. This would give us an optimal balance between shipping a substantial amount of work and moving quickly. The new system would control an entire area of the page. This enabled teams to shift work in that area to the new system. At the same time, most areas could be rebuilt within one to three sprints.

### Thread One

The first thread targeted the simplest component: a small blue button in the top right corner of the page, known internally as “Bar One.”

This first Steel Thread required us to set up:

1. The basic infrastructure for the new system.  
2. The core data model and message-selection logic.  
3. Basic subscription targeting.  
4. The “Bar One” component and its targeted messages.  
5. A safe mechanism to switch between the old and new implementations.

![Thread One](/image/programming/steel-threads-thread-one.png)

It was a hefty start. We could have sliced it thinner, but we followed one guiding principle: **every Steel Thread should end with a change affecting our readers.** You might not adopt that principle, but for us it kept momentum pointed toward production. Once this first thread shipped, we had the foundation—the systems, structures, and targeting logic—that began the reverse snowball effect, making each subsequent thread smaller and faster.

Internally to each thread, we broke the work into even smaller pieces. After the infrastructure and algorithm were in place, we migrated each message one at a time. Each message brought its own integrations. For instance, the first subscriber-facing message required connecting to our subscription system. We didn’t integrate every dependency up front—only what was necessary for the current message. That discipline kept us shipping quickly and stopped us from guessing about future needs or writing speculative code.

### Results

So, did it work? Today, the new system—known internally as “Onsite Messaging”—has completely replaced the old one. It has also expanded to power experiences the original system never touched, unlocking new capabilities like machine-learning decision making.

We began with the component-by-component strategy. As the migration progressed, we eventually shifted to a page-by-page model, thanks to the reverse snowball effect. Early Steel Threads added the core targeting features we needed, making later threads smaller and easier. Over time, each migration could cover more ground without slowing down.

Today, my teams use Steel Threads to modernize other systems too. We're using them to revamp our offer targeting systems to streamline our ability to target offers at potential subscribers. We're also using them to improve the system that decides if and what type of paywall you see. By applying Steel Threads, these teams have turned multi-year projects into a steady flow of small releases that ship to production.

[Quality](/word/quality) systems aren’t built all at once. They're spun from many small threads; each one built, tested, strengthened, and bound together over time.
