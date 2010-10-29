
readability.sgr_strip_tags_with_closing = ['head', 'script', 'style', 'button', 'select', 'iframe'];
readability.sgr_strip_tags_no_closing = ['meta', 'input', 'hr', 'link'];

readability.sgr_attribute_whitelist = ['table', 'div', 'td', 'tr', 'tbody', 'thead', 'tfoot', 'th', 'col', 'colgroup', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'dl', 'dd', 'a', 'img', 'object', 'embed', 'video', 'audio', 'pre', 'center', 'form', 'em', 'strong', 'abbr', 'sup', 'br', 'cite', 'code', 'param', 'i', 'b', 'blockquote', 'canvas', 'svg', 'header', 'hgroup', 'nav', 'section', 'article', 'aside', 'footer', 'source', 'font'];

readability.sgr_keep_attributes = {
          'a'          : ['href', 'title'],
          'img'        : ['alt', 'src', 'title', 'sgr-src'],
          'table'      : ['cellpadding', 'cellspacing', 'border'],
          'object'     : '__ALL__',
          'embed'      : '__ALL__',
          'param'      : '__ALL__',
          'video'      : '__ALL__',
          'audio'      : '__ALL__',
          'source'     : '__ALL__',
          'area'       : ['alt', 'shape', 'coords', 'href']
}

readability.sgr_anchor_filters = [
        /^http(?:s|)\:\/\/(?:www\.|)del\.icio\.us\/post/,
        /^http(?:s|)\:\/\/(?:www\.|)(digg|reddit|stumbleupon)\.com\/submit/,
        /^http(?:s|)\:\/\/(?:www\.|)facebook\.com\/sharer\.php/,
        /^http(?:s|)\:\/\/(?:www\.|)twitter\.com\/home\?status=/,
        /^http(?:s|)\:\/\/(?:www\.|)google\.com\/buzz\/post/,
];


readability.sgr_article_title = null;

readability.sgr_filtered_elements = [];


readability['sgrGetArticleTitle'] = function(content) {

  var curTitle = null;
  var origTitle = null;

  try {
    curTitle = origTitle = content.match(/<title.*?>(.*?)<\/title>/im)[1];
  } catch(e) {
    debug("Title match error. " + e.name + ": " + e.message);
  }

  if (curTitle == null) {
    debug("readability_sgr : no article title found.");
    return null;
  }

  if(curTitle.match(/ [\|\-] /))
  {
      curTitle = origTitle.replace(/(.*)[\|\-] .*/gi,'$1');
      
      if(curTitle.split(' ').length < 3) {
          curTitle = origTitle.replace(/[^\|\-]*[\|\-](.*)/gi,'$1');
      }
  }
  else if(curTitle.indexOf(': ') !== -1)
  {
      curTitle = origTitle.replace(/.*:(.*)/gi, '$1');

      if(curTitle.split(' ').length < 3) {
          curTitle = origTitle.replace(/[^:]*[:](.*)/gi,'$1');
      }
  }
  else if(curTitle.length > 150 || curTitle.length < 15)
  {
      //var hOnes = page.getElementsByTagName('h1');
      //if(hOnes.length == 1)
      //{
          //curTitle = readability.getInnerText(hOnes[0]);
      //}
  }

  curTitle = curTitle.replace( readability.regexps.trim, "" );

  if(curTitle.split(' ').length <= 4) {
      curTitle = origTitle;
  }

  if (curTitle.length <= 0) {
    curTitle = null;
  }

  return curTitle.replace(/\uffff/g,'');
}

