
# How To Write Error Messages That Don’t Suck

“A validation error occurred.” Yep. Thanks!

The release is imminent; this is the last update that needs to be verified, and I get an error message that’s as useful as the close button on an elevator.

It turns out that it *is* a validation error, kind of. The input I am giving is a duplicate. It’s valid, it just already exists!

Wouldn’t it be so helpful to know that?

It would be helpful to be informed of several things when errors happen. I don’t need to know everything. The history of programming won’t help me here. The message should give me just enough info for me to get this error fixed so that I can finish my work, go home, and play with my kids.

### What makes an Error?

In JavaScript, an error object always has the name, message, and stack properties. The name gives you an at-a-glance classification of the error. The stack tells you where it happened. The message? Well, according to some developers, you don’t need to worry about that! “The stack trace gives you everything you need.”

Please, don’t be one of those developers.

### Useful Error Messages

Raise your right hand, place your left hand on a copy of “Clean Code” and repeat after me.

“I swear to include enough detail in my error messages that future developers will easily be able to determine what went wrong and what they need to do to fix it.”

### What Happened

When a police officer pulls you over to give you a ticket, does it say “Bad Driving”? No! It says you were going 65 miles per hour in a school zone, you passed a stopped bus, and your car hasn’t been inspected in four years! Sure, you’re going to jail, but at least you know *why*.

So the error message from earlier should not be, “A validation error occurred”, but instead:

```
Unable to save model "user" because the property "email" with value "JustinFuller@company.com" already exists.
```

Instead of a simple error that says, “Invalid option” use:

```
The option "update" is not valid. Valid options include "upsert", "get", and "delete".
```

These updated error messages attempt to help us understand the cause, giving us a start toward the solution.

### How It Might Have Happened

Now that the error is describing what exactly went wrong, it’s time to help the poor soul who stumbled into this predicament begin to climb back out. Watch carefully. When done correctly it will seem like you’re reaching forward through time by anticipating what could have led to this unfortunate turn of events. You’ll be right there with that future developer — maybe yourself — telling them that everything is fine, that you’ll get through this together.

You’ll begin by explaining what happened.

For anything that has a prerequisite step, such as configuration or validation, you can suggest verifying that step has been completed. Don’t worry if your error messages get long. It’s better to provide too much information than not enough.

I’ll add more detail to one of the earlier examples:

```
The option “update” is not valid. Valid options include “upsert”, “get”, and “delete”. **If you expected “update” to be an option, you must first export it from the file: "./src/controllers/index.js".**
```

Now you are anticipating how this might have happened: the developer probably just forgot to export the new option. The error becomes a reminder of that step. You’ve now shown two possible causes of the error; the first is a possible typo (here are the valid options) and the second is a configuration error (here’s where it should be exported).

The React library does an excellent job of anticipating how errors might have occurred. They don’t address every edge case, but they do give helpful hints for the most common errors. For example, you can’t use the function reactDom.renderToNodeString() in the browser because node streams don’t exist there. So React gives you a suggestion of how it happened and how to fix it:

```
ReactDOMServer.renderToNodeStream(): The streaming API is not available in the browser. Use ReactDOMServer.renderToString() instead.
```

There could be other ways for that error to occur, but they guess that the most common reason is that renderToNodeStream was called in the browser.

### Relevant Data

While writing error messages you must remember that applications rarely do only one thing at a time. So when errors occur it’s a challenge to find the state of the application at that time. For this reason, it’s very important to capture the relevant data and relay it back to the developer so that they can pinpoint the cause.

In the first example, I included the phrase:

```
The property “email” with value “JustinFuller@company.com” already exists.
```

This is very useful but could be impractical. It may take too much effort or time to create natural language errors for every variation of data, or in some cases, we may simply be passing on a failure outside of our control, so the only option left is to give a good description and include as much relevant data that is safe to print.

The choice of what data is safe to print is tricky: if you choose exactly what properties to include then you end up modifying the list every time there is a new property, or, worse, you forget and it doesn’t show up when needed; on the other hand you can remove properties that are known to be unsafe, but here you risk adding a new property and forgetting to exclude it, causing leaked sensitive data. You have to use your judgment and consider your company rules. Does your software handle highly valuable or personal data that should not be written to a non-encrypted destination? Thoughtlessly logging out every object that causes an error is liable to get you fired from some jobs, while at others it’s the standard operating procedure. So please, use common sense and be careful!

### Unexpected Errors

There are two ways to include relevant data when you don’t know exactly which property or action caused the error.

The first should be used when you intend for the error to be read by humans, you put the data right in the message: `An error was received: “Duplicate entry found for user.email”, while upserting user: { “email”: “justinfuller@company.com” }`. This error style has its drawbacks, like the entire object being placed into the error message that could be sent somewhere unintended. If, however, you know it’s safe then this style has the advantage of giving complete details about the situation.

In other cases, you may not want the data to leak to a log file or an API response. You can provide a reference ID, a timestamp that can be manually or automatically referenced to data later, or some other property that will allow the developer to track down the pesky data-point that caused an error.

### Expected Errors

I’ll be the first to admit that I’m prone to making simple mistakes. I type “upswert” instead of “upsert”; I type “npm tes” instead of “npm test”. So it’s refreshing when I get an error message saying:

```
Received an unknown command, "npm tes". Did you mean "npm test"?
```

When the developers prepped for this, they must have gazed into the future and saw that someone would make that typo — or maybe they just know that humans are prone to silly errors.

Whenever there’s a step in a process that can go predictably wrong you have an opportunity to prepare clear guidance on what went wrong and how to fix it.

### Steps To Fix The Issue

For some errors, it will be possible to give a solution to the error instead of just reporting that it happened. Some times it will be easy, like earlier when we showed the correct options after accidentally typing “update” instead of “upsert”. Other times you’ll need to put in more effort to give the user enough information to correct their mistake, like if you’ve detected a recursive dependency, and you need to tell them where the loop is and what they must do to remove it.

### An error that doesn’t suck

So, do you want to provide helpful error messages? Next time you write an error, try to include a full description of what happened, how it might have happened, any relevant data that is safe to include, and any steps that might help resolve the problem.

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
