 //console.log('in iframe_preload.js for ' + self.location.href);

// Inject the iframe_raw script directly into the document
//
var res = document.createElement('SCRIPT'); 
res.type = 'text/javascript'; 
res.src = chrome.extension.getURL("iframe_raw.js");
document.documentElement.appendChild(res);

