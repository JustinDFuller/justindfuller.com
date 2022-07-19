---
author: "Justin Fuller"
date: 2020-01-06
linktitle: "Go Things I Love: Channels and Goroutines"
menu:
  main:
    parent: posts
next: /posts/go-things-i-love-channels-and-goroutines
title: "Go Things I Love: Channels and Goroutines"
weight: 1
images:
  - /go-things-i-love.png
tags: [Code]
--- 

This series, _Go Things I Love_, is my attempt to show the parts of Go that I like the best, as well as why I love working with it at [The New York Times](https://open.nytimes.com).

In my last post [Go Things I Love: Methods On Any Type](/2019/12/go-things-i-love-methods-on-any-type/), I demonstrated a feature of Go that makes it easy to build Object-Oriented software.

This post, _Channels and Goroutines_, will demonstrate a few neat concurrency patterns in Go.

<!--more-->

First: to get the most out of this post you should familiarize yourself with the fundamentals of Go concurrency. A great place to do that is [in the Go tour](https://tour.golang.org/concurrency/1). These patterns rely on goroutines and channels to accomplish their elegance.

Concurrency, in some form, is one of the most important building blocks of performant software. That's why it's important to pick a programming language with first-class concurrency support. Because Go, in my estimation, provides one of the most delightful ways to achieve concurrency, I believe it is a solid choice for any project that involves concurrency.

## First Class

To be first-class is to have full support and consideration in all things. That means, to be first-class, concurrency must be a part of the Go language itself. It cannot be a library bolted on the side.

A few type declarations will begin to show how concurrency is built into the language.

```go
type (
    WriteOnly(chan<- int)
    ReadOnly(<-chan int)
    ReadAndWrite(chan int)
)
```

Notice the `chan` keyword in the function argument definitions. A `chan` is a channel. 

Next comes the arrow `<-` that shows which way the data flow to or from the channel. The `WriteOnly` function receives a channel that can only be written to. The `ReadOnly` function receives a channel that can only be read from. 

Being able to declare the flow of the data to a channel is an important way in which channels are first-class members of the Go programming language. Channel flow is important because it's how goroutines communicate. 

It's directly related to this phrase you might have seen before:

> Do not communicate by sharing memory; instead, share memory by communicating.

The phrase, "share memory by communicating", means goroutines should communicate changes through channels; they provide a safer, idiomatic way to share memory.

## Communicating by sharing memory (👎)

Here's an example of Go code that communicates by sharing memory.

```go
func IntAppender() {
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
}
```

`IntAppender` creates a goroutine for each integer that is appended to the array. Even though it's a little too trivial to be realistic, it still serves an important demonstrative purpose. 

In `IntAppender` each goroutine shares the same memory—the `ints` array—which it appends integers to.

This code communicates by sharing memory. Yes, it seems like works (only if you run it on the go playground)—but it's not idiomatic Go. More importantly, it's not a safe way to write this program because it doesn't always give the expected results (again, unless you run it on the go playground).

It's not safe because there are 11 goroutines (one running the main function and ten more spawned by the loop) with access to the `ints` slice.

This pattern provides no guarantee that the program will behave as expected; anything can happen when memory is shared broadly.

## Share memory by communicating (👍)

The first sign that this example is not following "share memory by communicating" is the use of `sync.WaitGroup`. Even though I consider WaitGroups to be a code smell, I'm not ready to claim they are always bad. Either way, code is usually safer with a channel.

Let's convert the bad example to idiomatic Go by replacing the `WaitGroup` with a channel.

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

Now, only one goroutine can modify the `ints` slice while the rest communicate through a channel. They're sharing memory by communicating through a channel instead of modifying shared memory.

The example here shows two important ways that concurrency (goroutines and channels) are first-class citizens of the Go programming language. First, we used a write-only channel argument. This guaranteed that the method won't accidentally read from the channel, unexpectedly altering the functionality. Second, we see that the `for range` loop works on channels.

These are just a few ways that Go makes concurrency a first-class citizen. Next, let's see what we can accomplish with goroutines and channels.

## Timeout

To demonstrate a timeout, we will construct a simple news UI backend that fetches results from three [New York Times endpoints](https://developer.nytimes.com/). Even though the NYT endpoints respond very quickly, this won't quite meet our standards. Our program must always respond within 80 milliseconds. Because of this restriction, we're only going to use NYT endpoint responses that come fast enough.

Here are the URLs that the program will fetch from:

```go
var urls = [...]string{
    "https://api.nytimes.com/svc/topstories/v2/home.json",
    "https://api.nytimes.com/svc/mostpopular/v2/viewed/1.json",
    "https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json",
}
```

The URLs have been declared as an array of strings, which will allow them to be iterated. 

Another neat feature of Go is how you can declare `const` blocks. Like this:

```go
const (
    urlTopStories              = "https://api.nytimes.com/svc/topstories/v2/home.json"
    urlMostPopular             = "https://api.nytimes.com/svc/mostpopular/v2/viewed/1.json"
    urlHardcoverFictionReviews = "https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json"
)
```

Now, the `urls` array can be more expressive by using the const declarations.

```go
var urls = [...]string{
    urlTopStories,
    urlMostPopular,
    urlHardcoverFictionReviews,
}
```

The URLs are for top stories, most popular stories, and the current hardcover fiction reviews. 

Instead of a real `http.Get` I will substitute a fake `fetch` function. This will provide a clearer demonstration of the timeout.

```go
func fetch(url string, channel chan<- string) {
    source := rand.NewSource(time.Now().UnixNano())
    random := rand.New(source)
    duration := time.Duration(random.Intn(150)) * time.Millisecond
    time.Sleep(duration)
    channel <- url
}
```

This is a common pattern in Go demonstration code—generate a random number, sleep the goroutine for the randomly generated duration, then do some work. To fully understand why this code is being used to demonstrate a fake `http.Get`, the next sections will step through each line, explaining what it does.

### Deterministic Randomness (See: oxymorons)

In Go, the random number generator is, by default, deterministic.

> In mathematics, computer science and physics, a deterministic system is a system in which no randomness is involved in the development of future states of the system. - [The Encyclopedia of Science](https://www.daviddarling.info/encyclopedia/D/deterministic_system.html)

This means that we have to seed the randomizer with something that changes; if not, the randomizer will always produce the same value. So we create a source, typically based on the current time. 

```go
source := rand.NewSource(time.Now().UnixNano())
```

After the source is created, it can be used to create a random number generator. We must create the source and random generator each time. Otherwise, it will continue to return the same number.

```go
random := rand.New(source)
```

Once the generator is created, it can be used to create a random number between 0 and 150. That random number is converted to a `time.Duration` type, then multiplied to become milliseconds.

```go
duration := time.Duration(random.Intn(150)) * time.Millisecond
```

One further note about the randomness is needed. It will always return the same value in the go playground because the go playground always starts running with the same timestamp. So, if you plug this into the playground, you'll always receive the same result. If you want to see the timeout in action, just replace 150 with some number below 80.

### Another send-only channel

At the very bottom of `fetch` are the two lines that we care about.

```go
time.Sleep(duration)
channel <- url
```

The first line tells the goroutine to sleep for the specified duration. This will make some responses take too long for the given URL, later causing the API to respond without the results of that URL.

Finally, the URL is sent to the channel. In a real `fetch` it would be expected that the actual response is sent to the channel. For our purposes, it's just the URL.

### A read-only channel

Since the `fetch` function funnels results in the channel, it makes sense to have a corresponding function funnel results from the channel into a slice of strings.

Take a look at the function. Next, we'll break it down line-by-line.

```go
func stringSliceFromChannel(maxLength int, input <-chan string) []string {
    var results []string
    timeout := time.After(time.Duration(80) * time.Millisecond)

    for {
        select {
        case str := <-input:
            results = append(results, str)

            if len(results) == maxLength {
                fmt.Println("Got all results")
                return results
            }
        case <-timeout:
            fmt.Println("Timeout!")
            return results
        }
    }
}
```

First, look at the function argument declaration.

```go
func stringSliceFromChannel(maxLength int, input <-chan string) []string {
```

The `stringSliceFromChannel` function declares that it will accept a read-only channel, `channel <-chan string`. This indicates that the function will convert the channel's inputs into a different type of output—a slice of strings, or `[]string`. 

Even though it's valid to declare a function argument with, `channel chan string`, opting for the arrow `<-` operator makes the function's intent clearer. This can be particularly helpful in a long function.

Next, the timeout is created. 

```go
timeout := time.After(time.Duration(80) * time.Millisecond)
```

The function `time.After` returns a channel. After the given `time.Duration` it will write to the channel (_what_ it writes doesn't matter).

Moving on, the `timeout` and `input` channels are used together in a `for select` loop. 

The `for` loop with no other arguments will loop forever until stopped by a `break` or `return`. 

The `select` acts as a `switch` statement for channels. The first `case` block to have a channel ready will execute. 

By combining the `for` and `select`, this block of code will run until the desired number of results is retrieved or until the timeout happens.

Take a look at the case block for the `input` channel.

```go
case str := <-input:
    results = append(results, str)
    
    if len(results) == maxLength {
        fmt.Println("Got all results")
        return results
    }
```

The output of the channel is assigned to a variable, `str`. Next, `str` is appended to the results array. The results array is returned if it is the desired length.

Now, look at the case block for the `timeout` channel.

```go
case <-timeout:
    fmt.Println("Timeout!")
    return results
```

Whatever results are available, even if there are none, will be returned when the timeout happens.

---

👋 Want to learn more about Go? [Subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to get an update, once-per-month, about what I'm writing about.

---

## The Main Function

Now there is both a channel writer and a channel reader. Let's see how to put it all together in the `main` function.

```go
func main() {
    channel := make(chan string)
    for _, url := range urls {
        go fetch(url, channel)
    }

    results := stringSliceFromChannel(len(urls), channel)

    fmt.Printf("Results: %v\n", results)
}
```

First, a channel is created to collect the fetch results, `channel := make(chan string)`.

Next, the `urls` are looped over, creating a goroutine to fetch each url. 

```go
for _, url := range urls {
    go fetch(url, channel)
}
```

This allows the fetching to happen concurrently.

After the fetches have been kicked off, `stringSliceFromChannel` will block until either the results are in or the timeout occurs.

```go
results := stringSliceFromChannel(len(urls), channel)
```

Finally, we can print the results to see which URLs are returned. If you run this code in the [Go Playground](https://play.golang.org/p/g3RnP9A26v5), remember to change the timeout number since the random number generator will always return the same results.

## Caveats

It could seem like I'm suggesting that you should always use channels instead of waitgroups or mutexes. I'm not. Each tool is designed for a specific use case, [and each has a tradeoff](https://github.com/golang/go/wiki/MutexOrChannel). Instead of walking away from this post thinking, "I should always use channels, they're so much better than anything else." I hope you will simply consider if you can improve the clarity of your program with a channel, rather than sharing memory. If not, don't use them.

## Final Thoughts

Here's the cool thing. We started out talking about how Go has first-class concurrency support with goroutines and channels. Then we saw how easy it is to implement a complex concurrent pattern, a timeout, with a single channel and a few goroutines. Over my next few posts, I hope to show that this was only scratching the surface of what one can do with concurrency in Go. I hope you'll check back in. (Better yet, [subscribe to my newsletter](https://justindfuller.us4.list-manage.com/subscribe?u=d48d0debd8d0bce3b77572097&id=0c1e610cac) to be updated each month about my new posts)

Finally, even though this is a neat concurrency pattern, it's unrealistic. As an exercise you could open the [Go Playground](https://play.golang.org/p/g3RnP9A26v5) to see if you can implement these scenarios:

* The results should be returned as a JSON object. Maybe we could use a struct instead of an array of URLs?
* A blank page is useless, the code should at least wait until there is one result to display.
* The [context](https://golang.org/pkg/context/) type is often used with http handlers. Can you replace the `time.After` with an expiring context?

---

Hi, I’m Justin Fuller. Thanks for reading my post. Before you go, I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
