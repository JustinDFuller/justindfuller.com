---
title: "How to copy to a user’s clipboard with only JavaScript"
subtitle: ""
date: 2017-01-16
draft: false
tags: [Code]
---

Put your learning hats on, we’re diving into another API that you might not have known existed before today!

<!--more-->

*It will test your head… and your mind… and your brain, too.*

## I need to be honest, this isn’t really one API.

The clipboard API is made up of multiple API’s. But more than that, we’re going to need to pull in some more Web API’s that don’t directly relate to the clipboard and its utilities in order to completely take full advantage of the browser’s clipboard abilities. By the end you should have several new tools that make it easier to work with text on your websites and apps!

### **Starting small: ClipboardEvent**

The clipboard event is the easiest to use, and is technically created through the [real clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/ClipboardEvent/ClipboardEvent), but here’s the dilemma: the clipboard API isn’t exposed in most web browsers. So you can only get to it through event handlers on the copy, cut, and paste events.

This means you can modify what is happening during those events. Your code can change both what eventually ends up on the user’s clipboard, and what ends up showing on the screen. However, you can’t create your own event, [except in Firefox](http://caniuse.com/#search=clipboardevent).

**So.. What can we even do under these constraints?**

As it turns out, plenty!

I can think of a few reasons to modify these events and I’ll give examples below.

* Add or remove something from a copied or cut text.
* Obtain the data that was pasted and use it elsewhere in your app.

That’s not necessarily a *lot*, but with some extra API juice we can enhance our abilities. More on that later.

**Lets take a look at some examples.**

https://gist.github.com/JustinDFuller/70167eaf10104a2c12778bf77c446b6c#file-on-copy-js

In the above example all you have to do is add an eventListener to the copy event. The event that you receive contains clipboardData and its three methods: setData, getData, and clearData.

It actually has all methods and properties of the [DataTransfer](https://html.spec.whatwg.org/multipage/interaction.html#datatransfer) object. So you can inspect the properties, items and types in case you are not sure what arguments to use for setData or getData.

https://gist.github.com/JustinDFuller/ebef98aa6dbd0f10350dbf5db62cbce1#file-stop-pasting-js

This example shows what it would look like to not allow a user to paste text into an input with the ID of “passwordConfirmation”. It also doesn’t allow them to paste “theUserPassword” into any field (we’re pretending that’s actually their password. Please ignore for a moment that you should never have the user’s password available in plain text in your web app.).

Another example could be a profanity filter if you are creating a web app that expects young users.

You could go on to use the value retrieved from getData elsewhere in your app. As an example, maybe you need to log when data is pasted, like in a test-taking app. Sometime’s pasting text in that setting could be OK, but you may want to be able to go back later and ensure the pasted content wasn’t copied from elsewhere.

## Creating your own copy event.
> Copying text to the clipboard shouldn’t be hard. It shouldn’t require dozens of steps to configure or hundreds of KBs to load. But most of all, it shouldn’t depend on Flash or any bloated framework. — [clipboardjs.com](https://clipboardjs.com/)

Before we get into this, I’d like to introduce you to an open source project that simplifies everything I’m about to show you. It’s called “clipboard.js” and it allows you to easily copy text to your clipboard. You may find it easier than doing this on your own. It’s quite a small library, and has a very simple API.
[**clipboard.js**](https://clipboardjs.com/)

But we’re here to learn, so lets look at how you can copy text to the user’s clipboard using only Web APIs.

Since the ClipboardEvent object isn’t exposed in most browsers, we must go a different route. To accomplish this we’ll need to add to our tools, document.execCommand(). This will allow us to run a copy command that copies that current selection to the keyboard.

Here’s an example shown with CodePen:

https://codepen.io/Iamjfu/pen/WRGZOg

This must be triggered by a user event, like a click. This is a safety feature implemented on important operations, such as opening the file upload window, copying to a clipboard, etc. It helps to keep users safe from websites interacting with their computer when they don’t them want to.

A few notes:

* You can use either an input with the type attribute set to text, or a textarea. With the latter requiring one less line of code in order to create it.

* You may read that document.execCommand requires designmode, but as far as I can tell this is not true. It just needs to be triggered by a user initiated event.

* You probably want to wrap document.execCommand in a try/catch block. In some browsers it will throw an error on failures.

* You can inspect the result of execCommand to see if it worked or not. It returns a Boolean that relates to the success of the command.

And that’s it! You’re now successfully copying text to your clipboard!

Please feel free to check out some of my other writings on APIs: [Battery](https://justindfuller.com/posts/14), [Console](https://justindfuller.com/posts/15), and [Video](https://justindfuller.com/posts/16).

Also, please stay on the lookout for my upcoming post on the [DesignMode](https://developer.mozilla.org/en-US/docs/Web/API/Document/designMode) API and how it can be used with execCommand to do some really awesome stuff!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
