---
title: "Three reasons I avoid anonymous JS functions like the plague"
subtitle: ""
date: 2017-02-13
draft: false
tags: [Code]
---

You're bound to see an anonymous function whenever your read code. Sometimes they are called lambdas, sometimes anonymous functions, either way, I think they're bad.

<!--more-->

In case you don't know what an anonymous function is, here's a quote:

> Anonymous functions are functions that are dynamically declared at runtime. They're called anonymous functions because they aren't given a name in the same way as normal functions. — Helen Emerson, Helephant.com

They look a little something like this:

```js
function () { ... code ... }

// OR

(args) => { ... code .. }
```

I'd like to try to make the case to you today that, in general, you should only use an anonymous function when necessary. They should not be your go-to, and you should understand why. Once you do, your code will be cleaner, easier to maintain, and bugs will become simpler to track down. Let's start with three reasons to avoid them:

## Stack traces

Eventually, while you're writing code, you're going to run into an error, no matter how good you are at coding. Sometimes these errors are easy to track down, other times they aren't.

Errors are easiest to track down if, well, you know where they come from! To do this, we use what's called a stack trace. If you don't know anything about a stack trace, [Google gives us a great intro](https://developers.google.com/web/tools/chrome-devtools/console/track-exceptions).

Lets say we have a really simple project:

```js
function start () {
 (function middle () {
   (function end () {
     console.lg('test');
    })()
  })()
}
```

But it looks like we've done something incredibly silly, like misspelled `console.log`. In our small project, it's no big deal. But maybe this is a snippet from a HUGE project, with a large number of modules that are pulled together. On top of that, let's pretend you aren't the one who made this silly error. That new Junior Dev checked it into the repo right before he left for vacation yesterday!

Now, we have to track it down. With our nicely named functions we get a stack trace like this:

![](https://cdn-images-1.medium.com/max/2000/1*2xJ42hw41svXHKehiJcp6A.png)

Thanks for naming your functions, Junior Developer! Now we can easily track down that bug.

But... Once we've fixed that, it turns out there's another bug. This time it was introduced by a more senior developer. This person knows about lambdas (anonymous functions) and makes heavy use of them in their code. It turns out they accidentally checked in a bug and it's our job to track it down.

Here's the code:

```js
(function () {
 (function () {
   (function () {
     console.lg('test');
    })();
  })();
})();
```

Amazingly, this developer has also forgotten how to spell `console.log`! What are the chances?! But sadly, they have not named their functions.

What does the console show us?

![](https://cdn-images-1.medium.com/max/2000/1*6WRmLi3uJmjw3CXn3SXqKg.png)

Well… At least we have line numbers? In this example, It looks like we have about 7 lines of code. What if we were dealing with a massive codebase? 10k lines of code? And what if the line numbers were far apart? What if the code was minified, without a map file, rendering line numbers almost completely useless?

I think you can answer all those questions pretty easily. The answer: *You would be having a very bad day.*

## Readability

So, I hear you aren't convinced yet. You still love your anonymous functions and you never create bugs. My apologies, I had forgotten to address those of you that code perfectly. Let's take another shot at this!

Examine these two different code samples:

```js
function initiate (arguments) {
  return new Promise((resolve, reject) => {
    try {
      if (arguments) {
         return resolve(true);
      }
      return resolve(false);
    } catch (e) {
      reject(e);
    }
  });
}

initiate(true)
  .then(res => {
    if (res) {
      doSomethingElse();
    } else {
      doSomething();
    }
  ).catch(e => {
    logError(e.message);
    restartApp();
});
```

This is a very contrived example, but I think you get the point. We have a method, it returns a promise, we use that promise object/methods to handle the different possible responses.

You might think this code isn't that hard to read, but I think it could be better!

What if we got rid of all the anonymous functions, then what?

```js
function initiate (arguments) {
  return new Promise(checkForArguments);
}

function checkForArguments (resolve, reject) {
  try {
    if (arguments) {
     return resolve(true);   
    }
    return resolve(false);
  } catch (e) {
    reject(e);
  }
}