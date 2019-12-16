# Simply JavaScript: a straightforward intro to Mocking, Stubbing, and Interfaces

I like to think that I’m a simple guy, I like simple things. So whenever I sense complexity, my first reaction is to wonder if I can make things easier.

Before I transitioned to software development, I spent time as a sound engineer. I was recording bands and mixing live shows. I was even recording and mixing live shows for broadcast. During that time I talked with too many people who would always attempt to solve problems by purchasing some expensive, more complex equipment. Sadly the return on investment never seemed to be all it promised.

Instead of buying into the “more expensive, more complex is better” philosophy, I spent every evening learning the basics. I focused on fundamental skills. I learned how to use an equalizer to make a voice sound natural. I learned how to use a compressor to soften quick and loud sounds or to beef up thin sounds. It turned out that the return on investment for those hours was more than I ever hoped for!

I ended up favoring the simplest tools and I was very happy with the work I produced.

I believe the same principle can be applied to almost every aspect of life—finances, parenting, even software engineering.

As people, we naturally tend to look for flashy, popular solutions that promise to solve all of our problems (or at least to perfectly solve a single problem). We are misguided about these complex solutions. We’ve created complicated problems by not properly understanding the fundamentals of whatever we’re struggling with.

## JavaScript Basics

We’ll be looking at basic programming concepts and how they can be applied to JavaScript. The goal here is to have code that is simpler, more flexible, easier to understand, and easier to test.

First, before introducing interfaces, I’d like to talk about a problem.

### Mocking, stubbing, and mutating

Recently I was writing code that read files from the file system. The code worked great. To test it, I had to use a library that would stop my code from reading from the file system. My tests would have been too slow if I had let it do that. Plus I needed to simulate scenarios that would have been complicated to implement with the actual file system.

