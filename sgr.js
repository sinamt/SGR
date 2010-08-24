
(function($) {

  // $.sgr namespace constructor
  //
  $.sgr = function(func_name) {
    $.isFunction(func_name) ? func_name.call() : null
  }

  ////////////
  // CONFIG
  ////////////

  // Minimum allowed height for the preview iframe
  //
  $.sgr.minimum_iframe_height = 700;
  $.sgr.minimum_iframe_height_str = $.sgr.minimum_iframe_height.toString() + 'px';

  // Comment selector snippet for finding comments on a page
  //
  $.sgr.comment_selector = "[class*=comment], [id*=comment]";

  ////////////
  // End CONFIG
  ////////////

  // Settings cache
  //
  $.sgr._settings = {};

  // Setting tab counter, so we know when to insert our settings tab
  //
  $.sgr.setting_group_title_add_count = 0;

  // Container to store when an entry has been closed. Used to prevent entry 'flicker'
  // when entry is closed/opened/closed too quickly
  //
  $.sgr.entry_closed_at_time = {};

  // Stored original entry content for entry being replaced by readability.
  //
  $.sgr.entry_original_content = '';

  // Google Reader _USER_ID value
  //
  $.sgr.USER_ID = null;

  // Load default global settings.
  //
  $.sgr.initSettings = function() {

    $.sgr.initUserId();

    // Set the defaults for global settings
    //
    var default_settings = {use_iframes: false, use_readability: false, readability_pre_fetch: false, url_in_subject: false, hide_likers: true};

    $.each(default_settings, function(key,value) {
      var stored_setting = $.sgr.getGlobalSetting(key);
      if (stored_setting === null) {
        $.sgr.setGlobalSetting(key,value);
      }
    });

    // Sanity check for use_iframes and use_readability to ensure both are not true simultaneously
    //
    if ($.sgr.getGlobalSetting('use_iframes') == true && $.sgr.getGlobalSetting('use_readability') == true) {
      $.sgr.setGlobalSetting('use_iframes',false);
      $.sgr.setGlobalSetting('use_readability',false);
    }
  }

  $.sgr.initUserId = function() {
    $("head script").each(function(){
      var user_id = this.innerHTML.match(/_USER_ID = "(.*?)"/)[1];
      if (user_id != null) {
        $.sgr.USER_ID = user_id;
      }
    });
  }

  // Helper function to add global CSS styles to the page head
  //
  $.sgr.addStyles = function(css) {
    var head=document.getElementsByTagName('head')[0];
    if (head)
    {
      var style=document.createElement('style');
      style.type='text/css';
      style.innerHTML=css;
      head.appendChild(style);
    }
  }

  // Initialise global page CSS styles
  //
  $.sgr.initStyles = function() {

    var global_styles = ' div.preview .entry-container { display: none; } .entry .entry-container-preview { padding: 0.5em 0; margin: 0 10px; color: #000; max-width: 98%; display: block; left: -10000px; } .entry .entry-container-preview .entry-title { max-width: 98%; } .entry .entry-container-preview .entry-main .entry-date { display: none; } .entry .entry-container-preview-hidden { position: absolute; } #setting-enhanced .enhanced { border-bottom:1px solid #FFCC66; margin:0; padding:0.6em 0; } #setting-enhanced .enhanced-header { font-weight: bold; margin-bottom: 1em; } div.preview iframe.preview { display: block; overflow-y: hidden; } .entry .hostname { font-weight: normal; } .entry .entry-main .hostname { font-size: 90%; }';
//]]></r>).toString();

    // Check if 'Hide likers' is enabled and add appropriate CSS
    //
    if ($.sgr.getSetting('hide_likers')) {
      global_styles += ' .entry-likers { display: none; }';
    }

    $.sgr.addStyles(global_styles);
  }

  // Set a setting value per feed or folder. Store it in localStorage.
  //
  $.sgr.setLocalSetting = function(setting_name,value) {
    var key = $.sgr.getSettingName(setting_name, 'local');
    if (key == false) {
      return false;
    }
    //debug("setLocalSetting() : " + key + " = " + value);
    
    $.stor.set(key, value);
    $.sgr._settings[key] = value;
  }

  // Set a global setting value. Store it in localStorage.
  //
  $.sgr.setGlobalSetting = function(setting_name,value) {
    var key = $.sgr.getSettingName(setting_name, 'global');
    //debug("setGlobalSetting() : " + key + " = " + value);
    $.stor.set(key, value);
    $.sgr._settings[key] = value;
  }

  // Fetch a per feed or folder setting value from localStorage.
  //
  $.sgr.getLocalSetting = function(setting_name) {
    var key = $.sgr.getSettingName(setting_name, 'local');
    if (key == null) {
      return null;
    }
    var value = $.sgr._settings[key];
    if (value == null) {
      //debug("no $.sgr._settings[key] found for " + key);
      value = $.stor.get(key);
      $.sgr._settings[key] = value;
    }
    //debug("getLocalSetting() : " + key + " = " + value);
    return value;
  }

  // Fetch a global setting value from localStorage.
  //
  $.sgr.getGlobalSetting = function(setting_name) {
    var key = $.sgr.getSettingName(setting_name, 'global');
    var value = $.sgr._settings[key];
    if (value == null) {
      //debug("no $.sgr._settings[key] found for " + key);
      value = $.stor.get(key);
      $.sgr._settings[key] = value;
    }
    //debug("getGlobalSetting() : " + key + " = " + value);
    return value;
  }

  // Get a setting value. Look for a locally set value first (for this user), otherwise use
  // the default global setting value.
  //
  $.sgr.getSetting = function(setting_name) {
    var local_setting = $.sgr.getLocalSetting(setting_name);
    return local_setting == null ? $.sgr.getGlobalSetting(setting_name) : local_setting;
  }

  // Get a setting name, namespaced to the currently selected feed or folder
  //
  $.sgr.getLocalSettingName = function(setting_name) {
    var feed = $.sgr.getCurrentFeedName();
    if (typeof feed == 'undefined') {
      return false;
    }
    return "setting_" + setting_name + "_" + feed;
  }

  $.sgr.getSettingName = function(setting_name, setting_type) {
    var _setting_name = false;
    if (setting_type == 'local') {
      _setting_name = $.sgr.getLocalSettingName(setting_name);
    } else if (setting_type == 'global') {
      _setting_name = 'global_' + setting_name;
    }

    if (_setting_name == false || $.sgr.USER_ID == null) {
      return null;
    }

    return $.sgr.USER_ID + "_" + _setting_name;
  }

  // Initialise global page CSS styles
  //
  $.sgr.initIframeStyles = function() {

    var global_styles = ' #sgr_toggle_cmts { cursor: pointer; font-size: 14px; color: black; background-color: #F3F5FC; border: 2px solid #6688EE; padding: 5px; position: absolute; right: 20px; top: 0px; text-decoration: none; font-weight: normal; display: inline; -moz-border-radius: 3px; -webkit-border-radius: 3px; } #sgr_toggle_cmts:hover { text-decoration: underline; } /*html {overflow-y: hidden; }*/ ';

    $.sgr.addStyles(global_styles);
  }

  // Find and hide elements that appear to be comments. Add a show/hide comments
  // button to the page to allow comments to be toggled on/off.
  //
  $.sgr.hideComments = function() {
    if ($.sgr.getSetting('hide_comments')) {
      var comments = $($.sgr.comment_selector);
      if (comments.size() > 0) {
        comments.hide();
        $("body").prepend('<div id="sgr_toggle_cmts" class="sgr_hidden">Show comments</div>');
        $("#sgr_toggle_cmts").click(function(){
          if ($(this).hasClass('sgr_hidden')) {
            $($.sgr.comment_selector).show();
            $(this).removeClass('sgr_hidden').text('Hide comments');
          } else {
            $($.sgr.comment_selector).hide();
            $(this).addClass('sgr_hidden').text('Show comments');
          }
          sendSizeToParent();
        });
      }
    }
  }

  // Find and return the currently selected feed href or folder name
  //
  $.sgr.getCurrentFeedName = function() {
    if (typeof $("a.tree-link-selected").attr('href') != 'undefined') {
      return unescape($("a.tree-link-selected").attr('href').match(/.*\/(.*)/)[1]);
    }
  }

  // Helper function to get the CSS xpath for a specific HTML element
  //
  $.sgr.getXPath = function(elt) {
    if (elt instanceof jQuery) {
      elt = elt.get(0);
    }
    var path = '';
    for (; elt && elt.nodeType == 1; elt = elt.parentNode)
    {
      var idx = 0;
      $(elt.parentNode).children(elt.tagName).each(function(index) {
        if (this == elt) {
          idx = index + 1;
          return;
        }
      });
      //var idx = $(elt.parentNode).children(elt.tagName).index($(elt)) + 1;
      idx > 1 ? (idx='[' + idx + ']') : (idx='');
      path = '/' + elt.tagName.toLowerCase() + idx + path;
    }
    return path;
  }

  // Main message handler to handle messages from iframe preview window.
  //
  // There are 2 types of messages we will accept from a child iframe:
  //  1. Data string of 'helo', to which we respond with 'hello'. This 
  //     represents the iframe registering itself with it's parent (us)
  //     so the iframe window knows it is running inside google.com
  //  2. Data string containing an integer, which represents the height 
  //     of the iframe window. When receiving this we adjust the height 
  //     of the iframe element on our page.
  //
  $.sgr.receiveIframeMessage = function(event) {  
    var msg_ev = event.originalEvent;
    //debug('msg_ev.data = ' + msg_ev.data);
    //debug('msg_ev.origin = ' + msg_ev.origin);

    if (typeof msg_ev.data == 'undefined') {
      return;
    }  

    // Message data from iframe is 'helo'. iframe is registering itself with us,
    // we respond with 'hello'.
    //
    if (msg_ev.data == 'helo') {
      window.frames[0].postMessage('hello', msg_ev.origin);

    // Convert any other data to an integer and set the iframe element height accordingly
    //
    } else {
      $.sgr.setIframeWindowHeight($('#sgr_preview'), msg_ev.data);
    }
  }  

  $.sgr.receiveRequest = function(request, sender, sendResponse) {  
    debug("reader.js: receiveRequest() called. request.action: " + request.action);
    if (request.action == 'set_window_height') {
      debug("reader.js: request.window_height=" + request.window_height);
      sendResponse({_msg: "reader.js received window height " + request.window_height});
      $.sgr.setIframeWindowHeight($('#sgr_preview'), request.window_height);

    } else {
      sendResponse({}); // snub them.
    } 
  }

  $.sgr.setIframeWindowHeight = function(iframe, raw_height)  {
    var height = parseInt(raw_height);

    //debug('height = ' + height);

    if (iframe.size() < 1) {
      return;
    }

    // Make sure the requested height is above our minimum
    //
    if (height < parseInt($.sgr.minimum_iframe_height)) {
      return;
    }

    // Set the iframe height
    //
    iframe.attr('height', height.toString() + 'px');
  }

  // Scroll viewing pane to the top of a specific entry
  //
  $.sgr.scrollTo = function(entry) {
    $("#entries").scrollTop(entry.attr("offsetTop"));
  }

  // Toggle the showing / hiding of an entry preview iframe.
  //
  $.sgr.showPreview = function(entry) {

    //debug("showPreview");

    // If this entry is already open in an iframe, close it
    //
    if (entry.hasClass("preview")) {
      $.sgr.removePreview(entry);

    // Else show the entry in an iframe
    //
    } else {
      entry.addClass("preview");

      $.sgr.scrollTo(entry);

      // If there is already a hidden preview container for this entry, show it
      //
      if (entry.find(".entry-container-preview-hidden").size() > 0) {
        $.sgr.restorePreview(entry);
      } else { //if ($(".entry-body iframe.preview").size() <= 0) {
        $.sgr.createPreviewIframe(entry, false);
      }

    }

  }

  // Create a new iframe element for previewing an entry.
  //
  $.sgr.createPreviewIframe = function(entry, hidden) {
    if (typeof hidden == 'undefined') {
      hidden = false;
    }

    // Create a new div.entry-container-preview with our iframe in it. 
    //
    entry.find(".collapsed").after($('<div class="entry-container-preview' + (hidden ? ' entry-container-preview-hidden' : '') + '"><iframe id="sgr_preview" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="' + $.sgr.getEntryUrl(entry) + '" class="preview"></iframe></div>'));

    // Add the entry header to our iframe container
    //
    $.sgr.populateIframeHeading(entry);

  }

  // Completely remove the iframe preview container from the DOM.
  //
  $.sgr.removePreview = function(entry) {
    //debug("removePreview");
    $(entry).removeClass("preview").find(".entry-container-preview").remove();
  }

  // Save the preview iframe container (effectively hiding it) for possible re-use later.
  //
  $.sgr.savePreview = function(entry) {
    //debug("savePreview");
    $(entry).removeClass("preview").find(".entry-container-preview").addClass("entry-container-preview-hidden");
  }

  // Restore a previously saved/hidden preview iframe.
  //
  $.sgr.restorePreview = function(entry) {
    //debug("restorePreview");
    entry.find(".entry-container-preview-hidden").removeClass("entry-container-preview-hidden");
    $.sgr.populateIframeHeading(entry);
  }

  // When adding a preview iframe, we need to rebuild the entry header elements to prepend
  // to our iframe container.
  //
  $.sgr.populateIframeHeading = function(entry) {
    // If the preview container is not in this entry, or it already has
    // an .entry-main added, return
    //
    if (entry.find(".entry-container-preview").size() <= 0 
        || entry.find(".entry-container-preview .entry-main").size() > 0) 
    {
      return;
    }

    // Grab the relevant header components from the existing .entry-container and 
    // prepend them to our new preview container.
    //
    var preview_header = entry.find(".entry-container .entry-main").clone();
    if (preview_header.size() > 0) {
      preview_header.find(".entry-body").remove();
      entry.find(".entry-container-preview").prepend(preview_header);
      $.sgr.addHostnameToSubject(entry, '.entry-container-preview .entry-main .entry-title');
    }
  }


  // Setup the Settings window. Google Reader settings are handled via a seperate iframe. 
  // When a user starts the Settings iframe, we execute this function to inject our 'Enhanced' 
  // settings tab content into the DOM.
  //
//(<r><![CDATA[
  $.sgr.initSettingsNavigation = function() {
    $('#settings .settings-list').append(' <li id="setting-enhanced" class="setting-group"> <div id="setting-enhanced-body" class="setting-body"> <div class="enhanced"> <div class="enhanced-header">Opening entries</div> <label> <input type="checkbox" id="setting-global-use-iframes"> Default to open all entries as previews (iframes) </label> </div> <div class="enhanced"> <div class="enhanced-header">Entry subject</div> <label> <input type="checkbox" id="setting-global-url-in-subject"> Default to include entry hostname in subject </label> </div> <div class="enhanced"> <div class="enhanced-header">Entry content</div> <label> <input type="checkbox" id="setting-global-hide-likers"> Hide \'Liked by users\' for each entry </label> </div> </div> </li>');
//]]></r>).toString());

    var global_settings = ['use_iframes', 'url_in_subject', 'hide_likers'];

    // Loop the possible global settings and set the checkboxs to appropriate initial values
    // based on the user's current global setting values. Also initialise a click event
    // handler for each setting.
    //
    $(global_settings).each(function(){
      var gs_name = this;
      var alt_gs_name = gs_name.replace(/_/g, '-');

      // Set the setting checkbox state based on the user's global setting value
      //
      if ($.sgr.getGlobalSetting(gs_name) == true) {
        $("#setting-global-" + alt_gs_name).attr('checked','checked');
      }

      // Initialise a click event handler for this setting checkbox
      //
      $("#setting-global-" + alt_gs_name).click(function() {
        $.sgr.globalSettingClickEventHandler(gs_name, false, 'setting-global-' + alt_gs_name);
      });
    });

  }

  // Settings checkbox click event handler. Handles a user changing a setting.
  //
  $.sgr.globalSettingClickEventHandler = function(gs_name, gs_default, gs_id) {
    var gs_value = !$.sgr.getGlobalSetting(gs_name);
    $.sgr.setGlobalSetting(gs_name, gs_value);

    if (gs_value) {
      $("#" + gs_id).attr('checked','checked');
    } else {
      $("#" + gs_id).removeAttr('checked');
    }

  }

  // Main setup for previewing entries in iframes. Sets up appropriate listeners.
  //
  $.sgr.initMainWindowEvents = function() {

    // Do not execute this for the settings iframe
    //
    if (window.location.href.match(/\/\/(www\.|)google\.com\/reader\/settings/)) {
      //debug("returning, reader settings");
      return;
    }

    // Add the entry hostname to entry subjects (if enabled)
    //
    //$.sgr.addHostnameToSubjects();

    // Note: We try to setup live events on the entire div#entries area where possible. 
    // This keeps the amount of live events to a minimum.
    //


    // div#entries live DOMAttrModified event
    //
    //$("#entries").live('DOMAttrModified', function(ev){
    //$(".entry").live('click', function(ev){

    // div#entries live DOMNodeInserted event
    //
    $("#entries").live('DOMNodeInserted', function(ev){
      var ev_target = $(ev.target);

      if (ev_target.hasClass("entry-container")) {

        var entry = ev_target.closest(".entry");

        $.sgr.removePreview($(".preview"));

        // If it has the class 'expanded' but doesnt anymore, try to save any iframe.preview that exists
        //
        //if (ev.prevValue.match(/expanded/) && !ev.newValue.match(/expanded/)) {
        if ($(this).hasClass("expanded")) {
          //debug('article close');
        
          // Store the time that this particular entry is being closed
          //
          //var entry_closed_at_time = new Date();
          //$.sgr.entry_closed_at_time[$.sgr.getXPath(ev_target)] = entry_closed_at_time.getTime();
          //$.sgr.removePreview(ev_target);

        // Else if it doesn't have the class 'expanded' but previously did, try to open an iframe.preview
        //
        // TODO support for ctrlKey toggling of iframe on a per-entry basis
        //
        } else if ($.sgr.getSetting('use_iframes') || $.sgr.getSetting('use_readability')) {
          //debug('article open');

          // Grab the time that this entry is being opened
          //
          var entry_opened_at_time = new Date();
          var entry_xpath = $.sgr.getXPath(entry);

          // Check if this entry was recently closed. Google reader seems to remove, add, and remove the 'expanded'
          // class when closing an entry. This causes it to 'flicker' on the screen. We check that the entry
          // wasn't recently (<500ms) closed before we attempt to open it, in order to avoid the flicker.
          //
          if (typeof $.sgr.entry_closed_at_time[entry_xpath] != 'undefined') {
            //debug("found previous entry_closed_at_time for " + entry_xpath + " : " + $.sgr.entry_closed_at_time[entry_xpath]);

            if (500 > (entry_opened_at_time.getTime() - $.sgr.entry_closed_at_time[entry_xpath])) {
              //debug("time diff < 500 : " + (entry_opened_at_time.getTime() - $.sgr.entry_closed_at_time[entry_xpath]));
              return;
            }
          }

          // Show the preview iframe
          //
          if ($.sgr.getSetting('use_iframes')) {
            $.sgr.showPreview($(ev_target).closest(".entry")); 

          // Fetch the article content and parse through readability
          //
          } else if ($.sgr.getSetting('use_readability')) {
            $.sgr.addHostnameToSubject(entry, '.entry-title');
            var entry_body = ev_target.find(".entry-body");
            $.sgr.entry_original_content = entry_body.html();
            entry_body.html("<p>Loading...</p>");

            $.sgr.sendReadabilityFetchRequest(entry);
          }

        }
      }

      // If this is an .entry node being inserted, add the entry hostname to it's subject (if appropriate).
      //
      if (ev_target.hasClass("entry")) {
        // Add hostname to subject
        //
        $.sgr.addHostnameToSubject(ev_target, '.entry-title');

        // Pre fetch readable content
        //
        if (!ev_target.hasClass("read") && $.sgr.getSetting("use_readability") && $.sgr.getSetting("readability_pre_fetch")) {
          $.sgr.sendReadabilityFetchRequest(ev_target, {pre_fetch: true});
        }
      }
    });

    $("#entries").live('DOMNodeRemoved', function(ev){
      var ev_target = $(ev.target);

      if (ev_target.hasClass("entry-container")) {
        var entry = ev_target.closest(".entry");

        // Store the time that this particular entry is being closed
        //
        var entry_closed_at_time = new Date();
        var entry_xpath = $.sgr.getXPath(entry);
        $.sgr.entry_closed_at_time[entry_xpath] = entry_closed_at_time.getTime();
        //debug("setting entry_closed_at_time for " + entry_xpath + " : " + $.sgr.entry_closed_at_time[entry_xpath]);

        $.sgr.removePreview(entry);

      }
    });

    // 'Settings' menu live click event. Inject our own items into the menu.
    //
    $("#stream-prefs-menu").live('click', function(ev) {
      // Remove any existing settings we may have injected
      //
      $("#stream-prefs-menu-menu .sgr-menuitem").remove();

      // Inject our settings options
      //
      $("#stream-prefs-menu-menu .goog-menuseparator:first").before(
        $.sgr.getGoogMenuseparatorHtml() + 
        $.sgr.getGoogMenuitemHtml('menu_use_iframes', 'Full entry content', $.sgr.getSetting('use_iframes')) + 
        $.sgr.getGoogMenuitemHtml('menu_use_readability', 'Readable content', $.sgr.getSetting('use_readability')) + 
        $.sgr.getGoogMenuseparatorHtml() + 
        $.sgr.getGoogMenuitemHtml('menu_readability_pre_fetch', 'Pre-fetch readable content', $.sgr.getSetting('readability_pre_fetch')) + 
        $.sgr.getGoogMenuitemHtml('menu_url_in_subject', 'Show host in subject', $.sgr.getSetting('url_in_subject'))
      );

      // Initialise a hover event for hovering over our settings menu options
      //
      $(".sgr-menuitem").hover(
        function(ev) {
          $(this).addClass("goog-menuitem-highlight");
        },
        function(ev) {
          $(this).removeClass("goog-menuitem-highlight");
        }
      );
    });

    // Feed/folder setting menu option live click event
    //
    $(".sgr-menuitem").live('click', function(ev) {
      var setting_name = $(this).attr('id').match(/^menu_(.*)/)[1];

      // Get the setting name
      //
      //var var_name = $.sgr.getSettingVarName(var_type);
      //if (var_name == false) {
        //return false;
      //}

      // If this feed/folder doesn't already have a setting for this, use
      // the global setting to determine what to set the feed/folder setting to
      //
      var setting_value = !$.sgr.getSetting(setting_name);

      $.sgr.setLocalSetting(setting_name, setting_value);

      // Special case for mutually exclusive use_iframes / use_readability
      //
      if (setting_name == 'use_iframes') {
        $.sgr.setLocalSetting('use_readability', !setting_value);
        if (setting_value) {
          $("#menu_use_readability").removeClass("goog-option-selected");
        } else {
          $("#menu_use_readability").addClass("goog-option-selected");
        }
      } else if (setting_name == 'use_readability') {
        $.sgr.setLocalSetting('use_iframes', !setting_value);
        if (setting_value) {
          $("#menu_use_iframes").removeClass("goog-option-selected");
        } else {
          $("#menu_use_iframes").addClass("goog-option-selected");
        }
      }

      // Set the setting in the menu to display our new value (a tick beside the setting).
      //
      if (setting_value) {
        $(this).addClass("goog-option-selected");
        if ($(this).attr('id') == 'menu_url_in_subject') {
          $.sgr.addHostnameToSubjects();
        }
      } else {
        $(this).removeClass("goog-option-selected");
        if ($(this).attr('id') == 'menu_url_in_subject') {
          $.sgr.removeHostnameFromSubjects();
        }
      }

    });

    // 'Back to Google reader' settings close live click event (settings iframe will have a class adjusted)
    // 
/*
// FIXME need to inject the hide_likers CSS when global setting changes in settings iframe
    $("#settings-frame").live('DOMAttrModified', function(ev){

      // If the settings iframe is being hidden after being shown,
      // look for changes to hide_likers and then reload the $.sgr.settings 
      // array because settings may have been updated.
      //
      if (!$(ev.target).hasClass("loaded") && ev.attrName === 'class') {

        // Note: The $.sgr.settings container has the *previous* values for global settings
        // in it at this point. This is because the settings were changed in an iframe, and 
        // not in the parent. This allows us to compare $.sgr.settings values to the GM_getvalue()
        // equivalent to find settings that have changed and then take appropriate action.
        //

        // If hide_likers is being disabled, show all entry likers
        //
        if ($.sgr.getSetting('hide_likers') ) {
          debug("previous global_hide_likers is true, new is false");
          $.sgr.addStyles(' .entry-likers { display: ""; }');
          $(".entry-likers").css('display','');

        // If hide_likers is being enabled, hide all entry likers
        //
        } else if (!$.sgr.getSetting('hide_likers') ) {
          debug("previous global_hide_likers is false, new is true");
          $.sgr.addStyles(' .entry-likers { display: none; }');
          $(".entry-likers").css('display','none');
        }

        // Re-initialise the settings container values so they pickup changes done in the settings iframe
        //
        $.sgr.initSettings();

      }
    });
*/

    if (chrome) {
      // Chrome listener for background messages
      //
      chrome.extension.onRequest.addListener($.sgr.receiveRequest);

    } else {
      // Listener for iframe messages
      //
      $(window).bind("message", $.sgr.receiveIframeMessage);
    }

  }


  $.sgr.sendRequest = function(data) {
    if (chrome) {
      chrome.extension.sendRequest(data, function(response) {
        console.log("sgr.js : response from sendRequest() : " + response._msg);

        if (response.action == 'readability_content') {
          //debug("reader.js: request.readability_content=" + request.readability_content);
          //debug("response=");
          //debug(response);
          if (typeof response.pre_fetch == 'undefined' || response.pre_fetch == false) {
            $(".expanded .entry-body").html(response.readability_content);
            $.sgr.postProcessReadabilityFetchRequest($(".expanded .entry-body"));
          }

        } else if (response.action == 'readability_error_use_original_content') {
          if (typeof response.pre_fetch == 'undefined' || response.pre_fetch == false) {
            $(".expanded .entry-body").html($.sgr.entry_original_content);
          }
        }

      });
    }
  }

  $.sgr.sendReadabilityFetchRequest = function(entry, extra_data) {
    extra_data = $.extend(extra_data, {user_id: $.sgr.USER_ID});
    $.sgr.sendRequest({action: 'readability_fetch', readability_url: $.sgr.getEntryUrl(entry), extra_data: extra_data});
  }

  $.sgr.postProcessReadabilityFetchRequest = function(entry_body) {
    // Find any img elements with an sgr-src attribute and replace the src value if it doesnt match sgr-src
    //
    entry_body.find("img[sgr-src]").each(function() {
      if ($(this).attr('src') != $(this).attr('sgr-src')) {
        $(this).attr('src', $(this).attr('sgr-src'));
      }
    });
  }

  // Main setup for Google Reader Settings iframe. Initialises listeners and injects settings
  // tab and tab content into the DOM.
  //
  $.sgr.initSettingsWindow = function() {

    // Only execute this for the settings iframe
    //
    if (!window.location.href.match(/\/\/(www\.|)google\.com\/reader\/settings/)) {
      return;
    }

    $.sgr.initSettingsNavigation();

    // Live event for DOMNodeInserted on #settings
    //
    $("#settings").live('DOMNodeInserted', function(ev){
      var ev_target = $(ev.target);

      // If the inserted node is a setting tab, check if we want to insert our own tab.
      //
      if (ev_target.hasClass("setting-group-title")) {
        $.sgr.setting_group_title_add_count += 1;

        // When the 6th (last) setting tab has been inserted, append our Enhanced setting tab
        // 
        if ($.sgr.setting_group_title_add_count == 6) {

          // Inject the Enhanced tab heading html
          //
          $("#settings-navigation").append('<h3 id="setting-header-enhanced" class="setting-group-title"><span class="link setting-group-link">Super</span></h3>');

          // Click event for Enhanced tab. Add "selected" state for our enhanced tab and remove it from other tabs.
          //
          $("#setting-header-enhanced").click(function(){
            $("#settings .setting-group-title, #settings .setting-group").removeClass("selected");
            $("#setting-header-enhanced, #setting-enhanced").addClass("selected");
          });

          // Click event for non-Enhanced tabs. We need to remove the "selected" state from our enhanced tab.
          //
          $(".setting-group-title:not(#setting-header-enhanced)").click(function(){
            $("#setting-header-enhanced, #setting-enhanced").removeClass("selected");
          });
        }
      } 
    });
  }

  // Find and return the external/outgoing link for a specific entry
  //
  $.sgr.getEntryUrl = function(entry) {
    return entry.find('.entry-original').attr('href');
  }

  // Append an entry's hostname to it's subject (or any specified selector).
  // Take into account the global setting for appending an entries hostname.
  //
  $.sgr.addHostnameToSubject = function(entry, selector) {
    if ($.sgr.getSetting('url_in_subject')) {
      entry.find(selector).append('<span class="hostname"> ' + $.sgr.getEntryHostname(entry) + '</span>');
    }
  }

  // Add entry hostnames to all available entries
  //
  $.sgr.addHostnameToSubjects = function() {
    $(".entry").each(function(){
      $.sgr.addHostnameToSubject($(this), '.entry-title');
    });
  }

  // Remove the hostname from entry subjects if it exists
  //
  $.sgr.removeHostnameFromSubjects = function() {
    $(".entry-title .hostname").remove();
  }

  // Find the hostname for an entry, based on it's external/outgoing link
  //
  $.sgr.getEntryHostname = function(entry) {
    return $.sgr.getEntryUrl(entry).match(/\/\/([^\/]*?)(?:\/|$)/)[1].replace(/^www./, '');
  }

  // Find the base domain url for a given url
  //
  $.sgr.getBaseUrl = function(url) {
    return url.match(/(.*?\/\/[^\/]*?)(?:\/|$)/)[1];
  }

  $.sgr.getBaseUrlWithPath = function(url) {
    try {
      var url_match = url.match(/(.*?:\/\/*?(\/.*\/|\/$|$))/)[1];
    } catch(e) {
      console.log("Error running getBaseUrlWidth() for url " + url + ".");
      return null;
    }
    //debug("url match: url=" + url + ", url_match=" + url_match);
    if (url_match[url_match.length-1] != "/") {
      url_match = url_match + "/";
    }
    return url_match;
  }

  $.sgr.fetchReadableContent = function(url, success_callback, failure_callback, extra_return_data) {
    debug("fetchReadableContent() : fetching " + url);
    $.ajax({
      url: url,
      data: {},
      success: function(responseHtml) {

        //console.log(responseHtml);

        var page = document.createElement("DIV");
        //page.innerHTML = responseHtml;
        page.innerHTML = readability.sgrInit(responseHtml);
        debug("page.innerHTML=");
        debug(page.innerHTML);
        //$(page).html(readability.sgrInit(responseHtml));
//return false;

        readability.flags = 0x1 | 0x2 | 0x4;

        try {
          var content = readability.grabArticle(page);
        console.log(content.innerHTML);
          readability.removeScripts(content);
          readability.fixImageFloats(content);

        } catch(e) {
          console.log("Error running readability. Using original article content.");
          var return_data = $.extend({action: 'readability_error_use_original_content'}, extra_return_data);
          failure_callback(return_data);
          return false;
        }
        console.log(content.innerHTML);
        content = readability.sgrPostProcess(content, url);

        console.log(content);
        $.stor.set($.sgr.getReadabilityContentStorageKey(url, extra_return_data.user_id), content);

        var return_data = $.extend({action: 'readability_content', readability_content: content}, extra_return_data);
        success_callback(return_data);
      }
    });
  }

  $.sgr.getReadabilityContentStorageKey = function(url, user_id) {
    return (user_id == null ? $.sgr.USER_ID : user_id) + "_ra_url_" + url.replace(/[^a-zA-Z0-9]+/g,'_');
  }

  $.sgr.preFetchReadableEntry = function(entry) {
    $.sgr.fetchReadableContent($.sgr.getEntryUrl(entry), function(){}, function(){}, {pre_fetch: true});
  }

  $.sgr.preFetchReadableEntries = function() {
    if ($.sgr.getSetting('readability_pre_fetch')) {
      $(".entry").not(".read").each(function(){
        $.sgr.preFetchReadableEntry($(this));
      });
    }
  }

  // Contruct the HTML for a dropdown menu option item
  //
  $.sgr.getGoogMenuitemHtml = function(id, label, selected) {
      return '<div class="sgr-menuitem goog-menuitem goog-option' + (selected ? ' goog-option-selected' : '') + '" role="menuitem" style="-moz-user-select: none;" id="' + id + '"><div class="goog-menuitem-content"><div class="goog-menuitem-checkbox"></div>' + label + '</div></div>';
  }

  // Contruct the HTML for a dropdown menu separator item
  //
  $.sgr.getGoogMenuseparatorHtml = function() {
    return '<div class="goog-menuseparator sgr-menuitem" style="-moz-user-select: none;" role="separator" id=""></div>';
  }

  $.sgr.getUrlExtension = function(url) {
    return url.match(/.*\.(.*)$/i)[1];
  }

  $.sgr.matchUrlExtension = function(url, match_arr) {
    var url_ext = $.sgr.getUrlExtension(url);
    if (jQuery.inArray(url_ext, match_arr) > -1) {
      return true;
    }
    return false;
  }

  $.sgr.sendToCurrentTab = function(data) {
    if (chrome) {
// @FIXME this is not the correct way to do it, this just sends to whatever tab the user is looking at
      chrome.tabs.getSelected(null, function(tab) {
        debug("sending data to chrome tab " + tab.id);
        chrome.tabs.sendRequest(tab.id, data, function(response) {
          console.log(response._msg);
        });
      });
    }
  }

  $.sgr.sendToGoogleReaderTabs = function(data) {
  }

  $.sgr.sendReadabilityContentResponse = function(content) {
    sendResponse({action: 'readability_content', readability_content: content});
  }

  // Main code run for iframe
  //
  $.sgr.run_iframe = function() {
    $.sgr.initSettings();
    $.sgr.initIframeStyles();
  }


  // Main run of all code
  //
  $.sgr.run = function() {

    $.sgr.initSettings();

    $.sgr.initStyles();

    $.sgr.initMainWindowEvents();

    $.sgr.initSettingsWindow();

/*
var html = '<p>some text <img class="dsfg" src="/images/blah2.gif" id="dsgdsg"></p>';
html = html.replace(/<img.*?src=("|')(.*?)("|')/gi, '<img src="" sgr-src="$2"');
debug(html);
var page = document.createElement("DIV");
page.innerHTML = html;
debug(page.innerHTML);
*/
  }

})(jQuery);

