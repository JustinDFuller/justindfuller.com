
# Why you should use functional composition for your full applications



Function composition is growing in popularity, so I say it’s about time we considered composing full applications. Give me a few minutes of your time, and we’ll see if you agree!

## Two problems

Imports are an amazing addition to the JavaScript language. They allow you to split code into small modules and only import what you need. Problems arise because any exported functions will now come with the assumed context of those imports. We’ll look more deeply into those problems in a moment.
> # “The problem with object-oriented languages is they’ve got all this implicit environment that they carry around with them. You wanted a banana, but what you got was a gorilla holding the banana, and the entire jungle”
> # — Joe Armstrong

Next, try to remember the last time you started to work on someone else’s project. Did you find yourself wondering where the database connection was? Where the websockets were initially instantiated?

Finding what you need in an application can be very difficult when applications aren’t composed. It can be daunting to have to follow the chain of imports, particularly if you aren’t starting at the entry of the application.

### Imports

I recently calculated the average number of import statements across all files in each of the apps I’m working on. I came up with an average of about 750. The highest was over 2500, and the lowest was around 300.

Each of those imports means that when writing tests, I would be forced to test the imports along with the exported code. To avoid testing the imports, I can overwrite them with a library like proxyquire or jest. This works, but at the cost of adding a significant amount of complexity to each unit test.

Do you like complexity? I sure don’t.

### Walking the dependency tree

Following the import path of an application to find a specific component is a very common task for developers.

Each file imports its dependencies, so you may find yourself following links from one file to another to find the component you’re looking for. Read this database example and see if it sounds familiar…

* You start out in the index or main function, then see that it imports a server…

* That server imports routes

* Those routes import services

* Next, you see that the services import models

* Then the models import the database…

* Finally you find that the database imported is actually a singleton that instantiated the connection the first time it was imported. It did this by importing a third party library.

