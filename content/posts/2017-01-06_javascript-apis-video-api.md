---
author: "Justin Fuller"
date: 2017-01-06
linktitle: "JavaScript APIs: Video API"
menu:
  main:
    parent: posts
next: /posts/javascript-apis-video
title: "JavaScript APIs: Video API"
weight: 1
images:
  - /learning-javascript.jpeg
aliases:
  - /posts/2017-01-06_javascript-apis-video-api
tags: [Code]
---

In this series, I will be exploring the different JavaScript APIs that are available for use in a browser environment. Some will be well known, others may be completely new to you. Hopefully, each section will present you with some new information and useful real-world tips! So, let’s get started.

<!--more-->

**Not Just For YouTube**

If you haven’t used it before, you may not even know the Video API exists, or you may be under the impression it can only be used for creating a custom video player. However, if you just need to embed a video into your site, and don’t want to create your own fancy video player, the Video API still has something for you!

**Remembering User Settings**

All options available to the video HTML tag, such as autoplay, controls, loop, and src can be set with JavaScript instead of HTML. So, imagine that you have an automatically playing video, but you want to let your users opt-out of that probably-annoying feature, you could do the following:

https://gist.github.com/JustinDFuller/ca8d3fe08f2d00ec7b04f1cd4853f79a#file-video-js

Now you’re only showing autoplay for those who are OK with that feature!

**Playing the correct size video based on connection**

This next option is a bit more specific, and a bit more complicated, but it has huge benefits when it comes to user experience. You’ll have to play around with it to find the right balance for you and your users, but this should provide you with a good starting point.

The Video API comes with a set of events that happen over the course of a video’s lifecycle. `oncanplay`, `oncanplaythrough`, `onplay`, `onpause` are all examples of good lifecycle events that can be used, but we’re not concerned about when things are going well, we want to know when the video isn’t loading properly.

So we are going to watch for `onstalled`, `onwaiting`, `onerror` so that we can make changes when these events happen.

When we get the `onerror` event, we will give the user an option to reload the video. When we have `onstalled` or `onwaiting` we are going to check to see if this has happened before, how many times it has happened, and if it’s been too many times we’re going to change the src to a smaller bitrate video.

Here is an example of reloading the video (or giving the option to do so) on an error:

https://gist.github.com/JustinDFuller/5a5572b1a59ef92db75cae0cdd2e72ac#file-video-js

Here is an example of changing the src when the video is loading too often:

https://gist.github.com/JustinDFuller/ab65954961d76f15d8a273c99577d20b#file-video-js

Finally, a good resource for the Video API is [http://www.w3schools.com/tags/ref_av_dom.asp](http://www.w3schools.com/tags/ref_av_dom.asp).

Stay tuned for more posts about JavaScript APIs!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
