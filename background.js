(function($) {

/* 
// to send a message to a content script
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendRequest(tab.id, {greeting: "hello"}, function(response) {
      console.log(response.farewell);
    });
  });
*/


  chrome.extension.onRequest.addListener(
    function(request, sender, sendResponse) {
      debug("background.js : received request, request.action = " +request.action);

      // Iframe window height
      //
      if (request.action == 'window_height') {
        sendResponse({_msg: "action " + request.action + ", window height " + request.window_height});
        $.sgr.sendToCurrentTab({action: 'set_window_height', window_height: request.window_height});

      // Fetch readable content
      //
      } else if (request.action == 'readability_fetch') {
        //sendResponse({_msg: "action : " + request.action});

        var stor_url_key = $.sgr.getReadabilityContentStorageKey(request.readability_url, request.extra_data.user_id);
        var stored_content = $.stor.get(stor_url_key);

        // Use cached content if it exists
        //
        if (stored_content !== null && stored_content.length > 0 && stored_content != 'none') {
          sendResponse($.extend({action: 'readability_content', readability_content: stored_content, _msg: (request.extra_data.pre_fetch ? "[PRE-FETCH] " : "") + "Cached content found for " + request.readability_url},request.extra_data));

        // PDF, PPT in Google Docs
        //
        } else if ($.sgr.matchUrlExtension(request.readability_url, ['pdf', 'ppt'])) {
          var content = '<iframe id="google_doc_iframe" scrolling="no" width="100%" height="' + $.sgr.minimum_iframe_height_str + '" src="http://docs.google.com/gview?embedded=true&url=' + request.readability_url + '" class=""></iframe>';
          sendResponse($.extend({action: 'readability_content', readability_content: content, _msg: "Google docs content found for " + request.readability_url},request.extra_data));

        } else if (stored_content == 'none') {
          sendResponse($.extend({action: 'readability_error_use_original_content', _msg: "No content found (cached) for " + request.readability_url},request.extra_data));

        } else {
          $.sgr.fetchReadableContent(request.readability_url, sendResponse, sendResponse, request.extra_data);
        }

      // Global setting change from settings iframe
      //
      } else if (request.action == 'global_setting_change') {
        $.sgr.sendToCurrentTab({action: 'global_setting_change', setting_name: request.setting_name, setting_value: request.setting_value});
      } else {
        sendResponse({}); // snub them.
      }
    });

})(jQuery);
