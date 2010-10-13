//console.log('in reader_preload.js for ' + self.location.href);

var proceed = true;

// Google Chrome has an annoying bug that incorrectly caches an iframe
// after a restart of Chrome. This causes the previous iframe content to
// become locked into each iframe you try to generate from that point on.
// So we reload Chrome ourselves when Chrome first loads, which fixes the 
// problem. Yuck.
//
if (sessionStorage.getItem('sgr_no_reload') == null) {
  // If this is the first window load, set our flag and initiate the reload.
  //
  sessionStorage.setItem('sgr_no_reload', true);
  window.location.reload();
  proceed = false;
} else {
  // If this is the reload, clear our flag.
  //
  sessionStorage.removeItem('sgr_no_reload');
}

if (proceed) {
  // Inject the reader_raw script directly into the document
  //
  var res = document.createElement('SCRIPT'); 
  res.type = 'text/javascript'; 
  res.src = chrome.extension.getURL("reader_raw.js");
  document.documentElement.appendChild(res);
}
