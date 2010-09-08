 console.log('in iframe_preload.js for ' + self.location.href);

var res = document.createElement('SCRIPT'); 
res.type = 'text/javascript'; 
res.src = chrome.extension.getURL("iframe_raw.js");
document.documentElement.appendChild(res);

var top = "blah";
console.log(top);
/*
$(document.documentElement).bind('DOMNodeInserted', function(ev) {
  var ev_target = $(ev.target);
  //console.log("iframe_preload.js " + self.location.href + " : DOMNodeInserted : " + ev.target.tagName);
  if (ev.target.tagName == 'SCRIPT') {
  console.log("iframe_preload.js " + self.location.href + " : DOMNodeInserted : " + ev.target.tagName);
    console.log(ev.target);
    console.log($(ev.target));
  }
});
*/

