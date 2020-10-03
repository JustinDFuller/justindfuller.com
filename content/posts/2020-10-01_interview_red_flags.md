---
author: "Justin Fuller"
date: 2020-10-02
linktitle: "Two interview red flags and how to avoid them
menu:
  main:
    parent: posts
next: /posts/interview-red-flags
title: Two interview red flags and how to avoid them"
weight: 1
draft: true
---

Let's face it, interviewing is hard. It's tough for the interviewee but it's also tough for the interviewer. At best, you and the interviewer have a few hours together to decide if you want to work together for, potentially, several years.

Over the course of my career I've — thankfully — had many positive interviews, with only a few bad ones.

Here are the two biggest red flags I've encountered, and how to avoid them.

<!--more-->

## The Interviewer Won't Sell the Role

For the worst interview I've ever been a part of, it wasn't bad because of something the interviewers did; it was bad because of what they didn't do.

Before I begin interviewing with a company, I do some research to see if it aligns with my values and goals, and to see if the work seems interesting. I usually ask something like this: "There are so many great places to work, places that have important missions, meaningful work, and fun cultures. Tell me why you chose to work here, and why I should too."

Almost without fail, the interviewer will tell me all the things they love about their company. Except once, when they wouldn't.

They responded, "That's really for you to decide. I can't tell you why you should work here."

On the surface this sounds perfectly reasonable. Each of us is unique, with different goals and values, so we must make the choice for ourselves. But this is actually a __huge red flag__. Think about this question in some other context, like when you ask a friend if you should go to the new restaurant that your friend just tried. If they tell you "You have to decide for yourself", are you really going to try it? It seems like they had a bad experience but don't want to tell you.

### How To Respond

If the interviewer won't sell the role, you can try to reframe the question. You can ask "What's your favorite part about working here?" and "Tell me about a project that you're excited to work on."

It's also important to remember that a single interviewer may not be representative of the entire company. It's possible this person is burnt out or the company is a bad fit for them. Be sure to ask this type of question to multiple people if you don't hear a positive answer at first.

If they still can't give you an answer, it's time to realize that they don't enjoy working here, and likely neither will you.

### When You're Giving The Interview

As an interviewer, it's important to remember that you're being interviewed too. The interviewee is trying to decide if they would like working at your company and your team. You might be reluctant to advocate for your company in this way; maybe you're worried about unduly influencing the interviewees decision. __TODO__

## The Programming Gotcha

Here's how this interview-style works. You sit down at the table, the interviewer opens up their laptop, slides it over to you, and you see a few cryptic lines of code. This code never looks like code that would be approved in a pull request. Maybe it uses rarely-used features of a programming language, or some of the carefully avoided "features" of JavaScript. Either way, this is not code you might work with every day.

Now, the interview asks you what this code will output. You know it's a trick question, and that whatever it appears to output is not actually the case.

You take a guess, you're close, but when the interview runs the code, you see that some quirk of the language produces an unexpected result.

Why is this a red flag? Because it doesn't reflect how software engineers actually work. 

Think about a real, structural engineer. The design of the "code" (the blueprint) must be exactly right, because it's extremely expensive to hire the builders, get the building up, and realize that a crucial mistake is made. However, this is not true for software engineers. In modern languages like JavaScript and Go, building and running the program is extremely fast and cheap. You can do it many times per minute. 

It's perfectly acceptable, in fact I argue that it's expected, that an engineer will try many variations of their code—assisted by automated tests—to get the expected output.

It's also perfectly acceptable to never use certain features of a programming language. In fact, in JavaScript, we do this intentionally. If these features are difficult to use and error-prone, avoid them.

### How To Respond

How you respond depends on how urgently you need this job, or how badly you want to work for this company. It may be tempting to explain to the interviewer that their questions are bad, but that's unlikely to help anyone. If you're able to answer the questions correctly, you could get some extra points by carefully explaining why you think this questions can be troublesome, and by referring the interviewer to questions that you generally find to be more demonstrative of engineering skills.

Most of the time, you should just note that 

### When You're Giving The Interview

If this sounds like a question you've been asking in interviews, don't worry! It's easy to fix. Just remember the golden rule: If the answer is revealed by running the code once, it's not a good question.

You should instead consider using questions that require writing code similar to what your engineers do every day. If you're making UI widgets for a bank, do not require them to solve a complex leetcode-style algorithm. If you're maintaining legacy code, create a small project that contains a bug; then, ask the interviewee to find and fix it.

There are many options available to you, all of which avoid testing for rote memorization, while target skills for your unique needs.

Most importantly, be sure that this question, or a small set of questions, are consistent for all of your candidates. This will help ensure fair comparisons.

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!

---
