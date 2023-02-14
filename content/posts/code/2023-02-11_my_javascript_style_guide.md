---
author: "Justin Fuller"
date: 2023-02-11
linktitle: "My JavaScipt Style Guide"
menu:
  main:
    parent: posts
next: /posts/my-javascript-style-guide
title: "My JavaScript Style Guide"
weight: 1
images:
 - /my_javascript_style_guide.png
tags: [Code]
draft: true
---

JavaScript is a powerful language that I've used to successfully write complex programs.
However, the paradigms of the community yield obscure, disjointed, incoherent code.

<!--more-->

I attribute these results to the bad influence of useful tools, such as NPM, Babel, Webpack, the AirBnB Style Guide,
Angular, and even further back to spaghetti-inducing JQuery paradigms.

But, I do not want to complain about the bad habits of others.
Instead, I want to propose a style for writing comprehensible JavaScript.

**But first, a warning:** You are probably going to hate these suggestions.

{{< table_of_contents >}}

## Principles

* Verbose code is understood code.
* Understandable code is the best recipe for correct code.
* Don't write a single character without a clearly articulated purpose.
* Understanding code is far more difficult and time-consuming than writing code.
* Engineers avoid reading code and documentation as much as possible.

## Project Structure

### Domain-Driven Files and Folders

Instead of making a shared or common folder, put reused files at the root directory (or at the same level that you would place the shared folder).
Avoid introducing structure that reflects the technology, and instead use your structure to reflect domain concepts.

**Incorrect:**

```text
.
└── src/
    ├── routes/
    │   ├── Home.jsx
    │   └── Article.jsx
    └── shared/
        └── url.js
```

**Correct:**

```text
.
├── Home.jsx
├── Article.jsx
└── url.js
```

**Correct:**

```text
.
├── Home/
│   ├── Route.jsx
│   ├── api.js
│   └── styles.js
├── Article/
│   ├── Route.jsx
│   ├── api.js
│   └── styles.js
└── url.js
```

#### Why?

Could you learn what your project does by looking at the root of your repository?
What about the second level folder?

In some projects, you have to navigate through two, three, four, or more folders just to figure out what domain concepts it operates on.

Now, how can you succesfully understand and operate on your domain, if you cannot clearly see and understand what it is?

Terrible frameworks, such as Angular.js, and awful paradigms such as Model View Controller (MVC) have led us to organize projects in arbitrary and unhelpful ways.

So, instead of organizing your project around something meaningless to your product, such as routes, organize it around domain concepts.

### Prefer Fewer, Flatter Files

There are a myriad of valid reasons to split of functions, files, and folders.
However, size is not one of them.
I'm sorry if your finger hurts from scrolling.
Perhaps you can learn how to navigate more quickly with your keyboard.
Even better, use the search feature.

If you'd like to confuse your colleagues, I suggest splitting your code into many helper functions, then spread those helper functions throughout dozens of files and folders.

On the other hand, if you want to enable your colleagues (and yourself) to understand your code: only split it up when absolutely necessary, when you have a good reason, and even then, do it as little as possible.

### Domain-Driven Variable Names

The following names are essentially meaningless:

* util, utils, utilities, helper, helpers
* key, value, data, entry
* service, factory
* shared, common

By using any of these names, you are declaring: "I don't know what this code is used for. I don't know what it is operating on. I don't know who or what uses it."

Instead, you should use names that describe the **domain** on which your code is operating.

For example, let's say you need some helper functions to operate on a URL.

**Incorrect:**

```js
// utils.js

export function normalizeURL(url) {
  return url.endsWith("/") ? url : url + "/";
}

// Imported as:
import { normalizeURL } from './utils';

normalizeURL('https://www.justindfuller.com/')
```

**Correct:**

```js
// url.js

function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

export const URL = {
  ensureTrailingSlash,
}

// Imported as:
import { URL } from './url';

URL.ensureTrailingSlash('https://www.justindfuller.com/')
```

#### Why?

As I've claimed, naming things is one of the hardest problems in Software Engineering.

In my experience, engineers love two types of meaningless variables.

The first is the "cute" name that is cool, catchy, and ultimately meaningless.
Like naming your browser "Firefox".

The second is the vague, name, such as "util" or "data".
These are meaningless because all code constitutes a "utility" that operates on "data".

Neither type of name helps other engineers (or your future self) understand what is going on in the code.

The best names utilize descriptive terms that are meaningful to the relevant domain of your project.

### Prevent Export Renaming

*Never* use default exports. In fact, don't even use regular exported constant or functions.
Instead, wrap the exports in an exported variable that matches the module name.

**Incorrect:**

```js
export default function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

// Imported as:
import ensureTrailingSlash from './url';

ensureTrailingSlash("https://www.justindfuller.com");
```

**Incorrect:**

```js
export function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

// Imported as:
import { ensureTrailingSlash } from './url';

ensureTrailingSlash();

// Or import as:
import * as urlUtils from './url';

urlUtils.ensureTrailingSlash("https://www.justindfuller.com");
```

**Correct:**

```js
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

export const URL = {
  ensureTrailingSlash,
}

// Imported as:
import { URL } from './url';

URL.ensureTrailingSlash("https://www.justindfuller.com");
```

#### Why?

Naming things is one of the hardest things in software engineering.
A well-named variable (meaning it is accurate and concise) is rare.

Since thinking of good names is difficult and time-consuming, 
it is natural for engineers to not take the time to do it properly.
So, when you create a module, you should think very carefully about the names given to your exported functions and variables.

But you should also think carefully about how your module will be referenced.
By providing a consistent name, your module will be easier to find and understand.
Also, engineers will have to spend less time thinking of how to name your module when they import it.

