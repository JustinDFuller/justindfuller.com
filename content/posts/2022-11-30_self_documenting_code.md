---
author: "Justin Fuller"
date: 2022-11-30
linktitle: "Self-Documenting Code"
menu:
  main:
    parent: posts
next: /posts/self-documenting-code
title: "Self-Documenting Code"
weight: 1
images:
 - /self-documenting-code.png
tags: [Code]
---

At my first real Software Engineering job, the lead engineer taught me code should be self-documenting. In practice, this meant we did not document our code.

<!--more-->

If you need to write a comment, he said, that indicates a need for clearer naming or structure.

I took this advice with me for many years. Instead of documenting my code, I focused on writing clear code with
well-named functions and variables.

However, I've come to realize this isn't enough. There are some ways code can never be self-documenting.

I now follow this principle:

> **Assume engineers are competent but lack context.**

In other words, assume the engineer can understand your code when you take the time to name variables and functions properly.
But they don't know *why* you needed to write this code.

#### Why Assume Competency?

If your experience is anything like mine, you work with a lot of *really* excellent engineers.

I have pretty high confidence, on any given team I've worked on, most of the engineers understand the code
just as well as I do, if not better.

In the few cases where an engineer can't understand the code, there are still resources. 
First, I've never worked on a team where a more experienced engineer wouldn't be willing to explain confusing code. 
Second, if you are using a well-documented language like Go, there are many resources to help the engineer to learn.

#### Why Not Context?

Conversely, if your experience is anything like mine, you've experience a lot of turnover on your team or
re-orgs moving people around.

Having an engineer on a team for multiple years is somewhat rare in my experience. Having a full team stick together
for a long time is almost unheard of.

That's why I don't assume engineers have context. At any given time, half the team may be highly-skilled engineers
who are brand new to the team.

### Types of Information

I believe there are two types of information we want to share about code. 
One category can be understood by simply reading the code.
The other cannot.

#### What is self-documentable?

* The type of a variable
* The logical concept a type or function operates on
* The process by which code completes its task

#### What is not self-documentable?

* Why you needed to write this particular line of code
* Examples of the data it operates on (not the type but individual instances)

### Example

Let's look at an example of some code with a few different types of comments associated with it.

#### Self-Documenting

Here's the first example which attempts to be self-documenting:

```go
func (allABTests ABTests) MarshalJSON() ([]byte, error) {
  var usedABTests []ABTest

  for _, test := range allABTests {
    if test.Used {
      usedABTests = append(usedABTests, test)
    }
  }

  return json.Marshal(usedABTests)
}
```

Here are somethings we can learn from reading the code:

1. This method allows the `ABTests` type to implement the [json.Marshaler](https://pkg.go.dev/encoding/json#Marshaler) interface. That means this method will run whenever we turn this object into JSON.
2. This method loops over All AB Tests, building up an array of only the `Used` AB Tests, and ultimately only Marshals the used tests to JSON.

Here are some things we can't learn from reading the code:

1. Why do we need to do this?
2. On average, do we expect to have mostly used or unused tests?
3. When will this be used?

#### Unhelpful Comments

Now, here's the same code with some *unhelpful* comments added.

```go
// MarshalJSON marshals ABTests to JSON as a slice of bytes.
// It returns an error when it can't marshal ABTests to JSON.
func (allABTests ABTests) MarshalJSON() ([]byte, error) {
  var usedABTests []ABTest

  // Loop over all AB tests
  for _, test := range allABTests {
    // If the test is used, add it to the used tests array
    if test.Used {
      usedABTests = append(usedABTests, test)
    }
  }

  // Only Marshal the used tests to JSON
  return json.Marshal(usedABTests)
}
```

Now, assuming the engineer reading this code is competent in the Go programming language, there's nothing new
to be learned from these comments.

They simply explain what the code is doing. We could learn exactly the same information just by reading the code.

### Explain the *why*

Finally, here's how I believe code like this should be commented:

```go
// MarshalJSON provides a custom JSON marshaler to keep unused AB Tests out of our API response.
// On average, we have 1000 AB tests, but this system only ever targets messages to a few of them at a time.
// If we do not remove the extraneous AB tests, we end up with an API response ~20kb, much larger than necessary.
// The extraneous tests also makes it difficult to debug which AB Tests are applicable to a given API response.
func (allABTests ABTests) MarshalJSON() ([]byte, error) {
  var usedABTests []ABTest

  for _, test := range allABTests {
    // Whenever an AB test is used to target a message, it gets marked Used = true.
    // This happens at the message filtering step.
    if test.Used {
      usedABTests = append(usedABTests, test)
    }
  }

  return json.Marshal(usedABTests)
}
```

In my opinion, we finally can understand *why* someone would write this code: 
there are a TON of AB tests and we only care about, maybe, 3 of them at a time.
If we don't remove them from the API response, we get a giant (for this API) response of ~20kb.

We can also learn where this `Used` value comes from. Maybe we don't know about the "filtering" step yet, but
if we are debugging something, we at least have a lead on where to look next!

### Exceptions

There are exceptions to every rule. Here are some I can think of:

* When your programming language is not well-documented or you *know* the readers of your code aren't familiar with it.
* When you are using an API that is either obscure or poorly documented.
* When you are writing a very complex bit of code that cannot be simplified

There are likely many others! But, as a general rule, I believe the following principles stand:

1. Assume a competent engineer who lacks context.
2. Explain they *why* not the *what*.
3. Give examples and information that cannot be derived from variable names or types.

