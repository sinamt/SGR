
  // $.stor namespace constructor
  //
  $.stor = function(func_name) {
    $.isFunction(func_name) ? func_name.call() : null
  }

  $.stor.DISABLED = false;

  $.stor.hasLocalStorage = function() {
    return ('localStorage' in window) && window['localStorage'] !== null;
  }

  // Sets the item in the localstorage
  //
  $.stor.set = function(key, value) {
    if ($.stor.DISABLED) {
      return null;
    }
    try {
      //debug("Inside setItem:" + key );
      if ($.stor.hasLocalStorage()) {
        //window.localStorage.removeItem(key);
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    }catch(e) {
      debug("Error inside setItem");
      debug(e);
      if (e.name == "QUOTA_EXCEEDED_ERR") {
        $.stor.clear();
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    }
    //debug("Return from setItem" + key);
  }

  // Gets the item from local storage with the specified key
  //
  $.stor.get = function(key) {
    if ($.stor.DISABLED) {
      return null;
    }
    var value;
    //debug('Get Item:' + key);
    try {
      if ($.stor.hasLocalStorage()) {
        value = JSON.parse(window.localStorage.getItem(key));
      }
    }catch(e) {
      debug("Error inside getItem() for key:" + key);
      debug(e);
      value = "null";
    }
    //debug("Returning value for key: " + key);
    return value;
  }

  // Clears all the key value pairs in the local storage
  //
  $.stor.clear = function() {
    debug('about to clear local storage');
    if ($.stor.hasLocalStorage()) {
      window.localStorage.clear();
    }
    debug('cleared');
  }

  $.stor.cleanup = function() {
    if ($.stor.hasLocalStorage()) {
      debug("localStorage has " + localStorage.length + " items stored");
      for (var i=0; i < localStorage.length; i++) {
        //console.log(localStorage.key(i));
      }

      //$.each(localStorage,function(key, value) {
        //debug(key);
      //});
    }
  }
//$.stor.clear();
