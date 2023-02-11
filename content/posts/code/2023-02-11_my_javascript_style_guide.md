---
author: "Justin Fuller"
date: 2023-02-11
linktitle: "My JavaScipt Style Guide"
menu:
  main:
    parent: posts
next: /posts/my-javascript-style-guide
title: "Technical Roadmaps"
weight: 1
# images:
# - /my-javascript-style-guide.png
tags: [Code]
draft: true
---

Here is how I write JavaScript.

<!--more-->

## Principles

* Verbose code is understood code.
* Understandable code is the best recipe for correct code.
* Don't write a single character without a clearly articulated purpose.
* Understanding code is far more difficult and time-consuming than writing code.
* Engineers avoid reading code and documentation as much as possible.

## Explicit Checks

Wrong:

```js
if (someBoolean) {
  // do something
}
```

Wrong:

```js
if (!someThingThatCouldBeUndefined) {
  // do something
}
```

Right:

```js
if (someBoolean === true) {
  // do something
}

if (someThingThatCouldBeUndefined === undefined) {
  // do something
}
```

### Why?

TODO

## Always Use Brackets

Wrong:

```js
if (someBoolean === true) doAThing();
```

Right:

```js
if (someBoolean === true) {
  doAThing();
}
```

### Why?

TODO

## Prevent Export Renaming

Wrong:

```js
export default function() {
  // do something
}

// Imported as:
import doAThing from './thing';

doAThing();
```

Wrong:

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

Right:

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

## Why?

TODO

## Unfold If Statements

Wrong:

```js
if (something === true) {
  if (somethingElse === true && anotherThing === false) {
    // do something
  }
}
```

Right:

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

### Why?

TODO

## Embrace Short Variables

And allow the surrounding code context to provide additional information.

Wrong:

```js
export function stringifyABTests(allUserABTests) {
  return allUserABTests.map(function(userABTest) {
    return userABTest.name + '=' + userABTest.variant
  }).join(',')
}
```

Right:

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

### Why?

TODO

## Avoid Meaningless Names

The following names are essentially meaningless:

* util, utils, utilities, helper, helpers
* key, value, data, entry
* service, factory
* shared, common

By using any of these names, you are declaring: "I don't know what this code is used for. I don't know what it is operating on. I don't know who or what uses it."

Instead, you should use names that describe the **domain** on which your code is operating.

For example, let's say you need some helper functions to operate on a URL.

Wrong:

```js
// utils.js

export function modifyURL(url) {
  // do something
}

// Imported as:
import { modifyURL } from './utils';

modifyURL('https://www.nytimes.com/')
```

Right:

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

url.modify('https://www.nytimes.com/')
```

### Why?

TODO

## Avoid Meaningless Folders

Instead of making a shared or common folder, put reused files at the root directory (or at the same level that you would place the shared folder).

Wrong:

```
.
└── src/
    ├── routes/
    │   ├── Home.jsx
    │   └── Article.jsx
    └── shared/
        └── url.js
```

Right:

```
.
└── src/
    ├── routes/
    │   ├── Home.jsx
    │   └── Article.jsx
    └── url.js
```

### Why?

TODO

## Prefer Regular Functions

Unless you are using the `this` keyword.

Wrong:

```js
const modify = (url) => {
  return // do something to url
}
```

Wrong:

```js
function modify() {
  return this.url // do something to this.url
}
```

Right:

```js
function modify(url) {
  return // do something to url
}
```

Right:

```js
const modify = () => {
  return this.url // do something to this.url
}
```

### Why?

TODO