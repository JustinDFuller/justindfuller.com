---
markup: "mmark"
author: "Justin Fuller"
date: 2022-04-21
linktitle: "Bias Smells"
menu:
  main:
    parent: posts
next: /posts/bias-smells
title: "Bias Smells"
weight: 1
images:
  - /bias_smells.png
tags: [Life]
---

Only ten years late, I just finished reading [Thinking, Fast and Slow](https://amzn.to/3L5Dql3). In it, Daniel Kahneman explores biases involved in human intuition.

<!--more-->

Among the many biases he explores, there's the anchoring effect, where we don't stray far from a number, even when it's not relevant to the question at hand. There's also availability bias, where we answer questions based on the ease of thinking of examples, even when that doesn't provide the correct answer.

Throughout the book, Kahneman expresses skepticism that individuals can overcome these biases. I know of no reason he would be wrong, but I wonder if something similar to [code smells](https://blog.codinghorror.com/code-smells/) would help. In software engineering, we have the idea of code smells, which allow engineers to pair a generic problem with a solution quickly.

For example, one code smell is comments. If you see comments, you may be dealing with poorly named variable or function names. It's not always the case, but it provides a helpful heuristic to match a common problem to a quick solution.

Looking at the biases outlined in Thinking, Fast and Slow, we can develop some bias smells to help us quickly detect potential opportunities for bias. The smell can also help us quickly identify a solution. They'll be heuristics, so they won't be terribly accurate, but that doesn't mean they can't be helpful.

| Question | Bias | Solution |
|------|-------------|------------------------------------|
| What *usually* happens when...? How *often* does...?       | [Availability Bias](https://en.wikipedia.org/wiki/Availability_heuristic)                                              | Stop, admit that you don't know what usually happens, that you remember a few examples but haven't actually measured the frequency. Instead, collect and analyze data.                                             |
| How *important* is...? What *impact* will this have?       | [Focusing Illusion](https://en.wikipedia.org/wiki/Affective_forecasting#Focalism)                     | Stop, remind yourself that the importance of the thing you focus on may seem warped.   Instead, collect alternatives to compare importance and look for a numerical indicator of potential impact.                  |
| What are the *chances* that... How *likely* is it that...  | [Substituion](https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow#Substitution) | Stop, remind yourself that humans are not good at intuiting statistics. Instead, collect data and perform an actual statistical analysis. Even a back-of-the-napkin analysis of data may be better than intuition. |
| Are you willing to *lose*... Would you *walk away* from... | [Loss Aversion bias](https://en.wikipedia.org/wiki/Loss_aversion).                                                                                                                                                                        | Stop, remind yourself that humans are naturally averse to loss. Instead, compute the impact of the loss against the likelihood. Be sure to compare it to the impact and likelihood of the gain.                    |

This list is just a start. There are [many more biases](https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow#Heuristics_and_biases) outlined in the book. What "Bias Smells" would you add or change?
