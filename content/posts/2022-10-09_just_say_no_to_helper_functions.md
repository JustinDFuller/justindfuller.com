---
author: "Justin Fuller"
date: 2022-10-10
linktitle: "Just Say No To Helper Functions"
menu:
  main:
    parent: posts
next: /posts/just-say-no-to-helper-functions
title: "Just Say No To Helper Functions"
weight: 1
images:
 - /just_say_no_to_helper_functions.png
tags: [Code]
draft: true
---

I wake up in the morning. The sun is bright, the air is warm. The day is Saturday. What do I do? Of course, I settle down with my laptop to write some code.

I'm just waking up so I need to start simple to get the ol' synapses firing. 

<!--more-->

I open LeetCode to find a practice problem. Despite my ten years of experience, I fail to comprehend all but the easiest problems. Instead of questioning my life and career choices, I choose a simple "Two Sum" problem.

The prompt says, "given a set of integers, I must determine if any two of them sum to a third integer, `n`."

It's a pretty easy prompt. Several dozen attempts later I have a solution that seems to work:

```go
func TwoSum(ints []int, want int) (int, int) {
  seen := map[int]bool{}

  for _, i := range ints {
    diff := want - i
    if seen[diff] {
      return i, diff
    }
    seen[i] = true
  }

  return -1, -1
}
`````

I just wrote a function. It works, it is fast, it seems correct, it has clear variable names and simple formatting.

Am I done?

No?

Oh, I suppose I should refactor. I need to make the code _modular_ and _extensible_. How do I do that? I suppose I can refactor it into a few helper functions.

```go
func newSeenMap() map[int]bool {
  return map[int]bool{}
}

func diff(want, got int) int {
  return want - got
}

func has(m map[int]bool, i int) bool {
  return m[i]
}

func TwoSum(ints []int, want int) (int, int) {
  seen := newSeenMap()

  for _, i := range ints {
    d := diff(want, i)
    if has(seen, d) {
      return i, d
    }
    seen[i] = true
  }

  return -1, -1
}
```

There. I refactored my code. For each of my main operations I created a helper function.

Did I make the code better?

I don't think so.

Now, instead of one function to understand, I have to read and understand four functions. I hope they are all in the same file. If not? Then I have to search through multiple files just to find the same logic that previously lived in one. 

Maybe the problem is that I did not rewrite it in an _Object Oriented_ manner?

I will give it a shot.

```go
type differ struct {
  seen map[int]bool
}

func newDiffer() differ {
  return differ{
    seen: map[int]bool{},
  }
}

func (d differ) has(want, got int) bool {
  return d.seen[want-got]
}

func (d differ) get(want, got int) int {
  return want - got
}

func (d differ) add(i int) {
  d.seen[i] = true
}

func TwoSum(ints []int, want int) (int, int) {
  diff := newDiffer()

  for _, i := range ints {
    if diff.has(want, i) {
      return i, diff.get(want, i)
    }
    diff.add(i)
  }

  return -1, -1
}
```

Ah, there we go. Object Oriented. My system architect would be proud.

Still, I wonder if I actually made anything better.

Does the code have a capability it did not have before? Does the code satisfy a new use-case? Is it more performant?

One reason I can think of is *readability*. Unfortunately, this reason is completely subjective. Some readers will find it easier; some will find it harder.

How about this reason: ease of change. Again, unfortunately, I have no idea how this function will change in the future. I have no idea if this will make it easier or harder to change.

What about re-use? The new functions are only used once each, so there is no re-use value obtained. Maybe there will be re-use in the future. Maybe not.

But, what if this was a repetitive function?

Here's a pretend function that builds up a string in some imaginary, proprietary format.

```go
func format(data map[string]string) string {
  var output string

  if s := data["foo"]; s != "" {
    output += "foo=" + s + ";"
  }

  if s := data["bar"]; s != "" {
    output += "bar=" + s + ";"
  }

  if s := data["baz"]; s != "" {
    output += "baz=" + s + ";"
  }

  if s := data["thud"]; s != "" {
    output += "thud=" + s + ";"
  }

  return output
}
```

What if I refactor this function to use a helper? I will reuse that function many times. If I need to make a change, I will only do it in one place.

```go
func formatKeyVal(key, val string) string {
  return key + "=" + val + ";"
}

func format(data map[string]string) string {
  var output string

  if s := data["foo"]; s != "" {
    output += formatKeyVal("foo", s)
  }

  if s := data["bar"]; s != "" {
    output += formatKeyVal("bar", s)
  }

  if s := data["baz"]; s != "" {
    output += formatKeyVal("baz", s)
  }

  if s := data["thud"]; s != "" {
    output += formatKeyVal("thud", s)
  }

  return output
}
```

Ah, look at that. I replaced all that repetition with a helper function.

What? You say I now have more repetition? On second inspection, I do see the helper method's name is longer than the original code.

Oops.

But if I have a change, I only have to make it in one place.

In fact, I just got a message from my project manager. They want me to make a change. Now I can show off the cleverness of this implementation.

Oh, the change is an exception. For a specific field, we have to handle it differently. 

```diff
func formatKeyVal(key, val string) string {
+ if key == "BLAH" {
+   return strings.ToLower(key) + ":" + val + ";"
+ }
  return key + "=" + val + ";"
}

func format(data map[string]string) string {
  var output string

  if s := data["foo"]; s != "" {
    output += formatKeyVal("foo", s)
  }

  if s := data["bar"]; s != "" {
    output += formatKeyVal("bar", s)
  }

  if s := data["baz"]; s != "" {
    output += formatKeyVal("baz", s)
  }

  if s := data["thud"]; s != "" {
    output += formatKeyVal("thud", s)
  }

+ if s := data["BLAH"]; s != "" {
+   output += formatKeyVal("BLAH", s)
+ }

  return output
}
```

Now, you might rightly argue against such a change if someone asked you to make it. 

Even so, it turns out I was working on an unstated assumption. I assumed that each case would change in the same way. It turns out, reality did not align with my assumption. 

I am starting to think all my changes are only making things worse.

But I wonder, where does it end? Do I never create an abstraction, dooming myself to copy and paste coding for all eternity?

Well, what is so bad about that? I may have to make a change in multiple places, but my editor has powerful find and replace tools.

Still, there could be some general rules to help me out.

* I know about the [Rule of Three](https://en.m.wikipedia.org/wiki/Rule_of_three_(computer_programming)), which states I should only abstract after three identical use-cases.

* I'm reminded of [Domain-Driven Design](https://en.wikipedia.org/wiki/Domain-driven_design). Perhaps an abstraction is safer if it reflects the business domain.

* I can also identify cases where logic *must* change in sync. This is different than when we think or suspect things will change together. Instead, these are cases where logic absolutely must change together.

* There is also a mindset shift I can apply to myself. When I write helper methods, I am attempting to ease the burden of _writing_ code. However, in my experience, the real toil and burden belongs to the reading and understanding of code. I should optimize for that, instead.

* I can think of one more principle to apply. I believe it is the most important: I should write code for the current reality. I should not try to anticipate the future. I should not code for "what if" scenarios. 

I believe this will result in relentlessly simple code.

---

* Just say no to helper functions 
* Apply the rule of three
* Optimize for reading instead of writing code
* Code against reality
* Be relentlessly simple
