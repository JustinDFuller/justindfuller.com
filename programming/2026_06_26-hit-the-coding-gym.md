---
title: It’s time to hit the coding gym
date: 2026-06-26
draft: false
tags: [Code]
---

People have been working out for a long time. While the modern gym has only existed for a couple of hundred years, the idea goes back thousands. Plato built his school, the Academy, in ancient Greece, with the name inspired by a nearby gymnasium.

![The Coding Gym](/image/programming/the-coding-gym.PNG)

At first, these gyms were socially privileged institutions. In ancient Athens, they were limited to free men, which excluded most of the population. But over the centuries, access to gyms (both in terms of available time and privilege) expanded to include more of the population.

As lives grew more sedentary, and labor demanded less from bodies, the need for intentional exercise became increasingly important.

Now, AI is creating the same need for coding practice.

## Story Time

I try to interview a couple of times each year. It reveals if my current compensation is below market, if my resume is still up to par and, importantly, if my interview skills are still intact.

I’ve written about how I’ve been using AI to write 100% of my code since about August 2025. So it was a jarring experience to walk into a coding interview only to be asked to, can you believe it, write code. As you might guess, I failed the interview.

It’s not that I couldn’t code anymore. Instead, I was slow, awkward with the keyboard, and while I believe my solution was still heading in the right direction, I wasn’t able to get there in time. If I had to guess, the interviewer probably left with the impression that I knew where I wanted to get, but struggled to get the code to that place in a reasonable amount of time.

I realized: it’s time to hit the coding gym.

Just like when people began to exercise intentionally because physical labor stopped demanding the use of bodies, we should begin to practice coding intentionally now that daily work doesn’t require us to manually write code.

This affects more than just interviews. Recently at NYT, our internal gateway for Claude code experienced an outage. As an engineer on the Developer AI team, it was my team's responsibility to fix it. We had to fix Claude Code, without Claude Code.

If we allow our engineering skills to atrophy, we wouldn't be able to adequately respond to such incidents.

## Gyms

If you’re convinced that you should hit the gym, here are some of the options I am aware of.

