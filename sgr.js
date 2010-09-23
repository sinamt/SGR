
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

  // Date & time of last removal of goog-menu
  //
  $.sgr.goog_menu_removed_date = new Date();

  $.sgr.entry_tabs_html = '<div class="sgr-entry-tabs"><div class="sgr-tab-readable sgr-entry-tab">Readable</div><div class="sgr-tab-link sgr-entry-tab">Link</div><div class="sgr-tab-feed sgr-entry-tab">Feed</div></div>';

  // Load default global settings.
  //
  $.sgr.initSettings = function() {

    $.sgr.initUserId();

    // Set the defaults for global settings
    //
    var default_settings = {use_iframes: false, use_readability: false, readability_pre_fetch: false, url_in_subject: false, hide_likers: true, entry_tabs: true};

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
      $.sgr.togglePreFetchReadableContentMenuOption();
    }
  }

  $.sgr.initUserId = function() {
    $("head script").each(function(){
      var user_id_matches = this.innerHTML.match(/_USER_ID = "(.*?)"/);
      if (user_id_matches != null) {
        $.sgr.USER_ID = user_id_matches[1];
        return;
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

    var global_styles = ' div.preview .entry-container { display: none; } .entry .entry-container-preview { padding: 0.5em 0; margin: 0 10px 0 0; color: #000; max-width: 98%; display: block; left: -10000px; } .entry .entry-container-preview .entry-title { max-width: 98%; } .entry .entry-container-preview .entry-main .entry-date { display: none; } .entry .entry-container-preview-hidden { position: absolute; } #setting-enhanced .enhanced { border-bottom:1px solid #FFCC66; margin:0; padding:0.6em 0; } #setting-enhanced .enhanced-header { font-weight: bold; margin-bottom: 1em; } div.preview iframe.preview { display: block; overflow-y: hidden; } .entry .sgr-hostname { font-weight: normal; } .entry .entry-main .sgr-hostname { font-size: 90%; } .sgr-entry-tabs {position: absolute; background-color: #F3F5FC; left: 500px; padding: 0px 10px; top: 2px; z-index: 100; } .sgr-entry-tab {padding: 2px 5px 1px; margin: 1px 1px 0; border: 1px solid #68E; border-bottom: none; border-top-left-radius: 3px; border-top-right-radius: 3px; float: left; } .sgr-entry-tabs .selected {background-color: white; border: 2px solid #68E; border-bottom: none;} .sgr-entry-tab:hover {cursor: pointer; background-color: #FFFFCC;} #sgr-prefs-menu-menu {display: none; overflow-y: auto} .goog-menuitem-disabled .goog-menuitem-checkbox {opacity: 0.5;}';
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
    debug("setGlobalSetting() : " + key + " = " + value);
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
    // First look for a selected feed or folder, then try for a left-hand nav selection
    //
    var selected_href = $("a.tree-link-selected, #lhn-selectors .selected .link").first().attr('href');

    if (typeof selected_href != 'undefined') {
      //return unescape(selected_href.match(/.*\/(.*)/)[1]);
      return unescape(selected_href);
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
    debug('sgr : msg_ev.data = ' + msg_ev.data);
    debug('sgr : msg_ev.origin = ' + msg_ev.origin);

    if (typeof msg_ev.data == 'undefined') {
      return;
    }  

    // Message data from iframe is 'helo'. iframe is registering itself with us,
    // we respond with 'hello'.
    //
    if (msg_ev.data == 'helo') {
      //window.frames[0].postMessage('hello', msg_ev.origin);

    // Convert any other data to an integer and set the iframe element height accordingly
    //
    } else {
      $.sgr.setIframeWindowHeight($('#sgr_preview'), msg_ev.data);
    }
  }  

  $.sgr.receiveRequest = function(request, sender, sendResponse) {  
    //debug("reader.js: receiveRequest() called. request.action: " + request.action);

    // Iframe window height
    //
    if (request.action == 'set_window_height') {
      //debug("reader.js: request.window_height=" + request.window_height);
      //sendResponse({_msg: "reader.js received window height " + request.window_height});
      $.sgr.setIframeWindowHeight($('#sgr_preview'), request.window_height);

    // Global setting change from settings iframe
    //
    } else if (request.action == 'global_setting_change') {
      $.sgr.globalSettingChange(request);
      sendResponse({});
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
  $.sgr.togglePreview = function(entry) {

    //debug("togglePreview");

    // If this entry is already open in an iframe, close it
    //
    if (entry.hasClass("preview")) {
      $.sgr.removePreview(entry);

    // Else show the entry in an iframe
    //
    } else {
      $.sgr.scrollTo(entry);
      $.sgr.showPreview(entry);
    }
  }

  
  // Show an entry preview iframe.
  //
  $.sgr.showPreview = function(entry) {

    entry.removeClass("readable").addClass("preview");

    $.sgr.updateSelectedEntryTab(entry);

    // If there is already a hidden preview container for this entry, show it
    //
    if (entry.find(".entry-container-preview-hidden").size() > 0) {
      $.sgr.restorePreview(entry);
    } else { //if ($(".entry-body iframe.preview").size() <= 0) {
      $.sgr.createPreviewIframe(entry, false);
    }

  }

  // Create a new iframe element for previewing an entry.
  //
  $.sgr.createPreviewIframe = function(entry, hidden) {
    if (typeof hidden == 'undefined') {
      hidden = false;
    }

    // Create a new div.entry-container-preview for our iframe. 
    //
    entry.find(".collapsed").after('<div class="entry-container-preview' + (hidden ? ' entry-container-preview-hidden' : '') + '"></div>');

    // Add the entry header to our iframe container
    //
    $.sgr.populateIframeHeading(entry);

    // Add the iframe
    //
    entry.find(".entry-container-preview .entry-main").append('<iframe id="sgr_preview" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="' + $.sgr.getEntryUrl(entry) + '" class="preview"></iframe>');
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

  // Display an entry containing readable content
  //
  $.sgr.showReadableEntry = function(entry) {

      entry.addClass("readable");
      $.sgr.updateSelectedEntryTab(entry);
      $.sgr.addHostnameToSubject(entry, '.entry-title');

      var entry_body = entry.find(".entry-body");
      entry_body.html("<p>Loading...</p>");

      $.sgr.sendReadabilityFetchRequest(entry);
  }

  // Setup the Settings window. Google Reader settings are handled via a seperate iframe. 
  // When a user starts the Settings iframe, we execute this function to inject our 'Enhanced' 
  // settings tab content into the DOM.
  //
//(<r><![CDATA[
  $.sgr.initSettingsNavigation = function() {
    $('#settings .settings-list').append(' <li id="setting-enhanced" class="setting-group"> <div id="setting-enhanced-body" class="setting-body"><div class="enhanced"> <div class="enhanced-header">Entry</div> <label> <input type="checkbox" id="setting-global-entry-tabs"> Display \'Content Type\' tabs for each entry (\'Readable\', \'Link\', \'Feed\') </label> </div> <div class="enhanced"> <div class="enhanced-header">Opening entries</div> <label> <input type="radio" name="global_open_entry_default" id="setting-global-use-iframes"> Default to open all entries as previews (iframes) </label> <br /> <label> <input type="radio" name="global_open_entry_default" id="setting-global-use-readability"> Default to open all entries as readable content </label> </div> <div class="enhanced"> <div class="enhanced-header">Entry subject</div> <label> <input type="checkbox" id="setting-global-url-in-subject"> Default to include entry hostname in subject </label> </div> <div class="enhanced"> <div class="enhanced-header">Entry content</div> <label> <input type="checkbox" id="setting-global-hide-likers"> Hide \'Liked by users\' for each entry </label> <br /> <label><input type="checkbox" name="global_readability_pre_fetch" id="setting-global-readability-pre-fetch"> If readability enabled for feed/folder, default to pre-fetch all non-read entries as readable content</label> </div> </div> </li>');
//]]></r>).toString());

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

    var global_settings = ['use_iframes', 'use_readability', 'url_in_subject', 'hide_likers', 'readability_pre_fetch', 'entry_tabs'];

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

    // Special case for use_iframes / use_readability. If either is being enabled, make sure the opposite is disabled
    //
    if (gs_value) {
      if (gs_name == 'use_iframes') {
        $.sgr.setGlobalSetting('use_readability',false);
        $.sgr.sendRequest({action: 'global_setting_change', setting_name: 'use_readability', setting_value: false});
        $.sgr.togglePreFetchReadableContentMenuOption();
      } else if (gs_name == 'use_readability') {
        $.sgr.setGlobalSetting('use_iframes',false);
        $.sgr.sendRequest({action: 'global_setting_change', setting_name: 'use_iframes', setting_value: false});
        $.sgr.togglePreFetchReadableContentMenuOption();
      }
    }

    $.sgr.sendRequest({action: 'global_setting_change', setting_name: gs_name, setting_value: gs_value});
  }

  $.sgr.globalSettingChange = function(data) {

    // Set the changed setting value to reflect changes done in the settings iframe
    //
    $.sgr.setGlobalSetting(data.setting_name, data.setting_value);

    //debug("data.setting_name = " + data.setting_name + ", data.setting_value = " + data.setting_value);

    if (data.setting_name == 'url_in_subject') {
      $.sgr.toggleHostnameInSubjects();
    } else if (data.setting_name == 'hide_likers') {
      $.sgr.toggleEntryLikers();
    } else if (data.setting_name == 'entry_tabs') {
      $.sgr.toggleEntryTabs();
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
    $.sgr.toggleHostnameInSubjects();

    // Inject our 'Super settings...' button
    //
    $.sgr.initSgrSettingsButton();

    // Note: We try to setup live events on the entire div#entries area where possible. 
    // This keeps the amount of live events to a minimum.
    //


    // Any keydown event
    //
    //$(document).keydown(function() {
      //$.sgr.removeSgrSettingsMenu();
    //});

    // Any click event
    //
    $(document).click(function(ev) {
      //debug("document click");
      var ev_target = $(ev.target);

      //debug(ev_target);

      // If the user is clicking the 'Super settings..' button
      //
      if (ev_target.hasClass('sgr-prefs-menu-item')) {
        //debug("#sgr-prefs-menu click");
        var sgr_prefs_menu = ev_target.closest("#sgr-prefs-menu");

        // Remove settings menu
        //
        if (sgr_prefs_menu.hasClass("goog-button-base-open")) {
          $.sgr.removeSgrSettingsMenu();

        // Add settings menu
        //
        } else {

          sgr_prefs_menu.addClass("goog-button-base-open");

          // Inject our settings options
          //
          $("body").append(
            '<div class="goog-menu goog-menu-vertical" role="menu" aria-haspopup="true" tabindex="-1" id="sgr-prefs-menu-menu" aria-activedescendant="">' +
            $.sgr.getGoogMenuitemHtml('menu_entry_tabs', 'Show entry content tabs', $.sgr.getSetting('entry_tabs')) +
            $.sgr.getGoogMenuseparatorHtml() + 
            $.sgr.getGoogMenuitemHtml('menu_use_iframes', 'Full entry content', $.sgr.getSetting('use_iframes')) + 
            $.sgr.getGoogMenuitemHtml('menu_use_readability', 'Readable content', $.sgr.getSetting('use_readability')) + 
            $.sgr.getGoogMenuseparatorHtml() + 
            $.sgr.getGoogMenuitemHtml('menu_readability_pre_fetch', 'Pre-fetch readable content', $.sgr.getSetting('readability_pre_fetch')) + 
            $.sgr.getGoogMenuitemHtml('menu_url_in_subject', 'Show host in subject', $.sgr.getSetting('url_in_subject')) +
            '</div>'
          );

          var offset = sgr_prefs_menu.offset();

          $.sgr.togglePreFetchReadableContentMenuOption();

          $("#sgr-prefs-menu-menu").css('left', offset.left).css('top', offset.top + ev_target.height()).show();
          
          // Initialise a hover event for hovering over our settings menu options
          //
          $(".sgr-menuitem").hover(
            function(ev) {
              if (!$(this).hasClass("goog-menuitem-disabled")) {
                $(this).addClass("goog-menuitem-highlight");
              }
            },
            function(ev) {
              $(this).removeClass("goog-menuitem-highlight");
            }
          );
        }

      } else if (ev_target.hasClass('sgr-menuitem-item')) {
        if (!ev_target.hasClass('goog-menuitem-disabled') && !ev_target.parent().hasClass('goog-menuitem-disabled')) {
          $.sgr.removeSgrSettingsMenu();
        }

      // Else a click anywhere else not on the 'Super settings...' button, remove the super menu
      //
      } else {
        $.sgr.removeSgrSettingsMenu();
      }
    });

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

        $.sgr.setEntryOriginalContent(entry.find(".entry-body").html());

        // If it has the class 'expanded' but doesnt anymore, try to save any iframe.preview that exists
        //
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
            $.sgr.togglePreview(entry);

          // Fetch the article content and parse through readability
          //
          } else if ($.sgr.getSetting('use_readability')) {
            $.sgr.showReadableEntry(entry);
          }

        }

        $.sgr.injectEntryTabs(entry);
      }

      // If this is an .entry node being inserted
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
        entry.removeClass("readable");
        $.sgr.removeEntryTabs(entry);
      }
    });

    // Feed/folder header DOMNodeInserted
    //
    $("#viewer-top-controls").live('DOMNodeInserted', function(ev){
      var ev_target = $(ev.target);

      if (ev_target.attr('id') == "stream-prefs-menu") {
        $.sgr.initSgrSettingsButton();
      }
    });

    // Feed/folder setting menu option live click event
    //
    $(".sgr-menuitem").live('click', function(ev) {
      var setting_name = $(this).attr('id').match(/^menu_(.*)/)[1];

      // Return if this menu item is disabled
      //
      if ($(this).hasClass("goog-menuitem-disabled")) {
        return false;
      }

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

      if (setting_value) {
        // Set the setting in the menu to display our new value (a tick beside the setting).
        //
        $(this).addClass("goog-option-selected");

        // Special case for mutually exclusive use_iframes / use_readability
        //
        if (setting_name == 'use_iframes') {
          $.sgr.setLocalSetting('use_readability', !setting_value);
          if (setting_value) {
            $("#menu_use_readability").removeClass("goog-option-selected");
          }
          $.sgr.togglePreFetchReadableContentMenuOption();

        } else if (setting_name == 'use_readability') {
          $.sgr.setLocalSetting('use_iframes', !setting_value);
          if (setting_value) {
            $("#menu_use_iframes").removeClass("goog-option-selected");
          }
          $.sgr.togglePreFetchReadableContentMenuOption();
        }

      } else {
        $(this).removeClass("goog-option-selected");
      }

      if (setting_name == 'entry_tabs') {
        $.sgr.toggleEntryTabs();
      } else if (setting_name == 'url_in_subject') {
        $.sgr.toggleHostnameInSubjects();
      }

    });

    // Capture node removal from the dropdown feed/folder setting menu
    //
/*
    $("#stream-prefs-menu-menu").live('DOMNodeRemoved', function(ev){
//debug("menu DOMNodeRemoved : " + ev.target.tagName);
      var now = new Date();
//debug(now.getTime() - $.sgr.goog_menu_removed_date.getTime());
      if (100 < (now.getTime() - $.sgr.goog_menu_removed_date.getTime()) && $(ev.target).hasClass("goog-option")) {
        $.sgr.goog_menu_removed_date = new Date();
        //debug("goog-option being removed");
        setTimeout(function(){$("#stream-prefs-menu-menu .sgr-menuitem").remove()},20);
      }
    });
*/

    // Entry tab live click
    //
    $(".sgr-entry-tab").live('click', function(ev) {
      var tab = $(ev.target);
      var entry = tab.closest(".entry");

      // Readable
      //
      if (tab.hasClass("sgr-tab-readable")) {
        if (!entry.hasClass("readable")) {
          $.sgr.savePreview(entry);
          $.sgr.showReadableEntry(entry);
        }

      // Link
      //
      } else if (tab.hasClass("sgr-tab-link")) {
        if (!entry.hasClass("preview")) {
          $.sgr.showPreview(entry); 
        }

      // Feed
      //
      } else if (tab.hasClass("sgr-tab-feed")) {
        if (entry.hasClass("preview") || entry.hasClass("readable")) {
          if (entry.hasClass("preview")) {
            $.sgr.savePreview(entry);
          } else {
            entry.removeClass("readable");
          }
          $.sgr.useEntryOriginalContent(entry);
        }
      }
    });

    // Sign out link click
    //
    $("#guser").live("click",function(ev) {
      var ev_target = $(ev.target);
      if (ev_target.attr('href') == "https://www.google.com/accounts/Logout?service=reader") {
        $.sgr.runReaderLogout();
      }
    });

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

  $.sgr.removeSgrSettingsMenu = function() {
    $("#sgr-prefs-menu").removeClass("goog-button-base-open");
    $("#sgr-prefs-menu-menu").remove();
  }

  $.sgr.initSgrSettingsButton = function() {
    $("#stream-prefs-menu").after($.sgr.getSgrSettingsButtonHtml());
  }

  $.sgr.updateSelectedEntryTab = function(entry) {
    //debug("$.sgr.updateSelectedEntryTab()");
    var tab = null;
    if (entry.hasClass("preview")) {
      tab = entry.find(".sgr-tab-link");
    } else if (entry.hasClass("readable")) {
      tab = entry.find(".sgr-tab-readable");
    } else {
      tab = entry.find(".sgr-tab-feed");
    }
    entry.find(".sgr-entry-tabs .selected").removeClass("selected");
    try {
      tab.addClass("selected");
    } catch(e) {}
  }


  $.sgr.sendRequest = function(data) {
    if (chrome) {
      chrome.extension.sendRequest(data, function(response) {
        console.log("sgr.js: " + response.action + " - " + response._msg);

        if (response.action == 'readability_content') {
          //debug("reader.js: request.readability_content=" + request.readability_content);
          //debug("response=");
          //debug(response);
          if (typeof response.pre_fetch == 'undefined' || response.pre_fetch == false) {
            $("#current-entry .entry-body").html(response.readability_content);
            $.sgr.postProcessReadabilityFetchRequest($("#current-entry .entry-body"));
          }

        } else if (response.action == 'readability_error_use_original_content') {
          if (typeof response.pre_fetch == 'undefined' || response.pre_fetch == false) {
            $.sgr.useEntryOriginalContent($("#current-entry"));
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

  $.sgr.setEntryOriginalContent = function(html) {
    $.sgr.entry_original_content = html;
  }

  $.sgr.useEntryOriginalContent = function(entry) {
    entry.removeClass("preview").removeClass("readable");
    $.sgr.updateSelectedEntryTab(entry);
    entry.find(".entry-body").html($.sgr.entry_original_content);
  }


  $.sgr.initBackgroundWindow = function() {
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      debug("background : received request, request.action = " +request.action);

      // Iframe window height
      //
      if (request.action == 'window_height') {
        sendResponse({_msg: "action " + request.action + ", window height " + request.window_height});
        $.sgr.sendToTab(sender.tab.id, {action: 'set_window_height', window_height: request.window_height});

      // Fetch readable content
      //
      } else if (request.action == 'readability_fetch') {
        //sendResponse({_msg: "action : " + request.action});

        var stor_url_key = $.sgr.getReadabilityContentStorageKey(request.readability_url, request.extra_data.user_id);
        var stored_content = $.stor.get(stor_url_key, 'session');

        // Use cached content if it exists
        //
        if (stored_content !== null && stored_content.length > 0 && stored_content != 'none') {
          sendResponse($.extend({action: 'readability_content', readability_content: stored_content, _msg: (request.extra_data.pre_fetch ? "[PRE-FETCH] " : "") + "Cached content found for " + request.readability_url},request.extra_data));

        // PDF, PPT in Google Docs
        //
        } else if ($.sgr.matchUrlExtension(request.readability_url, ['pdf', 'ppt'])) {
          sendResponse($.extend({action: 'readability_content', readability_content: $.sgr.getGoogleDocHtml(request.readability_url), _msg: "Google docs content found for " + request.readability_url},request.extra_data));

        } else if (stored_content == 'none') {
          sendResponse($.extend({action: 'readability_error_use_original_content', _msg: "No content found (cached) for " + request.readability_url},request.extra_data));

        } else {
          $.sgr.fetchReadableContent(request.readability_url, sendResponse, sendResponse, request.extra_data);
        }

      // Global setting change from settings iframe
      //
      } else if (request.action == 'global_setting_change') {
        $.sgr.sendToTab(sender.tab.id, {action: 'global_setting_change', setting_name: request.setting_name, setting_value: request.setting_value});

      // Clear storage
      //
      } else if (request.action == 'clear_store') {
        $.stor.clear(request.store_type);

      } else {
        sendResponse({}); // snub them.
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

    $(document).ready(function() {
      $.sgr.initSettingsNavigation();
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
    if ($.sgr.getSetting('url_in_subject')) { // && entry.find(selector + " > .sgr-hostname").size() <= 1) {
      entry.find(selector + " > .sgr-hostname").remove();
      entry.find(selector).append('<span class="sgr-hostname"> ' + $.sgr.getEntryHostname(entry) + '</span>');
    }
  }

  // Add entry hostnames to all available entries
  //
  $.sgr.addHostnameToSubjects = function() {
    if ($.sgr.getSetting('url_in_subject')) {
      $(".entry").each(function(){
        $.sgr.addHostnameToSubject($(this), '.entry-title');
      });
    }
  }

  // Remove the hostname from entry subjects if it exists
  //
  $.sgr.removeHostnameFromSubjects = function() {
    $(".entry-title .sgr-hostname").remove();
  }

  // Toggle add or remove of hostnames from entry subjects
  //
  $.sgr.toggleHostnameInSubjects = function() {
    if ($.sgr.getSetting('url_in_subject')) {
      $.sgr.addHostnameToSubjects();
    } else {
      $.sgr.removeHostnameFromSubjects();
    }
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

  $.sgr.toggleEntryLikers = function() {
    // If hide_likers is enabled, hide all entry likers
    //
    if ($.sgr.getSetting('hide_likers')) {
      debug("hiding entry-likers");
      $.sgr.addStyles(' .entry-likers { display: none; }');
      $(".entry-likers").css('display','none');

    // If hide_likers is disabled, show all entry likers
    //
    } else {
      debug("showing entry-likers");
      $.sgr.addStyles(' .entry-likers { display: block; }');
      $(".entry-likers").css('display','block');
    }
  }

  $.sgr.injectEntryTabs = function(entry) {
    //entry.find(".collapsed .entry-main").append($.sgr.entry_tabs_html);
    if (entry.length <= 0) {
      return;
    }
    if ($.sgr.getSetting('entry_tabs')) {
      entry.find(".entry-secondary-snippet").hide();
      entry.append($.sgr.entry_tabs_html);
      $.sgr.updateSelectedEntryTab(entry);
    }
  }

  $.sgr.removeEntryTabs = function(entry) {
    entry.find(".sgr-entry-tabs").remove();
    entry.find(".entry-secondary-snippet").show();
  }

  $.sgr.toggleEntryTabs = function() {
    var entry = $("#current-entry");
    if (entry.length <= 0) {
      return;
    }
    if ($.sgr.getSetting('entry_tabs')) {
      $.sgr.injectEntryTabs(entry);
    } else {
      $.sgr.removeEntryTabs(entry);
    }
  }

  $.sgr.togglePreFetchReadableContentMenuOption = function() {
    if ($.sgr.getSetting('use_readability')) {
      $("#menu_readability_pre_fetch").removeClass("goog-menuitem-disabled").addClass("goog-option");
    } else {
      $("#menu_readability_pre_fetch").addClass("goog-menuitem-disabled").removeClass("goog-option");
    }
  }

  $.sgr.fetchReadableContent = function(url, success_callback, failure_callback, extra_return_data) {
    debug("fetchReadableContent() FETCH : " + (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + " " + url);
    $.ajax({
      url: url,
      data: {},
      success: function(responseHtml) {
        //debug("fetchReadableContent() SUCCESS : " + (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + " " + url);

        //console.log(responseHtml);

        var page = document.createElement("DIV");
        //page.innerHTML = responseHtml;
        page.innerHTML = readability.sgrInit(responseHtml);
        //debug("page.innerHTML=");
        //debug(page.innerHTML);
        //$(page).html(readability.sgrInit(responseHtml));
//return false;

        readability.flags = 0x1 | 0x2 | 0x4;

        try {
          var content = readability.grabArticle(page);

          if (content == null) {
            throw new Error("Readability found no valid content.");
          }
          //console.log("content.innerHTML after grabArticle:");
          //console.log(content.innerHTML);
          readability.removeScripts(content);
          readability.fixImageFloats(content);

        } catch(e) {
          debug("Error running readability. Using original article content. " + e.name + ": " + e.message);
          $.stor.set($.sgr.getReadabilityContentStorageKey(url, extra_return_data.user_id), "none", 'session');
          var return_data = $.extend({action: 'readability_error_use_original_content', _msg: "No content found for " + url}, extra_return_data);
          failure_callback(return_data);
          return false;
        }
        //console.log("content.innerHTML before sgrPostProcess:");
        //console.log(content.innerHTML);
        content = readability.sgrPostProcess(content, url);

        console.log(content);
        $.stor.set($.sgr.getReadabilityContentStorageKey(url, extra_return_data.user_id), content, 'session');

        var return_data = $.extend({action: 'readability_content', readability_content: content, _msg: (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + "Content fetched for " + url}, extra_return_data);
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

  // Contruct the HTML for a 'Super settings' menu button
  //
  $.sgr.getSgrSettingsButtonHtml = function() {
    return '<div role="wairole:button" tabindex="1" class="goog-button goog-button-base unselectable goog-inline-block goog-button-float-left goog-menu-button goog-button-tight sgr-prefs-menu-item" id="sgr-prefs-menu"><div class="goog-button-base-outer-box goog-inline-block sgr-prefs-menu-item"><div class="goog-button-base-inner-box goog-inline-block sgr-prefs-menu-item"><div class="goog-button-base-pos sgr-prefs-menu-item"><div class="goog-button-base-top-shadow sgr-prefs-menu-item">&nbsp;</div><div class="goog-button-base-content sgr-prefs-menu-item"><div class="goog-button-body sgr-prefs-menu-item">Super settings...</div><div class="goog-menu-button-dropdown sgr-prefs-menu-item"></div></div></div></div></div></div>';
  }

  // Contruct the HTML for a dropdown menu option item
  //
  $.sgr.getGoogMenuitemHtml = function(id, label, selected) {
      return '<div class="sgr-menuitem sgr-menuitem-item goog-menuitem goog-option' + (selected ? ' goog-option-selected' : '') + '" role="menuitem" style="-moz-user-select: none;" id="' + id + '"><div class="sgr-menuitem-item goog-menuitem-content"><div class="sgr-menuitem-item goog-menuitem-checkbox"></div>' + label + '</div></div>';
  }

  // Contruct the HTML for a dropdown menu separator item
  //
  $.sgr.getGoogMenuseparatorHtml = function() {
    return '<div class="goog-menuseparator sgr-menuitem" style="-moz-user-select: none;" role="separator" id=""></div>';
  }

  $.sgr.getGoogleDocHtml = function(url) {
    return '<iframe id="google_doc_iframe" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="http://docs.google.com/gview?embedded=true&url=' + url + '" class=""></iframe>';
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

  $.sgr.sendToTab = function(tab_id, data) {
    debug("sendToTab : sending data to chrome tab " + tab_id);
    chrome.tabs.sendRequest(tab_id, data, function(response) {
      if (response._msg) {
        console.log(response._msg);
      }
    });
  }

  $.sgr.sendReadabilityContentResponse = function(content) {
    sendResponse({action: 'readability_content', readability_content: content});
  }

  // Main code run for iframe
  //
  $.sgr.run_iframe = function() {
    //$.sgr.initSettings();
    $.sgr.initIframeStyles();
  }

  $.sgr.runReaderLogout = function() {
    // Clear the content window sessionStore
    //
    $.stor.clear('session');

    // Tell the background page to clear it's sessionStore
    //
    $.sgr.sendRequest({action: 'clear_store', store_type: 'session'});
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


