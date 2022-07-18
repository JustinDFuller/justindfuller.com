---
author: "Justin Fuller"
date: 2020-10-04
linktitle: "Two interview red flags and how to avoid them
menu:
  main:
    parent: posts
next: /posts/interview-red-flags
title: Two interview red flags and how to avoid them"
weight: 1
draft: true
tags: ["Programming"]
---

Let's face it; interviewing is hard. It's tough for the interviewee, but it's also challenging for the interviewer. At best, you and the interviewer have a few hours together to decide if you want to work together for, potentially, several years.

I've — thankfully — had many positive interviews throughout my career, with only a few bad ones.

Here are two red flags I've encountered and how to avoid them.

<!--more-->

## The Interviewer Won't Sell the Role

The worst interview that I've ever been a part of wasn't bad because of something the interviewers did, but because of what they didn't do.

Before I begin interviewing with a company, I research to see if it aligns with my values and goals and see if the work seems interesting. Once I get into the interviews, I usually ask something like this: "There are so many great places to work, places that have important missions, meaningful work, and fun cultures. Tell me why you chose to work here and why I should too."

Almost without fail, the interviewer will tell me all the things they love about their company. Except once, when they wouldn't.

They responded, "That's for you to decide. I can't tell you why you should work here."

On the surface, this sounds perfectly reasonable. Each of us is unique, with different goals and values, so we must choose for ourselves. But this is a __huge red flag__. Think about this question in some other context, like when you ask a friend if you should go to the new restaurant that your friend just tried. If they tell you, "You have to decide for yourself", are you going to try it? Probably not. It seems like they had a bad experience but don't want to tell you.

### How To Respond

If the interviewer won't sell the role, you can try to reframe the question. You can ask, "What's your favorite part about working here?" and "Tell me about a project that you're excited to work on."

It's also important to remember that a single interviewer may not be representative of the entire company. Your interviewing could be experiencing burnout. Maybe the company is a bad fit for them. Whatever the reason, be sure to ask multiple people this type of question if you don't hear a positive answer at first.

If they still can't give you an answer, it's time to realize that they don't enjoy working here, and perhaps neither will you.

### When You're Giving The Interview

Whenever I interview for a job, I always remind myself that I'm interviewing the company just as much as they are interviewing me. I understand that not everyone has this luxury; some of us need a job. If you're interested in hiring candidates that have opportunities elsewhere, I suggest you remember that the candidate is interviewing you, too. 

This means that you should prepare for your interviews, don't walk in and "wing it". I've seen this approach used too many times, and I've rarely seen it go well. 

You need to have a standard interview format because you'll execute it more fluently over time. You'll also need to have standard interview questions because you'll learn where people get tripped up and how to use them to dig deeper into the candidate's knowledge; you'll also have a common comparison-point between all candidates. Finally, and most relevantly here, you need to prepare what you'll answer when the candidate asks about your company.

Come prepared to talk about your favorite projects, your company's leadership, and any benefits (not just HR benefits) to working here. You might feel like this is a job for HR or management; it's not. Engineers look to other engineers to see how they like their job. So, in a way, your answer may be more critical than whatever management or HR says because the interviewee can relate to your position.

## The Programming Gotcha

Here's how this interview-style works. You sit down at the table, the interviewer opens up their laptop, slides it over to you, and you see a few cryptic lines of code. This code rarely looks like code that would be approved in a pull request. Maybe it uses rarely-used features of a programming language, perhaps one of the carefully avoided "features" of JavaScript. Either way, this is not code you might work with every day.

Now, the interview asks you what this code will output. You know it's a trick question, and that whatever it appears to output is not the case.

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

Hi, I'm Justin Fuller. I'm so glad you read my post! I need to let you know that everything I've written here is my own opinion and is not intended to represent my employer.

I'd also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!

---
