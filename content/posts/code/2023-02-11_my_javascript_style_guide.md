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

Great software engineering, like all art and science (after all—software engineering is a mixture of art and science), requires peace and clarity of mind.
Without this, you will build your personal problems right into the software itself.

<!--more-->

Over the years I've built plenty of my personal problems into software. This has caused me to do two things: first, I've built the wrong software; second, I've built software the wrong way.

Today, I'd like to talk about that second type of problem.
Mostly because I'm still not sure I'm qualified to talk about how to solve the right problems.
In fact, I've got some people telling me, right now, that I'm solving the wrong problem. 
I'm not convinced that they are wrong, but I also can't figure out if they are right.
I admit that this is a far more important topic, but I'm just not ready yet to give advice on it.

So, I want to talk about the second problem. Later, there's going to be a lot of code and examples.
But, like many other things in life, they are worthless without context and reasons.
Those reasons bring us back to where I started, only a few sentences ago: clarity and peace of mind.

Have I built my personal problems into software? You bet. Let's begin with the most obvious: my laziness.
There's a quote, maybe from Bill Gates, that says, “I choose a lazy person to do a hard job. Because a lazy person will find an easy way to do it.”
But this implies a thoughtful, intentional laziness. A laziness that does have peace of mind.
My laziness has been anything but. I call mine, "laziness of the fingers."
Meaning, I take shortcuts just to save a little typing.

I vividly remember a project where I chose to enable a reusable feature by setting a flag (I know, that's vague, but the details don't really matter), saying "if we have to do this again, we'll just have to set this flag and it will work. This should make it a lot easier."
You see, I thought the hard part of enabling that feature in the future would be the _typing_.
Well, about a year later—just enough time for the original implementation to seep from my mind—we needed to add that feature again.
I remembered adding the flag, so I told my team it would be easy.
But it wasn't.
First, I couldn't quite remember what the flag was (and I of course had not documented it).
So just enabling the flag was difficult.
Next, the feature needed to be _slightly_ different than the first one.
So I had to go in and add special cases for the new implementation.
Now it gets even worse. Those special cases ended up breaking the original implementation.

At this point I was about five years into my career. I somehow had "Senior" in my title.
Shorly after I would be promoted, for the first time, to a "Tech Lead" of the entire team.
Yet, it was at this point that I realized for the first time, that typing was not the hardest part of software engineering.
Up until that point, much of what I had engineered was shortcuts to save time typing things out.

But it did not actually sink in until much, much later that I needed to optimize for something else entirely.
In some ways, I would find that I needed to actually veer my strategy all the way to the opposite side of the road, 
to instead optimize for the ability _understand_ and change things _safely_. I eventually learned that typing _more_ is often the best way to accomplish this.

That's where peace and clarity of mind come back into play. If you are not at peace—say, for example, you are in a rush—you cannot have clarity of mind.
But clarity of mind is vague and borderline meaningless. So I'll attempt to give it some meaning.
To have clarity of mind is to understand not only why you _are_ doing something, but also why you _are not_ doing something else.

You'll find this in much of the guide below. It will suggest to do one, probably slightly weird, thing, rather than any of the regular options.
If I do my job well, I'll explain the types of problems that the standard path causes and I'll show how my idea avoids those problems.

But before we jump in, I want to share one more thing I've learned.
It's more important context to help you understand how I came up with some of these odd ideas.
Not too long ago, I started thinking about how in my entire career, I've never really had to work on a truly Hard Problem<sup>TM</sup>.
Instead, I've been doing what I saw in some joking tweet: "Websites are just fancy database skins."
I've been making projects that are essentially either a CRUD (create, read, update, delete) app or an app that makes decisions based on some other CRUD app.

So, why are things so _hard_?

I think I figured out part of the reason.
I promise it's nothing new, people have been saying this for forever.
Instead of doing the simplest thing, we've added layer upon layer of abstraction upon our projects _for no good reason_.
We follow a pattern because some book told us to. We use a format becuase some framework requires it.
We add a few lines _just in case_.

