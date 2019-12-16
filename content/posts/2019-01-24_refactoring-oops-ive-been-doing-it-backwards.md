# Refactoring — oops, I’ve been doing it wrong.

Welcome to my intervention. I’m a refactoring addict and I’m not afraid to admit it, but there’s only one problem: I’ve been doing it backward. You see, what I’ve been doing could be more accurately described as premature code abstraction.

![](https://cdn-images-1.medium.com/max/2000/0*iKjvNG4OVK47bauK.jpeg)

We all know about refactoring. If you’ve read even a single programming book, or if you spend much time reading code blogs, you’ll have heard all about it. It’s an important concept that keeps code understandable, maintainable, and extensible.

At least that’s what everyone tells me.

So why has refactoring not been accomplishing what I was hoping?

As I wrote my most recent library, I took some time to reflect on the evolution of my code. I realized that before I had a fully working product and before I had an ideal output in my unit tests, I had refactored my code into interfaces that I wasn’t even sure I would need. I had moved code around, made it extensible, made it reusable, but why? Was that code going to give me the final output I needed? I didn’t know yet.

Everything worked out in the end, but was my code more complicated than it needed to be? I believe so.

## Principles Over Purpose

Have you heard of [SOLID](https://en.wikipedia.org/wiki/SOLID) principles? I try to follow them closely. Every function that I write aims to have [a single responsibility](https://en.wikipedia.org/wiki/Single_responsibility_principle). My classes and factories aim to be [open for extension while discouraging modification](https://en.wikipedia.org/wiki/Open/closed_principle). I also try not to depend directly on too many things, so instead, [I accept dependencies as arguments](https://en.wikipedia.org/wiki/Dependency_inversion_principle) in functions and classes.

Does that like a recipe for good code? I think it does. The problem occurs when my code focuses on being SOLID, or [pure](https://en.wikipedia.org/wiki/Pure_function), rather than on accomplishing what it was born to do. The problem occurs when I put principles over purpose.

For example, I’ve been so focused on making sure my [unit tests have no expensive IO](https://medium.freecodecamp.org/how-writing-tests-can-make-you-a-faster-and-more-productive-developer-f3ad978e3872) (input and output). I’ve occasionally had to go back and fix code that was wrong due to my incorrectly mocked dependencies.

So, what’s the solution?

Remember that reflection I mentioned earlier? It reminded me of the mantra, “[Make it work, make it right, make it fast.](http://wiki.c2.com/?MakeItWorkMakeItRightMakeItFast)” I’ve realized I’ve been going out of order. I’ve been making it right, making it fast, then making it work!

## Make It Work

As I’ve begun to write more it has become clear that good writing doesn’t just happen. First I have to get all my thoughts down on the page. I have to see where my thoughts take me. Then I must shape them into some sort of semi-coherent and non-rambling version of what just spilled out.

The same thing can happen with code.

Get it all out there into that function. At first don’t worry *too* much about naming, single responsibility, or being extensible — you’ll address that once your function is working. To be clear, you won’t be writing your whole application like this, just one small piece.

Once you’ve got the output you are looking for (you’ve got unit tests to prove that the code is correct, right?) begin refactoring, but don’t go too far too fast! For now, stick with refactoring strategies that are in the category of proper naming, functions doing only one thing, and the avoidance of mutation; don’t immediately start making extensible or reusable classes and factories until you have identified a repeating pattern.

At this point, it makes sense to use any refactoring that has a logical benefit. This means refactoring with the purpose of the code being understood, or the code being reliable.

Consider postponing refactoring with patterns that are only useful in certain scenarios.

You’ll want to save those until you have a reason.

## Have A Reason

Having SOLID code is not a reason. Having functional or pure code is not a reason.

Why do we make our code extensible? So that similar, but not identical, functionality can branch off of base logic.

Why do we invert dependencies? So that the business logic can be used by multiple implementations.

Hopefully, you see where I am going with this. Some refactoring stands on its own. For example, refactoring the name of a variable to become more accurate will always make sense. Its merit is inherent. Refactoring a function to be pure usually makes sense because side-effects can cause unforeseen issues. That's a valid reason.

“It’s best practice to use dependency inversion” is not a reason. “Good code is extensible” is not a reason. What if I only have a couple of never-changing dependencies? Do I still need dependency inversion? Perhaps not yet. What if nothing needs to extend my code and I have no plans for anything to do so? Should my code increase its complexity just to check off this box? No!

Take a look at the following example.

```js
// not extensible

function getUser() {
  return {
    name: 'Justin',
    email: 'justinfuller@email.com',
    entitlements: ['global', 'feature_specific']
  }
}

// used later

getUser().entitlements.includes['feature_specific']

// Extensible

class User {
  constructor() {
    // initialize here
  }
  
  hasEntitlement(expectedEntitlement) {
    return this.entitlements.includes(expectedEntitlement)
  }
}

// used later

new User().hasEntitlement('feature_specific')
```

Which do you prefer? Which do you naturally tend to write first? Of course, the User class is far more extensible because it can be overriden by another class. For example, if you had a `SuperUser` then you could implement `hasEntitlement` like this:

```js
hasEntitlement() {
  return true
}
```

Don't let the Class throw you off. The same result can be accomplished without it.

```
function superUser(user) {
  return {
    ...user,
    hasEntitlement() {
      return true
    }
  }
}
```

Either way, this encapsulation of `hasEntitlement` allows the User to, for different use cases, take advantage of polymorphism to extend—rather than change—the code.

Still, that User class may be complete overkill, and now your code is more complicated than it will ever need to be.

My advice is to stick with the simplest possible pattern until you have a reason for something more complex. In the above solution, you may choose to stick with the same simple User data object until you have multiple user types.

## Order Of Complexity

And now, if you’ll allow it, I’m going to make something up! I call it the order of complexity and it helps me when I make refactoring decisions. It looks like this:

* [Constant Variable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/const)

* [Mutable Variable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let)

* Collection (Object, Array)

* Function

* Function with [Closure](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)

* Factory (A function that returns a collection)

* Class

Whenever I decide how to organize functionality, I refer to the list. I choose the highest possible choice that will suffice for my implementation. I don’t choose again until it simply will not work. Sometimes performance will affect this choice, but not often.

Usually, I find that I’ll put something in an object instead of a simpler constant variable. Or I created a factory when I only require a function.

This list keeps me grounded. It prevents me from prematurely refactoring.

## Balance

I recently heard that if you say in a meeting, “it’s all about finding balance,” everyone will nod their head at your meaningless comment like you’ve said something profound. I’ve got to give it a try soon.

Here, though, I think balance is important. As programmers, we have to balance code quality, performance, maintainability, with the good old-fashioned need to get things done.

We have to be vigilant and make sure both needs stay in their correct place. Our code can’t be maintainable if it doesn’t work correctly. On the other hand, it’s hard to make bad code work correctly.

Still, code may be refactored, but what if it’s been refactored past the point of what is useful? These are important questions to keep in mind.

Next time you write your code, please, refactor! But also, maybe… don’t?

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
