<!-- markdownlint-disable-file MD041 -->

<!-- Prompt -->
Edit this as a Line editor. Do not edit this as a developmental, Substantive, Copy, Fact Checker, Proofreader, Technical, Sensitivity, or Authenticity editor.

<!-- PlainTextResponse -->

As a line edit, I’d focus on sentence-level clarity, rhythm, emphasis, and transitions while preserving your argument, structure, examples, and factual claims.

<!-- EditedCopy -->

#### Two Types of Advice

Broadly speaking, there are two categories of advice you might receive.

First, there is “I would…” advice, and second, there is “I did…” advice.

*I would* advice has the nature of logic. It is predictive: If I were in your shoes, I would do `A` because I think `B` would happen. *I did* advice has the nature of experience. It is retrospective: When I was in a similar situation, I did `A`, and `B` happened. Both rely on inference: if you do as I recommend, I predict `B` will happen.

If you propose an idea or take an action that attracts any amount of attention, you’ll likely receive a swarm of both types of advice.

I would…

> I would use Redis as a caching layer in front of that database to improve read performance. The database can become saturated if you frequently read or write to a particular range more than once per second, and Redis can help by reducing reads.

I did…

> When I set up that database, I used Redis as a caching layer in front of it, but I found that requests to Redis were occasionally slower than requests to the database. I ended up putting a tight timeout on the Redis requests.

There’s no need for one type to antagonize the other; both can be valuable. Instead, we can consider how and when to use each. We should begin by understanding the foundation of each type: premises support *I would*, while history supports *I did*.

As a gut reaction, one might assume a historical foundation is better. However, it is important to recognize that this form of advice applies history as an analogy—and not all analogies are equal. When evaluating an analogy, you should ask: **are there any relevant, invalidating differences?** If so, do they overwhelm the relevant, validating similarities?

In the previous database example, let’s pretend the advisor was creating a real-time web application, and this database served as the primary source of what users experienced. Now, what if I am setting up a database to record event logs that analysts will use to create reports? There is a relevant, invalidating difference: the read/write ratio and response requirements are totally different. In the advisor’s scenario, there were heavy reads and tight latency requirements. In my scenario, there are heavy reads and lenient latency requirements. These differences overwhelm the similarities, likely invalidating the analogy.

On the other hand, we can see how helpful historical advice becomes when the situations are sufficiently similar. Historical advice provides an example of how a decision might negatively affect us, as well as how to prevent that outcome. When using historical advice, you should **ask about potential problems**. This is where *I did* advice really shines. I did `A`, which led to `B`, reveals what might happen if you also do `A`. And if you’ve evaluated the relevant differences and concluded there are few or none, you can reasonably expect that you, too, might experience `B`.

If that’s the case, keep asking about other potential problems you might encounter. It isn’t even difficult. All you have to ask is, “Did you run into any other issues?”

Now, on to *I would* advice. If you have ever read a comment section on the internet, you know *I would* advice comes cheap. Anyone can react to your idea or accomplishment and tell you how they would do it differently. It’s particularly egregious when someone reacts to a successful *I did* with a hypothetical *I would have*. To which, I think, we would all like to respond: “Well, too bad. You didn’t.”

But look past the cheapness of *I would* advice—particularly when it comes from someone you trust—and you may find abundant value.
