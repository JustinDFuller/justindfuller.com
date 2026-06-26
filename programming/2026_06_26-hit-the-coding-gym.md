---
title: It’s time to hit the coding gym
date: 2026-06-26
draft: false
tags: [Code]
---

We’ve been working out for a long time. While the modern gym has only existed for a couple of hundred years, the idea goes back thousands of years. In Ancient Greece, almost 2500 years ago, Plato built the Academy, which was both the name of his school as well as a nearby gymnasium.

![The Coding Gym](/image/programming/the-coding-gym.PNG)

At first, these gyms were socially privileged institutions. In ancient Athens, they were limited to free men, which excluded most of the population. But over the centuries access to gyms (both in terms of available time and privilege) expanded to include more of the population.

As our lives grew more sedentary, and our labor demanded less from our bodies, the need for intentional exercise became increasingly important.

Now, AI is creating the same need for coding practice.

## Story Time

I try to interview a few times a year, and I recommend others do the same. It reveals if my current compensation is below market, it tells me if my resume is still up to par, and importantly, it reveals if my interview skills are still intact. I’ve written about how I’ve been using AI to write 100% of my code since about August 2025. So it was a jarring experience to walk into a coding interview only to be asked to, can you believe it, write code. As you might guess, I failed the interview.

It’s not that I couldn’t code any more. Instead, I was slow, awkward with the keyboard, and while I believe my solution was still heading in the right direction, I wasn’t able to get there in time. If I had to guess, the interviewer probably left with the impression that I knew where I wanted to get, but struggled to get the code to that place in a reasonable amount of time.

I realized: it’s time to hit the coding gym.

Just like when physical labor stopped demanding the use of our bodies, people began to exercise intentionally in a gym; now that our daily work doesn’t demand us to manually write code, we should begin practicing it intentionally.

This affects more than just interviews. Recently, our internal gateway for Claude code experienced an outage. As an engineer on the Developer AI team, it was up to me and the other engineers on the team to fix it. We had to fix Claude Code, without Claude Code.

## Gyms

If you’re convinced that you should hit the gym, here are some of the options I am aware of.

- [LeetCode](https://leetcode.com/): Algorithm and data-structure practice.
- [Exercism](https://exercism.org/): Language-focused exercises with feedback.
- [Codewars](https://www.codewars.com/): Community-made coding kata.
- [HackerRank](https://www.hackerrank.com/): Practice across algorithms, SQL, and languages.
- [CodeSignal](https://codesignal.com/): Coding challenges and interview assessments.
- [Advent of Code](https://adventofcode.com/): Story-driven programming puzzles.
- [Project Euler](https://projecteuler.net/): Math-heavy programming problems.
- [CodeCrafters](https://codecrafters.io/): Rebuild tools like Git, Redis, and SQLite.
- [Build Your Own X](https://github.com/codecrafters-io/build-your-own-x): Tutorials for building software from scratch.
- [Frontend Mentor](https://www.frontendmentor.io/): Realistic front-end project challenges.
- [Codeforces](https://codeforces.com/): Competitive programming contests and practice.
- [AtCoder](https://atcoder.jp/): High-quality competitive programming problems.
- [CodeChef](https://www.codechef.com/): Coding contests and practice problems.

## How to Practice

Here is how I practice.

First, I try not to overdo it. My weekly goal is to practice three times for about fifteen minutes each. Given that amount of time, I do not always expect to finish a problem each session. That’s ok.

When I encounter a problem I don’t know how to solve, I try my best guess or try to “brute force” my way through. The goal is not to solve it perfectly but to see how close I can get with the strategies I already know.

My primary goals are to:

- Get a working solution for any provided test cases.
- Correctly identify the space and time complexity of what I implemented.
- Identify test cases that break my solution or that would reveal specific categories of broken solutions.

Once I’ve exhausted the options with my current skills, it’s time to learn if any new strategies might help me improve.

Here, I am specifically not looking for how others solved it or for hints. Instead, I am trying to discover which tools are missing from my toolkit, then trying to figure out how to apply them to this problem.

Previously, I would look at other people’s solutions to see how they did it better. However, I found that I didn’t actually learn much from this exercise because seeing the answer didn’t make me work out the solution on my own.

Instead, I ended up creating this custom GPT that analyzes the problem and my solution and tells me which strategies I should know about to improve my implementation: [https://chatgpt.com/g/g-6a3d2c6556448191a65b1190bf1450b8](https://chatgpt.com/g/g-6a3d2c6556448191a65b1190bf1450b8) It is specifically forbidden from solving the problem or giving hints unless explicitly asked for.

For example, maybe a solution would benefit from a sliding window algorithm. It would tell me that I should try to learn about and implement a sliding window algorithm. It would not tell me exactly how to do that, but would tell me about sliding window algorithms in general and allow me to go apply it to the solution myself.

I prefer this approach to looking at solved problems or getting hints because it forces me to try to figure out how to do it on my own. I find that this helps me learn more than if the solution is simply handed to me.

## Closing Thoughts

I want to be clear: I am not advocating in this post for LeetCode-style interviews. Instead, I am recommending the use of these tools for coding practice. The aim is specifically to prevent basic coding skills from becoming rusty due to underuse, now that many of us rely on AI to write code for us. The usefulness of that type of interview is debated and I do not seek to enter that debate with this post.

It is fair to point out the paradox here. We are relying on these tools to write all our code, but they are not yet reliable enough to be fully trusted. They are helpful, but must be used with great caution. So, at this point, it is not yet safe to let coding skills atrophy. Yet, we are entering a phase where they will naturally do so if steps are taken to prevent it.

## Sources

- [https://en.wikipedia.org/wiki/Platonic_Academy](https://en.wikipedia.org/wiki/Platonic_Academy)
- [https://www.britannica.com/technology/gymnasium-sports](https://www.britannica.com/technology/gymnasium-sports)
