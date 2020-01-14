---
author: "Justin Fuller"
date: 2020-01-20
linktitle: "Go Things I Love: Channel Generators"
menu:
  main:
    parent: posts
next: /posts/go-things-i-love-channel-generators
title: "Go Things I Love: Channel Generators"
weight: 1
draft: true
images:
  - /go-things-i-love.png
---

// This example shows the default, synchronous code 
// It takes 600ms to execute, which is far too slow 
// but the errors do allow you to stop short.

https://play.golang.org/p/UR6Plhj1CXI

// This example shows using a waitgroup to obtain concurrency
// it executes in half the time, 300ms, but, as will be shown in another
// example, there are some problems with the waitgroup error handling.

https://play.golang.org/p/fkr6mbeSehG

// This example shows the problems with the waitgroup errors
// They do not fail fast, it still takes 300ms even though an
// error happens after 200ms.

https://play.golang.org/p/TKq6O13StDP

// This example shows using a sync.ErrorGroup
// Unfortunately, it still waits for the whole WaitGroup
// to complete, because under the hood it uses a regular 
// wait group.
// And also, in my opinion, it still has many, subjectively,
// ugly anonymous functions.

https://play.golang.org/p/4ByVdSlxtWP

// This example shows using channel generators
// It stops after 200ms, but it has a manual cleanup
// with a for loop, select, and a manual counter
// This is very complex

https://play.golang.org/p/aHXBOpGLpHs

// This example shows methods that accept an error channel
// This is a bit less complex because there are less methods
// and less cleanup. Also less channels.
// Unfortunately, it's not very realistic that
// everything can happen concurrently.

https://play.golang.org/p/RZjAYOUXtgo

// Here's a more complex use-case that doesn't assume
// all calls can go out at once.

https://play.golang.org/p/pKVDktQWCO0

// Here's a more complex use-case that doesn't assume
// all calls can go out at once.
// Now channel-generators have been added to allow
// Some of the processes to run concurrently.
// Unfortunately, it doesn't fail fast on errors.

https://play.golang.org/p/3F-xnztMhxj

// Here's a more complex use-case that doesn't assume
// all calls can go out at once.
// Now we are waiting for whichever channel returns first
// So on an error it will fail fast

https://play.golang.org/p/_LmnjayYw19

// Here's a more complex use-case that doesn't assume
// all calls can go out at once.
// Now it has channel generators and no errors

https://play.golang.org/p/ZkAUyCUCyQx

<!--more-->

![Go Things I Love](/go-things-i-love.png)

---

👋 Want to learn more about Go? [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about.

---




---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!

---

Things I want to talk about:
* Go's first-class support of channels in select statements and for loops.
* Read and write-only channels
* Channel generators
* Ordering channel responses
  * Unordered responses: https://play.golang.org/p/p_3YPw9LrgC
  * Ordered responses: https://play.golang.org/p/EkYf-YSsErW
  
