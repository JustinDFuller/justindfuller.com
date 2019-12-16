# Introducing Promise-Funnel

Today I’d like to give a quick overview of a new library that is made to help you manage the flow of your application.

![](https://cdn-images-1.medium.com/max/2000/1*tZhpkuhrEQagrdZdZJ5WVQ.png)

The use case was inspired by two particular problems I had recently.

In problem one I had a React App that authenticates both immediately, and on a regular interval. During each authentication the requests to retrieve data needed to wait. I did not want to receive or show unauthenticated response errors during this time.

In the second problem, I had a database micro-service that immediately invoked functions that send queries, but it needed to complete the connection to the database before any queries are actually sent.

This problem seems to be somewhat common. That’s where promise-funnel comes in! You can check it out [on NPM](https://www.npmjs.com/package/promise-funnel).

### Concepts

Promise-funnel is a very tiny (4kb) and a very simple library. It exports three functions.

**Wrap:** Any function that you want to be funneled must be wrapped.

**Cork:** To pause functions from executing you can cork the funnel. All function executions will collect so that they can run later.

**Uncork:** To begin execution again, and execute every function that should have run while the funnel was corked, you can uncork the funnel.

When combining these simple concepts we are able to create a powerful control-flow for our application!

### How to use it

Here’s how you might use it with a database application that needs to connect before sending any queries.

https://gist.github.com/JustinDFuller/a334841f01192fc33ad436c1d8db85a5#file-withdatabase-js

You can see that queries were immediately corked and were only uncorked when the database connection was successful. This means that the service can immediately accept requests, but it won’t execute any queries until the database connection happens!

Now let’s look at the authentication example that I mentioned earlier.

https://gist.github.com/JustinDFuller/1bdcf88233f2b7e1966775ebaa2497ec#file-authentication-js

Every five minutes the user is re-logged in. While login is happening every user request would fail. So instead of letting that happen, we’ve corked the fetch requests until login is complete. Now the user won’t be stopped by authentication.. although they might be delayed!

In case you’re wondering, createFunnel will create a new funnel instance each time. This means that you can safely funnel different actions separately.

### **Using your own Promises**

Not every environment has Promises natively. If you want to use a library like Bluebird with promise-funnel, you can!

https://gist.github.com/JustinDFuller/5cb609d74f417ccf85dd920c53b49569#file-bluebird-js

### The Promise Part

So far we haven’t really seen how a Promise is used by this library. A function won’t execute immediately when both the function is wrapped and the funnel is corked. A Promise is returned instead. It will resolve or reject only when the funnel is uncorked.

https://gist.github.com/JustinDFuller/c7fb196332a50dcc4b8c5bafa2addb85#file-promises-js

The code snippet above should show that uncorking the funnel will resolve the promise that was returned by the wrapped function.

This means that any functions that use await on a wrapped function or uses `.then().catch()` on a wrapped function will not continue until the funnel uncorks.

There you have it! promise-funnel is a tiny library, but I hope you all can find it useful.

To install it you can use the command:

```
npm install promise-funnel --save
```

You can also view the source code here: [https://github.com/JustinDFuller/promise-funne](https://github.com/JustinDFuller/promise-funnel)l

### Feedback

This is a brand new library and can obviously still be improved. Do you have any suggestions? For example, maybe it would benefit from optionally uncorking with only a certain amount of concurrency to avoid large bursts. There could also be other ways to accomplish what promise-funnel is supposed to. Feel free to share suggestions and alternative tools in the comments!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
