//Upon installation, create the context menu option and assign it an ID for re-use
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "saveImageAs",
    title: "Save Image As...",
    contexts: ["image"]
  });
});

//Upon clicking a context menu, catch the context menu info and tab info
chrome.contextMenus.onClicked.addListener((info, tab) => {
  //Only trigger when the Save Image As button is clicked AND the image's extension is .webp
  if (info.menuItemId === "saveImageAs" && info.srcUrl.endsWith(".webp")) {

    //When a user interacts with the popup.html (i.e. changes format), popup.js listens to it..
    //..then it stores that choice as a string with the key 'format'..
    //..then we extract the data from that key and if it's not found, set it to png by default
    chrome.storage.sync.get('format', (data) => {
      const format = data.format || 'png';

      //Fetch the image using the new fetchImage function to handle CORS
      fetchImage(info.srcUrl, format, tab.id);
    });
  }
});

//Function to fetch image and cors
function fetchImage(imageUrl, format, tabId) {
  //Fetch image from URL and handle CORS
  //'cors' mode allows for fetching image with CORS headers
  //convert response to Blob image data
  fetch(imageUrl, { mode: 'cors' })
    .then(response => response.blob())
    .then(blob => {

      //Execute convertImage script..
      const reader = new FileReader();
      reader.onload = function() {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: convertImage,
          args: [reader.result, format, imageUrl]
        });
      };
      //..upon reading blob data completed
      reader.readAsDataURL(blob);
    })
    .catch(error => {
      console.error("Error fetching image:", error);
    });
}

//Function injected into the webpage
//Note: logs for this function appear in the regular webpage console, not in the Service Worker console
function convertImage(dataUrl, format, originalUrl) {

  //Create an element to load the image from URL into memory (allowing for decoding the image) into bitmap
  const img = document.createElement('img');
  img.crossOrigin = 'anonymous'; //needed to save on pages with multiple images
  img.src = dataUrl;

  //Wait for newly initialized image to be fully loaded to execute the function
  img.onload = function() {

    //Recreate and paste the image on a Canvas, which allows for pixel/format/etc. manipulation
    const canvas = document.createElement('canvas');
    canvas.width = this.naturalWidth;
    canvas.height = this.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this, 0, 0);

    //Verify the selected MIME type
    let mimeType = `image/${format}`;
    if (format === 'jpg') {
      mimeType = 'image/jpeg';
    }

    //Convert the canvas content to the selected format
    const newDataUrl = canvas.toDataURL(mimeType);

    //Create the new filename for the download
    const url = new URL(originalUrl); //use the original URL to extract the filename
    let originalFilename = url.pathname.split('/').pop();
    originalFilename = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    const newFilename = `${originalFilename}.${format}`;

    //Send that newly created image & URL as a message to the background script (will be caught in .onMessage listeners)
    chrome.runtime.sendMessage({ dataUrl: newDataUrl, filename: newFilename });
  };

  //Debugging in case of an error
  img.onerror = function() {
    console.error("Error loading image for conversion.");
  };
}

//Listen for messages from the script, to download the converted image
chrome.runtime.onMessage.addListener((message) => {
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
