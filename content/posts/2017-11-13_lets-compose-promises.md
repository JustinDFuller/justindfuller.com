# Let’s Compose Promises!

Today we’re going to combine two of the most useful tools that a JavaScript developer has in his or her tool belt. Promises and Function Composition.

![Please enjoy this barely related comic about Functional Programming :)](https://cdn-images-1.medium.com/max/2000/1*IhaDj8f_Orwoh4HVb6xZKQ.jpeg)

### Promises

The [Promise API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) is a simple but powerful way to handle asynchronous operations. To create a promise you would type new Promise() and the only argument would be a callback function.

The callback function accepts two arguments: `resolve` and `reject`. When your asynchronous function finishes you call resolve with the result. If your asynchronous function throws an error you can call reject with that error. It looks like this:

```js
const myPromise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('Hello World');
  }, 2000);
});

myPromise.then(res => console.log(res)); // 'Hello World' is shown after 2 seconds.
```

We can access the result of resolve by calling [Promise.prototype.then](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then), which receives a callback function that has whatever you called resolve with as its argument.

Sometimes a Promise will throw an error. We can’t use a traditional [try/catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch) block in this scenario, because the error may be thrown at a later time. Instead we use [Promise.prototype.catch](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch). Just like `.then()` it receives a callback function. The difference is that it will receive whatever you pass to the argument of the `reject` function.

Finally, we may want to do some cleanup. What do we use? You guessed it: [Promise.prototype.finally](https://developers.google.com/web/updates/2017/10/promise-finally). Finally accepts a callback function, but that callback accepts no arguments. You can count on this function to be called after your Promise chain is finished executing. At the time of this writing finally isn’t available everywhere. You can use it in the latest version of Chrome or [Bluebird](http://bluebirdjs.com/docs/api/finally.html).

### Chaining Promises

When working with Promises you can chain them. This means when you have multiple asynchronous options in a row you can do them one after the other. It looks something like this:

```js
// In this example Promise.resolve represents any async action that returns a promise.
new Promise(resolve => setTimeout(() => resolve(10), 3000))
  .then(res => Promise.resolve(res + 10))
  .then(res => Promise.resolve(res + 10))
  .then(console.log)
  .catch(console.error)  
  .finally(() => console.log('All done!');
// After 3 seconds logs 30 
// Then it logs 'All done!'
```

As you can see Promises can be chained so that asynchronous operations can happen almost as if they are synchronous.

We used [Promise.resolve](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve) to represent a function that returns a Promise. Promise.resolve wraps a value in a Promise.

This isn’t a bad way of working with Promises, but I think we can do better.

### Composition

Function composition is simple but can be hard to wrap your mind around at first. The point of function composition is to allow you to string functions together. If we were to look at our last example, but with synchronous functions, it would look something like this:

```js
const result = compose(
  res => res + 10,
  res => res + 10,
)(10);
console.log(result); // 10
```

We took the result of each function, passed it to the next function, and that was the result of the whole composed function.

That compose function isn’t assumed to be a global function, like Promise or `Promise.resolve` are. We’ll have to define it. To define compose we’d have something like this:

```js
const compose = (...functions) => 
  initialValue =>
    functions.reduceRight(
      (sum, fn) => fn(sum),
      initialValue,
    );
```

So.. what exactly is going on here? Let me walk you through it step by step. This can be confusing, particularly if you aren’t familiar with a recent update to JavaScript known as [ES6](http://es6-features.org).

First, we accept any amount of functions. Then we use the [spread operator ](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Spread_operator)to gather all of those functions into a single array.

Next, we accept the initial value that our compose function will use as its first argument.

Once we have that initial value we begin calling each function from right to left (or bottom to top if you look at the example above). We use [Array.prototype.reduceRight](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/ReduceRight) to make sure that the functions are called in this order. If you’re familiar with how [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) works then you’re already familiar with reduceRight, you just may not know it! reduceRight is the same as reduce, but it works backward.

The `Array.reduce` and `Array.reduceRight` methods iterate through an array, and at each index in the array a callback is called. That callback receives two arguments. A sum, and the value at the current index of the array.

In our case, the value at the current index is a function. The sum is the `initialValue` for the first function in the array. After that, the sum is the result of the previous function that has been called with the results of the function before it.

So now we hopefully see the power of Promises, as well as the convenience and clarity of composition. What happens when we put them together?

### Composing Promises

You might wonder why we can’t just compose Promises with the compose function that we just created. The problem is that we access that value through [Promise.then](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then). So unless each of our functions unwraps arguments like:

```js
function myComposedFunction(argument) {
  argument.then(() => {
    // actual content of myComposedFunction goes here
  });
}
```

Then the function’s argument won’t be what it expects. Plus there’s another problem. Now `myComposedFunction` will only work with Promises! We can solve that problem rather simply.

```js
function myComposedFunction(argument) {
  Promise.resolve(argument).then(() => {
    // actual content of myComposedFunction goes here
  });
}
```

But this seems like a lot of [boilerplate](https://en.wikipedia.org/wiki/Boilerplate_code). Particularly if this is supposed to be a simple function. Maybe it just does: `return argument + 10;` we’ve just turned a very simple function into a very complicated one.

A much better way is to handle this within the compose function itself.

```js
const composePromise = (...functions) =>
  initialValue =>
    functions.reduceRight(
      (sum, fn) => Promise.resolve(sum).then(fn),
      initialValue
    );
```

This `composePromise` function works the same as our compose function earlier, with one major difference. It accepts Promises, and returns a Promise. You can use it like this:

```js
const add100ToNumberString = composePromise(
  console.log,
  res => res.toString(),
  res => Promise.resolve(res + 100),
  res => Promise.resolve(Number(res)),
);

add100ToNumberString(new Promise(resolve => {
  setTimeout(() => {
    resolve('400');
  }, 2000);
})); 
// Eventually prints out '500' after 2 seconds
```

You can continue to chain because the result of `add100ToNumberString` is a `Promise`. You can use `.catch()` and `.finally()` If needed as well!

### Try it yourself!

Below I’ve embedded a [CodePen](https://codepen.io/) playground with all this code in it so that you can try it out for yourself! Open up the console to see the results.

https://codepen.io/Iamjfu/pen/XzaegE

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
