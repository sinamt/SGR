  //console.log("in reader_raw.js for " +self.location.href);

window.addEventListener('message', function(ev) {
  //console.log('reader_raw: ev.data = ' + ev.data);
  //console.log('reader_raw: ev.origin = ' + ev.origin);

  if (typeof ev.data == 'undefined') {
    return;
  }  

  // Message data from iframe is 'helo'. iframe is registering itself with us,
  // we respond with 'hello'.
  //
  if (ev.data == 'sgr:helo') {
    //console.log('reader_raw: helo received, hello send to ' + ev.origin);

    // Loop all iframes in the document and try to match an iframe DOMWindow to the source
    // of this message. If we find one, we know we have a matching iframe registering
    // with us. We reply with the unique id of the iframe so it can use this in future
    // communications.
    //
    var iframes = document.getElementsByTagName("iframe");
    for (var i=0; i < iframes.length; i++) {
      var iframe = iframes[i];
      //console.log(iframe);
      if (iframe.contentWindow == ev.source) {
        var iframe_id = iframe.getAttribute("id").substr("sgr_preview_".length);
        //console.log("iframe found " + i + " id=" + iframe_id);
        if (iframe_id.length == 8) {
          ev.source.postMessage('sgr:hello:' + iframe_id, ev.origin);
        }
      }
    }
  }

});