Whenever they *do* want to rename it, they must explicitly do so.
This adds an extra barrier to the process, hopefully prompting them to think carefully about what they are doing.

### Prevent Returned Variable Renaming

**Incorrect:**

```js
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

// Import As:
import { URL } from './url';

const modified = url.ensureTrailingSlash("https://www.justindfuller.com")
```

**Incorrect:**

```js
function ensureTrailingSlash(url) {
  return {
    normalized: url.endsWith("/") ? url : url + "/",
  }
}

// Imported as:
import { URL } from './url';

const { normalized } = URL.ensureTrailingSlash("https://www.justindfuller.com")
// or
const url = URL.ensureTrailingSlash("https://www.justindfuller.com") 
```

**Correct:**

```js
function ensureTrailingSlash(url) {
  return {
    url: {
      normalized: url.endsWith("/") ? url : url + "/",
      original: url,
    }
  }
}

// Imported as:
import { URL } from './url';

const { url } = URL.ensureTrailingSlash("https://www.justindfuller.com");
console.log(url.normalized) // https://www.justindfuller.com/
```

#### Why?

Have you ever attempted to follow a single variable through a particular path in the code,
only to find it difficult because that variable is renamed a dozen times?

This problem is similar to [Prevent Export Renaming]({{< ref "#prevent-export-renaming" >}} "Prevent Export Renaming"), but it applies to returned variables and properties.

When code uses domain-driven variable naming, the property names are intentional. They should only be re-named with great care.
But, when a function directly returns a variable, engineers are prompted to come up with a name each time they use your function.

By preventing variable renaming, you reduce the burden on engineers using your function.
You reduce the chances that the same variable with have different names throughout the code.
Your codebase will gain consistency and other engineers jobs will become easier.

### Immutable Functional Classes

Store complex state in immutable functional classes.

**Incorrect:**

```js
const [postTitle, setPostTitle] = useState("");
const [postBody, setPostBody] = useState("");
```

**Incorrect:**

```js
class Post {
  constructor() {
    this.title = ""
    this.body = ""
  }

  setTitle(title) {
    this.title = title
  }

  setBody(body) {
    this.body = body
  }
}

const [post, setPost] = useState(new Post());
```

**Correct:**

```js
const postDefaults = {
  title: "",
  body: "",
};

function newPost(post = postDefaults) {
  return Object.freeze({
    ...post,
    setTitle(title) {
      return newPost({
        ...post,
        title,
      });
    },
    setBody(body) {
      return newPost({
        ...post,
        body,
      });
    },
  });
}

const [post, setPost] = useState(newPost());
```

#### Why?

TODO

## Logic

### Explicit Checks

**Incorrect:**

```js
if (someBoolean) {
  // do something
}
```

**Incorrect:**

```js
if (!someThingThatCouldBeUndefined) {
  // do something
}
```

**Correct:**

```js
if (someBoolean === true) {
  // do something
}

if (someThingThatCouldBeUndefined === undefined) {
  // do something
}
```

#### Why?

TODO

### Indented Error Flow

Indented lines should never contain the "happy path".
Unindented flows should never contain error paths.

**Incorrect:**

```js
if (something === true) {
  if (somethingElse === true && anotherThing === false) {
    // do something
  }
}
```

**Correct:**

```js
if (something === false) {
  return
}

if (somethingElse === false) {
  return
}

if (anotherThing === true) {
  return
}

// do something
```

#### Why?

TODO

## Style

### Always Use Brackets

**Incorrect:**

```js
if (someBoolean === true) doAThing();
```

**Correct:**

```js
if (someBoolean === true) {
  doAThing();
}
```

#### Why?

TODO

### Embrace Short Variables

And allow the surrounding code context to provide additional information.

**Incorrect:**

```js
export function stringifyABTests(allUserABTests) {
  return allUserABTests.map(function(userABTest) {
    return userABTest.name + '=' + userABTest.variant
  }).join(',')
}
```

**Correct:**

```js
function stringify(tests) {
  return tests.map(function(t) {
    return t.name + '=' + t.variant
  }).join(',')
}

export const abtests = {
  stringify,
}
```

#### Why?

TODO

### Prefer Regular Functions

Unless you are using the `this` keyword.

**Incorrect:**

```js
const ensureTrailingSlash = (url) => {
  return url.endsWith("/") ? url : url + "/"
}
```

**Incorrect:**

```js
function ensureTrailingSlash() {
  return this.url.endsWith("/") ? this.url : this.url + "/"
}
```

**Correct:**

```js
function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/"
}
```

**Correct:**

```js
const ensureTrailingSlash = () => {
  return this.url.endsWith("/") ? this.url : this.url + "/"
}
```

#### Why?

TODO

### Embrace Re-assignment

As long as the types are the same and the variables will not affect other scopes.

**Incorrect:**

```js
const request1 = await users.get('id1');
if (request.error) {
  return
}

const request2 = await users.get('id2');
if (request.error) {
  return
}
```

**Incorrect:**

```js
function normalize(url) {
  const lowerCase = url.toLowerCase();
  const withoutQuery = lowerCase.split('?')[0];
  const withoutHash = withoutQuery.split('#')[0];
  return withoutHash;
}
```

**Correct:**

```js
let request = await users.get('id1')
if (request.error) {
  return
}

request = await users.get('id2')
if (request.error) {
  return
}
```

**Correct:**

You could also use chaining here.

```js
function normalize(url) {
  url = url.toLowerCase();
  url = url.split('?')[0];
  url = url.split('#')[0];
  return url;
}
```

#### Why?

TODO