readability['sgrInit'] = function(content) {

//(/<script.*?>.*?<\/script>/gi

  content = content.replace(/\n/g,'\uffff');

  readability.sgr_article_title = readability.sgrGetArticleTitle(content);

  $.each(readability.sgr_strip_tags_with_closing, function(){
    var regex = new RegExp("<" + this + ".*?>.*?<\\/" + this + ">", "gi");
    content = content.replace(regex,'');
  });

  $.each(readability.sgr_strip_tags_no_closing, function(){
    var regex = new RegExp("<" + this + ".*?>", "gi");
    content = content.replace(regex,'');
  });

  return content.
        replace(/<!--.*?-->/gmi, '').
        replace(/<img.*?src=("|')(.*?)("|')/gi, '<img src="" sgr-src="$2"').
        replace(/\uffff/g,'\n').
        replace(/<(\/?)noscript/gi, '<$1div').
        replace(readability.regexps.replaceBrs, '</p><p>').
        replace(readability.regexps.replaceFonts, '<$1span>');
}

readability['sgrPostProcess'] = function(content, entry_url) {
  try {
    var jq_content = $(content);
  } catch(e) {
    debug("readability_sgr : html unable to be parsed by jquery. " + e.name + ": " +e.message);
    return;
  }


  // Process HTML attributes
  //

  // Loop each HTML element
  //
  jq_content.find("*").each(function(i, el) {
    try {
      var _el = $(this);
    } catch(e) {
      debug("sgrPostProcess: jQuery unable to parse " + el.tagName +". Skipping it.");
      return;
    }
    var remove_attrs = [];

    var el_name = el.tagName.toLowerCase();

    if (jQuery.inArray(el_name, readability.sgr_attribute_whitelist) <= -1) {
      //debug("sgrPostProcess: replacing non-whitelist element " + el.tagName );
      _el.replaceWith("<span>" + _el.text() + "</span>");
      //remove_els.push(el);
      return;
    }

    //debug(el_name);
    // Loop each HTML element's attributes
    //
    $.each(el.attributes, function(j, attrib){
      if (typeof attrib == 'undefined') {
        return;
      }
      //debug(el_name + " : " + attrib.name);
      var el_attr_keep = readability.sgr_keep_attributes[el_name];

      // @TODO whitelist support for specific style params

      // If the attribute is not on the whitelist, flag it for removal
      //
      if (el_attr_keep == null || (el_attr_keep != '__ALL__' && jQuery.inArray(attrib.name.toLowerCase(), el_attr_keep) <= -1)) {
        //debug("ATTR: Logging remove of " + attrib.name + " from " + el_name);
        remove_attrs.push(attrib.name);

      // If the attribute is a relative href or src value, make it absolute
      //
      } else if ($.inArray(attrib.name,["href", "sgr-src", "src"]) > -1) {
        //debug(attrib.value);

        try {
          _el.attr(attrib.name);
        } catch(e) {
          debug("sgrPostProcess: jQuery unable to parse " + el.tagName +".attr(" + attrib.name + "). Skipping it.");
          return;
        }
        // If href or src is a javascript call, remove it
        //
        if (attrib.value.match(/^javascript/ig)) {
          _el.attr(attrib.name, "");

        } else if (attrib.value[0] == "/") {
          //debug("ATTR : changing " + attrib.name + " for " + el_name + " from " + attrib.value + " to " + $.sgr.getBaseUrl(entry_url) + attrib.value);
          _el.attr(attrib.name, $.sgr.getBaseUrl(entry_url) + attrib.value);

        } else if (attrib.value.length > 0 && attrib.value.substr(0,4) != "http") {
          //debug("ATTR : changing " + attrib.name + " for " + el_name + " from " + attrib.value + " to " + $.sgr.getBaseUrlWithPath(entry_url) + attrib.value);
          _el.attr(attrib.name, $.sgr.getBaseUrlWithPath(entry_url) + attrib.value);
        }

        //debug(attrib.value);
      }
    });

    //debug(el_name + " : attr loop finished");

    // Remove any attributes not whitelisted
    //
    for (var k = 0; k < remove_attrs.length; k++) {
      //debug("ATTR: Removing " + remove_attrs[k] + " from " + _el.get(0).tagName);
      try {
        _el.removeAttr(remove_attrs[k]);
      } catch(e) {
        debug("sgrPostProcess: ATTR (" + remove_attrs[k] + ") unable to be removed for " + el_name +". Skipping it. Error was " + e.name + " : " + e.message);
      }
    }
    //debug(el_name + " : main loop finished");
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
  if (readability.sgr_article_title != null && jq_content.html().length > 0) {
    //debug("readability_sgr : adding title: " + readability.sgr_article_title);
    jq_content.prepend('<h2 class="sgr-entry-heading">' + readability.sgr_article_title + '</h2>');
  }
  return jq_content.html();
}


readability['sgrAddFilteredElement'] = function(el) {
  readability.sgr_filtered_elements.push(el);
}


readability['sgrRemoveFilteredElements'] = function(content) {
  readability.sgr_filtered_elements.reverse();

  debug("sgrRemoveFilteredElements:");
  debug($(readability.sgr_filtered_elements));

  $(readability.sgr_filtered_elements).each(function(idx,el){
    content.innerHTML = content.innerHTML.replace($('<div>').append(el.clone()).html(),'');
  });
}

/**
 * Filter anchor tags based on a whitelist of href values. Remove anchor tags
 * that match this whitelist.
 *
 * @package SGR
 *
 * @param Element
 * @return void
**/
readability['sgrFilterAnchor'] = function(anchor) {
  if (anchor.length <= 0) {
    return;
  }
  var filtered = false;

  // Loop our anchor tag filter regexp's and remove anchor tags that match
  //
  $(readability.sgr_anchor_filters).each(function(idx, filter) {
    if (anchor.attr('href').match(filter) != null) {
      //anchor.remove();
      filtered = true;
      return false;
    }
  });
  return filtered;
}


/**
 * If an element is about to be deleted, perform a last final check to see if it
 * should be saved. Look specifically for images without "a" tags as parents.
 *
 * @package SGR
 *
 * @param Element
 * @return boolean
**/
readability['sgrSaveElement'] = function(e) {
  // SGR : If this is a div, try not to remove images relevant to the article that
  // happen to be wrapped in a div. Loop all images and keep those not in an "a" tag.
  //
  var save = false;

  if (e.tagName == 'DIV' && typeof jQuery != 'undefined') {

    var jq_el = $(e);
    debug($("<div>").append(jq_el.clone()).html());

    var filtered = false;

    // Find and remove any anchor tags with images that are deemed unworthy;
    // these are mostly social media site submission links.
    //
    jq_el.find("img").each(function(idx,image) {
      if (readability.sgrFilterAnchor($(image).parent("a"))) {
        filtered = true;
        readability.sgrAddFilteredElement(jq_el);
        return false;
      }
    });

    // Save if not flagged as needing to be filtered, and it has remaining images present
    //
    if (filtered == false && jq_el.find("img").length > 0) {
      dbg("*** Saving element: " + e.className + ":" + e.id);
      save = true;
    }
    if (filtered) {
      dbg("### Filtering (removing) : " + e.className + ":" + e.id);
      save = true;
    }

  }
  return save;
}

