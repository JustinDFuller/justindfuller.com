---
title: Accretive Editing
date: 2026-07-10
draft: false
tags: [Code]
---

Accretive editing is a failure mode of current AI tools. You’ve probably seen it happen.

![Accretive Editing](/image/programming/accretive-editing.png)

## What?

1. You have some existing text.
2. Something changes so that the text is no longer accurate.
3. You ask an AI-based tool to update it.
4. It adds a parenthetical or some other type of of addendum, rather than correcting the text.

Here’s a real world example that happened to me yesterday.

I had some text like this: “This project can authenticate with Amazon Bedrock.” During an update, I removed support for Amazon Bedrock and added support for LiteLLM. Claude updated the text to become, “This project can authenticate with LiteLLM but no longer supports Amazon Bedrock.”

Now, to be clear, if you have a major update that removes support for one provider and replaces it with another, you probably do want to communicate that. However, scattering that information as addendums throughout your documentation is clearly not the way to go about it. Instead, you probably want a changelog, an announcement, or even a callout prominently in your docs.

Instead of doing any of that (and sometimes in addition to it) AI tools use accretive editing. It keeps the previous information, which is now irrelevant, and tacks it into the new.

Unfortunately, this is not the type of thing you can fix by telling the model to “write less.” That will just buy you terse accretion: “This project can authenticate with LiteLLM, not Amazon Bedrock.”. 

It’s also not something you can fix with style. Telling it to “avoid flourishes at the end of your sentences” will simply move the accretion to a new sentence: “This project can authenticate with LiteLLM. It no longer uses Amazon Bedrock.”

## Why?

Due to the nature of large language models, we don’t and possibly can’t know why this happens. But I will happily speculate.

When a person writes a document, they are writing it for another person. They understand that humans don’t care about the history of the document. They care about the information inside it. So, when they update a document, they will happily delete and rewrite obsolete statements. Their focus is on making the document true for the reader.

An LLM can’t have this perspective. Instead, it has two inputs (the old information and the new instructions) and needs to predict what is most likely to come next. Since “LiteLLM” and “Bedrock” rarely produce only “LiteLLM”, it outputs both.

## Fix

My goal here is to identify the issue. While I have been able to make some improvements, I haven’t been able to stop it completely. It’s possible this is a deeper architectural issue.

With most issues related to AI, I’ve found that telling it what *not* to do is less effective than telling it what *to* do.

So, I do *not* recommend adding something like this to your instructions: “Avoid accretive editing. When you make a change, do not tack on the old information to the new.”

Instead, focus on explaining how it should think about updating documents.

> When updating prose, replace obsolete text with accurate text rather than preserving the obsolete text and adding a correction. The final document should read as if it were written correctly from the beginning.
