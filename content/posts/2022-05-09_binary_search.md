---
author: "Justin Fuller"
date: 2022-05-09
linktitle: "Binary Search"
menu:
  main:
    parent: posts
next: /posts/binary-search
title: "Binary Search"
weight: 1
images:
 - /binary_search.png
draft: true
--- 

When searching an array, the typical Big O asymptotic runtime is going to be O(n). That is, in the worst case scenario, the item you are looking for will be the last element in the array. 

<!--more-->

This is the worst case scenario for a typical array search when you do not know the order of the array because it is unsorted. Since you do not know the order, the search algorithm must check each element in the array.

However, when the array is sorted you no longer need to check every element in the array. 

## Real-World Binary Search
Imagine, for example, that you want to look up a word in a dictionary. I happen to have a copy of the [1913 Webster’s New International Dictionary](https://jsomers.net/blog/dictionary) next to me. I’ll pick a random word, “Owl” to look up. Imagine for a moment that I have neither an index nor hints on the side of the pages. What should I do?

I won’t perform a linear search to find the word, starting at the first page and checking each page until I find “Owl”. That would take forever.

Instead I’ll open the dictionary to the middle. I landed in the middle of P, “Pieton” to “Pilewort”. 

![](/binary_search/1.png)

My dictionary is open in two halves. All the letters before P are on the left and all the letters that come after P are on the right. I know that the O in Owl comes before P. I could start flipping one or even a few pages at a time to the left until I find Owl, but that would turn my search into a dreaded linear search.

```go
[A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P⭐,Q,R,S,T,U,V,W,X,Y,Z]
```

Instead, I place a bookmark on the current page, pick up the left half of the pages, then open them to the middle.

I landed in F, “Ferret” to “Fetched”. 

![](/binary_search/2.png)

A bit of an overshoot. O was much closer to P than F. A distance of one letter compared to eight. But what is the state of my dictionary? I now have three sections. 

1. The left section contains all letters before F, which I don’t care about right now. 
2. The middle section contains letters from F to P, where I know O and Owl reside.
3. The right, beginning at the bookmark I placed, contains all letters after P, which I also don’t care about.

```go
[A,B,C,D,E,F⭐,G,H,I,J,K,L,M,N,O,P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

Let’s try again. I place another bookmark on the current page to represent the lower bound of my search. I pick up the pages between my lower and upper bookmarks, pages representing letters F to P. I again pick the middle page.

I’ve now landed in the L’s, from “Lingula Flags” to “Lipogrammatist”. 

![](/binary_search/3.png)

This is much closer than before, only two letters away! But still not as close as P, which was one letter away. 

My dictionary now has four sections. 

1. A to F, before my lower bookmark, where I found Ferret. I don’t need that section. 
2. F to L, below where I just found Lingula Flags. I know O won’t be in that section either. 
3. The one I care about, from the current page to my upper bookmark: L to P. I know O and Owl reside in this section.
4. P to Z is higher than my upper bookmark, so I won’t need that section. 

```go
[A,B,C,D,E,F🔖,G,H,I,J,K,L⭐,M,N,O,P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

It’s time to move my lower bookmark to the current page. Next, I open to the middle of the section between my bookmarks and land on N, “New” to “Nice”. I’m back to being only one letter away.

![](/binary_search/4.png)

I continue to have the dictionary split into four sections. The first, from A to L where my bookmark, from L to N where I am now, from N to P where I first landed, and the last from P to Z which I don’t need. I know O and Owl reside between N and P, which is now a very small section to search in.

```go
[A,B,C,D,E,F,G,H,I,J,K,L🔖,M,N⭐,O,P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

I open the dictionary again to find myself back in P, from “Pans” to “Paper”. Suddenly this whole exercise is feeling a bit unnecessary as I find myself back very close to where I started. I also see that I’ve overshot the O’s, so I can move the bookmark holding my place at “Pieton” down to “Pans”. I now need to pick the middle page between “New” and “Pans”. 

```go
[A,B,C,D,E,F,G,H,I,J,K,L,M,N🔖,O,⭐P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

Finally I find myself in the O’s, from “Oligachaete” to “Omnibus”. I’m quite close now. I can move my lower bookmark up from “New” to “Omnibus” and repeat my search between “Omnibus” and “Pans”.

```go
[A,B,C,D,E,F,G,H,I,J,K,L,M,N🔖,⭐O,P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

Even closer, I open the page to “Overissue” to “Overset”. Not only do I have the correct first letter of “Owl”, but the second letter is only one away.

```go
[A,B,C,D,E,F,G,H,I,J,K,L,M,N,🔖O⭐,P🔖,Q,R,S,T,U,V,W,X,Y,Z]
```

I move my lower bookmark from “Omnibus” to “Overset”, then open the dictionary again between “Oveset” and “Pans”. There’s only a few pages left now, and they’re quite thin, so it’s hard to grab the middle of the pages.

I open to the P’s, from “Pack” to “Paddle”. I’ve overshot again. I move my top bookmark down from “Pans” to “Pack.”  I open the dictionary again between “Overset” and “Pack”.

I did it! I landed on O, from “Ovicapsular” to “Oxide”, which includes “Owl”.

![](/binary_search/5.png)

This odd way to search for Owl required me to search 10 different pages. What if I had flipped through the pages starting at the first one I landed on? “Owl” is on page 1540 while “Pieton” is on page 1634, a whopping 94 pages away! I would have searched through 84 more pages if I had began flipping through starting at my first “close” guess.

What I just performed is called a binary search. I split the book in half, repeatedly searching the middle of each half, until I found what I was looking for.

## Logarithmic

The advantage of Binary Search is the logarithm. In big O asymptotic notation we write it as O(log n). 

What is a logarithm? It answers the question:

> How many of one number multiply together to make another number?

In this case, because it’s a binary search and splitting in half, we’re referring to the number 2 or log<sub>2</sub>(n). 

This property is extremely important, because it has a massive impact on the worst-case time it takes to run the operation.

My dictionary has over 2600 pages. If I start at the beginning searching for a letter that starts with Z, I may have to check over 2600 pages. If I start in the middle performing a binary search, I will have to search at most 12 pages.

What if my dictionary has a million pages? Using a linear scan I would have to, in the worst case, search a million pages. If I perform a binary search I have to perform, worst case, 20 searches.

A billion? Linear search is worst case a billion, binary search is worst case 30 searches.

You can see this illustrated in the following graph. The linear runtime continues up with the size of the input. However, the logarithmic runtime quickly flattens.

![](/binary_search/graph.png)

Hopefully you see the benefit of using this kind of search. Now, let’s see how to implement it in the Go programming language.

## Implementation

