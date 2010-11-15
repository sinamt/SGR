
 var _gaq = _gaq || [];
 _gaq.push(['_setAccount', 'UA-18940431-1']);
 _gaq.push(['_trackPageview']);

// Array Remove - By John Resig (MIT Licensed)
// http://ejohn.org/blog/javascript-array-remove/
//
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};
     
// Object size()
// From http://stackoverflow.com/questions/5223/length-of-javascript-associative-array
//
Object.prototype.size = function() {
  var len = this.length ? --this.length : -1;
    for (var k in this)
      len++;
  return len;
};

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

  ////////////
  // End CONFIG
  ////////////

  // Settings cache
  //
  $.sgr._settings = {};

  // Container to store when an entry has been closed. Used to prevent entry 'flicker'
  // when entry is closed/opened/closed too quickly
  //
  $.sgr.entry_closed_at_time = {};

  // Stored original entry content for entry being replaced by readability.
  //
  $.sgr.entry_original_content = {};

  // Google Reader _USER_ID value
  //
  $.sgr.USER_ID = null;

  // Regexp setup for detecting Google Reader URLs. Needs to allow country tlds.
  //
  $.sgr.start_url_str = '^http(?:s|)\:\/\/(?:www\.|)';
  $.sgr.gr_url_base = $.sgr.start_url_str + 'google(\.co(m|)|)(\.[A-Za-z]{2}|)\/reader\/';
  $.sgr.gr_main_window_re = new RegExp($.sgr.gr_url_base);
  $.sgr.gr_settings_window_re = new RegExp($.sgr.gr_url_base + 'settings');

  // Youtube API URLs
  //
  $.sgr.youtube_api = {
    video: "http://gdata.youtube.com/feeds/api/videos/[video_id]?v=2&alt=jsonc"
  }

  // Vimeo API URLs
  //
  $.sgr.vimeo_api = {
    video: "http://vimeo.com/api/v2/video/[video_id].json"
  }

  $.sgr.gr_api_base = self.location.protocol + '//' + self.location.host + '/reader/api/0/';
  debug($.sgr.gr_api_base);

  $.sgr.gr_api = {
    contents: $.sgr.gr_api_base + 'stream/contents/feed/'
  }

  // Entry tab HTML snippet
  //
  $.sgr.entry_tabs_html = '<div class="sgr-entry-tabs"><div class="sgr-tab-readable sgr-entry-tab">Readable</div><div class="sgr-tab-link sgr-entry-tab">Link</div><div class="sgr-tab-feed sgr-entry-tab">Feed</div></div>';

  // Settings feedback messages
  //
  $.sgr.setting_feedback_messages = {
    url_in_subject: {'true': 'Default to include entry hostname in subject.', 'false': 'Default to <em>not</em> include entry hostname in subject.'},
    hide_likers: {'true': "Hide 'Liked by users' for each entry.", 'false': "Show 'Liked by users' for each entry."},
    entry_tabs: {'true': "Display 'Content Type' tabs for each entry ('Readable', 'Link', 'Feed').", 'false': "<em>Do not</em> display 'Content Type' tabs for each entry ('Readable', 'Link', 'Feed')."},
    use_iframes: {'true': 'Default to open all entries as previews (iframes).', 'false': 'Default to <em>not</em> open all entries as previews (iframes).'},
    use_readability: {'true': 'Default to open all entries as readable content.', 'false': 'Default to <em>not</em> open all entries as readable content.'},
    readability_pre_fetch: {'true': 'If readability enabled for feed/folder, default to pre-fetch all non-read entries as readable content.', 'false': 'If readability enabled for feed/folder, <em>do not</em> default to pre-fetch all non-read entries as readable content.'},
    readability_more_images: {'true': 'For readable content, try to include more images in the content.', 'false': 'Use normal settings for fetching readable content.'}
  }

  // Load default global settings.
  //
  $.sgr.initSettings = function() {

    $.sgr.initUserId();

    // Set the defaults for global settings
    //
    var default_settings = {use_iframes: false, use_readability: false, readability_pre_fetch: false, url_in_subject: false, hide_likers: false, entry_tabs: true, readability_more_images: false};

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
    
    // Register the setting 'readability_more_images' with the background window
    //
    $.sgr.sendRequest({action: 'global_setting_background', setting_name: 'readability_more_images', setting_value: $.sgr.getSetting('readability_more_images')});
  }

  // Initialise the USER_ID. This is found within the javascript itself on the google reader page.
  //
  $.sgr.initUserId = function() {
    $("head script").each(function(){
      var user_id_matches = this.innerHTML.match(/_USER_ID = "(.*?)"/);
      if (user_id_matches != null) {
        $.sgr.USER_ID = user_id_matches[1];

        // Register the USER_ID with the background window
        //
        $.sgr.sendRequest({action: 'regsiter_user_id', user_id: $.sgr.USER_ID});

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

    var global_styles = ' div.preview .entry-container { display: none; } .entry .entry-container-preview { padding: 0.5em 0; margin: 0 10px 0 0; color: #000; max-width: 98%; display: block; left: -10000px; } .entry .entry-container-preview .entry-title { max-width: 98%; } .entry .entry-container-preview .entry-main .entry-date { display: none; } .entry .entry-container-preview-hidden { position: absolute; } #setting-enhanced .enhanced { border-bottom:1px solid #FFCC66; margin:0; padding:0.6em 0; } #setting-enhanced .enhanced-header { font-weight: bold; margin-bottom: 1em; } div.preview iframe.preview { display: block; overflow-y: hidden; } .entry .sgr-hostname { font-weight: normal; } .entry .entry-main .sgr-hostname { font-size: 90%; } .sgr-entry-tabs {position: absolute; background-color: #F3F5FC; left: 500px; padding: 0px 10px; top: 2px; z-index: 100; } .sgr-entry-tab {padding: 2px 5px 1px; margin: 1px 1px 0; border: 1px solid #68E; border-bottom: none; border-top-left-radius: 3px; border-top-right-radius: 3px; float: left; } .sgr-entry-tabs .selected {background-color: white; border: 2px solid #68E; border-bottom: none;} .sgr-entry-tab:hover {cursor: pointer; background-color: #FFFFCC;} .cards .sgr-entry-tabs {background-color: transparent; top: 0; } .cards .sgr-entry-tab {background-color: white; } .cards .sgr-entry-tabs .selected {padding: 2px 5px;} .cards .entry {padding: 21px 0 0;} #sgr-prefs-menu-menu {display: none; overflow-y: auto} .goog-menuitem-disabled .goog-menuitem-checkbox {opacity: 0.5;} .sgr-wikipedia-content .tright {float: right; clear: right; margin: 0.5em 0px 0.8em 1.4em;} .sgr-wikipedia-content .tleft {float: left; clear: left; margin: 0.5em 1.4em 0.8em 0px;} .sgr-wikipedia-content .thumbinner { background-color: #F9F9F9; border: 1px solid #CCC; font-size: 94%; overflow: hidden; padding: 3px !important; text-align: center; min-width: 100px; } .sgr-wikipedia-content #toc, .sgr-wikipedia-content .toc, .sgr-wikipedia-content .mw-warning {background-color: #F9F9F9; border: 1px solid #AAA; font-size: 95%; padding: 5px;} .sgr-wikipedia-content #toc ul, .sgr-wikipedia-content .toc ul {list-style-image: none; list-style-type: none; margin-left: 0px; padding-left: 0px; text-align: left;} .sgr-wikipedia-content .infobox { background-color: #F9F9F9; border: 1px solid #AAA; clear: right; color: black; float: right; margin: 0.5em 0px 0.5em 1em; padding: 0.2em; } #chrome-orig {position: absolute; left: -9999px;} .sgr-filtered {display: none;} .sgr-filter-nav {margin-left: 5px;} .sgr-filter-nav-active {background-color: white;}';
    
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

  // Get a setting key name. Can be either a local or global name depending on setting_type.
  // Namespace the setting name to the USER_ID.
  //
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

  // Find and return the currently selected feed href or folder name
  //
  $.sgr.getCurrentFeedName = function() {
    // First look for a selected feed or folder, then try for a left-hand nav selection
    //
    var selected_href = $("a.tree-link-selected, #lhn-selectors .selected .link").first().attr('href');

    if (typeof selected_href != 'undefined') {
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
 
  // Helper function to (crudely) strip HTML from a given string
  //
  $.sgr.stripHtml = function(text) {
    return text.replace(/<.*?>/g, '');
  }

  // Google reader main window content script handler for receiving a request from the background window.
  // Processes the following requests:
  //    - set_window_height : adjusts an entry's iframe window to the requested height
  //    - global_setting_change : processes a global setting change from the google reader settings iframe
  //
  $.sgr.receiveRequest = function(request, sender, sendResponse) {  
    //debug("reader.js: receiveRequest() called. request.action: " + request.action);

    // Iframe window height
    //
    if (request.action == 'set_window_height') {
      //debug("set_window_height: " + request.window_height + ", " + request.iframe_id);
      if (typeof request.iframe_id == 'undefined' || request.iframe_id == null || request.iframe_id == '' || request.iframe_id.match(/^[A-Za-z0-9]{8}$/) == null) {
        return;
      }
      $.sgr.setIframeWindowHeight($('#sgr_preview_' + request.iframe_id), request.window_height);

    // Global setting change from settings iframe
    //
    } else if (request.action == 'global_setting_change') {
      $.sgr.globalSettingChange(request);
    }

    sendResponse({}); 
  }

  // Set the specified iframe element to the specified height. Height should be specified
  // as the integer value of pixels to be set.
  //
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
      if ($.sgr.isExpandedView() == false) {
        $.sgr.scrollTo(entry);
      }
      $.sgr.showPreview(entry);
    }
  }

  // Show an entry preview iframe.
  //
  $.sgr.showPreview = function(entry) {
    //debug("showPreview");

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

  // Show an entry preview iframe only if one isn't already being shown.
  //
  $.sgr.checkAndShowPreview = function(entry, scroll_to) {
    if (typeof scroll_to == 'undefined') {
      scroll_to = false;
    }
    if (!entry.hasClass("preview")) {
      if (scroll_to) {
        $.sgr.scrollTo(entry);
      }
      $.sgr.showPreview(entry); 
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
    entry.find(".entry-container").after('<div class="entry-container-preview' + (hidden ? ' entry-container-preview-hidden' : '') + '"></div>');

    // Add the entry header to our iframe container
    //
    $.sgr.populateIframeHeading(entry);

    // Add the iframe
    //
    entry.find(".entry-container-preview .entry-main").append('<iframe id="sgr_preview_' + $.sgr.generateRandomString(8) +'" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="' + $.sgr.getEntryUrl(entry) + '" class="preview"></iframe>');
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

  // Generate a random alphanumeric string of a given length
  //
  $.sgr.generateRandomString = function(str_len) {
 var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < parseInt(str_len); i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;

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

      entry.addClass("readable").addClass($.sgr.generateReadableEntryClass($.sgr.getEntryUrl(entry)));
      $.sgr.updateSelectedEntryTab(entry);
      $.sgr.addHostnameToSubject(entry, '.entry-title');

      var entry_body = entry.find(".entry-body");
      entry_body.html("<p>Loading...</p>");

      $.sgr.sendReadabilityFetchRequest(entry);
  }

  // Wrapper for displaying an entry containing readable content that
  // checks if it's already showing a readable entry, and if not also trys to 
  // save any iframe being shown for the entry.
  //
  $.sgr.checkAndShowReadableEntry = function(entry, scroll_to) {
    if (typeof scroll_to == 'undefined') {
      scroll_to = false;
    }
    if (!entry.hasClass("readable")) {
      $.sgr.savePreview(entry);
      if (scroll_to) {
        $.sgr.scrollTo(entry);
      }
      $.sgr.showReadableEntry(entry);
    }
  }

  // Setup the Settings window. Google Reader settings are handled via a seperate iframe. 
  // When a user starts the Settings iframe, we execute this function to inject our 'Enhanced' 
  // settings tab content into the DOM.
  //
  $.sgr.initSettingsNavigation = function() {
    $('#settings .settings-list').append(' <li id="setting-enhanced" class="setting-group"> <div id="setting-enhanced-body" class="setting-body"><div class="enhanced"> <div class="enhanced-header">Entry</div> <label> <input type="checkbox" id="setting-global-entry-tabs"> Display \'Content Type\' tabs for each entry (\'Readable\', \'Link\', \'Feed\'). </label> <br /> <label> <input type="checkbox" id="setting-global-hide-likers"> Hide \'Liked by users\' for each entry. </label> </div> <div class="enhanced"> <div class="enhanced-header">Opening entries</div> <label> <input type="radio" name="global_open_entry_default" id="setting-global-use-iframes"> Default to open all entries as previews (iframes). </label> <br /> <label> <input type="radio" name="global_open_entry_default" id="setting-global-use-readability"> Default to open all entries as readable content. </label> </div> <div class="enhanced"> <div class="enhanced-header">Entry subject</div> <label> <input type="checkbox" id="setting-global-url-in-subject"> Default to include entry hostname in subject. </label> </div> <div class="enhanced"> <div class="enhanced-header">Readable content</div> <label><input type="checkbox" name="global_readability_pre_fetch" id="setting-global-readability-pre-fetch"> If readability enabled for feed/folder, default to pre-fetch all non-read entries as readable content.</label> <br /> <label><input type="checkbox" name="global_readability_more_images" id="setting-global-readability-more-images"> Try to fetch more images along with readable content. Sometimes this may result in too much clutter. This functionality is experimental. </label> </div> </div> </li>');

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

    var global_settings = ['use_iframes', 'use_readability', 'url_in_subject', 'hide_likers', 'readability_pre_fetch', 'entry_tabs', 'readability_more_images'];

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

    // Initialise the settings feedback message area
    //
    $("#message-area-outer").addClass("hidden").addClass("info-message");
  }

  // Settings checkbox click event handler. Handles a user changing a setting.
  //
  $.sgr.globalSettingClickEventHandler = function(gs_name, gs_default, gs_id) {
    gs_name = gs_name.toString();
    var gs_value = !$.sgr.getGlobalSetting(gs_name);
    $.sgr.setGlobalSetting(gs_name, gs_value);

    if (gs_value) {
      $("#" + gs_id).attr('checked','checked');
    } else {
      $("#" + gs_id).removeAttr('checked');
    }

    $.sgr.showSettingChangeFeedbackMesssage(gs_name, gs_value);

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

    $.sgr.sendRequest({action: 'global_setting_change', setting_name: gs_name, setting_value: gs_value, set_in_background: (gs_name == 'readability_more_images' ? true : false)});
  }

  // Act on a global setting change in the main Google Reader window
  //
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
    } else if (data.setting_name == 'readability_more_images') {
      // Tell the background page to clear it's sessionStore of readable content
      //
      $.sgr.sendRequest({action: 'clear_store', store_type: 'session'});
    }
  }


  // Display a feedback 'flash' message on screen after a global setting is changed
  //
  $.sgr.showSettingChangeFeedbackMesssage = function(gs_name, gs_value) {
    var fb_value = gs_value;
    if (gs_value === true) {
      fb_value = 'true';
    } else if (gs_value === false) {
      fb_value = 'false';
    }

    var msg = $.sgr.setting_feedback_messages[gs_name][fb_value];
    if (msg != null) {
      $("#message-area-inner").html(msg);
      $("#message-area-outer").removeClass("hidden").width($("#message-area-inner").width() + 15).css('margin-left', '-' + ($("#message-area-outer").width() / 2) + 'px');

      // Timeout handling for removing the flash message
      //
      clearTimeout($.sgr.setting_feedback_timer);
      $.sgr.setting_feedback_timer = setTimeout(function(){
          $("#message-area-outer").addClass("hidden");
        }, 6000);
    }
  }

  // Main setup for Google Reader window. Sets up appropriate listeners.
  //
  $.sgr.initMainWindowEvents = function() {

    // Do not execute this for the settings iframe
    //
    if (window.location.href.match($.sgr.gr_settings_window_re)) {
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
    $(document).keydown(function(ev){

      // keydown 8, 9 or 0 : switch between readable, iframe and original 
      // entry views
      //
      if (jQuery.inArray(parseInt(ev.keyCode), [48,56,57]) > -1) {
        // Don't fire in text-accepting inputs that we didn't directly bind to
        // from jquery.hotkeys.js
        //
        if ( this !== ev.target && (/textarea|select/i.test( ev.target.nodeName ) ||
           ev.target.type === "text") ) {
          return;
        }

        var entry = $("#current-entry");
        if (entry.hasClass("expanded") || $.sgr.isExpandedView()) {
          // Keydown 0 - show original content
          //
          if (ev.keyCode == 48) {
            $.sgr.checkAndShowEntryOriginalContent(entry, true);
            $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'OriginalEntry', ga_action: 'keydown'});

          // Keydown 8 - show readable content
          //
          } else if (ev.keyCode == 56) {
            $.sgr.checkAndShowReadableEntry(entry, true);
            $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'ReadableEntry', ga_action: 'keydown'});

          // Keydown 9 - show iframe content
          //
          } else if (ev.keyCode == 57) {
            $.sgr.checkAndShowPreview(entry, true);
            $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'IframeEntry', ga_action: 'keydown'});
          }
        }
      }
    });

    // Any click event
    //
    $(document).click(function(ev) {
      //debug("document click");
      var ev_target = $(ev.target);

      // If the user is clicking the 'Super settings..' button
      //
      if (ev_target.hasClass('sgr-prefs-menu-item')) {
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

      // Else if a user is clicking the menu itself, we can remove the super menu
      //
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


    // div#entries live DOMNodeInserted event
    //
    $("#entries").live('DOMNodeInserted', function(ev){
      var ev_target = $(ev.target);
      var entries = $(this);

      // If an entry is having it's content inserted (e.g. being opened), take appropriate action to
      // inject our own tabs or replace the content as necessary.
      //
      if (ev_target.hasClass("entry-container")) {
        var entry = ev_target.closest(".entry");
        //debug("#entries DOMNodeInserted .entry-container");

        $.sgr.removePreview($(".preview"));
        $.sgr.setEntryOriginalContent(entry);

        $.sgr.handleEntryOpen(entry);
      }

      // If this is an .entry node being inserted
      //
      if (ev_target.hasClass("entry")) {
        var entry = ev_target;

        // Check if this entry is meant to be filtered
        //
        $.sgr.runFilterEntry(entry);
        $.sgr.fetchMoreFilteredEntriesForCurrentFeed();

        // If this is the first entry being inserted, then it must be an initial load of entries.
        // We will:
        //  1. Setup our filters nav (if filters exist).
        //  2. Clear any cached data for the filters, so new entries can be captured properly.
        //
        if (entries.find(".entry").length == 1) {

          $.sgr.removeFilterNav();

          var filters = $.sgr.getCurrentFeedFilters();
          $(filters).each(function(idx,filter) {
            // Setup filter nav
            //
            if ($("#filter-nav-" + filter.id).length <= 0) {
              $("#chrome-title").css('display', 'inline').after('<a href="/reader/view/filter/' + filter.id + '" class="sgr-filter-nav' + ($.sgr.isFilterActive(filter.id) ? ' sgr-filter-nav-active' : '' ) + '" id="sgr-filter-nav-' + filter.id + '">' + (filter.name.length > $.sgr.filter_name_max_display ? filter.name.substr(0,$.sgr.filter_name_max_display) + '..' : filter.name) + '</a>');

              // Clear cached filter feed data
              //
              //$.sgr.clearCachedFilterFeedData(filter.id);
            }
          });
        }
        $.sgr.setEntryOriginalContent(entry);

        // If we are in expanded view
        //
        if ($.sgr.isExpandedView()) {
          $.sgr.handleEntryOpen(entry);
        } else {
          // Add hostname to subject
          //
          $.sgr.addHostnameToSubject(entry, '.entry-title');

          // Pre fetch readable content
          //
          if (!entry.hasClass("read") && $.sgr.getSetting("use_readability") && $.sgr.getSetting("readability_pre_fetch")) {
            $.sgr.sendReadabilityFetchRequest(entry, {pre_fetch: true});
          }
        }

      }
    });


    // #entries live DOMNodeRemoved event
    //
    $("#entries").live('DOMNodeRemoved', function(ev){
      var ev_target = $(ev.target);

      // If the entry is being closed (.entry-container is being removed) note the time and remove
      // any DOM components we have previously added for this entry.
      //
      if (ev_target.hasClass("entry-container")) {
        var entry = ev_target.closest(".entry");

        // Store the time that this particular entry is being closed
        //
        var entry_closed_at_time = new Date();
        var entry_xpath = $.sgr.getXPath(entry);
        $.sgr.entry_closed_at_time[entry_xpath] = entry_closed_at_time.getTime();
        //debug("setting entry_closed_at_time for " + entry_xpath + " : " + $.sgr.entry_closed_at_time[entry_xpath]);

        // Cleanup any iframes and entry tabs we have previously injected for this entry
        //
        $.sgr.removePreview(entry);
        entry.removeClass("readable");
        $.sgr.removeEntryTabs(entry);
      }
    });

    // Feed/folder header DOMNodeInserted
    //
    $("#viewer-top-controls").live('DOMNodeInserted', function(ev){
      var ev_target = $(ev.target);

      // After a "Settings..." button has been injected, add our own "Super settings.." button
      //
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

          $.sgr.switchAllEntriesToPreview();

        } else if (setting_name == 'use_readability') {
          $.sgr.setLocalSetting('use_iframes', !setting_value);
          if (setting_value) {
            $("#menu_use_iframes").removeClass("goog-option-selected");
          }
          $.sgr.togglePreFetchReadableContentMenuOption();

          $.sgr.switchAllEntriesToReadable();
        }

      } else {
        $(this).removeClass("goog-option-selected");
      }

      // Entry tabs toggle
      //
      if (setting_name == 'entry_tabs') {
        $.sgr.toggleEntryTabs();

      // Show hostname in subject toggle
      //
      } else if (setting_name == 'url_in_subject') {
        $.sgr.toggleHostnameInSubjects();

      // Pre-fetch readable content if this is being enabled
      //
      } else if (setting_name == 'readability_pre_fetch' && setting_value && $.sgr.getSetting("use_readability")) {
        $.sgr.preFetchAllUnreadEntries();
      }

    });


    // Entry tab live click
    //
    $(".sgr-entry-tab").live('click', function(ev) {
      var tab = $(ev.target);
      var entry = tab.closest(".entry");

      // Readable
      //
      if (tab.hasClass("sgr-tab-readable")) {
        $.sgr.checkAndShowReadableEntry(entry);
        $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'ReadableEntry', ga_action: 'click'});

      // Link
      //
      } else if (tab.hasClass("sgr-tab-link")) {
        debug(".sgr-entry-tab live click for sgr-tab-link");
        $.sgr.checkAndShowPreview(entry); 
        $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'IframeEntry', ga_action: 'click'});

      // Feed
      //
      } else if (tab.hasClass("sgr-tab-feed")) {
        $.sgr.checkAndShowEntryOriginalContent(entry);
        $.sgr.sendRequest({action: 'ga_track_event', ga_category: 'OriginalEntry', ga_action: 'click'});
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

    // Filter nav
    //
    $('.sgr-filter-nav').live('click', function(ev) {
      debug('sgr-filter-nav click');
      try {
        $.sgr.toggleFilter($.sgr.getFilterIdFromLink(this));
      } catch(e) {
        debug("error with $.sgr.toggleFilter() : " + e.name + " : " + e.message);
      }
      return false;
    });

    // Left-hand nav filter click event
    //
/*
    $(".sgr-lhn-link").live('click',function(ev){
      //debug('lhn click: ');
      //debug(this);
      
      $.sgr.clearLhnSelection();

      var link_el = $(this);
      link_el.addClass("tree-link-selected").closest("li").addClass("tree-selected");
      try {
        $.sgr.displayFilteredEntries($.sgr.getFilterIdFromLink(this));
      } catch(e) {
        debug("error with $.sgr.displayFilteredEntries() : " + e.name + " : " + e.message);
      }
      return false;
    });

    // Any #nav click event
    //
    $("#nav").live('click',function(ev) {
      var ev_target = $(ev.target);
      debug("#nav click");
      if (!ev_target.hasClass("sgr-lhn-link") && !ev_target.closest("li").hasClass("sgr-lhn-link")) {
        debug("#nav click, non-sgr-lhn-link");
        $.sgr.clearSgrLhnSelection();
        // FIXME
        if ($("#chrome-orig").length > 0) {
        debug("#nav click, non-sgr-lhn-link, #chrome-orig");
          $("#chrome").remove();
          $("#chrome-orig").attr('id','chrome').find("#viewer-container-orig").attr('id','viewer-container').find('#entries-orig').attr('id','entries');
        }
      }
    });
*/

    // Any #nav click event
    //
    $("#nav").live('click',function(ev) {
      $.sgr.removeFilterNav();
    });

    // Keyboard shortcut help - DOMNodeInserted live event 
    //
    $(".keyboard-help-banner .secondary-message").live('DOMNodeInserted',function(ev){
      var ev_target = $(ev.target);
      if (ev_target.attr('id') == 'keyboard-help-container') {
        var start_tr = ev_target.find("#keyboard-help tr:eq(9)");
        start_tr.find("td:eq(0)").remove();
        start_tr.find("td:eq(0)").replaceWith('<th colspan="2">Super - acting on items</th>');

        start_tr.next().find("td:eq(0)").addClass("key").html("8:");
        start_tr.next().find("td:eq(1)").addClass("desc").html("view readable content");
        start_tr.next().next().find("td:eq(0)").addClass("key").html("9:");
        start_tr.next().next().find("td:eq(1)").addClass("desc").html("view link in iframe");
        start_tr.next().next().next().find("td:eq(0)").addClass("key").html("0:");
        start_tr.next().next().next().find("td:eq(1)").addClass("desc").html("view original entry");
      }
    });

    // SGR inserted entry - live click
    //
/*
    $(".sgr-entry").live('click',function(ev){

      debug(".sgr-entry click");

      var entry = $(this);

      var already_open = false;

      // Close any entry already open
      //
      if (entry.hasClass("expanded")) {
        already_open = true;
      }

      $.sgr.closeSgrEntryBody();

      if (already_open == false) {
        $.sgr.removePreview($(".preview"));

        // Setup original entry content
        //
        entry.find('.entry-body').html(entry.data().sgr_content);
        $.sgr.setEntryOriginalContent(entry);

        $.sgr.handleEntryOpen(entry);
        $.sgr.openSgrEntryBody(entry);
      }
    });
*/

    if (chrome) {
      // Chrome listener for background messages
      //
      chrome.extension.onRequest.addListener($.sgr.receiveRequest);
    }

    $.sgr.sendRequest({action: 'ga_track_pageview', track_url: self.location.pathname});
  }

  $.sgr.removeFilterNav = function() {
    $(".sgr-filter-nav").remove();
  }

  $.sgr.closeSgrEntryBody = function() {
    $("#current-entry").removeClass("expanded").attr('id','').find(".entry-container, .entry-comments, .entry-actions").addClass("hidden");
  }

  $.sgr.openSgrEntryBody = function(entry) {
    entry.addClass("expanded").addClass("read").attr('id','current-entry').find(".entry-container, .entry-comments, .entry-actions").removeClass("hidden");
  }

  $.sgr.clearLhnSelection = function() {
    $(".tree-selected").removeClass("tree-selected");
    $(".tree-link-selected").removeClass("tree-link-selected");
    $("#lhn-selectors .selected").removeClass("selected");
  }

  $.sgr.clearSgrLhnSelection = function() {
    $(".sgr-lhn-link").closest("li").removeClass("tree-selected");
    $(".sgr-lhn-link").removeClass("tree-link-selected");
  }

  // Remove our "Super settings.." menu from the DOM
  //
  $.sgr.removeSgrSettingsMenu = function() {
    $("#sgr-prefs-menu").removeClass("goog-button-base-open");
    $("#sgr-prefs-menu-menu").remove();
  }

  // Add our "Super settings..." menu to the DOM
  //
  $.sgr.initSgrSettingsButton = function() {
    $("#stream-prefs-menu").after($.sgr.getSgrSettingsButtonHtml());
  }

  // Update the selected Entry Tab based on the entry content being shown
  //
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

  // Handler for an entry being opened
  //
  $.sgr.handleEntryOpen = function(entry) {

    // If this entry doesn't have the class 'expanded', and we are using an iframe or readability to view the entry,
    // process the entry as such. We check for a missing 'expanded' class even though that class is added when an entry
    // is opened because this code runs before Google Reader has actually assigned the expanded class.
    //
    if (!entry.hasClass("expanded") && ($.sgr.getSetting('use_iframes') || $.sgr.getSetting('use_readability'))) {
      //debug('article open');

      // Grab the time that this entry is being opened
      //
      var entry_opened_at_time = new Date();
      var entry_xpath = $.sgr.getXPath(entry);

      // Check if this entry was recently closed. Google reader seems to remove, add, and remove the 'expanded'
      // class when closing an entry. This causes it to 'flicker' on the screen. We check that the entry
      // wasn't recently (<50ms) closed before we attempt to open it, in order to avoid the flicker.
      //
      if (typeof $.sgr.entry_closed_at_time[entry_xpath] != 'undefined') {
        //debug("found previous entry_closed_at_time for " + entry_xpath + " : " + $.sgr.entry_closed_at_time[entry_xpath]);

        if (50 > (entry_opened_at_time.getTime() - $.sgr.entry_closed_at_time[entry_xpath])) {
          //debug("time diff < 50 : " + (entry_opened_at_time.getTime() - $.sgr.entry_closed_at_time[entry_xpath]));
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

  // Convert all entries to readable view
  //
  $.sgr.switchAllEntriesToReadable = function() {
    if ($.sgr.isExpandedView()) {
      $("#entries .entry").each(function(){
        $.sgr.checkAndShowReadableEntry($(this));
      });
    } else {
      $.sgr.checkAndShowReadableEntry($("#current-entry"));
    }
  }

  // Convert all entries to preview view
  //
  $.sgr.switchAllEntriesToPreview = function() {
    if ($.sgr.isExpandedView()) {
      $("#entries .entry").each(function(){
        $.sgr.checkAndShowPreview($(this));
      });
    } else {
      $.sgr.checkAndShowPreview($("#current-entry"));
    }
  }

  // Check if the current view of enties is the 'Expanded' view
  //
  $.sgr.isExpandedView = function(){
     return $("#entries").hasClass("cards");
  }

  // Loop all current unread entries and pre-fetch readable content for them.
  //
  $.sgr.preFetchAllUnreadEntries = function() {
    $("#entries .entry:not(.read)").each(function(){
      $.sgr.sendReadabilityFetchRequest($(this), {pre_fetch: true});
    });
  }

  // Send a request from a content script to the background window. Wait for a response and take 
  // appropriate action in some specific cases.
  //
  $.sgr.sendRequest = function(data) {
    if (chrome) {
      chrome.extension.sendRequest(data, function(response) {
        debug("sgr.js: " + response.action + " - " + response._msg);

        if (response.action == 'readability_content' 
            || response.action == 'readability_error_use_original_content') {

          // If this isn't a pre-fetched reabable content chunk, and
          // the readable chunk matches the currently open entry, keep going
          //
          if (typeof response.pre_fetch == 'undefined' || response.pre_fetch == false) {
            var entry = $('.' + $.sgr.generateReadableEntryClass(data.readability_url));

            if (entry.length > 0) {
              // If we have received readable content for an entry, check if we need to display this content
              // for the currently open entry.
              //
              if (response.action == 'readability_content') {
                var jq_rc = $(response.readability_content);

                // Find any img elements with an sgr-src attribute and replace the src value if it doesnt match sgr-src
                //
                jq_rc.find("img[sgr-src]").each(function() {
                  if ($(this).attr('src') != $(this).attr('sgr-src')) {
                    $(this).attr('src', $(this).attr('sgr-src'));
                  }
                });

                // replace the currently open entry content with the readable content
                //
                entry.find(".entry-body").html(jq_rc);

              // If we have asked for readable content and have not found any, revert to using the original
              // content of the entry.
              //
              } else if (response.action == 'readability_error_use_original_content') {
                $.sgr.useEntryOriginalContent(entry);
              }
            }
          }
        }
      });
    }
  }

  // Ask the background window to fetch us readable content for the specified entry
  //
  $.sgr.sendReadabilityFetchRequest = function(entry, extra_data) {
    extra_data = $.extend(extra_data, {user_id: $.sgr.USER_ID});
    $.sgr.sendRequest({action: 'readability_fetch', readability_url: $.sgr.getEntryUrl(entry), extra_data: extra_data});
  }

  // Store the original feed content for an entry. We use this if we can't find any readable content for the entry.
  //
  $.sgr.setEntryOriginalContent = function(entry) {
    $.sgr.entry_original_content[$.sgr.generateReadableEntryClass($.sgr.getEntryUrl(entry))] = entry.find(".entry-body").html();
  }

  // Retrieve the stored original feed content for an entry
  //
  $.sgr.getEntryOriginalContent = function(entry) {
    return $.sgr.entry_original_content[$.sgr.generateReadableEntryClass($.sgr.getEntryUrl(entry))];
  }

  // Revert to using the entry's original feed content.
  //
  $.sgr.useEntryOriginalContent = function(entry) {
    entry.removeClass("preview").removeClass("readable");
    $.sgr.updateSelectedEntryTab(entry);
    entry.find(".entry-body").html($.sgr.getEntryOriginalContent(entry));
  }

  // Revert to using the entry's original feed content, after checking it isn't
  // already being shown and then saving any iframe being shown.
  //
  $.sgr.checkAndShowEntryOriginalContent = function(entry, scroll_to) {
    if (typeof scroll_to == 'undefined') {
      scroll_to = false;
    }
    if (entry.hasClass("preview") || entry.hasClass("readable")) {
      if (entry.hasClass("preview")) {
        $.sgr.savePreview(entry);
      } else {
        entry.removeClass("readable");
      }
      if (scroll_to) {
        $.sgr.scrollTo(entry);
      }
      $.sgr.useEntryOriginalContent(entry);
    }
  }

  // Initialise the background window, mainly for a request listener.
  //
  $.sgr.initBackgroundWindow = function() {
    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
      debug("background : received request, request.action = " +request.action);

      // Iframe window height
      //
      if (request.action == 'window_height') {
        sendResponse({_msg: "action " + request.action + ", window height " + request.window_height});
        $.sgr.sendToTab(sender.tab.id, {action: 'set_window_height', window_height: request.window_height, iframe_id: request.iframe_id});

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

        // If stored content exists but has been set to 'none', meaning previously no readable content could be found,
        // report a readability error and use the original feed content.
        //
        } else if (stored_content == 'none') {
          sendResponse($.extend({action: 'readability_error_use_original_content', _msg: "No content found (cached) for " + request.readability_url},request.extra_data));

        // Otherwise we can fetch readable content from the source
        //
        } else {
          $.sgr.fetchReadableContent(request.readability_url, sendResponse, sendResponse, request.extra_data);
        }

      // Global setting change from settings iframe
      //
      } else if (request.action == 'global_setting_change') {
        $.sgr.sendToTab(sender.tab.id, {action: 'global_setting_change', setting_name: request.setting_name, setting_value: request.setting_value});

        // Set this global setting in the background window itself if we are told to
        //
        if (typeof request.set_in_background != 'undefined' && request.set_in_background) {
          $.sgr.setGlobalSetting(request.setting_name, request.setting_value);
        }

      // Global setting for background
      //
      } else if (request.action == 'global_setting_background') {
        $.sgr.setGlobalSetting(request.setting_name, request.setting_value);

      // Register USER_ID
      //
      } else if (request.action == 'regsiter_user_id') {
        $.sgr.USER_ID = request.user_id;

      // Clear storage
      //
      } else if (request.action == 'clear_store') {
        $.stor.clear(request.store_type);

      // Google Analytics Track Pageview
      //
      } else if (request.action == 'ga_track_pageview') {
        $.sgr.gaTrackPageView(request.track_url);

      // Google Analytics Track Event
      //
      } else if (request.action == 'ga_track_event') {
        $.sgr.gaTrackEvent(request);

      } else {
        sendResponse({}); // snub them.
      }
    });
  }

  // Google Analytics track pageview. Needs to be called from background window.
  //
  $.sgr.gaTrackPageView = function(url) {
    if (DEBUG) {
      debug('gaTrackPageView : ' + url);
    } else {
      _gaq.push(['_trackPageview', url]);
    }
  }

  // Google Analytics track event. Needs to be called from background window.
  //
  $.sgr.gaTrackEvent = function(ga_obj) {
    if (DEBUG) {
      debug('gaTrackEvent : ' + ga_obj.ga_category + ', ' + ga_obj.ga_action + ', ' + ga_obj.ga_opt_label + ', ' + ga_obj.ga_opt_value);
    } else {
      _gaq.push(['_trackEvent', ga_obj.ga_category, ga_obj.ga_action, ga_obj.ga_opt_label, ga_obj.ga_opt_value]);
    }
  }

  // Main setup for Google Reader Settings iframe. Initialises listeners and injects settings
  // tab and tab content into the DOM.
  //
  $.sgr.initSettingsWindow = function() {

    // Only execute this for the settings iframe
    //
    if (!window.location.href.match($.sgr.gr_settings_window_re)) {
      return;
    }

    // Inject the global settings tab and listeners once the entire DOM is ready, so we can
    // ensure we place our tab in the correct location.
    //
    $(document).ready(function() {
      $.sgr.initSettingsNavigation();
    });


  }

  // Find and return the external/outgoing link for a specific entry
  //
  $.sgr.getEntryUrl = function(entry) {
    return entry.find('.entry-original, .entry-title-link').first().attr('href');
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

  // Find the base domain url and path (excluding filename if present) for a given url
  //
  $.sgr.getBaseUrlWithPath = function(url) {
    try {
      var url_match = url.match(/(.*?:\/\/.*?(.*\/|$))/)[1];
    } catch(e) {
      debug("Error running getBaseUrlWithPath() for url " + url + ".");
      return null;
    }
    //debug("url match: url=" + url + ", url_match=" + url_match);
    if (url_match[url_match.length-1] != "/") {
      url_match = url_match + "/";
    }
    return url_match;
  }

  // Toggle display of 'X users liked this' for all entries, depending on user's settings.
  //
  $.sgr.toggleEntryLikers = function() {
    // If hide_likers is enabled, hide all entry likers
    //
    if ($.sgr.getSetting('hide_likers')) {
      $.sgr.addStyles(' .entry-likers { display: none; }');
      $(".entry-likers").css('display','none');

    // If hide_likers is disabled, show all entry likers
    //
    } else {
      $.sgr.addStyles(' .entry-likers { display: block; }');
      $(".entry-likers").css('display','block');
    }
  }

  // Inject entry tabs into an entry
  //
  $.sgr.injectEntryTabs = function(entry) {
    if (entry.length <= 0) {
      return;
    }
    if ($.sgr.getSetting('entry_tabs')) {
      entry.find(".entry-secondary-snippet").hide();
      entry.append($.sgr.entry_tabs_html);
      $.sgr.updateSelectedEntryTab(entry);
    }
  }

  // Remove entry tabs from an entry
  //
  $.sgr.removeEntryTabs = function(entry) {
    entry.find(".sgr-entry-tabs").remove();
    entry.find(".entry-secondary-snippet").show();
  }

  // Toggle the display of entry tabs in an entry, depending on a user's settings.
  //
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

  // Toggle the display of the readability pre-fetch menu option, depending on the user's setting
  // for 'use_readability'.
  //
  $.sgr.togglePreFetchReadableContentMenuOption = function() {
    if ($.sgr.getSetting('use_readability')) {
      $("#menu_readability_pre_fetch").removeClass("goog-menuitem-disabled").addClass("goog-option");
    } else {
      $("#menu_readability_pre_fetch").addClass("goog-menuitem-disabled").removeClass("goog-option");
    }
  }

  // Fetch readable content for an entry. First we check if the entry is a known type (e.g. youtube video) and
  // handle it appropriately if it is. If not, we perform an ajax request to grab the content and then parse
  // it through readability.
  //
  $.sgr.fetchReadableContent = function(url, success_callback, failure_callback, extra_return_data) {
    debug("fetchReadableContent() FETCH : " + (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + " " + url);

    var content_replaced = $.sgr.handleReadableEntryContentReplace(url, success_callback, failure_callback, extra_return_data);

    if (content_replaced == false) {
      $.ajax({
        url: url,
        data: {},

        // Success accessing URL
        //
        success: function(responseHtml) {
          //debug("fetchReadableContent() SUCCESS : " + (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + " " + url);

          try {
            var page = document.createElement("DIV");
            page.innerHTML = readability.sgrInit(responseHtml);
            //debug("page.innerHTML=");
            //debug(page.innerHTML);

            readability.flags = 0x1 | 0x2 | 0x4;

            var content = readability.grabArticle(page);

            if (content == null) {
              throw new Error("Readability found no valid content.");
            }

            //debug("content.innerHTML after grabArticle:");
            //debug(content.innerHTML);

            // Remove any elements previously flagged to be filtered
            //
            readability.sgrRemoveFilteredElements(content);

            readability.removeScripts(content);
            readability.fixImageFloats(content);

            //debug("content.innerHTML before sgrPostProcess:");
            //debug(content.innerHTML);
            content = readability.sgrPostProcess(content, url);
          } catch(e) {
            debug("Error running readability. Using original article content. " + e.name + ": " + e.message);
            content = "<p>Sorry, no readable content was able to be generated.</p>";
          }

          $.sgr.completedReadableContent(content, url, success_callback, extra_return_data);
        },

        // Error accessing URL
        //
        error: function(xhr) {
          debug("Error fetching readability url. Using original article content.");
          $.sgr.completedReadableContent('<p>Sorry, the entry link was unable to be reached successfully.</p>', url, failure_callback, extra_return_data);
        }
      });
    }
  }

  // Handle a successful generation of readable content. We store the content and execute the provided calback.
  //
  $.sgr.completedReadableContent = function(content, url, success_callback, extra_return_data) {
    //debug(content);
    $.stor.set($.sgr.getReadabilityContentStorageKey(url, extra_return_data.user_id), content, 'session');

    var return_data = $.extend({action: 'readability_content', readability_content: content, _msg: (extra_return_data.pre_fetch ? "[PRE-FETCH] " : "") + "Content fetched for " + url}, extra_return_data);
    success_callback(return_data);
  }

  // Handle a failed generation of readable content. We execute the provided calback.
  //
  $.sgr.failedReadableContent = function(url, failure_callback, extra_return_data) {
    var return_data = $.extend({action: 'readability_error_use_original_content', _msg: "No content found for " + url}, extra_return_data);
    failure_callback(return_data);
  }

  // Look for a matched known entry type to replace content with readable content (e.g. youtube).
  //
  $.sgr.handleReadableEntryContentReplace = function(url, success_callback, failure_callback, extra_return_data) {
    var found_match = false;
    $($.sgr.readable_entry_content_replace).each(function(){
      url_matches = url.match(this['regex']);
      if (url_matches != null) {
        found_match = this['callback'](url, url_matches, success_callback, failure_callback, extra_return_data);
        return;
      }
    });
    return found_match;
  }

  // Readable content generator for Youtube videos. Fetches info on the video via the youtube api
  // and renders an embedded link to the video along with some info.
  //
  $.sgr.replaceContentYoutube = function(url, url_matches, success_callback, failure_callback, extra_return_data) {
    var video_id = url_matches[1];
    if (video_id == null) {
      return false;
    }
    var yt_url = $.sgr.youtube_api['video'].replace(/\[video_id\]/, video_id);
    $.ajax({
      url: yt_url,
      data: {},
      dataType: 'json',
      success: function(video){
        var uploaded = new Date(video.data.uploaded);
        var content = '<h2 class="sgr-entry-heading">' + video.data.title + '</h2><iframe class="youtube-player" type="text/html" width="640" height="385" src="http://www.youtube.com/embed/' + video_id +'" frameborder="0"></iframe><p>' + video.data.description + '</p><p><strong>Uploader: </strong>' + video.data.uploader + '</p><p><strong>Uploaded: </strong>' + uploaded.toString() + '</p>';
        $.sgr.completedReadableContent(content, url, success_callback, extra_return_data);
      },
      error: function() {
        $.sgr.failedReadableContent(url, failure_callback, extra_return_data);
      }
      
    });
    return true;
  }

  // Readable content generator for Vimeo videos. Fetches info on the video via the vimeo api
  // and renders an embedded link to the video along with some info.
  //
  $.sgr.replaceContentVimeo = function(url, url_matches, success_callback, failure_callback, extra_return_data) {
    var video_id = url_matches[1];
    if (video_id == null) {
      return false;
    }
    var vimeo_url = $.sgr.vimeo_api['video'].replace(/\[video_id\]/, video_id);
    $.ajax({
      url: vimeo_url,
      data: {},
      dataType: 'json',
      success: function(video){
        video = video[0];
        var uploaded = new Date(video.upload_date);

        var content = '<h2 class="sgr-entry-heading">' + video.title + '</h2><iframe type="text/html" width="' + video.width + '" height="' + video.height + '" src="http://player.vimeo.com/video/' + video_id +'" frameborder="0"></iframe><p>' + video.description + '</p><p><strong>Uploader: </strong><a href="' + video.user_url + '">' + video.user_name + '</a></p><p><strong>Uploaded: </strong>' + uploaded.toString() + '</p>';
        $.sgr.completedReadableContent(content, url, success_callback, extra_return_data);
      },
      error: function() {
        $.sgr.failedReadableContent(url, failure_callback, extra_return_data);
      }
      
    });
    return true;
  }

  // Readable content generator for Wikipedia articles. Fetches the article content via the wikipedia api
  // and renders it nicely.
  //
  $.sgr.replaceContentWikipedia = function(url, url_matches, success_callback, failure_callback, extra_return_data) {
    var topic = url_matches[1] != null ? url_matches[1] : url_matches[2];
    if (topic == null) {
      return false;
    }
    var wp_url = url + (url.indexOf('?') > -1 ? '&' : '?') + 'action=render';
    $.ajax({
      url: wp_url,
      data: {},
      success: function(html){

        if (html.length > 0) {
          html = '<h2 class="sgr-entry-heading">' + topic.replace(/_/g,' ') + '</h2>' + html;
          var jq_html = $('<div>' + html + '</div>')
          jq_html.find(".editsection, script, link, style").remove();
          html = jq_html.html();
          html = '<div class="sgr-wikipedia-content">' + html + '</div>';
        }

        $.sgr.completedReadableContent(html, url, success_callback, extra_return_data);
      },
      error: function() {
        $.sgr.failedReadableContent(url, failure_callback, extra_return_data);
      }
      
    });
    return true;
  }

  // Settings for known readable content types. Includes regex to match against entry links. This
  // must be defined after the callback functions have been initiated so references to the callbacks
  // can be listed in this settings object.
  //
  $.sgr.readable_entry_content_replace = [
    {name: 'youtube', regex: new RegExp($.sgr.start_url_str + 'youtube\.com\/(?:watch|)\\?v\=(.*?)(?:&.*|)$'), callback: $.sgr.replaceContentYoutube}
    ,{name: 'vimeo', regex: new RegExp($.sgr.start_url_str + 'vimeo\.com\/([0-9]*)'), callback: $.sgr.replaceContentVimeo}
    ,{name: 'wikipedia', regex: /^http(?:s|)\:\/\/.*?\.wikipedia\.org\/(?:wiki\/(.*)|w\/index\.php.*?title=(.*?)(?:&.*|)$)/, callback: $.sgr.replaceContentWikipedia}
    ];

  // Generate a class name for an entry based on it's URL
  //
  $.sgr.generateReadableEntryClass = function(url) {
    return "sgr-entry-" + url.replace(/[^a-zA-Z0-9]+/g,'_');
  }

  // Generate a storage key for readability content based on USER_ID and URL
  //
  $.sgr.getReadabilityContentStorageKey = function(url, user_id) {
    return (user_id == null ? $.sgr.USER_ID : user_id) + "_ra_url_" + url.replace(/[^a-zA-Z0-9]+/g,'_');
  }

  // Construct the HTML for a 'Super settings' menu button
  //
  $.sgr.getSgrSettingsButtonHtml = function() {
    return '<div role="wairole:button" tabindex="0" class="goog-button goog-button-base unselectable goog-inline-block goog-button-float-left goog-menu-button goog-button-tight sgr-prefs-menu-item" id="sgr-prefs-menu"><div class="goog-button-base-outer-box goog-inline-block sgr-prefs-menu-item"><div class="goog-button-base-inner-box goog-inline-block sgr-prefs-menu-item"><div class="goog-button-base-pos sgr-prefs-menu-item"><div class="goog-button-base-top-shadow sgr-prefs-menu-item">&nbsp;</div><div class="goog-button-base-content sgr-prefs-menu-item"><div class="goog-button-body sgr-prefs-menu-item">Super settings...</div><div class="goog-menu-button-dropdown sgr-prefs-menu-item"></div></div></div></div></div></div>';
  }

  // Construct the HTML for a dropdown menu option item
  //
  $.sgr.getGoogMenuitemHtml = function(id, label, selected) {
      return '<div class="sgr-menuitem sgr-menuitem-item goog-menuitem goog-option' + (selected ? ' goog-option-selected' : '') + '" role="menuitem" style="-moz-user-select: none;" id="' + id + '"><div class="sgr-menuitem-item goog-menuitem-content"><div class="sgr-menuitem-item goog-menuitem-checkbox"></div>' + label + '</div></div>';
  }

  // Construct the HTML for a dropdown menu separator item
  //
  $.sgr.getGoogMenuseparatorHtml = function() {
    return '<div class="goog-menuseparator sgr-menuitem" style="-moz-user-select: none;" role="separator" id=""></div>';
  }

  // Construct HTML for am embedded Google Docs iframe
  //
  $.sgr.getGoogleDocHtml = function(url) {
    return '<iframe id="google_doc_iframe" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="http://docs.google.com/gview?embedded=true&url=' + url + '" class=""></iframe>';
  }

  // Get the URL extension (e.g. php) if it exists.
  //
  $.sgr.getUrlExtension = function(url) {
    return url.match(/.*\.(.*)$/i)[1];
  }

  // Match a URL's extension to a given array of extensions.
  //
  $.sgr.matchUrlExtension = function(url, match_arr) {
    var url_ext = $.sgr.getUrlExtension(url);
    if (jQuery.inArray(url_ext, match_arr) > -1) {
      return true;
    }
    return false;
  }

  // Send a request to a specific chrome tab. Usually executed from a background window.
  //
  $.sgr.sendToTab = function(tab_id, data) {
    //debug("sendToTab : sending data to chrome tab " + tab_id);
    chrome.tabs.sendRequest(tab_id, data, function(response) {
      if (response._msg) {
        debug(response._msg);
      }
    });
  }

  $.sgr.canRun = function() {

    // Check we are running on the Google Reader domain.
    //
    if (self.location.href.match($.sgr.gr_main_window_re) == null) {
      return false;
    }

    // Check if we need to reload. If we do, there is no need to continue.
    // The 'sgr_no_reload' value is setup in reader_preload.js
    //
    if (sessionStorage.getItem('sgr_no_reload')) {
      return false;
    }

    return true;
  }


  $.sgr.entry_base_jq= $(' <div class="entry entry-0 sgr-entry" id=""><div class="collapsed"><div class="entry-icons"><div class="item-star star link unselectable empty"></div></div><div class="entry-date"></div><div class="entry-main" style=""><a class="entry-original" target="_blank" href=""></a><span class="entry-source-title"></span><div class="entry-secondary"><h2 class="entry-title"></h2><span class="entry-secondary-snippet" style="display: inline; "> - <span class="snippet"></span></span></div></div></div><div class="entry-container hidden"><div class="entry-main"><div class="entry-date"></div><h2 class="entry-title"><a class="entry-title-link" target="_blank" href=""><div class="entry-title-go-to"></div></a></h2><div class="entry-author"><span class="entry-source-title-parent">from <a class="entry-source-title" target="_blank" href=""></a></span> <div class="entry-likers"></div></div><div class="entry-debug"></div><div class="entry-annotations"></div><div class="entry-body"></div></div></div></div></div><div class="entry-comments hidden"></div><div class="entry-actions hidden"><span class="item-star star link unselectable">Add star</span><wbr><span class="like-inactive like link unselectable">Like</span><wbr><span class="broadcast-inactive broadcast link unselectable">Share</span><wbr><span class="broadcast-with-note link"><span class="link unselectable">Share with note</span></span><wbr><span class="email"><span class="link unselectable">Email</span></span><wbr><span class="read-state-read read-state link unselectable">Mark as read</span><wbr><span class="item-link link unselectable"><wbr><span class="entry-link-action-title">Send to</span><div class="item-link-drop-down-arrow"></div></span><wbr><span class="tag link unselectable"><span class="entry-tagging-action-title">Edit tags: </span><ul class="user-tags-list"><li><a href="">main</a></li></ul></span></div></div>');
  
  $.sgr.buildNewEntry = function(entry_data) {
    var entry = $.sgr.entry_base_jq.clone();
    entry.find(".entry-original, .entry-title-link").attr('href', entry_data.alternate[0].href);
    entry.find(".snippet").html(entry_data._sgr_snippet);
    entry.find(".entry-secondary .entry-title, .entry-title-go-to, .entry-title-link").html(entry_data.title);
    if (entry_data._sgr_read == true) {
      entry.addClass("read");
    }
    entry.data({sgr_content: entry_data._sgr_content});
    return entry;
  }

  $.sgr.insertNewEntry = function(entry_data) {
    $("#entries").append($.sgr.buildNewEntry(entry_data));
  }

  // Handle a logout from google reader. Clear the sessionStore on this content page 
  // and on the background page.
  //
  $.sgr.runReaderLogout = function() {
    // Clear the content window sessionStore
    //
    $.stor.clear('session');

    // Tell the background page to clear it's sessionStore
    //
    $.sgr.sendRequest({action: 'clear_store', store_type: 'session'});
  }

  //$.sgr.gr_lhn_tree_html = '<li class="sub unselectable expanded unread" id="sub-tree-item-[__id__]-main"><div class="toggle sub-toggle toggle-d-1 hidden"></div><a class="link" href="" id="sub-tree-item-[__id__]-link"><span class="icon sub-icon icon-d-1" id="sub-tree-item-[__id__]-icon"></span><span class="name sub-name name-d-1 name-unread" id="sub-tree-item-[__id__]-name" title=""><span class="name-text sub-name-text name-text-d-1"></span><span class="unread-count sub-unread-count unread-count-d-1" id="sub-tree-item-[__id__]-unread-count"></span></span><div class="tree-item-action-container"><div id="sub-tree-item-[__id__]-action" class="action tree-item-action section-button section-menubutton goog-menu-button"></div></div></a></li>';
  $.sgr.gr_lhn_tree_html = '<li class="sub unselectable expanded unread" id="sub-tree-item-[__id__]-main"><div class="toggle sub-toggle toggle-d-1 hidden"></div><a class="sgr-lhn-link" href="javascript:" id=""><span class="sgr-lhn-link-text"></span><span class="unread-count sub-unread-count unread-count-d-1" id="sub-tree-item-[__id__]-unread-count"></span></a></li>';
  //$.sgr.gr_lhn_tree_html = '<li class="sub unselectable expanded unread" id="sub-tree-item-[__id__]-main"><a class="" href="javascript:" id="">test</a></li>';

  $.sgr.filters = [
    {name: 'inc "geelong|ablett"', id: 100001, base: '/reader/view/feed/http://feeds.news.com.au/public/rss/2.0/heraldsun_afl_geelong_559.xml', feed_type: 'feed', url: 'http://feeds.news.com.au/public/rss/2.0/heraldsun_afl_geelong_559.xml', filters: [{type: 'include', item: 'post', content: 'geelong'}, {type: 'include', item: 'post', content: 'ablett'}] }
,
    {name: 'Exc "ask hn|tell hn|show hn|facebook"', id: 100002, base: '/reader/view/feed/http://news.ycombinator.com/rss', feed_type: 'feed', url: 'http://news.ycombinator.com/rss', filters: [{type: 'exclude', item: 'post', content: 'tell hn|ask hn|show hn|facebook'}] }
,
    {name: 'Inc "facebook"', id: 100003, base: '/reader/view/feed/http://news.ycombinator.com/rss', feed_type: 'feed', url: 'http://news.ycombinator.com/rss', filters: [{type: 'include', item: 'post', content: 'facebook'}] }
,
    {name: 'Exc "facebook"', id: 100004, base: '/reader/view/feed/http://news.ycombinator.com/rss', feed_type: 'feed', url: 'http://news.ycombinator.com/rss', filters: [{type: 'exclude', item: 'post', content: 'facebook'}] }
,
    {name: 'Exc "an"', id: 100005, base: '/reader/view/feed/http://news.ycombinator.com/rss', feed_type: 'feed', url: 'http://news.ycombinator.com/rss', filters: [{type: 'exclude', item: 'post', content: 'an'}] }
,
    {name: 'Exc "apple|microsoft|facebook"', id: 100006, base: '/reader/view/feed/http://feedproxy.google.com/TechCrunch', feed_type: 'feed', url: 'http://feedproxy.google.com/TechCrunch', filters: [{type: 'exclude', item: 'post', content: 'apple'}, {type: 'exclude', item: 'post', content: 'microsoft'}, {type: 'exclude', item: 'post', content: 'facebook'}] }
,
    {name: 'Inc "facebook"', id: 100007, base: '/reader/view/feed/http://feedproxy.google.com/TechCrunch', feed_type: 'feed', url: 'http://feedproxy.google.com/TechCrunch', filters: [{type: 'include', item: 'post', content: 'facebook'}] }
,
    {name: 'Exc "facebook"', id: 100008, base: '/reader/view/feed/http://feedproxy.google.com/TechCrunch', feed_type: 'feed', url: 'http://feedproxy.google.com/TechCrunch', filters: [{type: 'exclude', item: 'post', content: 'facebook'}] }
,
    {name: 'Inc "twitter" title', id: 100009, base: '/reader/view/feed/http://feedproxy.google.com/TechCrunch', feed_type: 'feed', url: 'http://feedproxy.google.com/TechCrunch', filters: [{type: 'include', item: 'title', content: 'twitter'}] }
  ]


  $.sgr.filtered_feed_item_threshold = 40;
  $.sgr.filter_name_max_display = 30;
  $.sgr.filter_max_fetch_recurse_level = 50;

  // Hash containing filter ID's as the key. filtered_feed_data.items will contain 
  // entry urls as the key. These entries are to be shown (so they are NOT filtered) 
  // for this particular filter.
  //
  $.sgr.filtered_feed_data = {};

  $.sgr.filters_enabled = {};
  $.sgr.filters_by_feed = {};
  $.sgr.filters_by_id = {};
  $.sgr.filters_being_fetched = {};

  $.sgr.initFilters = function() {
    // Fetch the filtered feed or label contents
    //
    $($.sgr.filters).each(function(idx, filter){
      $.sgr.filters_by_id[filter.id] = filter;
      $.sgr.preFetchFilteredContent(filter.id);
      $.sgr.fetchFilteredContent(filter);
    });
  }

  // Clear cached filter feed data
  //
  $.sgr.clearCachedFilterFeedData = function(filter_id) {
    debug("Clearing filter feed data for " + filter_id + ", size = " + (typeof $.sgr.filtered_feed_data[filter_id] != 'undefined' ? $.sgr.filtered_feed_data[filter_id].items.size() : 0));
    if (typeof $.sgr.filtered_feed_data[filter_id] != 'undefined') {
      delete $.sgr.filtered_feed_data[filter_id];
    }
  }

  $.sgr.getCurrentFeedFilters = function() {
    var curr_feed = $.sgr.getCurrentFeedName();
    if (typeof $.sgr.filters_by_feed[curr_feed] != 'undefined') {
      return $.sgr.filters_by_feed[curr_feed];
    }

    $.sgr.filters_by_feed[curr_feed] = [];
    
    $($.sgr.filters).each(function(idx,filter) {
      if (filter.base == curr_feed) {
        $.sgr.filters_by_feed[curr_feed].push(filter);
      }
    });
    return $.sgr.filters_by_feed[curr_feed];
  }

  $.sgr.getCurrentFeedActiveFilters = function() {
    var active_filters_by_feed = [];
    $($.sgr.getCurrentFeedFilters()).each(function(idx,filter) {
      if ($.sgr.isFilterActive(filter.id)) {
        active_filters_by_feed.push(filter);
      }
    });
    return active_filters_by_feed;
  }

  $.sgr.isFilterActive = function(filter_id) {
    return $.sgr.getFilterSetting(filter_id);
  }

  /*
  $.sgr.runFilterEntries = function() {
    $(".entry:not(.sgr-filtered)").each(function(idx,entry) {
      $.sgr.runFilterEntry(entry);
    });
  }
  */

  $.sgr.runFilterEntriesForFilter = function(filter_id) {
    if ($.sgr.canFilterRunForCurrentEntries(filter_id) == false) {
      return false;
    }
    //debug("$.sgr.runFilterEntriesForFilter running for " + $.sgr.filters_by_id[filter_id].base);
    var prev_entry_count = $(".entry:not(." + $.sgr.getFilteredClass(filter_id) + ")").length;
    $(".entry:not(." + $.sgr.getFilteredClass(filter_id) + ")").each(function(idx,entry) {
      if ($.sgr.isEntryFilteredByFilter(filter_id, entry)) {
        //debug("Filter: removed entry:");
        //debug($(entry));
        $.sgr.filterEntry($(entry), filter_id);
      }
    });
    var after_entry_count = $(".entry:not(." + $.sgr.getFilteredClass(filter_id) + ")").length;
    debug("Filtered " + (prev_entry_count - after_entry_count) + " entries from current list");
    $.sgr.triggerGoogleReaderFetchMoreEntries();
  }

  $.sgr.canFilterRunForCurrentEntries = function(filter_id) {
    return $.sgr.filters_by_id[filter_id].base == $.sgr.getCurrentFeedName() && $.sgr.isFilterActive(filter_id) && typeof $.sgr.filtered_feed_data[filter_id] != 'undefined';
  }

  // Check if we need to fetch more filtered entries for the current feed. We
  // need to keep more filtered entries stored so any new entries fetched from
  // scrolling in Google Reader are able to be parsed through any active filters.
  //
  $.sgr.fetchMoreFilteredEntriesForCurrentFeed = function() {
    var filters = $.sgr.getCurrentFeedFilters();

    $(filters).each(function(idx,filter) {
      $.sgr.fetchMoreFilteredEntriesForCurrentFeedFromFilter(filter);
    });
  }

  $.sgr.fetchMoreFilteredEntriesForCurrentFeedFromFilter = function(filter) {
    if ($.sgr.canFilterRunForCurrentEntries(filter.id) == false || $.sgr.isFilterBeingFetched(filter.id)) {
      return false;
    }
    var active_entry_count = $(".entry:not(." + $.sgr.getFilteredClass(filter.id) + ")").length;

    // If we have 75% or more current entries compared to stored filtered entries, get more
    //
    //debug("fetchMoreFilteredEntriesForCurrentFeedFromFilter: active_entry_count * 1.75 = " + (active_entry_count * 1.75) + " vs feed data = " + $.sgr.getFilteredFeedDataItemCount(filter.id));
    if( (active_entry_count * 1.75) >= $.sgr.getFilteredFeedDataItemCount(filter.id)) {
      $.sgr.preFetchFilteredContent(filter.id);
      $.sgr.fetchFilteredContent(filter);
    }
  }

  $.sgr.runFilterEntry = function(entry) {
    var active_filters = $($.sgr.getCurrentFeedActiveFilters());
    active_filters.each(function(idx,filter) {
      if ($.sgr.isEntryFilteredByFilter(filter.id, entry)) {
        $.sgr.filterEntry(entry, filter.id);
        return false;
      }
    });
  }

  $.sgr.filterEntry = function(entry, filter_id) {
    //$("#filtered-entries").append($(entry).addClass("sgr-filtered").addClass($.sgr.getFilteredClass(filter_id)).remove());
    entry.addClass("sgr-filtered").addClass($.sgr.getFilteredClass(filter_id));
    //debug("Entry filtered: " + $.sgr.getEntryUrl(entry));
    //$(entry).remove();
  }

  $.sgr.isEntryFilteredByFilter = function(filter_id, entry) {
    if (typeof $.sgr.filtered_feed_data[filter_id] == 'undefined') {
      return false;
    }
    // If entry is not in the filter data array, it will not be shown. It is being filtered.
    //
    return typeof $.sgr.filtered_feed_data[filter_id].items[$.sgr.getEntryUrl($(entry))] == 'undefined' ? true : false;
  }

  $.sgr.getFilteredFeedDataItemCount = function(filter_id) {
    try {
      return $.sgr.filtered_feed_data[filter_id].items.size();
    } catch(e) {
      return 0;
    }
  }

  $.sgr.getFilterSetting = function(filter_id) {
    var key = $.sgr.getSettingName('filter_' + filter_id, 'global');

    if (typeof $.sgr.filters_enabled[filter_id] != 'undefined') {
      return $.sgr.filters_enabled[filter_id];
    }

    var value = $.stor.get(key);
    if (value == null) {
      $.sgr.filters_enabled[filter_id] = false;
    } else {
      $.sgr.filters_enabled[filter_id] = true;
    }
    return $.sgr.filters_enabled[filter_id];
  }

  $.sgr.setFilterSetting = function(filter_id, setting) {
    var key = $.sgr.getSettingName('filter_' + filter_id, 'global');
    if (setting) {
      $.stor.set(key, true);
      $.sgr.filters_enabled[filter_id] = true;
    } else {
      $.stor.remove(key);
      if ($.sgr.filters_enabled[filter_id]) {
        $.sgr.filters_enabled[filter_id] = false;
      }
    }

  }

  $.sgr.getFilterIdFromLink = function(link_el) {
    return $(link_el).attr('href').match(/\/([0-9]*$)/)[1];
  }

  $.sgr.toggleFilter = function(filter_id) {
    if ($.sgr.isFilterActive(filter_id)) {
      $.sgr.disableFilter(filter_id);
    } else {
      $.sgr.enableFilter(filter_id);
    }
  }

  $.sgr.enableFilter = function(filter_id) {

    $("#sgr-filter-nav-" + filter_id).addClass("sgr-filter-nav-active");

    $.sgr.setFilterSetting(filter_id, true);

    //$.sgr.scrollTo($(".entry:last"));
    //$.sgr.scrollTo($(".entry:first"));
    // Loop all displayed entries to filter as necessary
    //
    //debug($.sgr.filtered_feed_data[filter_id]);
    $.sgr.runFilterEntriesForFilter(filter_id);
    //debug(remaining_entries_count);
    //debug($("#entries").outerHeight());
    //debug($("#entries").height());
    //debug($("#entries"));
  }

  $.sgr.disableFilter = function(filter_id) {
    if (typeof filter_id == 'undefined' || filter_id == null) {
      return false;
    }

    $("#sgr-filter-nav-" + filter_id).removeClass("sgr-filter-nav-active");

    $.sgr.setFilterSetting(filter_id, false);

    var added_count = 0 ;

    // Loop all displayed entries to remove this filter as necessary
    //
    $(".entry").each(function(idx,entry) {
      var entry = $(entry);
      if (entry.hasClass($.sgr.getFilteredClass(filter_id))) {
        entry.removeClass($.sgr.getFilteredClass(filter_id));

        var found_another_filter = false;
        $(entry.attr('class').split(/\s+/)).each(function(idx2,class_name) {
          if (class_name.substr(0,'sgr-filtered-by-'.length) == 'sgr-filtered-by-') {
            found_another_filter = true;
            return false;
          }
        });
        if (found_another_filter == false) {
          added_count += 1;
          entry.removeClass('sgr-filtered');
        }
      }
    });
    debug("Added " + added_count + " entries");
  }

  $.sgr.triggerGoogleReaderFetchMoreEntries = function() {
    var entry_count = $(".entry:not(.sgr-filtered)").length;
    var entry_height = $(".entry:first").outerHeight();


    if (typeof entry_count == 'undefined' || entry_count == null) {
      entry_count = 0;
    }
    if (typeof entry_height == 'undefined' || entry_height == null || entry_height <= 0) {
      entry_height = 26;
    }

    //debug(entry_height);
    //debug(entry_count);
    //debug($("#entries").outerHeight());
    //debug($("#entries").height());
    // If we have no active entries, briefly enable an entry to fake it so the scroll
    // can be triggered.
    //
    var entry_fake = false;
    if (entry_count == 0) { // || entry_count == 1) {
      entry_fake = true;
      entry_count = 1;
      $(".sgr-filtered:lt(1)").removeClass("sgr-filtered");
      debug("fake");
    }
    if ((($("#entries").outerHeight() / entry_height) + 5) >= entry_count) {
      //debug("here");
      var prev_entries_height = $("#entries").height();
      $("#entries").height(entry_height / 2);
      //$.sgr.scrollTo($(".entry:last"));
      //debug($(".entry:last").attr("offsetTop"));
      //debug(entry_height);
      $("#entries").scrollTop($(".entry:last").attr("offsetTop") + entry_height);
      //debug( $("#entries").scrollTop());
      $.sgr.scrollTo($(".entry:first"));
      //debug($("#entries").height());
      $("#entries").height(prev_entries_height);
    }
    if (entry_fake) {
      $(".entry:not(.sgr-filtered):first").addClass("sgr-filtered");
    }
  }

  $.sgr.getFilteredClass = function(filter_id) {
    return 'sgr-filtered-by-' + filter_id;
  }

  /*
  $.sgr.displayFilteredEntries = function(filter_id) {
    if (typeof $.sgr.filtered_feed_data[filter_id] == 'undefined') {
      // FIXME go fetch the data?
      return false;
    }
    debug("Displaying filter " + filter_id);

    $.sgr.prepFilteredEntriesDisplay($.sgr.filtered_feed_data[filter_id]);

    $($.sgr.filtered_feed_data[filter_id].items).each(function(idx,item) {
      $.sgr.insertNewEntry(item);
    });
  }

  $.sgr.prepFilteredEntriesDisplay = function(feed) {
    if ($("#chrome-orig").length <= 0) {
      var c = $("#chrome").clone();
    } else {
      var c = $("#chrome");
    }

    c.find('#entries').empty();
    c.find("#chrome-title a").html(feed._sgr_filter.name + ' <span class="chevron">&#0187;</span>').attr('href',feed._sgr_site);

    if ($("#chrome-orig").length <= 0) {
      $("#chrome").after(c);
      $("#chrome").attr('id','chrome-orig').find("#viewer-container").attr('id','viewer-container-orig').find('#entries').attr('id','entries-orig');
    }
  }

  */

  // FIXME need to fetch the feed only once per filter.base and cache it so all filters
  // for that filter.base can re-use it.
  //
  $.sgr.fetchFilteredContent = function(filter, filtered_feed_item_threshold) {

    //debug("fetchFilteredConten() start");

    $.sgr.flagFilterBeingFetched(filter.id, true);

    if ($.sgr.isFilterfetchRecusiveCountAboveMax(filter.id)) {
      debug(filter.id + " filter_max_fetch_recurse_level hit, no more fetching allowed");
      return false;
    }

    if ($.sgr.filtered_feed_data[filter.id]) {
      filter.continuation = $.sgr.filtered_feed_data[filter.id].continuation;
      if (typeof filtered_feed_item_threshold == 'undefined') {
        //filtered_feed_item_threshold += $.sgr.filtered_feed_data[filter.id].items.length;
        //filtered_feed_item_threshold = $.sgr.getFilteredFeedDataItemCount(filter.id);
        filtered_feed_item_threshold = $.sgr.filtered_feed_item_threshold + $.sgr.getFilteredFeedDataItemCount(filter.id);
      }
    }

    if (typeof filtered_feed_item_threshold == 'undefined') {
      filtered_feed_item_threshold = $.sgr.filtered_feed_item_threshold;
    }

    var api_contents_url = $.sgr.gr_api['contents'] + filter.url + '?r=n&client=sgr&n=100&ck=' + (new Date()).getTime() + (filter.continuation ? '&c=' + filter.continuation : '');
    //debug(api_contents_url);
    debug(filter.id + " " + filter.continuation);

    $.ajax({
      url: api_contents_url,
      dataType: 'json',
      success: function(feed_data) {
        //debug("Success : " + api_contents_url + ", time=" + (new Date()).getTime());
        //debug(feed_data);
        if (typeof $.sgr.filtered_feed_data[filter.id] == 'undefined') {
          $.sgr.filtered_feed_data[filter.id] = {};
          $.sgr.filtered_feed_data[filter.id].items = {};
          $.sgr.filtered_feed_data[filter.id].recurse_count = 0;
          //$.sgr.filtered_feed_data[filter.id] = jQuery.extend(true, {}, feed_data);
          //$.sgr.filtered_feed_data[filter.id].items = [];
          //$.sgr.filtered_feed_data[filter.id]._sgr_filter = filter;
        }
        $.sgr.filtered_feed_data[filter.id].continuation = feed_data.continuation;
        //$.sgr.filtered_feed_data[filter.id].updated = feed_data.updated;

        var included_item_count = 0;
        var excluded_item_count = 0;

        $(feed_data.items).each(function(idx, item){
          var add_feed_item_count = 0;
          $(filter.filters).each(function(idx2, _filter){
//debug("_filter=");
//debug(_filter);
            var check_fields = [];
            if ((_filter.item == 'post' || _filter.item == 'author') && typeof item.author != 'undefined' ) {
              check_fields.push(item.author);
            }
            if ((_filter.item == 'post' || _filter.item == 'summary') && typeof item.summary != 'undefined' && typeof item.summary.content != 'undefined' ) {
              check_fields.push($.sgr.stripHtml(item.summary.content));
            }
            if ((_filter.item == 'post' || _filter.item == 'categories') && typeof item.categories != 'undefined' ) {
              $(item.categories).each(function(idx4, category){
                if (category.match(/^(?!user\/)/) != null) {
                  check_fields.push(category);
                }
              });
            }
            if ((_filter.item == 'post' || _filter.item == 'content') && typeof item.content != 'undefined' && typeof item.content.content != 'undefined' ) {
              check_fields.push($.sgr.stripHtml(item.content.content));
            }
            if ((_filter.item == 'post' || _filter.item == 'title') && typeof item.title != 'undefined' ) {
              check_fields.push(item.title);
            }
//debug("check_fields=");
//debug(check_fields);
            var num_matches_found = 0;
            $(check_fields).each(function(idx3,check_field){
              //type_filter = _filter.type == 'include' ? '' : '?!';
              var re = new RegExp('(' + _filter.content +')', 'i');
//debug("re=");
//debug(re);
              if (check_field.match(re) != null) {
                //debug("check_field match : " + item.id + " : " + re + " : " + check_field);
                if (_filter.type == 'include') {
                  add_feed_item_count += 1;
                  return false;
                } else {
                  //debug("check_field match : " + re + " : " + check_field);
                  return false;
                }
              } else if (_filter.type == 'exclude') {
                //debug("check_field no match : " + re + " : " + check_field);
                num_matches_found += 1;
              }
            });
            //debug("num_matches_found=" + num_matches_found + ", check_fields.length=" + check_fields.length);
            if (_filter.type == 'exclude' && num_matches_found == check_fields.length) {
              add_feed_item_count += 1;
            } else {
//debug("excluding:");
//debug(item);
            }
          });
          if (add_feed_item_count >= filter.filters.length) {
//debug("not excluding:");
//debug(item);
            included_item_count += 1;
            //$.sgr.filtered_feed_data[filter.id].items.push($.sgr.cleanFilteredFeedItem(item));
            $.sgr.filtered_feed_data[filter.id].items[item.alternate[0].href] = true;
          } else {
            excluded_item_count += 1;
//debug("excluding:");
//debug(item);
          }
        });
        debug("FILTER: " + filter.id + " " + feed_data.title + " " + filter.name + " : Included " + included_item_count + " items, Excluded " +excluded_item_count+" items. Total included: " + $.sgr.getFilteredFeedDataItemCount(filter.id) + ". new_feed_data=");
        debug($.sgr.filtered_feed_data[filter.id]);

        // Recurse if items are below threshold
        //
        debug(filter.id + " $.sgr.getFilteredFeedDataItemCount() = " + $.sgr.getFilteredFeedDataItemCount(filter.id) + ", filtered_feed_item_threshold = " + filtered_feed_item_threshold);

        if ($.sgr.getFilteredFeedDataItemCount(filter.id) < filtered_feed_item_threshold) {
          $.sgr.setFilteredFetchRecurseCounter(filter.id, $.sgr.getFilteredFetchRecurseCounter(filter.id) + 1);
          debug(filter.id + " *RECURSE* to $.sgr.fetchFilteredContent(). Recurse count = " + $.sgr.getFilteredFetchRecurseCounter(filter.id));
          $.sgr.fetchFilteredContent(filter, filtered_feed_item_threshold);
        }

        $.sgr.runFilterEntriesForFilter(filter.id);
      },

      complete: function() {
        $.sgr.flagFilterBeingFetched(filter.id, false);
      }
    });
  }
    
  $.sgr.preFetchFilteredContent = function(filter_id) {
    if ($.sgr.isFilterfetchRecusiveCountAboveMax(filter_id) == false) {
      $.sgr.setFilteredFetchRecurseCounter(filter_id, 0);
    }
  }

  $.sgr.isFilterfetchRecusiveCountAboveMax = function(filter_id) {
    return $.sgr.getFilteredFetchRecurseCounter(filter_id) >= $.sgr.filter_max_fetch_recurse_level;
  }

  $.sgr.setFilteredFetchRecurseCounter = function(filter_id, value) {
    if (typeof  $.sgr.filtered_feed_data[filter_id] == 'undefined') {
      return;
    }
    $.sgr.filtered_feed_data[filter_id].recurse_count = value;
  }

  $.sgr.getFilteredFetchRecurseCounter = function(filter_id) {
    return typeof $.sgr.filtered_feed_data[filter_id] == 'undefined' ? 0 : $.sgr.filtered_feed_data[filter_id].recurse_count;
  }

  $.sgr.isFilterBeingFetched = function(filter_id) {
    return typeof $.sgr.filters_being_fetched[filter_id] != 'undefined';
  }

  $.sgr.flagFilterBeingFetched = function(filter_id, being_fetched) {
    if (being_fetched) {
      $.sgr.filters_being_fetched[filter_id] = true;
    } else {
      delete $.sgr.filters_being_fetched[filter_id];
    }
  }

  $.sgr.cleanFilteredFeedItem = function(item) {
    // Add a snippet for display in List view
    //
    if (typeof item.summary != 'undefined' && typeof item.summary.content != 'undefined') {
      item._sgr_snippet = $.trim($.sgr.stripHtml(item.summary.content));
    } else if (typeof item.content != 'undefined' && typeof item.content.content != 'undefined') {
      item._sgr_snippet = $.trim($.sgr.stripHtml(item.content.content).substr(0,255));
    } else {
      item._sgr_snippet = '';
    }

    // Find main entry content
    //
    if (typeof item.content != 'undefined' && typeof item.content.content != 'undefined') {
      item._sgr_content = item.content.content;
    } else if (typeof item.summary != 'undefined' && typeof item.summary.content != 'undefined') {
      item._sgr_content = item.summary.content;
    } else {
      item._sgr_content = '';
    }

    // Flag entry as read or not
    //
    $(item.categories).each(function(idx,category) {
      if (category == $.sgr.getReadCategory()) {
        item._sgr_read = true;
        return false;
      } else {
        item._sgr_read = false;
      }
    });

    return item;
  }

  $.sgr.getReadCategory = function() {
    return 'user/' + $.sgr.USER_ID + '/state/com.google/read';
  }

  // Main run of all code
  //
  $.sgr.run = function() {

    if ($.sgr.canRun() == false) {
      return;
    }

    $.sgr.initSettings();

    $.sgr.initStyles();

    $.sgr.initMainWindowEvents();

    $.sgr.initSettingsWindow();

    $.sgr.initFilters();

    /*
    var d = new Date();
    //var feed = $.sgr.getCurrentFeedName(true);
    var feed = 'http://feeds.news.com.au/public/rss/2.0/heraldsun_afl_geelong_559.xml';
    //var feed = 'http://feedproxy.google.com/TechCrunch';
    var api_contents_url = $.sgr.gr_api['contents'] + feed + '?r=n&client=sgr&n=50&ck=' + d.getTime();
    debug(api_contents_url);
    $.ajax({
      url: api_contents_url,
      dataType: 'json',
      success: function(feed_data) {
        debug(feed_data);
        var exclude_list = [];
        var c = $("#chrome").clone();
        //entries.empty().css({position: 'relative', 'z-index': '100'}).find('.same-dir').css('position','absolute');
        //$("#chrome-viewer-container").remove();
        c.find('#entries').empty();
        debug(c);
        $("#chrome").after(c);

        $("#chrome").attr('id','chrome-orig').css({position:'absolute', left:'-9999px'}).find("#viewer-container").attr('id','viewer-container-orig').find('#entries').attr('id','entries-orig');

        $(feed_data.items).each(function(idx){
          if(this.summary.content && this.summary.content.match(/coach/)) {
            //debug(idx + " " + this.summary.content);
            this.sgr_match = true;
            $.sgr.insertNewEntry(this);
          } else {
            //exclude_list.push(idx);
          }
        });
        //debug(exclude_list);
        //$(exclude_list).each(function(){
          //feed_data.items.remove(this);
        //});
      }
    });
    */
  }

})(jQuery);


