//console.log('in reader_preload.js for ' + self.location.href);

// Google Chrome has an annoying bug that incorrectly caches an iframe
// after a restart of Chrome. This causes the previous iframe content to
// become locked into each iframe you try to generate from that point on.
// So we reload Chrome ourselves when Chrome first loads, which fixes the 
// problem. Yuck.
//
if (localStorage.getItem('sgr_no_reload') == null) {
  // If this is the first window load, set our flag and initiate the reload.
  //
  localStorage.setItem('sgr_no_reload', true);
  window.location.reload();
  return;
} else {
  // If this is the reload, clear our flag.
  //
  localStorage.removeItem('sgr_no_reload');
}

// Inject the reader_raw script directly into the document
//
var res = document.createElement('SCRIPT'); 
res.type = 'text/javascript'; 
res.src = chrome.extension.getURL("reader_raw.js");
document.documentElement.appendChild(res);