- [LeetCode](https://leetcode.com/): Algorithm and data-structure practice.
- [Exercism](https://exercism.org/): Language-focused exercises with feedback.
- [Codewars](https://www.codewars.com/): Community-made coding kata.
- [HackerRank](https://www.hackerrank.com/dashboard): Practice across algorithms, system design, and more.
- [CodeSignal](https://codesignal.com/learn/course-paths): Coding challenges and interview assessments.
- [Advent of Code](https://adventofcode.com/): Story-driven programming puzzles.
- [Project Euler](https://projecteuler.net/): Math-heavy programming problems.
- [CodeCrafters](https://codecrafters.io/): Rebuild tools like Git, Redis, and SQLite.
- [Build Your Own X](https://github.com/codecrafters-io/build-your-own-x): Tutorials for building software from scratch.
- [Frontend Mentor](https://www.frontendmentor.io/): Realistic front-end project challenges.

If you don't like these, a quick search will reveal many more options.

## How to Practice

Here is how I practice.

First, I try not to overdo it. My weekly goal is to practice three times for about fifteen minutes each. Given that amount of time, I do not always expect to finish a problem each session. That’s ok.

When I encounter a problem I don’t know how to solve, I try my best guess or try to “brute force” my way through. The goal is not to solve it perfectly but to see how close I can get with the strategies I already know.

My primary goals are to

- Get a working solution for any provided test cases.
- Correctly identify the space and time complexity of what I implemented.
- Identify test cases that break my solution or that would reveal specific categories of broken solutions.

Once I’ve exhausted the options with my current skills, it’s time to learn if any new strategies might help me improve.

Here, I am specifically not looking for how others solved it or for hints. Instead, I am trying to discover which tools are missing from my toolkit, then trying to figure out how to apply them to this problem.

Previously, I would look at other people’s solutions to see how they did it better. However, I found that I didn’t actually learn much from this exercise because seeing the answer didn’t make me work out the solution on my own.

Instead, I ended up creating this custom GPT that analyzes the problem and my solution and tells me which strategies I should know about to improve my implementation: [https://chatgpt.com/g/g-6a3d2c6556448191a65b1190bf1450b8](https://chatgpt.com/g/g-6a3d2c6556448191a65b1190bf1450b8). It is specifically forbidden from solving the problem or giving hints unless explicitly asked for.

For example, maybe a solution would benefit from a sliding window algorithm. It would tell me that I should try to learn about and implement a sliding window algorithm. It would not tell me exactly how to do that, but would tell me about sliding window algorithms in general and allow me to go apply it to the solution myself.

I prefer this approach to looking at solved problems or getting hints because it forces me to try to figure out how to do it on my own. I find that this helps me learn more than if the solution is simply handed to me.

## Example

Recently, I was working on this LeetCode problem:

https://leetcode.com/problems/add-two-numbers

My original implementation looked like this:

```go
func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode {
    multiplier := 1
    sum1 := 0
    sum2 := 0
    
    for l1 != nil || l2 != nil {
        if l1 != nil {
            sum1 += l1.Val * multiplier
            l1 = l1.Next
        }
        
        if l2 != nil {
            sum2 += l2.Val * multiplier
            l2 = l2.Next
        }
        
        multiplier = multiplier * 10
    }
    
    sum := sum1 + sum2
    dividend := 1
    
    var nums []int
    
    for dividend < sum {
        dividend2 := dividend * 10
        remainder := sum % dividend2
        nums = append(nums, remainder / dividend)
        sum -= remainder
        dividend = dividend2
    }
    
    var head ListNode
    next := &head
    
    for _, num := range nums {
        next.Val = num
        next.Next = &ListNode{}
        next = next.Next
    }
    
    return &head
}
```

To be clear, this implementation was incorrect and insufficient and not optimal for many reasons. I wanted to improve it but I also don't know what I don't know, so I set out to find out. I asked my custom GPT and it identified these strategies I needed to learn:

1. Recognize when you cannot convert the input into an integer.
2. Process data incrementally rather than reconstructing the whole value.
3. Handle uneven list lengths.
4. Understand the complete loop-continuation condition.
5. Learn the dummy-head linked-list pattern.
6. Learn the tail-pointer append pattern.

This answer did not tell me how to solve the problem. Instead, it told me what to learn. After researching these strategies, I was able to improve my implementation to the following:

```go
func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode {
    head := ListNode{}
    next := &head
    
    var carry int
    
    for l1 != nil || l2 != nil || carry > 0 {
        var l1v int
        var l2v int
        
        if l1 != nil {
            l1v = l1.Val
            l1 = l1.Next
        }
        
        if l2 != nil {
            l2v = l2.Val
            l2 = l2.Next
        }
        
        sum := l1v + l2v + carry
        
        carry = sum / 10
        
        next.Next = &ListNode{
            Val: sum % 10,
        }
        next = next.Next
    }
    
    return head.Next
}
```

I don't claim it is a perfect implementation but it does pass all tests and ranked well in memory and time against other LeetCode submissions. It also has an `O(max(m, n))` space and time complexity.

So, the code improved and I learned several new skills.

## Closing Thoughts

I want to be clear: I am not advocating in this post for LeetCode-style interviews. Instead, I am recommending the use of these tools for coding practice. The aim is specifically to prevent basic coding skills from becoming rusty due to underuse, now that many of us rely on AI to write code for us. The usefulness of that type of interview is debated, and I do not seek to enter that debate with this post.

It is fair to point out the paradox here. We are relying on these tools to write all our code, but they are not yet reliable enough to be fully trusted. They are helpful, but must be used with great caution. So, at this point, it is not yet safe to let coding skills atrophy. Yet, we are entering a phase where they will naturally do so if steps are not taken to prevent it.

## Sources

- [https://en.wikipedia.org/wiki/Platonic_Academy](https://en.wikipedia.org/wiki/Platonic_Academy)
- [https://www.britannica.com/technology/gymnasium-sports](https://www.britannica.com/technology/gymnasium-sports)
