
# Easily create an HTML editor with DesignMode and ContentEditable

Have you ever wondered how hard it would be to recreate a text editor like the one we use right here on Medium?

If you haven’t seen Medium’s text editor, I would highly recommend checking it out. You are able to write, edit, and style your content (within Medium’s provided styles) right here in your browser.

No tech knowledge is needed. No html tags appear in the text.

Would you believe me if I said you’d need nothing more than vanilla JavaScript, CSS, and HTML?

Take a look:

https://codepen.io/Iamjfu/pen/oBYgWV

Hopefully that example demonstrated a few things for you:

1. You have two options. `document.designMode` for the entire document, and `element.contentEditable` for just one element.

1. The browser gives us all the methods we need. Anything outside of document.execCommand is simply for demonstration purposes and error handling.

1. The commands modify the HTML by adding new tags around our content. This allows us to use CSS to style those tags. So simple.

1. The only “gotcha” is that you have to use `event.preventDefault();` if you trigger the command from a button click. Otherwise the focus will shift to the button and the command will fail.

If nothing is selected, the command will fail *(sometimes)*.

If it serves your purposes better, you can also create editable content with HTML.

```html
<div contenteditable="true">
  This text can be edited!
</div>
```

This could work nicely with frameworks like React, Angular, etc. Where you could use a component’s state to control if the content is editable.

## Using The Data

Now, we have to be careful what we do with this. You have a few options here: Take the entire edited content, strip out anything dangerous (like JavaScript) and render what you are given, or you can come up with a system of grabbing the changed data individually.

Either way you need to:

1. Get the new text when it changes.

1. Make sure the text is safe.

1. Render back your entire HTML.

Below you will find the same example above, but this time when you change the text there will be some information logged to the console. I am using the MutationObserver API to watch for these changes.

https://codepen.io/Iamjfu/pen/NdaemL

So what did I do?

* I added an attribute to every element that I wanted to watch. You don’t have to do this, but it lets you hone in on specific editable items. If you do this, be careful not to turn on edit mode for tags you aren’t watching for changes.

* I inspected the mutations to find out if they contained the attributes I was looking for. If they did, I sent that element’s attribute name and new content to the output (in this case, the console).

I think that’s pretty simple. For your purposes, you can replace the console with a backend service that saves the changes. You’ll want to make sure no dangerous JavaScript has been added, so that it doesn’t open you up to [XSS ](https://www.owasp.org/index.php/Cross-site_Scripting_(XSS))attacks.

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
