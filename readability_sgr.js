
readability.strip_tags_with_closing = ['head', 'script', 'style', 'button', 'select', 'iframe'];
readability.strip_tags_no_closing = ['meta', 'input', 'hr', 'link'];

readability.sgr_keep_attributes = {
          'a'          : ['href', 'title'],
          'img'        : ['alt', 'src', 'title'],
          'table'      : ['cellpadding', 'cellspacing', 'border'],
          'object'     : '__ALL__',
          'embed'      : '__ALL__',
          'param'      : '__ALL__',
          'video'      : '__ALL__',
          'audio'      : '__ALL__',
          'area'       : ['alt', 'shape', 'coords', 'href']
}

readability['sgrInit'] = function(content) {

//(/<script.*?>.*?<\/script>/gi

  content = content.replace(/\n/g,'\uffff');

  $.each(readability.strip_tags_with_closing, function(){
    var regex = new RegExp("<" + this + ".*?>.*?<\\/" + this + ">", "gi");
//debug(regex);
    content = content.replace(regex,'');
  });
//debug(content);

  $.each(readability.strip_tags_no_closing, function(){
    var regex = new RegExp("<" + this + ".*?>", "gi");
//debug(regex);
    content = content.replace(regex,'');
  });
//debug(content);

  return content.
        replace(/<!--.*?-->/gi, '').
        replace(/\uffff/g,'\n').
        replace(/<(\/?)noscript/gi, '<$1div').
        replace(readability.regexps.replaceBrs, '</p><p>').
        replace(readability.regexps.replaceFonts, '<$1span>');
}

readability['sgrPostProcess'] = function(content, entry_url) {
  var jq_content = $(content);

  // Process HTML attributes
  //

  // Loop each HTML element
  //
  jq_content.find("*").each(function(i, el) {
    var _el = this;
    var remove_attrs = [];

    // Loop each HTML element's attributes
    //
    $.each(el.attributes, function(j, attrib){
      if (typeof attrib == 'undefined') {
        return;
      }
      var el_name = el.tagName.toLowerCase();
      var el_attr_keep = readability.sgr_keep_attributes[el_name];

      // @TODO whitelist support for specific style params

      // If the attribute is not on the whitelist, flag it for removal
      //
      if (el_attr_keep == null || (el_attr_keep != '__ALL__' && jQuery.inArray(attrib.name.toLowerCase(), el_attr_keep) <= -1)) {
        //debug("ATTR: Logging remove of " + attrib.name + " from " + el_name);
        remove_attrs.push(attrib.name);

      // If the attribute is a relative href or src value, make it absolute
      //
      } else if ($.inArray(attrib.name,["href", "src"]) > -1) {
        //debug(attrib.value);

        // If href or src is a javascript call, remove it
        //
        if (attrib.value.match(/^javascript/ig)) {
          $(_el).attr(attrib.name, "");

        } else if (attrib.value[0] == "/") {
          debug("ATTR : changing " + attrib.name + " for " + el_name + " from " + attrib.value + " to " + $.sgr.getBaseUrl(entry_url) + attrib.value);
          $(_el).attr(attrib.name, $.sgr.getBaseUrl(entry_url) + attrib.value);

        } else if (attrib.name == 'src' && attrib.value.substr(0,4) != "http") {
          debug("ATTR : changing " + attrib.name + " for " + el_name + " from " + attrib.value + " to " + $.sgr.getBaseUrlWithPath(entry_url) + attrib.value);
          $(_el).attr(attrib.name, $.sgr.getBaseUrlWithPath(entry_url) + attrib.value);
        }
        //debug(attrib.value);
      }
    });

    // Remove any attributes not whitelisted
    //
    for (var k = 0; k < remove_attrs.length; k++) {
      //debug("ATTR: Removing " + remove_attrs[k] + " from " + _el.tagName);
      $(_el).removeAttr(remove_attrs[k]);
    }
  });

  // Rewrite any relative img src paths to be absolute
  //
/*
  jq_content.find("img, a").each(function(){
    var el_name = this.tagName.toLowerCase();
    if (el_name == "img" && $(this).attr('src')[0] == '/') {
      //debug($(this).attr('src'));
       $(this).attr('src',$.sgr.getBaseUrl(entry_url) + $(this).attr('src'));
      //debug($(this).attr('src'));
    } else if (el_name == "a" && $(this).attr('href')[0] == '/') {
      debug($(this).attr('href'));
       $(this).attr('href',$.sgr.getBaseUrl(entry_url) + $(this).attr('href'));
      debug($(this).attr('href'));
    }
  });
*/
  //debug(jq_content.html());
  return jq_content.html();
}

