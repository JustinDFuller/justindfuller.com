# Three reasons I avoid anonymous JS functions like the plague

You’re bound to see an anonymous function whenever your read code. Sometimes they are called lambdas, sometimes anonymous functions, either way, I think they’re bad.

In case you don’t know what an anonymous function is, here’s a quote:

> Anonymous functions are functions that are dynamically declared at runtime. They’re called anonymous functions because they aren’t given a name in the same way as normal functions. — Helen Emerson, Helephant.com

They look a little something like this:

```js
function () { ... code ... }

// OR

(args) => { ... code .. }
```

![](https://cdn-images-1.medium.com/max/2000/1*EKIOEDfIunCnzQxo85NrRg.jpeg)

I’d like to try to make the case to you today that, in general, you should only use an anonymous function when necessary. They should not be your go-to, and you should understand why. Once you do, your code will be cleaner, easier to maintain, and bugs will become simpler to track down. Let's start with three reasons to avoid them:

## Stack traces

Eventually, while you’re writing code, you’re going to run into an error, no matter how good you are at coding. Sometimes these errors are easy to track down, other times they aren’t.

Errors are easiest to track down if, well, you know where they come from! To do this, we use what’s called a stack trace. If you don’t know anything about a stack trace, [Google gives us a great intro](https://developers.google.com/web/tools/chrome-devtools/console/track-exceptions).

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

But it looks like we’ve done something incredibly silly, like misspelled `console.log`. In our small project, it’s no big deal. But maybe this is a snippet from a HUGE project, with a large number of modules that are pulled together. On top of that, let's pretend you aren’t the one who made this silly error. That new Junior Dev checked it into the repo right before he left for vacation yesterday!

Now, we have to track it down. With our nicely named functions we get a stack trace like this:

![](https://cdn-images-1.medium.com/max/2000/1*2xJ42hw41svXHKehiJcp6A.png)

Thanks for naming your functions, Junior Developer! Now we can easily track down that bug.

But... Once we’ve fixed that, it turns out there’s another bug. This time it was introduced by a more senior developer. This person knows about lambdas (anonymous functions) and makes heavy use of them in their code. It turns out they accidentally checked in a bug and it’s our job to track it down.

Here’s the code:

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

So, I hear you aren’t convinced yet. You still love your anonymous functions and you never create bugs. My apologies, I had forgotten to address those of you that code perfectly. Let's take another shot at this!

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

You might think this code isn’t that hard to read, but I think it could be better!

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

function evaluateRes (res) {
  if (res) {
    doSomethingElse();
  } else {
    doSomething();
  }
}

function handleError (e) {
  logError(e.message);
  restartApp();
}

initiate(true)
  .then(evaluateRes)
  .catch(handleError);
```

Alright, so let's be clear: This code is longer, but I think it’s also far more readable! Instead of anonymous functions, we have nicely named functions. As soon as we see them, the name gives us a hint at what is going on. It removes a mental hurdle when evaluating the code.

It also helps to separate concerns. Instead of creating a method, passing it in, then running the logic, in the second example the arguments given to then and catch simply point to the function where everything happens.

There’s not much else I can do to convince you that this is more readable. But maybe if you’re still not convinced, I can try one last argument.

## Reusability

Did you notice something about the last example? The functions went from being scoped to the arguments and the `initiate` function being available for all other functions in that scope to use!

When you use anonymous functions they are much harder to use throughout your app. Reusability goes down the drain, and you end up writing the same code over and over again. As we all know, if you write less code, you introduce fewer bugs, and your users' browsers have less code to load! Everyone wins!

Conversely, a named function can be used throughout the entire scope, without needing to pass it around as a variable. Your code is automatically more reusable because, well, you can reuse it!

## Are Anonymous Functions Ever Good?

Yes. I hate to admit it, but they can be the best choice sometimes!

```js
const stuff = [ 
  { hide: true, name: 'justin' }, 
  { hide: false, name: 'lauren' },
  { hide: false, name: 'max' },
];

const filteredStuff = stuff.filter(s => !s.hide);
```

That anonymous function s => !s.hide is so small and simple, it doesn’t hurt anyone to not be able to use it elsewhere. It will also show up in the stack trace under stuff.filter. If you need to reuse it, you’d be better off reusing the whole thing:

```js
function filterByHide (array) {
  return array.filter(item => !item.hide);
}
```

Sometimes you want to wrap all your code in an anonymous function to make sure the global scope isn’t polluted.

```js
(() => {
 ... your code here ...
})();
```

Having the top-level anonymous function in the stack trace really won’t hurt anyone. No code-reuse is hurt because the entire purpose is to keep the methods contained.

Thanks for reading, now go out there and stop writing anonymous functions!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
