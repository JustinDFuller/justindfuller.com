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

Concurrency, in some form, is one of the most important building blocks of performant software. For developers, depending on the programming language they choose, this can become either a point of pain or joy. Go, in my estimation, provides one of the most delightful ways to achieve concurrency. 

This post, _First Class Concurrency_, will demonstrate a few of the neat concurrency patterns in Go.

<!--more-->

![Go Things I Love](/go-things-i-love.png)

To get the most out of this post you should familiarize yourself with the fundamentals of Go concurency. A great place to do that is [in the Go tour](https://tour.golang.org/concurrency/1). These patterns rely on goroutines and channels to accomplish their elegance.

## First Class

To be first class is to have full support and consideration in all things. For concurrency to be a first class citizen of Go, it must be a part of the language itself, not an API bolted on the side.

A few type declarations will serve to show how concurrency is built in to the language itself.

```go
type (
	WriteOnly(chan<- int)
	ReadOnly(<-chan int)
	ReadAndWrite(chan int)
)
```

Notice the `chan` keyword in the function argument definitions. A `chan` is a channel. 

Next comes the arrow `<-` that shows which way the data flows in relation to the channel. The `WriteOnly` function receives a channel that can only be written to. The `ReadOnly` function receives a channel that can only be read from. Being able to declare the flow of the data in relation to a channel is an important way in which channels are first-class members of the Go programming language.

In Go, channels are a mechanism for goroutines to communicate. You'll run across a common phrase when working with go:

> Do not communicate by sharing memory; instead, share memory by communicating.

This means that goroutines should communicate changes through channels. In Go, channels are a safer and idiomatic way to share memory.

## Communicating by sharing memory

Here's an example of Go code that communicates by sharing memory.

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
```

This piece of code creates a goroutine for each integer that is appended to the array. It's trivial and not realistic but it serves an important demonstrative purpose.

Each goroutine shares memory, the `ints` array, then appends an integer to it.

Clearly this code communicates by sharing memory, it does not share memory by communicating.

Yes it works but this is not the most idiomatic Go and it's not the safest way to write this program. In this example there are 11 goroutines with access to the `ints` slice (one running this functions, ten more spawned by the loop). 

What happens when the codebase grows to thousands or millions of lines of code? There's no longer any guarantee that things will behave as expected if many functions and goroutines are sharing memory.

# Share memory by communicating

The first sign that this code is not sharing memory by communicating is the use of `sync.WaitGroup`. To be clear, WaitGroups are not always bad, however they may indicate a code smell that your code _could_ instead use a channel.

Here's one idea of how to convert the bad example to idiomatic Go: replace the `WaitGroup` with a channel.

```go
// WriteOnly serves the purpose of demonstrating
// a method that writes to a write-only channel.
func WriteOnly(channel chan<-int, order int) {
	channel <- order
}

func main() {
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
}
```

[See this example in the Go playground.](https://play.golang.org/p/gi8zyZH7KMd)

Now, only one goroutine can modify the `ints` slice. Each goroutine communicates through a channel. They're sharing memory by communicating through a channel, instead of modifying shared memory.

The example here shows two important ways that concurrency (goroutines and channels) are first class citizens of the Go programming language. First, we used a write-only channel argument. This guaranteed that the method won't accidentally read from the channel, altering the functionality in an unexpected way. Second, we see that the `for range` loop works on channels.

These are just a few ways that Go makes concurrency a first class citizen. Next, let's see what we can accomplish with goroutines and channels.

## Timeout

One of the best ways to demonstrate the power of goroutines and channels is with a simple Go program that fetches results from three [New York Times endpoints](https://developer.nytimes.com/). One can imagine that the endpoint provides data for a news UI. Generally, the NYT API responds very quickly. However, it's vital that our page responds as quickly as possible. So, for this reason, we're going to serve whichever responses come within 80 milliseconds.

Here are the URLs that we'll be fetching from:

```go
var urls = [...]string{
	"https://api.nytimes.com/svc/topstories/v2/home.json",
	"https://api.nytimes.com/svc/mostpopular/v2/viewed/1.json",
	"https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json",
}
```

They've been declared as an array of strings, this will allow them to be iterated. Another neat feature of Go is how you can declare `const` blocks. Like this:

```go
const (
	urlTopStories              = "https://api.nytimes.com/svc/topstories/v2/home.json"
	urlMostPopular             = "https://api.nytimes.com/svc/mostpopular/v2/viewed/1.json"
	urlHardcoverFictionReviews = "https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json"
)
```

Now the `urls` array can be more expressive by using the const declarations.

```go
var urls = [...]string{
	urlTopStories,
	urlMostPopular,
	urlHardcoverFictionReviews,
}
```

Clearly, the urls are for top stories, most popular stories, and the current hardcover fiction reviews. 

Instead of a real `http.Get` I will substitute a fake `Fetch` function. This will provide a clearer demonstration of the timeout.

```go
func fetch(url string, channel chan<- string) {
	source := rand.NewSource(time.Now().UnixNano())
	random := rand.New(source)
	duration := time.Duration(random.Intn(150)) * time.Millisecond
	time.Sleep(duration)
	channel <- url
}
```

There's already several concepts to unpack in this helper function and we haven't even gotten to the main body yet. 

### Deterministic Randomness (See: oxymorons)

In Go, the random number generator is, by default, determinstic.

> In mathematics, computer science and physics, a deterministic system is a system in which no randomness is involved in the development of future states of the system. - [The Encyclopedia of Science](https://www.daviddarling.info/encyclopedia/D/deterministic_system.html)

This means that we have to seed the randomizer with something that changes; if not, the randomizer will always produce the same value. So we create a source, typically based on the current time. 

```go
source := rand.NewSource(time.Now().UnixNano())
```

Once the source is created, we can use it create a random number generator. We must create the source and random generator each time, otherwise it will continue to return the same number.

```go
random := rand.New(source)
```

Once the generator is created, it can be used to create a random number between 0 and 150. Then that random number is converted to a `time.Duration` type, and multiplied to become milliseconds.

```go
duration := time.Duration(random.Intn(150)) * time.Millisecond
```

One further note about the randomness is needed. It will always return the same value in the go playground because the go playground always starts running with the same timestamp. So, if you plug this into the playground, you'll always receive the same result. If you want to see the timeout in action, just replace 150 with some number below 80.

### Another send-only channel

At the very bottom of `fetch` are the two lines that we actually care about.

```go
time.Sleep(duration)
channel <- url
```

The first line tells the goroutine to sleep for the specified duration. This will make some responses take too long for the given URL, later causing the API to respond without the results of that url.

Finally, the url is sent to the channel. In a real `fetch` it would be expected that the actual response is sent to the channel; for our purposes, it's just the url.

## The Main Function

This `Fetch` will respond with a string (the url) some time between 0 and 150 milliseconds after it's called. This function is intended to mock the results of an actual API, which could have response times varying from 60-150ms.

Now, the main program:

```go
func main() {
	start := time.Now()

	channel := make(chan string)
	for _, url := range urls {
		go Fetch(url, channel)
	}

	var results []string
	timeout := time.After(time.Duration(80) * time.Millisecond)

Loop:
	for {
		select {
		case url := <-channel:
			results = append(results, url)

			if len(results) == len(urls) {
				fmt.Println("Got all results")
				break Loop
			}
		case <-timeout:
			fmt.Println("Timeout!")
			break Loop
		}
	}

	fmt.Printf("Took %s\n", time.Now().Sub(start))
	fmt.Printf("Results: %v\n", results)
}
```

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!

---

Things I want to talk about:
* Go's first class support of channels in select statements and for loops.
* Read and write only channels
* Channel generators
* Channel timeouts
  * Limiting to responses under 100ms: https://play.golang.org/p/XnBSfTeeCX7
* Ordering channel responses
  * Unordered responses: https://play.golang.org/p/p_3YPw9LrgC
  * Ordered responses: https://play.golang.org/p/EkYf-YSsErW

