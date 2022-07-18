---
author: "Justin Fuller"
date: 2021-11-01
linktitle: "Why Did I Stop Writing?"
menu:
  main:
    parent: posts
next: /posts/why-did-i-stop-writing
title: "Why Did I Stop Writing?"
weight: 1
images:
  - /why_did_I_stop_writing.png
tags: ["Writing"]
--- 

The last time I wrote a regular blog post was about one year ago.

Now, as we all know, a few things have happened in the world since then. So, it could be understandable if I didn’t post anything. But, if I’m honest, the reasons I stopped posting related more to my feelings and less to the state of the world around me.

I’m thinking about this because I just finished reading [this excellent post by Dan Luu](https://danluu.com/look-stupid/) about his willingness to look stupid.

Near the end of his list of “stupid” things he does, he added this line:
> “Posting things on the internet: self explanatory”

It clicked the moment I read that line. Fear is the reason I stopped writing.

### Fear of being wrong

As I think about my previous posts, I remember [one of the hacker news comments](https://news.ycombinator.com/item?id=21977349) about my post, “[Go Things I Love: Channels and Goroutines](https://www.justindfuller.com/2020/01/go-things-i-love-channels-and-goroutines/).”

The commenter points out:
> The example under “Communicating by sharing memory” isn’t correct, despite the author claiming that “it works”.

They were correct; I was wrong. I had written my example in the Go Playground. Which the commenter pointed out runs with `GOMAXPROCS` set to 1, a setting that eliminated the concurrent behavior I was attempting to demonstrate.

I left a few comments that attempted to be thankful for the correction, and I updated the post — but if you head over to [justindfuller.com](https://justindfuller.com), you won’t find any more posts in the series “Go Things I Love.”

Thinking about another recent post, “[Why do we fall in the rewrite trap?](https://www.justindfuller.com/2020/01/why-do-we-fall-into-the-rewrite-trap/)” and [the related HN comments](https://news.ycombinator.com/item?id=22106367), which pointed out that there’s more nuance to if you should or should not rewrite your code. It also pointed out an apparent inconsistency in my examples of when and when not to rewrite.

Logically I understand that posting anything online where there’s a place for others to comment can be a great way to get feedback. But I got uncomfortable because that feedback often tells me how I’m wrong.

Instead of gratefully learning from it, I let it discourage me from posting.

For some reason, I let myself think that it wasn’t OK to be wrong. I let myself believe that being wrong was a failure in my writing.

### Fear of being unoriginal

I haven’t published any blog posts for a year, but that doesn’t mean I haven’t written anything.

As of this writing, I’ve got at least half a dozen unfinished posts. There are more Go posts, some about learning to code, and a few other random topics. 

I abandoned some of them because I felt that others may be “more qualified” or may have written them better.

### Fear of Hypocrisy

I can think of another thing that held me back from posting. The fear of hypocrisy — that I would write one thing and act another way in my day-to-day responsibilities.

I know from conversations that some of my colleagues read my posts, and I know that I don’t always do things the way I write about them.

For example, I once wrote about [how to write good error messages](https://www.justindfuller.com/2018/11/how-to-write-error-messages-that-dont-suck/). But here’s the thing: I constantly find myself writing terrible error messages. 

Now, I’m under no impression that the engineers on my team read that post. But my worry when writing new posts has been that they would notice the difference between my writing and my actions. I was worried they’d think I was hypocritical.

---

👋 Want to hear more of my stupid, unoriginal, and hypocrytical thoughts? [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about.

---

### Why have I been writing?

I think I’ve been writing to get some external benefit out of the experience. 

I thought that if I wrote good enough posts, I’d be respected, offered a job, or make some money (like when I post on Medium). All external things that aren’t really in my control and are perhaps unlikely outcomes for even a really good blog post.

That’s why negative feedback felt bad to me, even if on the surface I managed to receive it gracefully. 

The negative feedback was “getting in the way” of the outcome I wanted: prestige, respect, a job offer, money.

### Why should I write?

All of this naturally leads to the question, why should I write?

I could just privately reflect on my problems and interests, which is pretty much what I’ve been doing since I stopped writing.

But, even though it was sometimes painful, I did learn a lot from the responses. I don’t want to give that up. I just want to find a way to make it less painful, even enjoyable (hopefully).

### So, why will I write?

I don’t want to convince others that I’m a perfect, flawless expert in some field (I couldn’t if I tried). 

I don’t even want to limit myself to topics that I know a lot about. I’ll learn more when I write about (and research) topics where I don’t know much.

I don’t want to limit myself to thinking only about completely original content. Most of my ideas are unoriginal anyway. Like this post, they’re a riff off of someone else’s idea.

I want to write to reflect on an idea or problem I’m interested in. Then, I want to share my thoughts and learn from the feedback.

As Dan Luu said, I want to “view the upsides of being willing to look stupid as much larger than the downsides”. So, I’m going to post my stupid, unoriginal, hypocritical thoughts, and then I’m going to learn from them.

---

Hi, I’m Justin Fuller. Thanks for reading my post. Before you go, I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) or [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about. Thanks again for reading!
