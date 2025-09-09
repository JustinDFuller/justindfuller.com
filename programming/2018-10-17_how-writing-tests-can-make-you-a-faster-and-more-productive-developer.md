---
title: "Writing tests can make you a faster, more productive developer"
subtitle: ""
date: 2018-10-17
draft: false
tags: [Code]
---

Most of us have heard of "writer's block", but have you heard of "developer's block"? Just like a writer, a software developer can sit staring at a screen, not knowing where to begin. Sometimes that blank screen can be too intimidating and the code just doesn't come to you.

<!--more-->

So what do you do? Do you just take a coffee break, come back an hour later and hope you figure it out then? Maybe you can go talk to your coworkers, joke around for a bit, and put off getting that code working. Don't worry, future you can deal with this problem! (You never really liked them all that much anyways.)

Instead of struggling to bring that code out of nowhere, there is a simple way to trick your mind into getting started. A writer can overcome this problem by starting with an outline and filling it in. A developer can begin by writing tests!

You do this by using tests as an outline. You can break your code up into tiny chunks, and this will redirect your focus away from the big problem and on to making a single test pass. Since you've broken up your problem into small pieces, each piece will be easier to understand. Eventually when you need to refactor you'll quickly be alerted when a test breaks!

## How To Use Tests

It's actually pretty easy to write tests. Unfortunately it's also pretty easy to write bad tests.

Bad tests take a long time to write. They also take a long time to run. Have you ever spent five minutes waiting for one hundred tests to run? I have! Bad tests break even if the input and output stays the same. Running them is hard—you have to look up the command or commands every time. Writing them is harder. You spend more time reading the testing library documentation than you do writing your own code.

In order for tests to allow you to write code faster, you must first know how to write good tests. In the following sections, I'm going to outline how to use tests in a way that will let you code much more efficiently.

### Red Green Refactor 🚦

Efficient coding means knowing when your code does what you want. It also means you need to be alerted as soon as you've broken something.

There are two goals of red green refactor.

First, the tests should break when something goes wrong. Passing tests aren't good enough if they don't fail when the wrong things happen. The code `assert(true)` will always pass, but it will also always be useless!

Second, the tests should fail until your code does what you expect. This allows you to immediately know if you've written your code correctly.

Red green refactor says you should write code in the following order:

1. Write your test, it should fail.
2. Write only enough code to make your test pass (and not a single keystroke more!)
3. Refactor any existing code to make it more readable, performant, etc., but do not change or add any functionality. Your tests should still pass!

You repeat this process continually until you have your final working product.

Beginning with a failing test is very important. It means that you've validated that the existing code does not do something. When you write your code and the tests passes, you've now validated that it works they way you expect it to.

If instead you started with a passing test, how would you know your test fails without your added code?

Many of you know this already, but might avoid "red green refactor" because it seems like it would take longer to write code this way. Instead I've found that it makes me write code faster.

The quick reward cycle for your effort is going to keep you excited about your work. No longer will you write code for minutes or hours only to despair when it doesn't work once you finally execute it!

You will also know immediately if your code does what you expect. You will know immediately when you break existing functionality. No more waiting. No more frustration.

### Don't write any logic without a failing test

So how do you get started? You should start with a failing test, but what does that look like? It's as simple as:

```js
import assert from 'assert'
import test from 'my-favorite-test-library'

import functionality from './myFunctionality'

test('It exports a function', function () {
  assert.strictEqual(typeof functionality, 'function')
})
```

You can see that I've taken "don't write any logic without a failing test" seriously here! The function has neither been created nor exported. The test fails as expected.

So how does this make you write code faster? Well, two things are happening here.

First, if you're struggling to get started, this helps you to overcome your mental block by forcing you to begin doing *something.* I believe that just like in Newton's law of motion — an object in motion stays in motion — a developer writing code tends to continue writing code.

Second, and most importantly, when you follow this rule your code will have the huge advantage of *only* doing what you've verified that it does. You are far less likely to have any surprises down the road because your test suite automatically verifies every character of your code.

Not only does it verify your code, but by writing the test first you are creating a road map for what you want your code to do! That road map, just like the writer's outline mentioned before, lets you easily fill in the blanks.

```js

/* source code file "myFunction.js" */

export default myFunction(callback) {
  return callback(10)
}

/* test file */

import assert from 'assert'
import test from 'my-favorite-test-library'

import myFunction from './myFunction'

test('My function calls my callback with 10', function () {
  function callback(number) {
    assert.equal(number, 10, 'Number was not called with 10.')
  }

  myFunction(callback)
})
```

