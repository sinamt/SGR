
//,
    //{
      //"matches": ["http://*/*", "https://*/*"],
      //"js": ["jquery.js", "iframe_preload.js"],
      //"run_at": "document_end",
      //"all_frames": true
    //}

(function($) {

  //console.log('in iframe.js');

  // If the iframe preloader did not find an iframe, return immediately
  //
  if ($(".sgr_iframe").length <= 0) {
    //debug("no sgr_iframe exists");
    //return;
  }
  //debug("** sgr_iframe exists");

  //$('body').append('<script type="text/javascript">(function(l) { var res = document.createElement(\'SCRIPT\'); res.type = \'text/javascript\'; res.src = l; document.getElementsByTagName(\'head\')[0].appendChild(res); })(\''+chrome.extension.getURL("iframe_raw.js")+'\');</script>');

  // Return as quickly as possible if we are not in an iframe
  //
  //if (window.parent == window || typeof window.parent == 'undefined') {
    //return;
  //}

  //console.log('iframe.js : we are in an iframe');

  // If this is the google reader settings iframe, return
  //
  if (self.location.href.match(/\/\/(www\.|)google\.com\/reader\/settings/)) {
    debug("in greader settings iframe, returning");
    return;
  }

  // Minimum allowed iframe height to be sent to the parent
  //
  const MIN_IFRAME_HEIGHT = 700;

  // Maximum allowed times to send height to parent.
  //
  const MAX_SEND_SIZE = 25;

  // Counter for amount of times height has been sent to parent.
  var send_size_counter = 0;

  var ok_to_proceed = false;


  // Execute the posting of a message to our parent window.
  //
  function postMessageToParent(msg) {
    if (chrome) {
      $.sgr.sendRequest({action: "window_height", window_height: msg});
    } else if (window.parent['postMessage']) {
      // Ugh. We can't find out what protocol the parent google reader window is using, so
      // we spam both http and https. Yuck.
      //

      window.parent.postMessage(msg,'http://www.google.com');
      window.parent.postMessage(msg,'https://www.google.com');
    }
  }

  // Receive a response from our parent window. We are looking for a 'hello'
  // message from a google.com parent. Once we receive this, we can proceed 
  // with more destructive actions such as hiding all comments on the page.
  // Note this is not necessairly a security precaution, it's more a way of
  // preventing any iframe from running our "destructive" code.
  //
  function receiveParentMessage(event) {  
    var msg_ev = event.originalEvent;

    //debug('msg_ev.data = ' + msg_ev.data);
    //debug('msg_ev.origin = ' + msg_ev.origin);

    // Check the message was received from a google domain (http or https)
    //
    if (msg_ev.origin.match(/http(s|):\/\/www\.google\.com/) == null) {
      return;
    }
    if (typeof msg_ev.data == 'undefined') {
      return;
    }  

    if (msg_ev.data == 'hello') {
      ok_to_proceed = true;
      $.sgr.hideComments();
      sendSizeToParent();
    }

  }

  // Send a message to the parent window to acknowledge our existence, and 
  // ensure our parent is a google domain
  //
  function registerWithParent() {
    postMessageToParent('helo');
    return false;
  }

  // Find the height of the window and send it to the parent window.
  // This is done via parent.postMessage()
  //
  function sendSizeToParent() {

    //debug('sendSizeToParent()');

    // Check if we have exceeded the maximum allowed times to send the height to the parnet.
    // This is here as a catchall or precaution in case we get stuck in a resize loop and continually
    // spam the parent with height values. This can sometimes occur if we use a window resize event 
    // handler to determine when to send height to the parent.
    //
    if (send_size_counter > MAX_SEND_SIZE) {
      debug("sendSizeToParent() exceeded call limit");
      if (jQuery) {
        $(window).unbind('resize', sendSizeToParent);
      }
      return false;
    }

    try {
      var scroll_height = document.body.scrollHeight;
    } catch(e) {
      console.log("document.body.scrollHeight not found");
      return false;
    }

    send_size_counter += 1;

    //if (window.parent['postMessage']) {
      var height;

      // If jQuery has loaded, use it to find the window height
      //
      if (jQuery) { 
        // document.body.scrollHeight *seems* to be the correct height to use in 
        // cases where a page has been shortened in height during it's load process. 
        // So if document.body.scrollHeight is less than $(document).height(), but 
        // still larger than the minimum allowable iframe height, use it.
        //
        if (document.body.scrollHeight < $(document).height() && document.body.scrollHeight > MIN_IFRAME_HEIGHT) {
          // Add a little fudge (20px) to cover fringe cases of incorrect height
          //
          height = document.body.scrollHeight + 20;
        } else {
          height = $(document).height();
        }

      // If we don't have access to jQuery, simply use document.body.scrollHeight
      //
      } else {
        // Add a little fudge (20px) to cover fringe cases of incorrect height
        //
        height = document.body.scrollHeight + 20;
      }

      // Send the height to the parent using postMessage()
      //
      postMessageToParent(height);
    //}
    return false;
  }

  // Register a listener for receiving messages from our parent
  //
  //$(window).bind("message", receiveParentMessage);

  // Send a message to our parent to check we are interacting with a google domain
  //
  //registerWithParent();


  // MAIN
  //

  // Send the window size to the parent right now
  //
  //sendSizeToParent();

  var sgr_no_div = true;
  var prev_scrollheight = 0;

  //$(window).bind('DOMNodeInserted', function(ev){
  $("body").live('DOMNodeInserted', function(ev){
    //if (document.body && sgr_no_div == true) { // Math.floor(Math.random()*10) == 1) {
      //sgr_no_div = false;
      //debug("DOMNodeInserted sendSizeTOParent " + self.location.href);
      //sendSizeToParent();
    //}
    //if ($.inArray(ev.target.tagName,['DIV','P']) > -1 && document.body) {
    //debug("DOMNodeInserted " + self.location.href);
    if ($.inArray(ev.target.tagName,['DIV','P']) > -1) {
      //debug("DOMNodeInserted doducment.body.scrollHeight = " + document.body.scrollHeight + " " + self.location.href);
      if (document.body.scrollHeight > prev_scrollheight) {
        debug("DOMNodeInserted sendSizeTOParent " + self.location.href);
        prev_scrollheight = document.body.scrollHeight;
        sendSizeToParent();
      }
    }
  });

  $(document).ready(function() {
    debug("document.ready sendSizeTOParent " + self.location.href);
    sendSizeToParent();
  });

  // Send the window size to the parent after the window has loaded
  //
  $(window).load(function() {
    debug("window.load sendSizeTOParent " + self.location.href);
    sendSizeToParent();
  });

  // Run the main code
  //
  $.sgr.run_iframe();

})(jQuery);

