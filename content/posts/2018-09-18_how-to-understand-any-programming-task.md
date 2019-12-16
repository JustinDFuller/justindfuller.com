# How to understand any programming task

The day has finally arrived. Is it your first day on your job, or have you been doing this for ten years? It doesn’t matter. We all eventually find ourselves with a task that we simply do not understand.

So what should you do? Should you just get started and hope it works? Should you immediately tell your boss that you can’t do this because you don’t understand?

I imagine that you know the answer is neither!

In programming, as with any other profession, I have found that it’s almost impossible to go through a week (and sometimes not even a day) without finding some problem that I don’t understand.

But don’t fret! I have great news. Not only can you fix this problem, but it can also be a good thing.

It means that in some way you are expanding your skill and knowledge beyond what you’ve done and known before.

In the next few paragraphs I’m going to detail how you can bridge the gap between the requirements you’ve been handed, and the knowledge you need to complete the task you’ve been given.

### About ‘requirements’

You may have noticed that I used the word “requirements”. That word might have certain connotations depending on where you work.

In my experience, big companies love requirements and small companies sometimes “don’t do requirements”. I think this is perfectly fine for our purposes here.

That’s because in the end all we’re doing as software engineers is solving problems.

You could receive an extensive one hundred page report on how to solve that problem (I once had an hour long meeting about the text for a button). Or maybe your CEO will meander over to your desk and casually ask if you can solve the problem by Friday.

Either way — you’ve been given a task, and you need to be sure you fully understand that problem in order to address it correctly!

### About the steps