It's this, more than anything else, that my suggestions attempt to combat.
They attempt to ruthlessly, mercilessly, scrape away the cruft of patterns and abstraction.
I want to wittle down the art of software engineering to its simplest, over-simplified form.
OK, maybe I exaggerate a bit. We're not going all the way back to ones and zeroes. But, let's see how far we can go.

To create this style guide, I'll ask two questions about the way I've learned to create JavaScript applications:

1. What arbitrary paradigms or abstractions can I **remove** to reveal the real purpose of my code?
2. What verbosity can I **add** to improve the clarity of my programs?

# Style Guide

{{< table_of_contents >}}

## Project Structure

The project structure should reflect the problem domain.

### Remove Arbitrary Files & Folders

Each file and folder should meaningfully relate to the domain of your application.
Remove any file or folder that was created without reason.

Common examples of rote folders are: `src`, `utils`, `shared`, `common`.

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
│   ├── Component.jsx
│   ├── api.js
│   └── styles.js
├── Article/
│   ├── Component.jsx
│   ├── api.js
│   └── styles.js
└── url.js
```

#### Why?

Could you learn what my project does by looking at the root of the repository?
What about the second level folder?

In some projects, you have to navigate through two, three, four, or more folders just to figure out what domain concepts it operates on.

Now, how can you join me to succesfully understand and operate on my domain, if you cannot clearly see and understand what it is?
Of course you will be able to because you are likely a skilled Software Engineer.
But, depending on the project layout, it take you longer than necessary.

I noticed frameworks (such as Angular) and paradigms (such as MVC, Model View Controller) influenced me to organize projects in arbitrary and unhelpful ways. 
So, instead of organizing my project around something meaningless to the product, such as routes, I now organize it around domain concept.

### Prefer Fewer, Flatter Files

Do not split up for organization.
Only split up files and functions when the code is reused by multiple things.

Incorrect:

```text
.
└── article/
    ├── Header.jsx
    ├── Footer.jsx
    └── Body.jsx
```

Correct:

```text
.
└── Article.jsx
```

#### Why?

Earlier in my career, I would follow these steps when writing code.

1. Figure out how to get it working.
2. Test it thoroughly.
3. Refactor it to make it "modular" and "readable".

In the final step of that process, I typically made things "modular" and "readable" by splitting code into multiple files and functions.

After a while, I realized this was making my code _harder_ to read and understand — even for myself!

Instead of a single function that I could simply read straight through, I now had to dive through many files and functions to accomplish the same task.
This obfuscated how my code worked, even though I was careful to use descriptive file and function names.

Now, I only split up files and functions under these circumstances:

1. (Primary reason) The code needs to be used in 3+ places.
2. (Secondary reason) They are truly unrelated domain concepts.
3. (Last resort) The file is getting so long my IDE is struggling with it.

Now, related code lives together. Unrelated code lives apart.

The tradeoff is, of course, that my files and functions are bigger.
However — at least when reading my own code — I am now more reliably able to come back to it, understand it, and successfully modify it.

### Domain-Driven Variable Names

I have come to believe that the following variable names are essentially meaningless:

* util, utils, utilities, helper, helpers
* key, value, data, entry
* service, factory
* shared, common

Previously, I frequently used these names in my code. But, I have a confession: by using these names, I was declaring: "I don't know what this code is used for. I don't know what it is operating on. I don't know who or what uses it."

I now prefer to use names that describe the **domain** on which my code is operating.

For example, let's say I need some helper functions to operate on a URL.

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

Naming things is one of the hardest problems in Software Engineering.

In my experience, we engineers love two types of meaningless variables.

The first is the "cute" name that is cool, catchy, and ultimately meaningless.
Like naming your browser "Firefox". 
This is a great strategy for marketing, but not for clearly communicating functionality.

The second is the vague name, such as "util" or "data".
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

Again, naming things is one of the hardest things in software engineering.
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


