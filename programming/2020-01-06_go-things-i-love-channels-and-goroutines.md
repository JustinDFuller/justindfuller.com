---
title: "Go Things I Love: Channels and Goroutines"
subtitle: ""
date: 2020-01-06
draft: false
tags: [Code]
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