![](https://cdn-images-1.medium.com/max/2000/0*c7d0llT62DAg9GLi)

Not all of the steps given below are needed for every problem. Only the hardest problems to understand may require you to carefully proceed through all the steps that will be discussed in this article.

Many of the questions may not be answerable through the requirements that you’ve been given, or through your personal experience alone.

You may have to ask other developers, your team lead, product owner, business analyst, or even your grandma. Maybe you’ll have to ask all of them by the time you’re done!

That’s fine though. It means you’ll be taking scattered knowledge and condensing it to reside in one place. That place is in yourself and now you will be able to produce the best possible result!

**A final warning before you learn the steps:** don’t over-formalize this process. The point here is to help you *quickly* understand a problem. It shouldn’t create barriers or red tape! Instead it should provide you with a systematic plan to tackle a problem you don’t understand.

## The first step: Analyzing the task

In this step, you will seek to understand *what* you’ve been asked to do. You’re not trying to figure out *how* to do it yet!

The distinction here is important. It can be dangerous to jump straight in to implementation without thinking through all the consequences, or worse, without identifying exactly what it is you’ve been asked to do.

### Classify the task

To classify a task means to determine what kind of work you’ll be doing to solve this problem. Here are some examples of types of tasks:

* Bug fix
* New feature
* New application
* Research Assignment
* Performance improvement

Remember that these are not all the possible options.

The goal here is to determine what *kind* of work you are expected to do. This is important because it has a direct effect on *what *work you do.

This step is particularly important for vague requirements. An example of a vague requirement is: “We need a way to purge our clients’ caches after an update to the website.”

There can be a few possible interpretations.

1. You need to immediately implement some cache purging mechanism so that clients always see the latest updates.

1. You need to research all the ways that clients’ caches are stored and determine the best way or ways to bust those caches after every update of the website.

1. The clients’ caches already should be being cleared and you need to find and fix the bug that is preventing them from clearing.

At this point, if you aren’t absolutely sure which meaning is being used, you should ask for clarification before proceeding.

### State what the task is in one or two simple sentences.

Summarize the complicated requirements as if you’ve been asked what you are working on today. Maybe it won’t be that simple, but you should be able to boil it down to a sentence or two.

If you can’t summarize the task it probably means you are going to need to split it up into multiple tasks. So essentially this step becomes a litmus test to determine if you’ve organized your tasks into small enough chunks.

Here’s a good example of a summary: “When we update the site, we append a unique number to the files so that the browser knows it needs to use the latest code.”

This task passes the simplicity litmus test and you probably don’t need to create multiple tasks.

A bad example might look like: "When we update the site we append a unique number to the files so that the browser knows it needs to use the latest code. We also have to send a message to our CDN letting it know that it needs to update the files. Also the IOS and Android apps will need to have an update sent to the app store. Also…"

This one clearly fails the test. There’s a lot of work to do and it may need to be identified and tracked separately.

### Outline the major parts

In whatever form is most convenient for you, you should now make a list of the major things that must be done.

These should still be very simple summaries of each major step.

These should *not* be a step by step or detailed guide of how to fix the issue.

Remember that you are still analyzing the task you were given. I would recommend writing these down somehow. I personally record them in my Notes app.

Our caching task is very simple and may not actually need an outline. For this example we’ll consider a more complex issue.

Our next task is a new feature: "Each user should be shown a targeted advertisement for an internal product. This ad should be tailored to fit their individual needs based on the data we have collected."

To outline the major parts you will need to think clearly about what each part of the requirement will have you do.

* Our current advertisements will need to be broken down in such a way that they can correlate to some specific user metric.
* There will need to be a way for our marketing team to map new advertisements to a piece or pieces of user data (without coding!)
* The system will need to aggregate metrics about a user that are relevant to our advertisements.
* Finally, you need to create some kind of system that receives a user id and outputs an advertisement.

The beauty of a list like this is that it can be used to quickly verify with your team or boss! So in this example, maybe you’ve run it by your team lead and he decided that there needs to be one more major piece:

* Users should be able to tell us when they don’t want to see certain ads any more.

Because after all, we don’t want to annoy our beloved users! By taking the time to think about our task for just a couple minutes, we’ve saved hours or days of pain later by identifying and planning for an important task before getting started with coding.

Before we move on, I want to address a possible criticism that you might have.

You might be thinking: “In a proper business this is the type of work that should be done before requirements ever reach the developer”, and I definitely agree with you!

However, we sadly don’t live in a perfect world. Sometimes requirements aren't always completely fleshed out before they get to a developer. This means we must all do our best to properly evaluate the requirements before development starts.

### Define the problem or problems that you are trying to solve.

Answer the question, “why will someone use this?”, or “what actual or perceived real world problem am I trying to fix?”

Hopefully the answer is obvious. For our cache example you could say, “users will always see the latest updates.” For the advertisement example, “users will see relevant ads instead of ads they don’t care about.”

If the answer isn’t obvious then it’s probably time to ask someone why you are doing this task! Asking this question will lead to either you having a clearer understanding of the task at hand, or it will lead to a re-think of what you’ve been asked to do.

Hopefully you see the benefits to either of those answers! A deeper understanding of the problem and purpose will allow you to make decisions in your implementation that actually serve the business goals. Identifying bad solutions or problems that don’t make sense will avoid wasted effort on work that would never solve a problem in the end.

## The second step: Interpreting and evaluating the requirements

At this point you should have an understanding of what it is that you will be doing and why you are doing it.

Your next step will be to understand the details of what you are doing, how you are expected to do it, and why you are doing it that way.

### Clarify all the important terms related to your task.

You may find that this step is more important if you are a new developer on a team or if you work in a large company. Both of those situations make it more likely that you will find unknown terms in your requirements.

Terms can be business terms, like the names of products, customers, or processes. They can also be development terms like names of tools, applications, models, services, or libraries.

You must be sure to understand all the important terms, without any vagueness, so that you can be certain you are implementing your task correctly.

You might understand that you need to create a way to access the aggregated user information, but do you understand what it means to add it to the “dao”?

You might understand that you need to format the advertisement data, but do you understand what the “MADF” (Marking advertisement data feed) is?

Neither do I.

This is why you must identify and define all the important terms. You have a greater chance of implementing the task incorrectly if you get the definitions wrong.

### Identify how the task should be done

At this point you should now begin to look at how the task should be done. This step can vary widely depending on where you work and the particular task you’ve been given.

On some teams you won’t be told how to implement requirements, you’ll just be told what functionality you should end up with.

Others will detail every step you should take.

Most likely your experience falls somewhere in the middle.

If your team hasn’t given you instructions then you can’t do much on this step. If you have been given instructions, then at this point you’ll want to begin to become familiar with the steps you’ll need to take.

This step seems pretty obvious, but the order it comes in is something you should pay special attention to.

The natural inclination can be to dive into all the details of the task before ensuring that the purpose of the task is understood.

Since you’ve taken the time to understand your task first, you will now have a clearer goal in mind when evaluating the steps you need to take.

### Determine if the problems were solved

This is where the analysis stage and the interpretation stage come together. In the analysis stage you focused on the big picture goals and outcomes, the *what *and *why*.

In the interpretation step you focused on the details, the *how*.

The reason it’s called interpretation and evaluation is that you will now compare the how to the what and the why. You interpret the details by considering the bigger picture. You will evaluate the details and determine if the original problem was solved.

Ask yourself: Will the steps I’ve been given result in the outcome that your task was intended to create? Will this outcome actually solve the original problem?

If you feel confident that all the problems are solved, and all the details make sense, you are ready to begin your work! Otherwise, you must move to the third stage to resolve any conflicts.

## The third step: Think critically

At this stage you should confidently be able to state that you understand the problem and the solution. The very last step is to make sure that you have the *right *solution.

In order to create the best possible product we should all feel like we have the responsibility to speak up when something just doesn’t make sense.

On the other hand, we don’t want to disagree out of turn. You shouldn’t say something is wrong because “it feels wrong” or because “I don’t like it”. You must have concrete and well thought out reasons.

So lets lay down some ground rules about disagreements.

### Know when to disagree

* Don’t disagree until you understand fully.

Never say that something is wrong until you are absolutely sure you understand what you are disagreeing with.

If you can’t confidently state the problem and the intended solution, you shouldn’t disagree. If you haven’t verified your understanding, you shouldn’t disagree. Only when you know you have the most complete understanding possible should you begin to disagree.

If you find that you don’t have all the information you need, then it might be time to stop and revisit any of the previous steps before you tell someone that the requirements are wrong.

* Don’t disagree over subjective matters. Focus on actual potential problems.

“I don’t like how this is done” is subjective. “This will cause performance issues because of the number of operations involved.” is an objective reason. Other examples of subjective reasons might include, “This isn’t how I’ve done it elsewhere” and “I would have designed this solution slightly differently, but only because of personal preferences.”

* Have well reasoned explanations of your disagreements ready to be presented.

If you can’t explain *why* something is wrong, can you really say that you actually know it’s wrong? I would suggest writing down the reasons why something is wrong and what can be done to fix it.

Alternatively, if you don’t have a solution to fix it, state clearly at the beginning that you don’t know.

Be careful about when you disagree with others. The bulk of your time should be spent on understanding and listening before you disagree.

If you followed all the steps up until this point it’s very likely that you have a good understanding. But take great care to keep an open mind that you may have missed something!

I like to start conversations by saying, “I’m not disagreeing with you, I just don’t understand.” Later comes the disagreement if necessary, but hopefully never before understanding.

### Know how to disagree

In order to make sure we disagree objectively, here are a few measures that will help you determine if your disagreement is valid.

Objective disagreements do one or more of the following:

* Show that the solution is uninformed.
* Show that the solution is misinformed.
* Show that the problem or solution is illogical.
* Show that the solution is incomplete.

To be uninformed is not an insult, but instead it means that information was lacking when a solution was created. Perhaps they did not know about a system that currently exists and can perform the actions that are needed.

To be misinformed means that the solution came from incorrect information.

In this case they might think an existing system does something that it actually does not. For example, maybe the SEO (search engine optimization) team asked you to have Google indexed a logged in page on your application. Google can’t do that. They were misinformed about what Google’s crawler does.

An illogical problem or solution is one that simply does not make sense. As a developer I think a common illogical request you might see is for one feature that could break another feature. It could be considered illogical to do that because it would hurt, rather than help.

A solution being incomplete may actually be intended. In software development we often try to start by making an MVP (minimum viable product). This means that we may, at first, purposely leave out functionality that isn’t absolutely necessary.

Instead you should only consider a solution to be incomplete if it doesn’t solve the immediate problem that you’ve been asked to fix, or if the steps provided aren’t sufficient to create a working product or feature.

## Summary

Remember, don’t over-formalize this process. It should be quick and probably consist of jotting down a few thoughts in your Notes app. Then it could possibly lead to a few conversations with your coworkers to clarify what you’re supposed to be doing. That’s all!

Here’s a simplified list of the steps:

**Step 1 — Analyze**

* Classify
* Summary
* Outline
* Define the problem

**Step 2 — Interpret and Evaluate**

* Clarify terms
* Identify the tasks
* Determine if the problem will be solved

**Step 3 — Think Critically**

* Know when to disagree
* Know how to disagree

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
