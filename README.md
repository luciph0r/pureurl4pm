<h2>Pure URL for Palemoon</h2>

Strips garbage referer tracking fields like 'utm_source' from links. This is forked from the <a href="https://addons.mozilla.org/en-US/firefox/addon/pure-url/">original Firefox extension</a>. Pale Moon users can install the latest version directly from <a href="https://addons.mozilla.org/en-US/firefox/addon/pure-url/">here.</a>

By default it removes the most common tracking parameters like `utm_source`, you can customize it by adding your own in the Garbage fields list' in extension settings. This is a comma separated list where each field shown is automatically removed from all URLs. You can include domain specific filters, for example `fbclid@facebook.com` will only remove the parameter `fbclid` from the Facebook domain but allow it elsewhere. 
