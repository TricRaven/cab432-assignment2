// Requirements
const fileInput = document.querySelector("#imageFileInput");
const canvas = document.querySelector("#canvas");
const canvasCtx = canvas.getContext("2d");
const brightnessInput = document.querySelector("#brightness");
const saturationInput = document.querySelector("#saturation");
const blurInput = document.querySelector("#blur");
const inversionInput = document.querySelector("#inversion");
const settings = {};
let image = null;

//Image editing options
function resetSettings() {
  settings.brightness = "100";
  settings.saturation = "100";
  settings.blur = "0";
  settings.inversion = "0";
  brightnessInput.value = settings.brightness;
  saturationInput.value = settings.saturation;
  blurInput.value = settings.blur;
  inversionInput.value = settings.inversion;
}

//Event listeners
function updateSetting(key, value) {
  if (!image) return;

  settings[key] = value;
  renderImage();
}

//Generate filter
function generateFilter() {
  const { brightness, saturation, blur, inversion } = settings;

  return `brightness(${brightness}%) saturate(${saturation}%) blur(${blur}px) invert(${inversion}%)`;
}

//Render image
function renderImage() {
  canvas.width = image.width;
  canvas.height = image.height;

  canvasCtx.filter = generateFilter();
  canvasCtx.drawImage(image, 0, 0);
}

brightnessInput.addEventListener("change", () =>
  updateSetting("brightness", brightnessInput.value)
);
saturationInput.addEventListener("change", () =>
  updateSetting("saturation", saturationInput.value)
);
blurInput.addEventListener("change", () =>
  updateSetting("blur", blurInput.value)
);
inversionInput.addEventListener("change", () =>
  updateSetting("inversion", inversionInput.value)
);

fileInput.addEventListener("change", () => {
  image = new Image();

  image.addEventListener("load", () => {
    resetSettings();
    renderImage();
  });
  image.src = URL.createObjectURL(fileInput.files[0]);
});

// Upload Image
function upload() {
  // Gets Image Details
  var nameInput = document.getElementById("imageName").value;
  
  // Ensures image has a name
  if (nameInput == "") {
    nameInput = "untitled";
  };
  
  // Sends Image details to client - returns S3 URL
  try {
    const dataURL = canvas.toDataURL("image/jpeg");
    fetch(`/images/add/${nameInput}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: dataURL,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
      
        // Replaces the first image placement with uploaded image
        const url = data.imageURL;
        document.getElementById("image1").src=url;
      });

  } catch {
    alert("Original or edited image is greater than 5MB");
  }
}

// Download Image/s
async function getImage(position) {
  // Make a request to send image to express and get zip
  url = document.getElementById("image" + position).src;
  fetch("/images/download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: url,
    }),
  })
    // Automatically download zip
    .then((response) => response.blob())
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = "edited-images.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
  });
}

// Gets Top 6 Redis Images for initial display - on app opening
(async () => {
  try {
    console.log(">> Top 6 Redis Images Collected: ");
    await fetch('/images/collect')
      .then((response) => response.json())
      .then((imageList) => {
        console.log(imageList);
        
        // Sets values for image display
        for (let i = 0; i < imageList.length; i++) {
          const imgName = imageList[i].nameKey;
          const imgSrc = imageList[i].urlValue;
          
          // Replaces src of set image location with an S3 URL
          const imageID = "image" + (i+1);
          document.getElementById(imageID).src=imgSrc;
        };

      });
  } catch (error) {
    console.log(error);
  };
})();

resetSettings();