This rule can be difficult to follow sometimes. In the code block above you should see that I returned callback but never tested the return value of myFunction. It's very easy to forget to test something this small, and code coverage reporters don't help you find it.

The more I practice this rule, the easier it becomes to avoid this, but it will always require constant vigilance and discipline.

### Fast tests

Nothing stops a developer from writing tests quite like a slow test suite. The only thing worse is one that's difficult to run at all!

Your goal should be to run thousands of tests in only a few seconds. This should be the case for most mid-tier and higher development machines.

To accomplish fast tests you will need a few things, in this order.

1. Your code should be fast.
2. Your unit tests should be isolated from expensive IO (Input and Output).
3. A fast test runner
4. A lightweight assertion library

It doesn't matter how good your test runner is, if your code is slow, your tests will be slow! If your unit tests make real HTTP requests or run actual SQL queries, your tests will be too slow!

Integration and regression tests can be expected to take slightly longer to run. That's where you would perform real requests to the network, database, or file system. They should live in separate commands and test files in order to keep your unit tests fast.

### Simple tests

Tests only make you write code faster when you can write your tests quickly. You can only write tests quickly if they are simple.

There should be no complicated commands to run — just npm test or something like npm run test:coverage for code coverage reports.

There should be no complicated API — just `assert(value`) or `assert.equal(expected, actual)`. Many of us have struggled with complicated assertion libraries where you `chain.every.word.to.make.a.sentence()`. If you're like me you end up spending more time reading the docs than writing your tests.

You should avoid test hooks that set up and tear down your tests. Test runner functions like `before()` `after()` `beforeEach()` and `afterEach()` should be avoided because it encourages your tests to share state. This could lead to unpredictable tests because of that shared state. Instead you should just have a setup function or functions that return anything you need for your tests.

### Use Snippets

There are certain tests that you will write over and over. Your test runner has a specific way of writing a test. You'll likely have the same imports for many of your tests. Every single one of these things can be written more quickly with a snippet!

Your favorite code editor will have support for snippets. It doesn't matter if you use a full IDE or a simple editor like vim. You can easily make snippets.

```json
{
  "Ava Test Snippet": {
    "prefix": "ava",
    "body": [
      "import test from 'ava'",
      "",
      "import ${1} from '${2}'",
      "",
      "test('It exports a function', function (t) {",
      "  t.is(typeof ${3}, 'function')",
      "})",
      ""
      ],
    "description": "Ava Test Snippet"
  }
}
```

I prefer to use Ava for my tests. The above snippet creates an entire basic test whenever I start a new test file using Visual Studio Code. You can see that `${1}` is included for the variable parts of the snippet. VScode allows me to tab through these, which I can usually do in a few seconds, and I have my first test ready!

You can do the same thing for mocha or any other test runner. I recommend making snippets for all the common tests that you create. Whenever you've repeated yourself a couple times—take a break and make a snippet!

### Avoid mocking

While I suggest that you don't make fun of people—that's not quite what I'm talking about here!

It's very common to use a library like [sinon](http://sinonjs.org) or [proxyquire](https://github.com/thlorenz/proxyquire) to change how dependency modules work. Usually we use them to isolate your code from expensive operations like an HTTP request, reading from a database, or operating on the file system.

I've stopped using these libraries because I believe there is a better way! Instead you can construct your modules to accept an interface of dependencies. Here's what it looks like:

```js
/**
 * Normally you might do:
 * import fs from 'fs-extra-promise'
 * but here we will allow the user of this file to provide the fs module
 */
export default function ({ fs }) {
  return function(fileName) {
    return fs.readFileAsync(fileName, 'utf8')
  }
}
```

Now you don't need proxyquire or sinon or anything to change what the fs module does! You can provide that directly from your tests. So you don't have to learn the sinon or proxyquire API, you don't have to remember to call `restore()` on stubbed functions. Your tests are now simpler and easier and you can continue to write code faster than ever!

## Wrapping up

By following these simple rules you should find that your tests allow you to write faster and more predictable code. You will be alerted more quickly when you break something. Most importantly you'll be forced to plan out your code before you write it!

I hope that you see the benefits to developing like this. Like any change it won't be easy right away, but with time and practice this will all feel natural. In fact you might eventually find that it feels unnatural and uncomfortable to write untested code!

Here's a quick summary:

* Red, Green, Refactor
* Don't write untested code
* Keep your tests fast
* Keep your tests simple
* Use snippets
* Avoid mocking

Please share in the comments your experiences with testing your code. Have you been able to leverage your tests to deliver your product more quickly?
