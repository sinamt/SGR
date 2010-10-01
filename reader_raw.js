  //console.log("in reader_raw.js for " +self.location.href);

jQuery.noConflict();

function fireKeyboardEvent(element, kbEvent, keyIdentifier) {
   if (document.createEvent) {
     //var evt = document.createEvent("MouseEvent");
     //evt.initMouseEvent(event, true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
     var evt = document.createEvent("KeyboardEvent");
     evt.initKeyboardEvent(kbEvent, true, true, window, keyIdentifier, false, false, false, false, false, false);
     evt.which = 79;
     evt.keyCode = 79;
       
     console.log("fireEvent evt=");
     console.log(evt);
     return !element.dispatchEvent(evt);
   } 
}

pressKey = function(key, shift) {
  var evt = document.createEvent('KeyboardEvent');
  evt.initKeyEvent("keypress", false, true, null, false, false,
                   shift, false, 79, key.charCodeAt(0));
  document.dispatchEvent(evt);
}

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

/*
window.addEventListener('keydown', function(ev) {
  //if (ev.keyCode == 219 || ev.keyCode == 220 || ev.keyCode == 221) {
  //if (ev.keyCode == 79 && ev.shiftKey && ev.ctrlKey) {
  if (ev.keyCode == 219 || ev.keyCode == 220 || ev.keyCode == 221) {
    console.log("raw: []\\ pressed, keyCode = " + ev.keyCode);
    console.log(ev);
    //var current_entry = document.getElementById("current-entry");
    //console.log(current_entry);
    //current_entry.click();
    //pressKey(79, false);

    setTimeout(function(){ fireKeyboardEvent(document, 'keypress', 79);},1);
  }
});

setTimeout(function(){ fireKeyboardEvent(document, 'keypress', 79);},4000);
*/

jQuery(document).bind("keydown", function(ev){
  console.log("raw keydown, ev.keyCode = " + ev.keyCode);
});

/*
window.addEventListener('keypress', function(ev) {
  console.log("keypress event =");
    console.log(ev);
});

window.addEventListener('mousedown', function(ev) {
  console.log("mousedown triggered");
  console.log(ev);
});
*/