![Me after following that many levels of imports](https://cdn-images-1.medium.com/max/2000/0*gSyOcZNAgLwA9DNm.gif)
*Me after following that many levels of imports*

## Another Way

Do you think this seems a little backwards?

I think it would make more sense to structure an application in almost the complete opposite manner. Instead of an import tree, we would have a composed and almost linear flow of functions.

This happens to fit right in with a concept called [Dependency Inversion](https://www.oodesign.com/dependency-inversion-principle.html). Instead of requesting its own dependencies, a piece of software can simply accept them as an argument of some kind!

Let’s look at the database example again, but this time with a hint of composition.

First you instantiate the database connection. Then you hand that database connection to the models. Next those models are handed to the server. Finally the server uses them in the routes. Your index or main function simply sets off this chain of events. Maybe it could look something like this:

```js
import config from './config';
import Database from './Database';
import Models from './Models';
import Server from './Server';

function startApplication() {
  const env = config();
  const dbConnection = Database(env);
  const models = Models(env, dbConnection);
  const app = Server(env, models);
  return app;
}
startApplication();

// or

export default startApplication;
```

You can see everything that takes place and where it happens. It all happens right here at the entry to the app! You know exactly where each part of the application is started.

Notice I threw in an extra piece: env. Instead of constantly checking process.env or importing config all over the app, you see that it is created in one place and then given to the rest of the steps.

## Application Composition

What I’ve just hinted at is what I like to call application composition. The point is to compose an application from small functions. Each piece lays the foundation for the next. Every major entry point is visible from one file. Each piece returns it’s own methods or properties for the next pieces to use.

The above example is a major simplification. It doesn’t account for asynchronous functions, and passing in all those arguments will become tedious.

Wouldn’t it be nice if each function could access the results of all the previous functions? Let’s see if we can make that happen!

The code snippet below shows a simple reducer that merges objects and freezes them. It accounts for async functions, too. You can simply return an object containing any properties that you want to make available to each of the following functions.

```js
import Promise from 'bluebird'; // For environments without Promises.
import { compose, reverse } from 'lodash/fp'; // Or any functional utility library

const mergeFreeze = compose(
  Object.freeze,
  Object.assign,
);

const reducer = (sum, fn) => Promise.resolve(fn(sum)).then(res => mergeFreeze({}, sum, res));

const reduceAndMerge = functions => Promise.reduce(reverse(functions), reducer, {});

export default reduceAndMerge;
```

Fantastic! The function above will be our tool to make this all work. But… how exactly does it work? I’m glad you asked!

You simply give reduceAndMerge a list of functions like this:

```js
import reduceAndMerge from './reduceAndMerge';

reduceAndMerge(
  initializeServer, // Start the server listening.
  createRoutes, // Create an array or object of routes.
  createModels, // Create models that are available to the routes.
  initializeDbConnection, // Connect to the DB
  initializeLogger, // Start a generic logger for the app to use.
  initializeConfig, // Set config defaults and import process.env
);
```

Pretty cool, eh? You use it just like any compose function. Each function is invoked (from right to left, or bottom to top). The result of each function is passed to the next function.

(I recommend you check out [this fantastic explanation](https://github.com/getify/Functional-Light-JS/blob/master/manuscript/ch4.md/#chapter-4-composing-functions) if you’re not familiar with Composing functions.)

The difference here is that the result is expected to be an object. That object is then merged with every object that came before it, then it’s frozen. Each function receives the results of what came before it.

### But my app isn’t one single linear flow!

You’re probably right! Most apps are not one single linear flow. Why? Because you and I never tried to make them that way. But with some adjustments, most apps probably can be.

Think about your app for a moment. What do you find yourself constantly importing? Maybe you check process.env in several files. Maybe you have a logger utility. Database models and connections are common to have, and so are services that use that connection. These are all candidates for composable functions!

### What do composable functions look like?

Alright, you want an example. I’ve got it covered. Let’s look at the logger function that I’ve alluded to a few times now.

```js
export default ({ dependencies }) => ({
  log: dependencies.bunyan.createLogger({ name: 'compose-app' }),
});
```

It’s extremely simple. From this point on, each function will receive an object that contains the log property.

But hold on! You see that I didn’t import Bunyan directly. This is a very important piece of this puzzle. Third party dependencies are a big source of what we need to proxyquire when testing our files. By passing in dependencies as an object, we are able to test them very easily.

### Testing

Because we didn’t import our dependencies, this logger utility is extremely easy to test. Take a look!

```js
import test from 'ava';
import logger from './logger';

const bunyan = {
  createLogger() {
    return { 
      test: 'test' 
    };
  },
};

test('It returns the result of bunyan.createLogger inside the log property', (t) => {
  const res = logger({ dependencies: { bunyan } });
  t.true(res.log.test === 'test'); // Make sure it returns the bunyan object inside the log property.
});
```

No proxyquire or other stubbing function is required.

### So how do I import my dependencies?

You’re full of great questions today! Instead of importing your dependencies throughout your app, you will do it in one file instead. The advantage to this is you can have an immediate picture of what your app is actually importing.

You can also modify the imports in one central location. A common example is to use Bluebirds Promisify function. It turns a function that uses a callback into a function that uses Promises.

### This is just dependency injection…

Right you are! Dependency injection is a well-known, battle-hardened, and time-tested practice. It allows us to explicitly call out our dependencies in a functional manner. You no longer have to use proxyquire or another mocking utility, you just pass in the expected interface!

### This requires too many changes

I suspect at this point you are thinking about the production application you work on every day. You know that it’s littered with imports and impure functions. It would simply be too difficult and time intensive to change the architecture now.

Don’t think about refactoring your entire app. Don’t think about refactoring your entire current feature, even. Instead start small. Begin by using small, reusable, composable functions.

Over time you will see the effects begin to snowball.

First you compose functions, then you compose components, then you compose features, and finally you compose applications.

*One bite at a time.*

### Resources

[Here is an example](https://github.com/JustinDFuller/compose-app) of a (small) fully composed application. It contains a composed app with configuration, third party dependencies, a database connection, models, websockets, and an express server.

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
