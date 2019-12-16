# Continuous deployment for Node.js on DigitalOcean

Continuous Integration and Deployment have become important parts of the software development cycle. It’s important to spend your time creating features, and you don’t want to worry about deploying your code. Plus, the more you are manually deploying code, the more likely you are to make an error. Today we will automate the process of running our tests and deploying our Node.js app to DigitalOcean.

![](https://cdn-images-1.medium.com/max/2186/1*9fGCe-oMWWl4AygOmtMPSw.png)

By following this guide you should be set up with continuous integration and deployment of your Node.js app within just a few minutes. It makes a few assumptions: The first is that you are hosting your application on DigitalOcean and the second is that you have your repository stored on Github, Bitbucket, or Gitlab. It also assumes you have a pretty good grasp of Node.js, NPM, and the command line.

## Feel free to skip around

Depending on if you are using a one-click droplet or not you can probably skip a large portion of these instructions. Each section should alert you to exactly the steps contained in them, so if you know you’ve already completed a step then just skip over it.

## Create NPM scripts

This process relies on at least 3 NPM scripts:

* **test**: This will run your tests. I won’t try to tell you how to set up your tests, but this guide assumes you have them. They should be triggered by `npm test` or `yarn test`.

* **start**: This starts your application. This needs to be set up in a specific way because we will rely on the module [PM2](https://github.com/Unitech/pm2) to start our server. `pm2 start index.js -i max — name=\”My-App\”` this starts the server with PM2, it starts it in cluster mode and will attempt to restart on failures.

* **restart**: This will be needed to restart the server after updates are downloaded. This script does not gracefully restart but that option is available through PM2. However, you’ll need to handle that in your code. It should look like this `pm2 restart all`.

Your package.json should now have this in it:

```json
{
  "dependencies": {
    "pm2": "^2.4.2"
  },
  "scripts": {
    "start": "pm2 start index.js -i max — name=\”My-App\”",
    "restart": "pm2 restart all",
    "test": "your test script goes here"
  }
}
```

## Create a deploy user on DigitalOcean

For this step, I’m going to assume you either know how to create a droplet on DigitalOcean or you already have one. If you don’t then head over to their [documentation](https://www.digitalocean.com/community/tags/node-js?type=tutorials) and come back when you’re ready.

At this point, you will want to create a user to use in deployment. For safety, you will not want this user to have any root privileges. If you find that your specific use case needs root privileges I will include how to do that, but generally, you will not want to give this user full access to your system.

* **Connect:** Open up your terminal and log into your digitalocean droplet via the command: `ssh root@YOUR_SERVER_IP`. Replaced `YOUR_SERVER_IP` with the IP address of your DigitalOcean droplet. You can find that on “Access” page when you select your droplet. *If you haven’t added your SSH key to your droplet then scroll down to the bottom of this post to find out how to do that—or use DigitalOcean’s terminal.*

* **Add user:** You should now be logged into your droplet as the root user. To create the deploy user use the following command: `useradd -s /bin/bash -m -d /home/deploy -c “deploy” deploy`. This will create the deploy user with a folder in the home directory.

* **Password:** Now you will need to create the password with passwd deploy where it will ask you to type in the password twice. I suggest you make the password different than the root user.

* **Only give sudo access if needed.** Give deploy access to some root-level commands with `usermod -aG sudo deploy`.

## Set up Node.js and NPM on the droplet

* Run the following commands to get everything set up. This is where some of the sudo access is needed.

```
curl -sL [https://deb.nodesource.com/setup_7.x](https://deb.nodesource.com/setup_7.x) | sudo bash -
```

```
sudo apt-get install nodejs
```

You should then be able to run `nodejs -v` and `npm -v` to see if it successfully installed. *This may be out of date, and 7.x could be old*. Please check to see what the latest version of Node is before you install it.

## Optional: Set up Yarn on the droplet

I use Yarn instead of NPM. If you use NPM then you can skip this step.

Yarn install instructions can be found on their website.
[Yarn](https://yarnpkg.com/en/docs/install#linux-tab)

To keep things brief here are the directions:

```
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -

echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt-get update && sudo apt-get install yarn
```

## Connect to Github via SSH

Connecting to GitHub via SSH is a simple process and Github maintains great documentation about how to set it up. Check it out in the link below:
[Connecting to GitHub with SSH—User Documentation](https://help.github.com/articles/connecting-to-github-with-ssh/)

You will need to create an SSH key on your droplet and add it to Github by following those directions. This is necessary not just for the next step, but also because later we will use git to pull down the latest changes to the droplet after the CI passes. Specifically, make sure your SSH key is connected to the deploy user that we created earlier.

## Clone your repository

Now that you’re connected to Github you can clone your repo.

```
git clone git@github.com:USERNAME/REPOSITORY.git
```

Replace `USERNAME` with your username and `REPOSITORY` with the repo you want to clone.

After this, you should have your repository cloned onto your droplet. Run `cd REPOSITORY && yarn && yarn start` to install dependencies and begin running the server. Our build script will only restart the server, not start it. So you must explicitly start it now.

## Set Up Codeship

Now that we have everything set up on the droplet we can begin setting up our Continuous Integration and Deployment. For this example, I’ve chosen [Codeship](https://codeship.com/) because it’s free tier offers everything we need to accomplish this.

**Here’s the order of operations:**

1. You push code to Github/Bitbucket/Gitlab.
2. Codeship runs your tests.
3. If your tests pass then Codeship runs a build script.
4. Your build script triggers your droplet to pull down the latest changes from Github.
5. Yarn installs any new dependencies.
6. PM2 restarts the Node.js application.

Sound good? Ok, here’s what to do:

1. Create your Codeship account and log in. It should walk you through connecting to Github (or Bitbucket or Gitlab) and then selecting your repository. Since you’re an adult I’m going to let you handle this part!
2. You should now be at a screen where you need to configure your tests. The first section gives you setup commands, use these:

```
nvm use 6
npm i -g yarn
yarn
```

3. Next, you need to set up your test commands. This part is complicated, but don’t worry, you can just paste in the following command:

```
yarn test
```

4. If you made it through that difficult step, go ahead and move on to setting up your deployment settings. Once you’re on that part you’ll see a bunch of options to select, like Amazon S3 and Heroku. We’re going to use a custom script, which is the very last option. That script should look like this:

```
ssh deploy@DROPLET_IP 'cd NAME_OF_YOUR_PROJECT/; git checkout master; git pull; yarn; yarn restart;'
```

Take careful note of the single quotes around the second part of the script. Anything in those quotes will be run inside the droplet. If the ssh connection fails those commands will not run.

## Allow Codeship to connect to DigitalOcean via SSH

We’re almost done. But right now Codeship cannot connect to your droplet in that deploy script we just created.

Head over to your project settings and find “General” where you will find your “SSH public key”. This is the SSH key you need to add to your droplet. Read the following link to learn about how to add an SSH key.
[How To Configure SSH Key-Based Authentication on a FreeBSD Server](https://www.digitalocean.com/community/tutorials/how-to-configure-ssh-key-based-authentication-on-a-freebsd-server)

## Test it out

That’s it! Once you push a new commit to your repo Codeship will run your tests and deploy your code!

## Know a better way?

This was my first time setting up continuous deployment and integration for Node.js and DigitalOcean. If you know of a better way please feel free to share it in the comments!

---

Hi, I’m Justin Fuller. I’m so glad you read my post! I need to let you know that everything I’ve written here is my own opinion and is not intended to represent my employer in *any* way. All code samples are my own and are completely unrelated to my employer's code.

I’d also love to hear from you, please feel free to connect with me on [LinkedIn](https://www.linkedin.com/in/justin-fuller-8726b2b1/), [Github](https://github.com/justindfuller), or [Twitter](https://twitter.com/justin_d_fuller). Thanks again for reading!
