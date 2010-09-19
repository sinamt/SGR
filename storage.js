
  // $.stor namespace constructor
  //
  $.stor = function(func_name) {
    $.isFunction(func_name) ? func_name.call() : null
  }

  $.stor.DISABLED = false;

  $.stor.hasLocalStorage = function() {
    return ('localStorage' in window) && window['localStorage'] !== null;
  }

  $.stor.hasSessionStorage = function() {
    return ('sessionStorage' in window) && window['sessionStorage'] !== null;
  }

  // gets the appropriate storage container, local or session
  //
  $.stor.getStorage = function(store_type) {
    if ((typeof store_type == 'undefined' || store_type == 'local') && $.stor.hasLocalStorage()) {
      return window.localStorage;
    } else if (store_type == 'session' && $.stor.hasSessionStorage()) {
      return window.sessionStorage;
    }
    return false;
  }

  // Private function to set the item in storage
  //
  $.stor._set = function(key, value, storage) {
    storage.setItem(key, JSON.stringify(value));
  }

  // Sets the item in storage
  //
  $.stor.set = function(key, value, store_type) {
    if ($.stor.DISABLED) {
      return null;
    }
    var storage = $.stor.getStorage(store_type);
    if (storage == false) {
      return null;
    }
    try {
      //debug("Inside setItem:" + key );
      $.stor._set(key, value, storage);
    }catch(e) {
      debug("Error inside setItem");
      debug(e);
      if (e.name == "QUOTA_EXCEEDED_ERR") {
        $.stor.clear();
        $.stor._set(key, value, storage);
      }
    }
    //debug("Return from setItem" + key);
  }

  // Gets the item from storage with the specified key
  //
  $.stor.get = function(key, store_type) {
    if ($.stor.DISABLED) {
      return null;
    }
    var storage = $.stor.getStorage(store_type);
    if (storage == false) {
      return null;
    }

    var value;
    //debug('Get Item:' + key);
    try {
      value = JSON.parse(storage.getItem(key));
    }catch(e) {
      debug("Error inside getItem() for key:" + key);
      debug(e);
      value = "null";
    }
    //debug("Returning value for key: " + key);
    return value;
  }

  // Clears all the key value pairs in storage
  //
  $.stor.clear = function(store_type) {
    debug('about to clear ' + store_type + ' storage');
    var storage = $.stor.getStorage(store_type);
    if (storage == false) {
      return null;
    }
    storage.clear();
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
