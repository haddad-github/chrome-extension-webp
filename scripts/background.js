//Upon installation, create the context menu option and assign it an ID for re-use
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed and initializing context menu.");
  chrome.contextMenus.create({
    id: "saveImageAs",
    title: "Save Image As...",
    contexts: ["image"]
  });
});

//Upon clicking a context menu, catch the context menu info and tab info
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked.");
  console.log("Info: ", info);
  console.log("Tab: ", tab);
  //Only trigger when the Save Image As button is clicked AND the image's extension is .webp
  if (info.menuItemId === "saveImageAs" && info.srcUrl.endsWith(".webp")) {
    console.log("Save Image As and URL ending with .webp, continuing..");

    //When a user interacts with the popup.html (i.e. changes format), popup.js listens to it..
    //..then it stores that choice as a string with the key 'format'..
    //..then we extract the data from that key and if it's not found, set it to png by default
    chrome.storage.sync.get('format', (data) => {
      console.log("Getting stored data from popup: ", data)
      const format = data.format || 'png';

      //Script the execute (target is current tab, function is convertImage, args function takes are the URL & format)
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: convertImage,
        args: [info.srcUrl, format]

      });
    });
  }
});

//Function injected into the webpage
//Note: logs for this function appear in the regular webpage console, not in the Service Worker console
function convertImage(imageUrl, format) {
  console.log("Convert Image function received data imageUrl: ", imageUrl);
  console.log("Convert Image function received data format: ", format);

  //Create an element to load the image from URL into memory (allowing for decoding the image) into bitmap
  const img = document.createElement('img');
  img.crossOrigin = 'anonymous';
  img.src = imageUrl;
  console.log("Image created: ", img.src);

  //Wait for newly initialized image to be fully loaded to execute the function
  img.onload = function() {
    console.log("New image created finished loading, activating function to convert");

    //Recreate and paste the image on a Canvas, which allows for pixel/format/etc. manipulation
    const canvas = document.createElement('canvas');
    canvas.width = this.naturalWidth;
    canvas.height = this.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this, 0, 0);

    //Convert the canvas content to the selected format
    const dataUrl = canvas.toDataURL(`image/${format}`);
    console.log("dataUrl: ", dataUrl);

    //Create the new filename for the download
    const originalUrl = new URL(imageUrl); //transforms the string into a URL to bypass regex extraction
    let originalFilename = originalUrl.pathname.split('/').pop();
    originalFilename = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    const newFilename = `${originalFilename}.${format}`;
    console.log("New Filename: ", newFilename);

    console.log("Sending message to download listener...")
    //Send that newly created image & URL as a message to the background script (will be caught in .onMessage listeners)
    chrome.runtime.sendMessage({dataUrl: dataUrl, filename: newFilename});
  };

  //Debugging in case of an error
  img.onerror = function() {
    console.error("Error loading image for conversion.");
  };
}

//Listen for messages from the script, to download the converted image
chrome.runtime.onMessage.addListener((message) => {
  console.log("Inside the download listener...message received: ", message);
  //The message here should include the keys dataUrl and filename (which were given in the convertImage function)
  //Send the download request
  if (message.dataUrl && message.filename) {
    chrome.downloads.download({
      url: message.dataUrl,
      filename: message.filename,
      saveAs: true
    });
  }
});
