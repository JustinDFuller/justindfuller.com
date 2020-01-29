---
author: "Justin Fuller"
date: 2020-02-03
linktitle: "Comparing Concurrency Patterns in Go"
menu:
  main:
    parent: posts
next: /posts/comparing-concurrency-patterns-in-go
title: "Comparing Concurrency Patterns in Go"
weight: 1
draft: true
images:
  - /go-things-i-love.png
---

There are many ways to organize concurrent programs in Go. In my last post, [Channels and Goroutines](/2020/01/go-things-i-love-channels-and-goroutines/), I discussed how channels and goroutines can be used to safely write concurrent programs. Those aren't the only options, though. This post will compare channels, goroutines, waitgroups, errorgroups, channel generators, and more.

<!--more-->

![Go Things I Love](/go-things-i-love.png)

## Starting Synchronous

To explore these concepts, I want to start small and build up to the fully concurrent version. In this way, we will clearly see the decisions that led from synchronous to concurrent code.

The example scenario is a common one: user creation. Really, it could be substitued for any entity creation. However, I want to show it in the context of a more fully-functioning production application. This means that, instead of just creating the user in the database, there will be some analytics data saved and a new user email will be scheduled; there will also be some error handling.

Here's the initial snippet.

```go
func (service *Service) CreateUser(user *User) error {
	err := service.AnalyticsClient.Put(AnalyticsTypeUserSignup, AnalyticsStateUserSignupStarted, user.Email)
	if err != nil {
		return err
	}

	err = service.DatabaseClient.Put(DatabaseTableUsers, user.Email, user)
	if err != nil {
		return err
	}

	err = service.EventScheduler.Schedule(EmailTemplateNewUserSignup, user.Email, user)
	if err != nil {
		return err
	}

	return nil
}
```

[See it in the Go Playground.](https://play.golang.org/p/v2QKP3Q1bIC)

Hopefully this code looks like something you could imagine seeing in a user registration service. It does some straightforward work. First, it saves analytics data and the new user to the database, then it schedules a new user welcome email.

So, what's the problem?

Well, in our imaginary scenario, this particular registration endpoint is used because the shopping cart checkout forces users to create an account. The route used to respond very quickly, before we started collecting analytics and sending the emails. Now it responds several hundred milliseconds slower, [significantly lowering the conversion rate](https://www.fastcompany.com/1825005/how-one-second-could-cost-amazon-16-billion-sales).

__The Comparison Checklist:__

To compare the different concurrency patterns, this checklist will show how each pattern stacks up against the others. The ideal pattern would check every box.

- [ ] Executes in 300ms.
- [x] No or little concurrency cleanup required/no complicated waiting logic.
- [x] Fails immediately on the first error.
- [ ] Fails in 200ms on error (fastest possible error, see later examples).

This non-concurrent example meets two out of four criteria. Yes, it has no cleanup for concurrent operations and it does fail as soon as an error occured. Unfortunately, since it does each operation serially, it takes much longer than 300ms to complete, and it takes more than 200ms to exit on database failures because it doesn't start executing that function until after 100ms.

Now, let's see if we can speed it up.

## Add a little concurrency

The dead-simplest way to achieve concurrency is with a waitgroup. We can keep all the original code, wrap the execution in a [IIFE](https://en.wikipedia.org/wiki/Immediately_invoked_function_expression), and launch each part as a goroutine.

A [sync.WaitGroup](https://golang.org/pkg/sync/#WaitGroup) works by keeping a counter of operations that are still waiting to complete. For each operation, the counter is incremented by one. To execute concurrently, each operation is kicked off by a new goroutine. As an operation completes, `wg.Done()` is called, decrementing the counter. The function `wg.Wait()` will block until the counter reaches zero.

```go
func (service *Service) CreateUser(user *User) error {
	var wg sync.WaitGroup
	var userError error

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := service.AnalyticsClient.Put(AnalyticsTypeUserSignup, AnalyticsStateUserSignupStarted, user.Email)
		if err != nil {
			userError = err
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := service.DatabaseClient.Put(DatabaseTableUsers, user.Email, user)
		if err != nil {
			userError = err
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		err := service.EventScheduler.Schedule(EmailTemplateNewUserSignup, user.Email, user)
		if err != nil {
			userError = err
		}
	}()

	wg.Wait()

	return userError
}
```

[See it in the Go Playground.](https://play.golang.org/p/BgLqfb2d_pm)

A few things just happened. Yes, the snippet got longer, but it now runs in less than half the time! If you opened it up in the playground you saw that the program now runs in just 300ms. That's less than half of the last version, which clocked in at about 700ms. If we stopped here our conversion rate would go back to normal and everyone would be happy.

Well, maybe not everyone. What happens when an error occurs? Does this method fail-fast and quickly get an error response to the user? What about the memory sharing? Each goroutine is modifying `userError`, that can't be the best way to do it, right?

__The Comparison Checklist:__
- [x] Executes in 300ms.
- [x] No or little concurrency cleanup required/no complicated waiting logic.
- [ ] Fails immediately on the first error.
- [ ] Fails in 200ms on error (fastest possible error, see later examples).

This example still only checks two out of four of the comparison criteria, although it does check what is arguably the most important checkbox, "Executes in 300ms". Unfortunately, this example does not fail fast on errors. In fact, it will execute all goroutines regardless of errors.

Clearly, we've improved the execution speed, but the overall execution and the code itself may still have room for improvement.

## What happens when there is an error

Up until this point the code for `AnalyticsClient`, `DatabaseClient`, and `EventScheduler` has not been shown (unless you opened up the go playground). Unsurprisingly, the methods on these structs are only example code; they print the arguments, sleep the goroutine, then return `nil` or an error.

To show what happens when an error occurs, one of the methods can be altered to return an error instead of `nil`.

```go
func (ac *DatabaseClient) Put(table, key string, data interface{}) error {
	fmt.Printf("Saving database data to table %s with key %s. \n", table, key)
	time.Sleep(time.Duration(200) * time.Millisecond)
	return errors.New("Oops, we could have stopped after 200ms")
}
```

Instead of returning as soon as an error occurs, the error group waits for all goroutines to complete. Even though this is fine for many scenarios, it doesn't work for the user registration scenario that is being explored in this post. Since we want the user to get through registration as quickly as possible, it's crucial that errors are shown as quickly as possible, so that the User can address them (or retry) and move on. Otherwise, we'll lose sales.

```
Scheduling event for email NewUserSignupEmail with key johnny@example.com. 
Saving analytics data to table AttemptedUserSignups with key johnny@example.com. 
Saving database data to table Users with key johnny@example.com. 
Oops, we could have stopped after 200ms
Took 300ms
```

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
  
