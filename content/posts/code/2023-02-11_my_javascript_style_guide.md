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
# images:
# - /my-javascript-style-guide.png
tags: [Code]
draft: true
---

Here is how I write JavaScript.

<!--more-->

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
└── src/
    ├── routes/
    │   ├── Home.jsx
    │   └── Article.jsx
    └── url.js
```

#### Why?

TODO

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

export function modifyURL(url) {
  // do something
}

// Imported as:
import { modifyURL } from './utils';

modifyURL('https://www.justindfuller.com/')
```

**Correct:**

```js
// url.js

function modify(url) {
  // do something
}

export const url = {
  modify,
}

// Imported as:
import { url } from './url';

url.modify('https://www.justindfuller.com/')
```

#### Why?

TODO

### Prevent Export Renaming

**Incorrect:**

```js
export default function() {
  // do something
}

// Imported as:
import doAThing from './thing';

doAThing();
```

**Incorrect:**

```js
export function doAThing() {
 // do something
}

// Imported as:
import { doAThing } from './thing';

doAThing();

// Or import as:
import * as thing from './thing';

thing.doAThing();
```

**Correct:**

```js
function do() {
  // do something
}

export const thing = {
  do,
}

// Imported as:
import { thing } from './thing';

thing.do();
```

#### Why?

TODO

### Prefer Fewer, Flatter Files

Try to limit the number of directories and files that you create.
Do not arbitrary limit the number of lines in a file. Files in a folder, or folders in folders.

To take this to the extreme: your application should be one file until you have a good reason that it should not be.

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
const modify = (url) => {
  return // do something to url
}
```

**Incorrect:**

```js
function modify() {
  return this.url // do something to this.url
}
```

**Correct:**

```js
function modify(url) {
  return // do something to url
}
```

**Correct:**

```js
const modify = () => {
  return this.url // do something to this.url
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
