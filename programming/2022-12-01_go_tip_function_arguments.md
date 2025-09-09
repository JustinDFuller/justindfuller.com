---
title: "Go Tip: Prefer Function Arguments"
subtitle: ""
date: 2022-12-01
draft: false
tags: [Code]
---

Here's a quick Go language tip: Prefer function arguments over struct fields. I'll explain why.

<!--more-->

In the Go programming language, functions can accept many different types as arguments.

Often, I find myself wondering if there's a reason to prefer using Structs vs. individual function arguments.

### Example Function

Here's an example function that I'm writing for [Better Interviews](https://www.betterinterview.club).

It sends an email and is used widely in the code.

```go
type EmailOptions struct {
    To      string
    Subject string
    HTML    string
}

func Email(opts EmailOptions) error {
    from := os.Getenv("EMAIL")
    auth := smtp.PlainAuth("", from, os.Getenv("PASSWORD"), "smtp.gmail.com")

    t, err := template.New("email.template.txt").ParseFiles("./email.template.txt")
    if err != nil {
        return errors.Wrap(err, "error parsing emplate.template")
    }

    var b bytes.Buffer
    if err := t.Execute(&b, opts); err != nil {
        return errors.Wrap(err, "error executing email.template")
    }

    if err := smtp.SendMail("smtp.gmail.com:587", auth, from, []string{opts.To}, b.Bytes()); err != nil {
        return errors.Wrap(err, "error sending email")
    }

    return nil
}
```

It does a few things:

1. Grab some environment variables to construct the auth and FROM email
2. Parses a template that formats email messages
3. Executes the template with provided "To", "Subject" and "HTML" fields.
4. Send the email.

### Problem

I realized that my service could be used to send emails to other domains.
The idea for the product is to let teams communicate interview feedback to hiring managers.
I expect this would happen within a single organization, and therefor a single email domain.

I'm sure there will be exceptions to the rule. But until that happens, I want to try to make my service secure.

So, I need to prevent emails from sending to another organization.

### Solution

This should be pretty easy.
I have an `Organization` struct that can tell me if a particular email is within it.
I'll add it to my `EmailOptions` and refuse to send the email if the domains are different.

Let's see the code:

```diff
type EmailOptions struct {
    To      string
    Subject string
    HTML    string
+   Organization Organization
}

func Email(opts EmailOptions) error {
+   if opts.Organization.IsDifferentDomain(opts.To) {
+     return errors.New("emails cannot be sent across domains")
+   }

    from := os.Getenv("EMAIL")
    auth := smtp.PlainAuth("", from, os.Getenv("PASSWORD"), "smtp.gmail.com")

    t, err := template.New("email.template.txt").ParseFiles("./email.template.txt")
    if err != nil {
        return errors.Wrap(err, "error parsing emplate.template")
    }

    var b bytes.Buffer
    if err := t.Execute(&b, opts); err != nil {
        return errors.Wrap(err, "error executing email.template")
    }

    if err := smtp.SendMail("smtp.gmail.com:587", auth, from, []string{opts.To}, b.Bytes()); err != nil {
        return errors.Wrap(err, "error sending email")
    }

    return nil
}
```

I update the code and... everything still compiles! Great!

### Problem 2

Or, maybe not so great. Now I need to find all the places I need to update my code.
I really would prefer if my compiler would help me out here.

And that's where my suggestion comes from. By adding the Organization to the function arguments, the compiler actually will help me!

```diff
type EmailOptions struct {
    To      string
    Subject string
    HTML    string
}

- func Email(opts EmailOptions) error {
+ func Email(opts EmailOptions, org Organization) error {
+   if org.IsDifferentDomain(opts.To) {
+     return errors.New("emails cannot be sent across domains")
+   }

    from := os.Getenv("EMAIL")
    auth := smtp.PlainAuth("", from, os.Getenv("PASSWORD"), "smtp.gmail.com")

    t, err := template.New("email.template.txt").ParseFiles("./email.template.txt")
    if err != nil {
        return errors.Wrap(err, "error parsing emplate.template")
    }

    var b bytes.Buffer
    if err := t.Execute(&b, opts); err != nil {
        return errors.Wrap(err, "error executing email.template")
    }

    if err := smtp.SendMail("smtp.gmail.com:587", auth, from, []string{opts.To}, b.Bytes()); err != nil {
        return errors.Wrap(err, "error sending email")
    }

    return nil
}
```

This time, I added the `Organization` to the function arguments and...

```bash
organization/invite.go:115:31: not enough arguments in call to interview.Email
        have (interview.EmailOptions)
        want (interview.EmailOptions, interview.Organization)
# github.com/justindfuller/interviews/auth
auth/login.go:90:31: not enough arguments in call to interview.Email
        have (interview.EmailOptions)
        want (interview.EmailOptions, interview.Organization)
# github.com/justindfuller/interviews/feedback
feedback/give.go:205:31: not enough arguments in call to interview.Email
        have (interview.EmailOptions)
        want (interview.EmailOptions, interview.Organization)
feedback/request.go:153:32: not enough arguments in call to interview.Email
        have (interview.EmailOptions)
        want (interview.EmailOptions, interview.Organization)
```

The compiler tells me where I need to add a new argument.

### Exceptions & Tradeoffs

This is a tip, not a hard rule to follow. Here are some things to consider.

#### Clarity

I find structs to be incredibly helpful in representing **related domain concepts**.

You can obtain a specific benefit from the compiler by using a function argument instead of a struct.
However, you may be trading off readability.

For example, what if I moved the whole struct to function arguments?

```diff
- func Email(opts EmailOptions) error {
+ func Email(to, subject, html string, org Organization) error {
```

To call this function would look like this:

```go
err := Email("me@betterinterviews.com", "Check out this example", "<h1>Example</h1>", org)
```

We no longer have any named properties. Here it is fairly clear what each argument does, but that may not always be the case.

#### Verbosity

In the examples in this post, the function has one to four arguments at the most. It's a fairly small function.
Sometimes you have a function that needs far more data. Having twenty function arguments is not feasible and possibly represents a deeper issue.
