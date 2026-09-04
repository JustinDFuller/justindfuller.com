<!-- markdownlint-disable-file MD041 -->

<!-- Prompt -->

Edit this as a Substantive editor. Do not edit this as a developmental, Line, Copy, Fact Checker, Proofreader, Technical, Sensitivity, or Authenticity editor.

<!-- PlainTextResponse -->

As a substantive edit, I’m focusing on argument structure, conceptual clarity, examples, sequencing, and places where the reasoning needs strengthening. I’m deliberately leaving sentence-level polish, grammar, punctuation, and stylistic refinement alone.

The main issue in this draft is that the I did half develops into a fairly complete framework, while the I would half has only begun. I also tightened the conceptual distinction between the two forms of advice: both involve inference, but they differ in what evidence the inference rests on.

<!-- EditedCopy -->

#### Two Types of Advice

Broadly speaking, there are two categories of advice you might receive.

First, there is, “I would…” and second there is, “I did…” advice.

*I would* advice has the nature of logic. It is predictive: If I were in your shoes, I would do `A` because I think `B` would happen. *I did* advice has the nature of experience. It is retrospective: When I was in a similar situation, I did `A` and `B` happened.

Both ultimately ask you to make an inference about your own situation. *I would* advice says, in effect, these premises suggest that doing `A` will produce `B`. *I did* advice says, this happened before, so something similar may happen again.

If you propose any idea or take any action that attracts any amount of attention, you’ll likely receive a swarm of both types of advice.

I would…

> I would use Redis as a caching layer in front of that database to improve read performance. The database can become saturated if you frequently read or write to a particular range more than once per second, and Redis can help with that by reducing reads.

I did…

> When I set up that database, I used Redis as a caching layer in front of it, but found that occasionally requests to Redis were slower than the database, so I ended up putting a tight timeout on the Redis requests.

There’s no need for one type to antagonize the other, as both can be valuable. Instead, we can consider what each kind of advice gives us, what its weaknesses are, and what questions we should ask before accepting it.

The foundation of *I would* advice is a set of premises. The foundation of *I did* advice is a historical example.

That distinction gives us two different ways advice can fail.

## Evaluating *I did*

As a gut reaction, one might assume a historical foundation to be stronger. Something actually happened, after all. But *I did* advice applies history as an analogy, and not all analogies are equally useful.

When evaluating historical advice, the important question is: **are there relevant differences between their situation and yours?** And, if there are, do those differences matter enough to weaken the analogy?

In the previous database example, let’s pretend the advisor was creating a real-time web application and this database served as the primary source of what the users experience.

Now imagine that I am instead setting up a database to record event logs intended for analysts to create reports.

The two situations still have obvious similarities: they may use the same database, encounter some of the same technical limitations, and admit many of the same architectural choices. But some of their operating requirements differ substantially. The real-time application may have heavy reads and tight latency requirements, while the analytics system may have heavy writes and far more lenient latency requirements.

Those differences matter because they affect whether the advisor’s experience with Redis predicts what will happen in my system. The advice may still contain something useful, but the historical outcome is no longer strong evidence that I will experience the same thing.

This suggests the first rule for using *I did* advice:

**Test the analogy before importing the conclusion.**

Once the situations appear sufficiently similar, historical advice becomes especially valuable because it can reveal consequences that are difficult to predict in advance.

The advisor did `A`, which led to `B`. If your circumstances resemble theirs closely enough, `B` becomes something worth preparing for.

That gives us another useful question to ask:

**What problems did you encounter?**

This is where *I did* advice really shines. It can expose second-order consequences, unexpected failures, operational annoyances, and other things that might not appear in a clean theoretical analysis.

And once someone has given you one such example, it is worth continuing:

“Did you run into any other issues?”

The most valuable part of someone’s experience may not be the decision they made. It may be the collection of consequences they discovered afterward.

## Evaluating *I would*

Now, onto *I would* advice.

If you have ever read the comment section on the internet, you know *I would* advice comes cheap. Anyone can react to your idea or accomplishment and tell you how they would do it differently. It’s particularly egregious when someone reacts to a successful *I did* with a hypothetical *I would have*. To which, I think, we would all like to respond, “well, too bad, you didn’t.”

But the fact that *I would* advice is cheap does not mean it is worthless.

Unlike *I did* advice, it does not ask us to evaluate whether one situation is sufficiently analogous to another. Instead, it asks us to evaluate an argument.

The advisor is effectively saying:

`A` is true.
`B` is true.
Therefore, I expect `C` to happen.

The quality of the advice depends on the quality of those premises and on whether the conclusion actually follows from them.

So the useful question for *I would* advice is not primarily, “Have you done this before?”

It is:

**Why do you think that would happen?**

That question forces the premises into the open.

Suppose someone tells me:

> I would put Redis in front of the database because otherwise the database will become saturated.

There are now several things I can investigate. What kind of load would cause saturation? Does my application produce that load? Is the bottleneck actually database reads? Would Redis meaningfully reduce them? What additional complexity would caching introduce?

The advisor does not need to have personally built my exact system for the advice to be useful. They need to offer premises that accurately describe the system I am building and reasoning that connects those premises to their recommendation.

This means *I would* advice can sometimes outperform historical advice. Someone may have never encountered your exact situation before but understand the underlying system well enough to reason about it. Conversely, someone may have experienced something superficially similar while misunderstanding why it happened.

The two forms of advice therefore demand different skepticism.

With *I did*, ask:

**How similar was your situation to mine, and what happened?**

With *I would*, ask:

**What assumptions lead you to that conclusion, and are they true here?**

One gives you an analogy to examine. The other gives you an argument to examine.

Neither deserves automatic acceptance. Neither deserves automatic dismissal.

The goal is not to prefer experience over reasoning or reasoning over experience. It is to recognize what kind of evidence you have been given, then interrogate it accordingly.
