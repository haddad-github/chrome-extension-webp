//As soon as the browser finishes loading the HTML, add a listener to it
document.addEventListener('DOMContentLoaded', () => {
    //Checks if there's a saved format preference (JPG/PNG)
    chrome.storage.sync.get('format', (data) => {

        //It goes to popup.html's radio button with the name="format" that matches the value and sets it as checked
        if (data.format) {
            document.querySelector(`input[name="format"][value="${data.format}"]`).checked = true;
        }
    });

    //For each button (name="format"), add an event listener that'll trigger upon a 'change'..
    //..take the new value (here, 'jpg' or 'png') and save that data in the key 'format'..
    //..that is eventually sent to the background worker
    document.querySelectorAll('input[name="format"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const format = event.target.value;
            chrome.storage.sync.set({format: format}, () => {
                console.log('Format preference saved:', format);
            });
        });
    });
});
