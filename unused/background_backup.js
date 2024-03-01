//When the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  //Initialize the new context menu option
  //id = used to reference the option later in the code
  //title = name given to the new option
  //contexts = in which context this new context menu option will appear
  chrome.contextMenus.create({
    id: "saveAsJpg",
    title: "Save as JPG",
    contexts: ["image"]
  });
});

//When an option in the context menu is clicked
//Takes in 2 arguments given by the browser:
// info (contains info about the context menu item that was clicked --> ex: menuItemId (id of clicked option))
// tab (contains info about tab we're currently in --> ex: title (title of the tab))
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked. Item ID: " + info.menuItemId);
  //When the Save As JPG option is clicked (referred to by the id defined earlier)
  if (info.menuItemId === "saveAsJpg") {

    //Execute the following script
    //target = the victim of the script (here, chosen based on the tab id, taking the current tab)
    chrome.scripting.executeScript({
      //TARGET
      target: {tabId: tab.id},

      //FUNCTION TO EXECUTE
      //Converts the imageUrl (takes it as an argument) into a JPEG
      func: (imageUrl) => {
        console.log("Looking for image with URL:", imageUrl);
        //Find an "<img>" element whose "src" attribute matches the imageUrl passed to the function
        const img = document.querySelector(`img[src="${imageUrl}"]`);
        console.log("Image selector:", img)
        //If no image found, return
        if (!img) {
          console.error("No image found with the given src URL:", imageUrl);
          return;
        }

        //Based off the image found, we create an off-screen canvas (non-visible to the user) as a means to do format conversion
        //It takes the width and height of the image
        //It basically 'draws' the image found on that canvas at the coordinates 0.0 (center)
        //Effectively re-drawing the image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const context = canvas.getContext('2d');
        context.drawImage(img, 0, 0);

        //Convert the canvas to a data URL (base64 format for the JPEG image)
        //return that URL to the background script
        const dataUrl = canvas.toDataURL('image/jpeg');
        console.log('Data URL created successfully')
        return dataUrl;
      },

      //ARGUMENT
      //info has 'srcUrl' which contains the image URL of the image right-clicked (original image, before conversion)
      //..this becomes the value passed to the func above (takes on the value of imageUrl)
      args: [info.srcUrl]
    },

     //RETURN RESULTS
     (results) => {
      console.log('Script executed with results length:', results.length);
      if (chrome.runtime.lastError) {
        console.error('Error injecting script:', chrome.runtime.lastError.message);
        return;
      }
      //Check if error or 0 was returned, if so, error in script
      if (chrome.runtime.lastError || results.length === 0) {
        // If there was an error executing the script, log it and exit.
        console.error('Error injecting script:', chrome.runtime.lastError?.message);
        return;
      }

      console.log('Script result:', results[0].result);

      //Get the results (the base64 URL for the JPEG image generated)
      const dataUrl = results[0].result;
      if (dataUrl) {

        //Extract original filename without the extension
        const originalUrl = new URL(info.srcUrl);
        let originalFilename = originalUrl.pathname.split('/').pop()
        if (originalFilename.includes('.')){
          originalFilename = originalFilename.substring(0, originalFilename.lastIndexOf('.'));
        }
        //Equivalent of f-strings in Python (encased with ` ` and $ before the {})
        const newFilename = `${originalFilename}.jpg`;

        //Call upon the Download function from the chrome API (to download a file)
        //url = the url of the image (here, the converted one)
        //filename = default name when saving the image
        //saveAs: true = prompt Save As dialog (as opposed to directly downloading without prompting)
        chrome.downloads.download({
          url: dataUrl,             // The data URL of the image to download.
          filename: newFilename, // Default filename for the download.
          saveAs: true              // Prompt the user with a "Save As" dialog.
        },
        );
      }
    });
  }
});