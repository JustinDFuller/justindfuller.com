# Service calls make your tests better

**TL;DR:** If all tests are mocked, you don’t know if your code works, you only know that, theoretically, it is supposed to work if the integrations adhere to the contract you expect.

![](https://cdn-images-1.medium.com/max/2000/0*iKjvNG4OVK47bauK.jpeg)

Mocking, stubbing, or maybe—even better—[dependency inversion](https://medium.com/free-code-camp/simply-javascript-a-straightforward-intro-to-mocking-stubbing-and-interfaces-14e67ed6641a), they can simplify testing and make your code easier to change, but can they cause problems too? Let’s see.

Take a look at this test where we are saving a file using an external file service.

```js
test("Upload a new file to the user's drive", async function (t) {
  const driveService = {
    write(file) {
      return Promise.resolve('/path/to/uploaded-file.json')
    }
  }
  
  const fileUploader = FileUploader(driveService)
  
  const file = FileBuilder()
 	.setPath('/path/to/uploaded-file.json')
  	.setContent(JSON.stringify({
  		foo: 'bar',
    	boo: 'baz'
  	}, null, 2))
  
  const url = await fileUploader.uploadFile(file)
  t.is(url, '/path/to/uploaded-file.json')
})
```

Can you determine if this is a useful test?

*Hint:* it most likely isn’t going to ever catch any bugs. Let’s see if we can determine why not.

The first reason it won’t catch any bugs is that we are using a mock implementation of the drive service. So we won’t catch any errors if someone changes the drive service without changing the file uploader. If the drive service changes from `write` to `writeFile` our test won’t catch that.

Now, what about even further down the line? What if something changes with the actual drive server that we want to integrate with? We certainly won’t catch those errors because we aren’t making a call to it.

In the end, the only thing we are truly testing is that the `uploadFile` method gives the file object to the `driveService`’s `write` function. We’ll catch an error if drive service uses the file object incorrectly, or if `fileUploader` stops giving the file directly to the drive service.

Unfortunately, we will also have to update this test whenever we change how `fileUploader` and `driveService` interact.

So not only is the test not very useful, it’s brittle. Further, in a typed language like Typescript, it would be completely useless since the compiler would catch these types of errors during compilation.

So, how can we make this test better? The test can become useful if it makes the service call to the drive server. Not the internal `DriveService` object, but to a real Drive Server.

Immediately you should be objecting, “My unit tests will take forever to run and become extremely brittle if I am making real service calls!” If you said that, you are right. That kind of test is best served as an integration test.

## Integration Tests

Integration tests will not be run as often as unit tests, but they should—at the very least—be run before integrating your changes into the codebase. See what I did there? Integration tests run when you integrate.

Still, the problem exists, how could one run all the servers needed for the application to function? Starting them up can be expensive, not to mention the data stores, managing ports, authentication, and everything else that goes into creating a fully-functioning system.

Take a look at this simple system diagram. It represents a very stripped-down version of the system in the example test from earlier.

![](https://cdn-images-1.medium.com/max/2000/0*EByxzGkBFV-tC8L8)

You can see that all we’re interested in here is testing the integration of our “File Service” with the external “Drive Service” that belongs to another team. In this case, we’re not trying to run a full end to end test.

But what are we testing?

![](https://cdn-images-1.medium.com/max/2000/0*c8sCS-H_FJxRSUyg)

Oops! Here, as shown in green, only the file service was tested. We wanted to test if our File Service and its connection to the Drive service are working. So instead of writing a mocked version on our end, we will look for a way to obtain a testable version of the drive service.

## Isolated Services

One option is to create an isolated version of the Drive Service. Ideally, this will be owned by the team that created the Drive Service. To ensure that the fake server is trustworthy they will run the same tests against both the fake server and the real server.

```js
export function DriveService() {
  const dataStorage = S3BucketDataStorage()
  const fileStorage = FileStorage(dataStorage)
  const { port } = Server().fromRoutes(
    DriveServerRoutes(fileStorage)
  ).startServer()
  return port
}

export function InMemoryDriveService() {
  const dataStorage = SqLiteInMemoryDataStorage()
  const fileStorage = FileStorage(dataStorage)
  const { port } = Server().fromRoutes(
    DriveServerRoutes(fileStorage)
  ).startServer({ port: 0 })
  return port
}
```

The above code represents a sample isolated server implementation. You can see that it is very similar to the real server implementation, except that it uses an in-memory data store instead of a real file storage device. It even uses port 0 to ensure that an [ephemeral port](https://en.wikipedia.org/wiki/Ephemeral_port) is used, further increasing the stability of its tests.

Now that the Drive team is providing this isolated server, our integration tests can safely start it and use it during integration tests. Let’s rewrite that original test as an integration test and see if it becomes more useful.

```js
let port
let fileHandler

beforeAll(function () {
  port = DriveServer.InMemoryDriveService()
    fileHandler = FileHandler(DriveService({ port }))
})

afterAll(function () { 
  DriveServer.stopService(port)
})

test("Upload a new file to the user's drive", async function (t) {
  const fileContents = JSON.stringify({ 
    foo: 'bar',
    boo: 'baz'
  }, null, 2)
  
  const file = FileBuilder()
    .setPath('/path/to/uploaded-file.json')
    .setContent(fileContents)
    
    const url = await fileHandler.uploadFile(file)
    t.is(url, '/path/to/uploaded-file.json')
    const contents = await fileHandler.readFile(url)
    t.deepEqual(contents, fileContents)
})
```

Now is our test more useful? Since we made the call to the real Drive Server API (even though it saves to a different storage device, the API and business logic remain the same) we will know if our integration breaks.

Even better, not only were we able to test what URL it returns, we were able to test if the content was saved as expected. Our test will tell us if file saving works!

![](https://cdn-images-1.medium.com/max/2000/0*qeITxHrazRrTKg27)

Look at our system diagram again. You can see in green the services that are being tested. This time we are testing the file service, the drive service, and, most importantly, the connection between them.

It isn’t realistic to expect that this set of tests will be run every time we change a line of code—that expectation is reserved for unit tests—but this test is still lightweight enough to run on each code check-in. Executing the integration test in this fashion will ensure that your main branch will have both correct business logic and a working integration with other services.

## A fallback when an isolated service just isn’t possible

Sometimes you really may have some kind of environment or build-time constraint that makes an isolated server impossible. If that’s the case then you could use fake APIs as a fallback.

Remember, we’re still talking about integrations here—code that interacts with other services. You may have noticed the code contained two Drive related entities: `DriveServer` and `DriveService`. The `DriveServer` was the actual server that belongs to the third party. We were using their in-memory version to test our integration with their service. The `DriveService` is an API that knows how to interact with a DriveServer. This API also belongs to the Drive team.

Thankfully they understand that not everyone can use their isolated in-memory server, so they also created a fake version of their API. Take a look.

```js
function FakeDriveService() {
  const files = new Map()

  return {
    write(file) {
    	files.set(file.getPath(), file.getContent())
    	return Promise.resolve(file.getPath())
    },
    read(filePath) {
    	return Promise.resolve(files.get(filePath))
    }
  }
}
```

This `FakeDriveService` is an implementation that the Drive Team could provide to anyone who uses their service. They are saying “If you test with the FakeDriveService you can trust that the real DriveService will work. We run tests against both to ensure that they work the same.”

This implementation is even lighter than the isolated server, so what’s the drawback? Let’s refer, once again, to our system diagram.

![](https://cdn-images-1.medium.com/max/2000/0*-HnhLFl8kcpFkPd9)

While we are technically testing the connection *mechanism* we aren’t touching the `DriveService`. Our test is built on trust, not actual verification. The trust is that the fake service does work the same as the full service. In many scenarios, this could be sufficient, but if you have a production critical system you may need a better guarantee.

Still, this test is better than the original mock function that we started with. That mock function was completely untrustworthy to the point that, I would argue, it tricked us into thinking we were safe from bugs, but in reality, we had no idea. Our tests will now have to change if the `DriveService` changes. In that first mock scenario, we wouldn’t have had to change our tests, it would have tricked us into thinking that our code still worked, even when it was broken due to an API change.

## Credits

This post was directly inspired by posts that I recently found in Google’s “Testing on the toilet” blog. I wanted to reframe the idea with JavaScript code. Please see the links below to read their original posts.

Exercise service call

https://testing.googleblog.com/2018/11/testing-on-toilet-exercise-service-call.html

Fakes:

https://testing.googleblog.com/2013/06/testing-on-toilet-fake-your-way-to.html

Hermetic Servers:

https://testing.googleblog.com/2012/10/hermetic-servers.html

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
