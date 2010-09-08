  console.log("in iframe_raw.js for " +self.location.href);

  if (window.parent == window || typeof window.parent == 'undefined') {
    console.log('NO IFRAME : window.parent == window || typeof window.parent == undefined. ' + self.location.href);
    
  } else {
    console.log("IFRAME present for " + self.location.href);
    var div = document.createElement('DIV');
    div.style.display = "none";
    div.className = "sgr_iframe";
    document.documentElement.appendChild(div);
  }

