# Function Composition with Lodash

Have you been reading JavaScript posts lately? Maybe you’ve noticed that functional programming is really popular right now. It’s a really powerful way to program, but can be overwhelming to get started with. Thankfully the most popular NPM package (with 48 million downloads this month) has a very useful functional programming package to help us get started!

In this post we’ll look at how to use Lodash/fp to compose both our own functions, and the Lodash functions that you may already be using today!

Before we start coding — lets be sure that we know what we’re talking about!

## Functional Programming:
> A method of programming that focuses on using functions as first class variables. It avoids mutating (changing) data, and attempts to treat applications as a linear flow that pieces functions together to create a whole.

## Function Composition:
> Invoke functions that have been listed, in order, passing the result of each function to the next in the list, and then return the final function result as the result of the whole.

Normally when you compose functions you may do it like this (without knowing you are composing):

```js
const myResult = myFunction(myOtherFunction(myData));
```

In that example you are giving myFunction the result of myOtherFunction as it’s only argument. Notice the functions would be called from right to left, or inside to outside. We do something similar with function composition.

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
* When chained together they can be used as a single “action” on a set of data.

## Lodash/fp

To accomplish these goals we’ll be using a subset of the Lodash library called Lodash/fp. “Fp” for functional programming. This package is already installed when you have Lodash installed! The only difference is the functions are changed to be immutable, auto-curried, iteratee-first, and data-last.

What does that mean?

* **Immutable**: the functions do not mutate any of their arguments.

* **Auto-Curried**: Passing in less arguments than the function accepts will only return another function. That function expects the rest of the arguments.

* **Iteratee-first**: Normally you pass in what you will do to your data as the last argument. Think of array functions. You pass in the callback last. In FP you pass it in first!

* **Data-last**: The last thing the function expects is the data. Since it’s curried this allows you to define what the function will do, assign it to a variable, then later give it the data in a composed function (or on its own).

* **Arguments** to callbacks/iteratees are capped (usually to just the first argument). This avoids side-effects for functions like parseInt that have optional extra arguments. Please note that this does not mean the functions themselves are capped to one argument.

All this may seem confusing right now. So let’s look at a code example!

### Problem:

You are building a web page that displays contact information to users. The business specified that contacts must be sorted by first name, filtered to remove any contacts without a phone number, it’s possible that contacts may have been added twice so only unique contact numbers should be shown, and the numbers must be formatted like (xxx)xxx-xxxx.

The contact object looks like this:

```js
{
  firstName: 'justin',
  lastName: 'fuller',
  phone: '1234568490'
}
```

### Imperative version:

```js
import _ from 'lodash';
const data = [ /* data in here */ ];

const sorted = _.sortBy(data, 'firstName');

const filtered = _.filter(sorted, 'phone');

const unique = _.uniqBy(filtered, 'phone');

const formatPhone = c => ({
  ...c,
  phone: `(${c.phone.slice(0, 2)})${c.phone.slice(3, 5)-${c.phone.slice(6)}}`
});

const formatted = _.map(unique, formatPhone);

console.log(formatted);
```

### Imperative version 2:

```js
import _ from 'lodash';
const data = [ /* data here */ ];

const formatPhone = c => ({
  ...c,
  phone: `(${c.phone.slice(0, 2)})${c.phone.slice(3, 5)-${c.phone.slice(6)}}`
});

const formatted = _.map(
  _.uniqBy(
    _.filter(
      _.sortBy(data, 'firstName')
        'phone',    
      ), 
    'phone',  
  ),
  formatPhone,
);

console.log(formatted);
```

### Functional version:

```js
import fp from ‘lodash/fp’;
const data = [ /* data here **/ ];

const formatPhone = c => ({
  ...c,
  phone: `(${c.phone.slice(0, 2)})${c.phone.slice(3, 5)-${c.phone.slice(6)}}`
});

const formatData = fp.compose(
  fp.map(formatPhone),
  fp.uniqBy('phone'),
  fp.filter('phone'),
  fp.sortBy('firstName'),
);

console.log(formatData(data));
```

Those who prefer functional programming would tell you that the last version is more declarative. Instead of telling you *how* the function works, it tells you *what* it does!

So let’s walk through each step of the code to unwrap what it does.

* fp.compose — a function that accepts any number of functions as arguments. It then calls them from right to left, just the same as functions are called when you pass them as an argument.

* Fp. SortBy, uniqBy, filter, and map all accept the data last. So first we tell the functions what to sort, filter, and map by, then later it accepts the data and returns the result.

* When we call formatData with data it takes the result of each function and passed it to the next function. The result of the last function is the result of the entire chain.

Now that we see the expressive power of functional programming with Lodash I want to explore some more problems. You’ll begin to see how easy it is, and hopefully you will see the safety that comes with this style of programming!

### Application Composition

Composition is not limited to working with data. An entire app can be composed together through many smaller functions.

Let’s do a mental exercise: think through the steps of an application.

* Retrieve any initial configuration (environment variables, command line arguments) and package then into a reusable object.

* Import any third party dependencies.

* Use the configuration and dependencies to bootstrap the app.

* Instantiate routes, services, components , whatever it is the app does.

Do you see how this example or any number of other examples could be strung together? Do you see the benefit that would come from eliminating side effects?

At this point you are hopefully wanting to dive in and begin using composition and Lodash/fp to solve problems, so below I wil include a link to the FP docs. Use this to find out how to use your favorite Lodash methods in a functional/composition style!
[lodash](https://github.com/lodash/lodash/wiki/FP-Guide)

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
