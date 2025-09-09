---
title: "Function Composition with Lodash"
subtitle: ""
date: 2017-11-09
draft: false
tags: [Code]
---

Have you been reading JavaScript posts lately? Maybe you've noticed that functional programming is really popular right now. It's a really powerful way to program, but can be overwhelming to get started with. Thankfully the most popular NPM package (with 48 million downloads this month) has a very useful functional programming package to help us get started!

<!--more-->

In this post we'll look at how to use Lodash/fp to compose both our own functions, and the Lodash functions that you may already be using today!

Before we start coding — lets be sure that we know what we're talking about!

## Functional Programming

> A method of programming that focuses on using functions as first class variables. It avoids mutating (changing) data, and attempts to treat applications as a linear flow that pieces functions together to create a whole.

## Function Composition

> Invoke functions that have been listed, in order, passing the result of each function to the next in the list, and then return the final function result as the result of the whole.

Normally when you compose functions you may do it like this (without knowing you are composing):

```js
const myResult = myFunction(myOtherFunction(myData));
```

In that example you are giving myFunction the result of myOtherFunction as it's only argument. Notice the functions would be called from right to left, or inside to outside. We do something similar with function composition.

```js
const getMyResult = compose(
  myFunction,
  myOtherFunction,
);

const myResult = getMyResult(myData);
```

To make things clearer I want to define a few goals for our composed functions.

* They will have a single input and output.
* They will not have side-effects.
* When chained together they can be used as a single "action" on a set of data.

## Lodash/fp

To accomplish these goals we'll be using a subset of the Lodash library called Lodash/fp. "Fp" for functional programming. This package is already installed when you have Lodash installed! The only difference is the functions are changed to be immutable, auto-curried, iteratee-first, and data-last.

What does that mean?

* **Immutable**: the functions do not mutate any of their arguments.

* **Auto-Curried**: Passing in less arguments than the function accepts will only return another function. That function expects the rest of the arguments.

* **Iteratee-first**: Normally you pass in what you will do to your data as the last argument. Think of array functions. You pass in the callback last. In FP you pass it in first!

* **Data-last**: The last thing the function expects is the data. Since it's curried this allows you to define what the function will do, assign it to a variable, then later give it the data in a composed function (or on its own).

* **Arguments** to callbacks/iteratees are capped (usually to just the first argument). This avoids side-effects for functions like parseInt that have optional extra arguments. Please note that this does not mean the functions themselves are capped to one argument.

All this may seem confusing right now. So let's look at a code example!

### Problem

You are building a web page that displays contact information to users. The business specified that contacts must be sorted by first name, filtered to remove any contacts without a phone number, it's possible that contacts may have been added twice so only unique contact numbers should be shown, and the numbers must be formatted like (xxx)xxx-xxxx.

The contact object looks like this:

```js
{
  firstName: 'justin',
  lastName: 'fuller',
  phone: '1234568490'
}
```
