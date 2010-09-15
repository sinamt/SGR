//console.log('in reader_preload.js for ' + self.location.href);

// Inject the reader_raw script directly into the document
//
var res = document.createElement('SCRIPT'); 
res.type = 'text/javascript'; 
res.src = chrome.extension.getURL("reader_raw.js");
document.documentElement.appendChild(res);

