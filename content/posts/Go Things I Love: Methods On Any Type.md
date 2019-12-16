# Go Things I Love: Methods On Any Type

Now that I am working with [Go](https://golang.org/) as my primary language at [The New York Times](https://open.nytimes.com/), 
I want to explore some of my favorite features of the language. I don't intend this to reveal previously unknown features or best 
practices; I just want to share some of the reasons that I enjoy working with the language.

![Go Things I Love](https://raw.githubusercontent.com/JustinDFuller/blog-posts/master/media/SOLID-single-responsibility-principle/go-things-i-love.png)

## Methods

Typically a method is defined as a function that belongs to an object or class. This means you wouldn't necessarily add a method
to a string, boolean, or number.

This limitation might lead a developer to produce code that looks like this:

```go
const LastOldSchoolID = 23959

if id < LastOldSchoolID {
  // allow access to the old school version of the game
}

// and elsewhere

if id < LastOldSchoolID {
  // allow access to the old school version of the forum
  // or some other custom logic for old school players
}
```

In this silly example there is a game that recently released a new version. Players who made an account before the release are still
allowed to play the old game and use the old forum. To do this, the developers went around the codebase and added a check: 
Is the user's ID lower than the last oldschool player's ID? If so, they can access the old game.

## Encapsulation

Unfortunately, and right away, the community notices a bug. Specifically, a single user notices this bug. The last old school player is
locked out of the game! The developers used the check `id < LastOldSchoolID` everywhere. So it works for all but the very last player.
At this point the developers are forced to search for every instance of this check (forunately there aren't that many, only a dozen or so)
and they replace the logic with `id <= LastOldSchoolID`. Everything is working perfectly again.

Except it's not. The developer who coded logic for the old school login page included this snippet:

```go
if id >= LastOldSchoolId {
  return httperrors.Unauthorized("We're sorry but you don't have access to the old school game.")
}
```

So, unfortunately, the bug still exists.

This could have all been prevented by a little encapsulation. The developers shouldn't have repeated the logic—all over the codebase—
to determine if an ID is valid for old school. The logic should live in only one place. 
Thankfully, Go provides exactly what is needed.

## Using a custom type

The User's ID will be implemented as a custom type. The type can be used independently or as part of a user struct. Most importantly,
it can have custom methods.

Here's how it works:

```go
const LastOldSchoolID = 23959

type UserID int

func (id UserID) IsOldSchool() bool {
  return id <= LastOldSchoolID // The last oldschool player
}

func (id UserID) IsNotOldSchool() bool {
  return !id.IsOldSchool()
}
```

Notice the custom methods added directly to the `UserID` type, which is an `int`. The code around the app can now be rewritten.

```go
if id.IsOldSchool() {
  // allow access to the old school version of the game
}

// elsewhere

if id.IsNotOldSchool() {
  return httperrors.Unauthorized("Please join us playing the new version at game.com/v2.")
}
```

If only this had been done in the first place, a lot of pain and suffering would have been saved for that poor 
user who wasn't able to access the game for a few days. The developers could have made the fix at a single location
in the code and the fix would have been applied everywhere.

## More encapsulation, delegation.

Some might point out that the code is still revealing too many details about the user and the old school logic. 
Why should the rest of the code need to know that old school access is determined by the ID? What if the business decides to change 
the rules to instead use the creation date? What if the developers decide to make an `IsOldSchool` property on the user? 

These are all valid points. First, I ask you to remember that this is simply an example to show a great feature within `Go`. 
Next, I'd like to point out two things.

1. Adding methods to a non-struct type (like an int or string) _might_ be a code smell that you are unecessarily leaking 
implementation details or other logic that should be private.
2. If the details need to be hidden, methods can still be added to the custom type, while at the same time hiding where 
that logic comes from.

Allow me to demonstrate.

```go
type User struct {
  UserID
}

func (u User) IsOldSchool() bool {
  return u.UserID.IsOldSchool()
}

func (u User) IsNotOldSchool() bool {
  return u.UserID.IsNotOldSchool()
}
```

Delegation is used inside the `User` struct. The details of how the ID calculates oldschool are even hidden to `User`.

Now the implementation details (that old school access is based off of the ID) can be hidden from the rest of the code.

```go
if user.IsOldSchool() {
  // allow access to the old school version of the game
}

// elsewhere

if user.IsNotOldSchool() {
  return httperrors.Unauthorized("Please join us playing the new version at game.com/v2.")
}
```

Again, internally, the User struct will take advantage of the methods on the ID, further encapsulating the logic.

You can play around with these examples on the [Go Playground](https://play.golang.org/p/2WlOg1byot1).

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve 
written here is my own opinion and is not intended to represent my employer. All code samples are my own.

I’d also love to hear from you, please feel free to follow me on [Github](https://github.com/justindfuller) 
or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
