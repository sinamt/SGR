  //console.log("in iframe_raw.js for " +self.location.href);

  if (window.parent == window || typeof window.parent == 'undefined') {
    //console.log('NO IFRAME : window.parent == window || typeof window.parent == undefined. ' + self.location.href);
    
  } else {

    window.addEventListener('message', function(ev) {
      //console.log('iframe_raw: ev.data = ' + ev.data);
      //console.log('iframe_raw: ev.origin = ' + ev.origin);

      if (typeof ev.data == 'undefined') {
        return;
      }  

      // Message data from parent is 'hello'. parent is saying we can execute.
      //
      if (ev.data.substr(0,9) == 'sgr:hello') {
        data_arr = ev.data.split(':');
        if (data_arr[2]) {
          console.log('iframe_raw: hello received, iframe confirmed.');
          var div = document.createElement('DIV');
          div.style.display = "none";
          div.className = "sgr_iframe";
          div.innerText = data_arr[2];
          document.documentElement.appendChild(div);
        }
      }

    });

    var msg = 'sgr:helo';

    // Ugh. We can't find out what protocol the parent google reader window is using, so
    // we spam both http and https. Yuck.
    //
    window.parent.postMessage(msg, '*'); //,window.parent.href.location);
    //window.parent.postMessage(msg,'http://www.google.com');
    //window.parent.postMessage(msg,'https://www.google.com');


  }

