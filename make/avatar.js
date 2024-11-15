const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.src = src;
    image.onload = () => resolve(image);
    image.onerror = reject;
  });

async function loadImageManifest() {
  return [
    '/image/00-ready-to-vote-no_avatar.png',
    '/image/01-just-cause_avatar.png',
    '/image/02-lower-pay_avatar.png',
    // '/image/03-forced-rto_avatar.png',
  ];
}

async function loadFrameImages() {
  const frameUrls = await loadImageManifest();
  return Promise.all(frameUrls.map(loadImage));
}

function render(profilePic, framePic) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  // the dimension of the resulting image should
  // be somewhere between 512px and 1024px
  const dimension = Math.min(
    Math.max(profilePic.width, profilePic.height, 512),
    1024
  );

  // set the the canvas to the resulting image size (a square)
  canvas.width = dimension;
  canvas.height = dimension;

  // if the image is in landscape mode (aspectRatio > 1) it will overflow horizontally,
  // if it's in portrait mode it will overflow vertically.
  const aspectRatio = profilePic.width / profilePic.height;
  const [profilePicW, profilePicH] =
    aspectRatio > 1
      ? [dimension * aspectRatio, dimension] // scale width outside dimension
      : [dimension, dimension / aspectRatio]; // scale height outside dimension

  // draw the picture at the center of the canvas
  const x = (dimension - profilePicW) / 2;
  const y = (dimension - profilePicH) / 2;
  context.drawImage(profilePic, x, y, profilePicW, profilePicH);

  // draw frame (if there is one)
  if (framePic) {
    context.drawImage(framePic, 0, 0, dimension, dimension);
  }

  const imgEl = document.createElement("img");
  imgEl.src = canvas.toDataURL("image/png");
  return imgEl;
}

const framePicsPromise = loadFrameImages();

window.addEventListener("DOMContentLoaded", async () => {
  const framePics = await framePicsPromise;

  const uploadBtn = document.getElementById("inp-button");
  const frameEl = document.getElementById("frames");
  const uploadedFrameEl = document.getElementById("uploaded-frame");

  // render initial gallery of empty frames
  frameEl.innerHTML = "";
  framePics.forEach((framePic) => frameEl.appendChild(framePic));

  uploadBtn.addEventListener("click", () => {
    document.getElementById("inp").click();
  });

  document.getElementById("inp").onchange = async ({ target }) => {
    try {
      frameEl.innerHTML = "Loading...";
      uploadedFrameEl.innerHTML = "";

      const profilePicUrl = URL.createObjectURL(target.files[0]);
      const profilePic = await loadImage(profilePicUrl);

      uploadedFrameEl.appendChild(render(profilePic));

      frameEl.innerHTML = "";
      frameEl.classList.remove("default-frames");

      // render each frame over the profile pic
      framePics.forEach((framePic) => {
        const imgEl = render(profilePic, framePic);
        frameEl.appendChild(imgEl);
      });
      uploadBtn.innerText = "change photo";
    } catch (err) {
      console.log(err);
    }
  };
});