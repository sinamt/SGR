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
    ev.source.postMessage('sgr:hello', ev.origin);
  }

});
