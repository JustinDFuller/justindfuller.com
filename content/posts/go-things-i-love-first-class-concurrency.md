---
author: "Justin Fuller"
date: 2019-12-27
linktitle: "Go Things I Love: First Class Concurrency"
menu:
  main:
    parent: posts
next: /posts/go-things-i-love-first-class-concurrency
title: "Go Things I Love: First Class Concurrency"
weight: 1
images:
  - /go-things-i-love.png
---

# Go Things I Love: First Class Concurrency

Things I want to talk about:
* Go's first class support of channels in select statements and for loops.
* Read and write only channels
* Channel generators
* Channel timeouts
  * Limiting to responses under 100ms: https://play.golang.org/p/XnBSfTeeCX7
* Ordering channel responses
  * Unordered responses: https://play.golang.org/p/p_3YPw9LrgC
  * Ordered responses: https://play.golang.org/p/EkYf-YSsErW

Concurrency, in some form, is one of the most important building blocks of performant software. For developers, depending on the programming language they choose, this can become either a point of pain or joy. Go, in my estimation, provides one of the most delightful ways to achieve concurrency. 

This post, _First Class Concurrency_, will demonstrate a few of the neat concurrency patterns in Go.

<!--more-->

![Go Things I Love](/go-things-i-love.png)

In order to get the most out of this post I suggest you familiarize yourself with the fundamentals of Go concurency, a great place to do that is [in the Go tour](https://tour.golang.org/concurrency/1). These patterns rely on goroutines and channels to accomplish their elegance.

## First Class

To be first class is to have full support and consideration in all things. For concurrency to be a first class citizen of Go, it must be a part of the language itself, not simply an API bolted on the side.

To demonstrate how concurrency is part of the language, see these type declarations:

```go
type (
	ReadOnly(<-chan int)
	WriteOnly(chan<- int)
	ReadAndWrite(chan int)
)
```

Notice the `chan` keyword in the function argument definitions. A `chan` is a channel. In Go, channels are a mechanism for goroutines to communicate. You'll run across a common phrase when working with go: "Do not communicate by sharing memory; instead, share memory by communicating." This means that, instead of multiple goroutines accessing the same variable or property, the goroutines should communicate changes through channels.

Here's an example of bad Go code that communicates by sharing memory.

```go
var ints []int
var wg sync.WaitGroup

for i := 0; i < 10; i++ {
  wg.Add(1)

  go func(i int) {
    defer wg.Done()
    ints = append(ints, i)
  }(i)
}

wg.Wait()

fmt.Printf("Ints %v", ints)
```

Yes, it technically works, but this is not the most idiomatic Go and it's not the safest way to write this program. In this example there are 11 goroutines with access to the `ints` slice (one running this functions, ten more spawned by the loop). In this simple example nothing bad happens but when the codebase grows to thousands or millions of lines of code there's no longer any guarantee that things will behave as expected.

Here's one idea of how to convert the bad example to idiomatic Go that communicates through channels.

```go
var ints []int
channel := make(chan int, 10)

for i := 0; i < 10; i++ {
  go WriteOnly(channel, i)
}

for i := range channel {
  ints = append(ints, i)

  if len(ints) == 10 {
    break
  }
}

fmt.Printf("Ints %v", ints)
```
