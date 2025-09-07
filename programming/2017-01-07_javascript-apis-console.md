---
title: "JavaScript APIs: Console"
subtitle: ""
date: 2017-01-07
draft: false
tags: [Code]
---

The console API could be the most well-known JavaScript API. Pretty much every developer who was written any substantial amount of code has had to console.log *something.* If you’ve written any kind of libraries or services, you’ve probably used console.warn or console.error to notify the user that they’ve done something incorrectly. But the console API can do far more for us, so today we’re going to see how to leverage that!

<!--more-->

## **Assert**

First up we have `console.assert(*assertion*)` which allows us to run an *assertion* in the console.

> An assertion is a boolean expression at a specific point in a program which will be true unless there is a bug in the program. —[ http://wiki.c2.com/?WhatAreAssertions](http://wiki.c2.com/?WhatAreAssertions)

If the assertion is true, the console does not output anything, if the assertion is false it will output that an assertion has failed, along with any message or data you give it.

https://gist.github.com/JustinDFuller/d60bc49f9279a15023f9876ff4c4a530#file-console-js

*Note:* In Node.js falsy assertions will throw an `AssertionError` and stop the execution of code. So it is not recommended for use in production environments.

## **Count**

Sometimes it could be important to know how many times a given line was called. Maybe you’re not ready to write your unit test yet that asserts it was only called once or twice; maybe you’re just debugging and trying to track down something that is happening more times than expected. This is where we can count on `console.count`.

This one is simple, add `console.count(*message*)` and run your code. You’ll see a message and a number pop up every time that line runs.

https://gist.github.com/JustinDFuller/2cfc58005ccc1753fa16f24b894a84af#file-console-count-js

An important thing to note in this example is that the count is set to 1 for each output. That’s because the message changed. No user was called more than once, so count never goes up! When you call user 4 again at the end, you see count finally go to 2.

## **Trace**

Finally, we’ve gotten to my favorite console method! Here we have `console.trace` which will spit out a [stack trace](https://developer.mozilla.org/en-US/docs/Web/API/console#Stack_traces). It starts at the method that invoked console.trace and moves all the way back to the initial call.

This method is extremely useful when you know a certain method is being called, but you don’t know where it is being called from.

But I can hear you saying right now, “Just put a debugger in the code and you get this, plus more!” To that, all I can say is, “yep”. Usually, you can just use a debugger, but sometimes you don’t want the code to stop (like if the timing of the call is relevant, or repetition + timing), or if for some reason you are needing to debug minified code.

Here’s a small example:

https://gist.github.com/JustinDFuller/36cb59736a3684e165abe011b994146d#file-console-trace-js

## **Formatting**

You don’t need ES6 to format a console string. They come with built-in formatters.

`%o` and `%O` will format an Object.

`%d` and `%i` will format numbers.

`%s` will format a string.

`%f` will format a floating-point number.

You can use them like this:

https://gist.github.com/JustinDFuller/a14fcc037f9f6d88a9746c6ac160302f#file-console-formatting-js

A nice part of this method is the object is still expandable in browsers that support pretty-printing/expanding/collapsing of objects in the console.

## A Final Word — Some “Gotcha’s!”

If you use Node.js, be very wary of the console. It prints to stdout synchronously, which could harm performance.

However, in some browser environments, some console statements are asynchronous, so using console.log will take a snapshot of any variables at the time it outputs, rather than when it is actually first invoked. This means you may not be seeing what you expect. In this case, you can use the `console.dir` method to be confident that you are seeing what you expect.

For that reason and others, I’d also caution against using console statements too often in a web browser environment. Typically you can use a debugger statement or breakpoints in the browser for anything you want to do with a console statement. With a debugger or breakpoint, you are able to investigate your variables without having to worry about async problems.

If you missed the first installment you can find it [here](https://justindfuller.com/posts/15). Please stay tuned as we dive deeper into some less known JavaScript APIs. We’re starting off easy but we’ll be diving deep soon!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
