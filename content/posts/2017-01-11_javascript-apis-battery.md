---
author: "Justin Fuller"
date: 2017-01-11
linktitle: "JavaScript APIs: Battery"
menu:
  main:
    parent: posts
next: /posts/javascript-apis-battery
title: "JavaScript APIs: Battery"
weight: 1
images:
  - /learning-javascript.jpeg
aliases:
  - /posts/2017-01-11_javascript-apis-battery
tags: ["Programming"]
---

Yes, you heard me right, the Battery API! As the web expands, so does the number of devices we expect to use our programs. This API can be particularly useful for protecting our mobile users and their precious battery life! So before we look at the API lets think of some reasons why we might need such a thing:

<!--more-->

* Decreasing processing and requests when the battery is low.

* Provide users with warnings. Especially useful if your users are working with time-sensitive data or actions, or if you know your app is a power-drainer.

* Serve a simpler, low power version of the site.

So let’s take a look at how you might use it.

https://gist.github.com/JustinDFuller/602e16f9cb147fecc441af9827238b3a#file-battery-js

A few things to note in the above example:

* getBattery is not available in all browsers. Make sure you perform a check before attempting to use it!

* The return value of getBattery is a `Promise` which resolves with the BatteryManager object.

* When the `onchange` function is called, you must re-inspect the original `BatteryManager` object that was provided by the promise. It will be modified and contain the new battery information.

* When the `onchange` function is called it receives one argument, event, which helpfully contains `event.type` that tells us which battery event happened. This allows you to reuse a single event handler!

## Using The Data

Now that we see how to *get* the data, let’s take a look at how we can *use* it!

In this example, we will watch for the battery to get low, and show an alert when it’s below a certain level.

https://gist.github.com/JustinDFuller/a35c05fd6dcebf8c8fe8f4f6335ba6c1#file-low-battery-js

The battery properties we are inspecting:

* `dischargeTime` is the amount of time until the battery is empty, in seconds. Its value will be infinity if the device is plugged into a power source.

* `level` is a percentage. So 0.2 is 20%.

You can customize these to fit your needs. In a highly time-sensitive environment, you may want to let them know earlier than 20% or 20 minutes.

A final note: Most devices will warn users when the battery is low, so you likely won’t need to add the example warning message to your application. Instead, you could limit your processes and display a message that processing is limited until the battery has been charged. Remember, this API is just another resource that allows you to solve problems for your users.

Feel free to check out some of my past posts: [Console API](https://justindfuller.com/posts/15), [Video API](https://justindfuller.com/posts/16).

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
