  //console.log("in reader_raw.js for " +self.location.href);

window.addEventListener('message', function(ev) {
  console.log('reader_raw: ev.data = ' + ev.data);
  console.log('reader_raw: ev.origin = ' + ev.origin);

  if (typeof ev.data == 'undefined') {
    return;
  }  

  // Message data from iframe is 'helo'. iframe is registering itself with us,
  // we respond with 'hello'.
  //
  if (ev.data == 'sgr:helo') {
    //console.log('reader_raw: helo received, hello send to ' + ev.origin);
/*
console.log(window.frames.length);
for (var i=0; i < window.frames.length; i++) {
  console.log(window.frames[i]);
  if (window.frames[i] == ev.source) {
    console.log("iframe found " + i + " id=" + window.frames[i].name);
  }
}
*/
var iframes = document.getElementsByTagName("iframe");
//console.log("iframes.length=");
//console.log(iframes.length);

for (var i=0; i < iframes.length; i++) {
  var iframe = iframes[i];
  //console.log(iframe);
  if (iframe.contentWindow == ev.source) {
    var iframe_id = iframe.getAttribute("id").substr("sgr_preview_".length);
    console.log("iframe found " + i + " id=" + iframe_id);
    if (iframe_id.length == 8) {
      ev.source.postMessage('sgr:hello:' + iframe_id, ev.origin);
    }
  }
}
  }

});