Historically I would have used a library like [Proxyquire](https://www.npmjs.com/package/proxyquire) or [Sinon](https://www.npmjs.com/package/sinon). Proxyquire allows you to override the imports of a file. Sinon allows you to mutate methods on an object. You can use either or both of these to make your code easier to test. Although it would be better to use just one.

As an example, let’s pretend you have a module called “a”. Let’s also say that module “a” imports module “b”. Proxyquire works by importing module “a” and overwriting the exports of module “b”. It won’t affect other imports of module “b” elsewhere. Sinon works by mutating the exports of module “b”. It will affect every place that imports module “b”, so you must remember to restore it when you are done.

```js
/* This is my file I'll be testing foo.js */

import fs from 'fs'
import { promisify } from 'util'

const readFileAsync = promisify(fs.readFile)

export function readJsonFile (filePath) {
 return readFileAsync(filePath).then(JSON.parse)
}

/* This is my test file foo.test.js */

import fs from 'fs'
import test from 'ava';
import { stub } from 'sinon'
import proxyquire from 'proxyquire'

test('readJsonFile with proxyquire', async function (t) {
  t.plan(2)
  
  /* fs.readFile is overwritten for this import of foo.js */
  const { readJsonFile } = proxyquire('./foo.js', {
    fs: {
      readFile(filePath, callback) {
        t.is(filePath, 'myTestFile')
        
        return callback(null, '{ success: true }')
      }
    }
  })
  
  const results = await readJsonFile('myTestFile')
  t.deepEqual(results, { success: true })
})

test('readJsonFile with sinon', async function (t) {
  t.plan(1)
  
  /* fs.readFile is overwritten everywhere */
  const fsStub = stub(fs, 'readFile')
    .withArgs('myTestFile')
    .callsArg(2, null, '{ success: true }')
  
  const results = await readJsonFile('myTestFile')
  t.deepEqual(results, { success: true })
  
  // Won't happen if test fails :(
  fsStub.restore()
})
```

### Why are stubs bad?

Neither of these options is great because they involve mutation. In software development, we want to avoid mutation when possible. because mutation leads to a decrease in predictability across an application.

One small mutation never seems like a big deal. But when there are many small mutations it becomes difficult to track which function is changing what value and when each mutation is being done.

There’s also the nuisance of lock-in. Both sinon and proxyquire will require you to update your tests if you change your file system library from fs to fs-extra-promise. In both cases, you’ll still be using the function readFileAsync. However, sinon and proxyquire will keep on trying to override fs.readFile.

## What are the alternatives?

To solve this problem I followed a principle called [Dependency Inversion](https://en.wikipedia.org/wiki/Dependency_inversion_principle). Instead of my module creating its dependencies, it will expect to be given its dependencies. This produces modules that are both easier to test and more flexible. They can also be made to work with many implementations of the same dependencies.

```js
/* This is my file I'll be testing foo.js */

export default function ({ readFileAsync }) {
  return {
    readJsonFile (filePath) {
     return readFileAsync(filePath).then(JSON.parse)
    }
  }
}

/* This is my test file foo.test.js */

import test from 'ava'

import foo from './foo'

test('foo with dependency inversion', function (t) {
  t.plan(2)
  
  const dependencies = {
    readFileAsync(filePath) {
      t.is(filePath, 'bar')
      
      return Promise.resolve('{ success: true '})
    }
  }
  
  const result = await foo(dependencies).readJsonFile('bar')
  t.deepEqual(result, { success: true })
})
```

Not only have precious lines been saved in our code, but there is also no more worrisome mutation happening! The module will now accept readFileAsync rather than creating that function itself. The module is better because it’s more focused and has fewer responsibilities.

### Where does the dependency go?

The dependencies have to be imported somewhere. In an application that follows dependency inversion, you should move the dependencies as far “out” as you can. Preferably you’d import them one time at the entry point of the application.

```js
/* json.js */

export default function ({ readFileAsync, writeFileAsync }) {
  return {
    readJsonFile(fileName) {
      return readFileAsync(`${fileName}.json`).then(JSON.parse) 
    },
    writeJsonFile(filePath, fileContent) {
      return writeFileAsync(filePath, JSON.stringify(fileContent)) 
    }
  }
}

/* content.js */

export default function ({ readJsonFile, writeJsonFile }) {
  return {
     getContent(contentName) {
      // business logic goes here.
      return readJsonFile(contentName)
     },
     writeContent(contentName, contentText) {
      // business logic goes here
      return writeJsonFile(contentName, contentText) 
     }
  }
}

/* index.js where the app starts */

import fs from 'fs-extra-promise'
import jsonInterface from './json'
import contentInterface from './content'

const json = jsonInterface(fs)
const content = contentInterface(json)

// content can be used by an http server
// or just exported if this is a library
export default content
```

In the example, you saw that the dependencies were moved to the entry point of the application. Everything except index.js accepted an interface. This causes the application to be flexible, easy to change, and easy to test.

## What else can Dependency Inversion do?

Now that you’ve fallen in love with dependency inversion I’d like to introduce you to some more of its power.

When your module accepts an interface, you can use that module with multiple implementations of that interface. This is a scenario where the libraries [TypeScript](https://www.typescriptlang.org/) and [Flow](https://flow.org/) can be useful. They’ll check that you’ve provided the correct interface.

**An interface is simply a collection of methods and properties**. So by saying that a module accepts an interface, I am saying that a module accepts an object that implements a set of methods and properties. The expectation is that the interfaces similarly implement different functionality.

A common interface you might know is the React component interface. In TypeScript it might look like this:

```js
interface ComponentLifecycle {
      constructor(props: Object);
      componentDidMount?(): void;
      shouldComponentUpdate?(nextProps: Object, nextState: Object, nextContext: any): boolean;
      componentWillUnmount?(): void;
      componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
      setState(
          state: ((prevState: Object, props: Object) => Object,
          callback?: () => void
      ): void;
      render(): Object | null;
      state: Object;
  }
```
    
Please don’t despair if you didn’t understand everything in that interface. The point is that a React Component has a predictable set of methods and properties that can be used to make many different components.

We are now beginning to venture into the territory of the [Open-Closed Principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle). It states that our software should be open for extension but closed for modification. This may sound very familiar to you if you’ve been building software with frameworks like [Angular](https://angularjs.org/), or [React](https://reactjs.org/). They provide a common interface that you extend to build your software.

Now, instead of relying on third-party interfaces for everything, you can begin to rely on your internal interfaces to create your software.

If you are writing a CRUD (create, read, update, delete) application, you can create an interface that provides the building blocks for your actions. Your modules can extend that interface to implement the business logic and use-cases.

If you are writing an application that performs tasks, you can build a task interface that provides the building blocks for different tasks. Each task can accept that task interface and extend it.

Dependency inversion and the Open-Closed principle allow you to write more reusable, testable, and predictable software. You’ll no longer have a jumbled mess of spaghetti code. Instead, you’ll have a uniform group of modules that follow the same pattern.

### Many Implementations

There’s one more benefit to accepting an interface. You can implement that interface in many different ways.

Here’s my favorite example of this. Imagine that you have an interface for a CRUD application. You could have one interface that implements the database storage. This is great, but what if the database reads or writes become slow? You could also write a faster implementation that uses [Redis](https://redis.io/) or [Memcached](https://www.memcached.org/) to speed up the response times. The only change you’ll have to make is writing a new interface. There will be no need to update business logic or anything else.

You could consider React and [React-Native](https://facebook.github.io/react-native/) to be popular examples of this. They both use the same React component and React DOM interfaces, but they implement them differently. Even inside React Native, there is an implementation for both IOS and Android. Multiple implementations allow you to write your logic once and execute it in multiple ways.

## Now what?

Now that you’ve learned about dependency inversion and the open-closed principle, it’s time for you to go and apply it in your code. Don’t write any imports in the next module you write. Instead, allow it to accept an interface. In your tests, you’ll be able to avoid third-party libraries that mutate your dependencies! Then try to start identifying where common interfaces can be used. You’ll slowly but surely create a better application!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
