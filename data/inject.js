(function(){

if (!document.body || typeof unsafeWindow.pureurljs !== 'undefined') return;
unsafeWindow.pureurljs = true;

var GarbageFields = function(config)
{
	this.ok = false;
	this.db = {'*': []};
	this.no_locals = true;
	this.regexps = {'*': null};

	//
	// Returns a proper regular expression for a host
	this.getRegExp = function(domain)
	{
		if (this.no_locals)
		{
			return this.regexps['*'];
		}

		if (this.regexps.hasOwnProperty(domain))
		{
			return (typeof this.regexps[domain] === 'string') ? this.regexps[this.regexps[domain]] : this.regexps[domain];
		}

		var fields = this.db['*'];
		var subdomain = (domain !== undefined) ? domain : '';
		var store_as = null;
		var stored = false;
		while (subdomain)
		{
			if (this.db.hasOwnProperty(subdomain))
			{
				if (!store_as)
				{
					store_as = subdomain;
					if (this.regexps.hasOwnProperty(store_as))
					{
						stored = true;
						break;
					}
				}
				fields = fields.concat(this.db[subdomain]);
			}
			var dotpos = subdomain.indexOf('.');
			subdomain = (dotpos === -1) ? '' : subdomain.substring(dotpos+1);
		}

		if (store_as)
		{
			if (!stored)
			{
				this.regexps[store_as] = new RegExp('(^|&)(' + fields.join('|') + ')=[^&#]*', 'ig');
			}
			if (store_as !== domain)
			{
				this.regexps[domain] = store_as;
			}
		}
		else
		{
			if (!this.regexps['*'] && this.db['*'].length)
			{
				// Prepare the global fields regexp
				this.regexps['*'] = new RegExp('(^|&)(' + this.db['*'].join('|') + ')=[^&#]*', 'ig');
			}
			this.regexps[domain] = (fields.length === 0) ? null : '*';
		}

		return (typeof this.regexps[domain] === 'string') ? this.regexps[this.regexps[domain]] : this.regexps[domain];
	};

	//
	// Parse fields string
	this.add = function(newval)
	{
		if (typeof newval !== 'string' || !newval) return;

		// Filter illegal symbols and split fields
		newval = newval.replace(/[^-._@\d\w]+/ig, ' ').replace(/[\s]{2,}/g, ' ').replace(/(^[\s]+|[\s]+$)/g, '').split(' ');

		// Parse each field
		newval.forEach(function(field)
		{
			// Split and remove empty hosts
			var parts = field.split('@').filter(function(val, idx){ return !!val || idx === 0; });

			// Skip if field isn't present
			parts[0] = parts[0].replace(/[^_\d\w]+/ig, '');
			if (!parts[0]) return;

			// Add to global or local list
			this.ok = true;
			if (parts.length === 1)
			{
				if (this.db['*'].indexOf(parts[0]) === -1)
				{
					this.db['*'].push(parts[0]);
				}
			}
			else for (var i = 1; i < parts.length; i++)
			{
				parts[i] = parts[i].toLowerCase();
				if (this.db[parts[i]] === undefined)
				{
					this.no_locals = false;
					this.db[parts[i]] = [];
				}
				if (this.db[parts[i]].indexOf(parts[0]) === -1)
				{
					this.db[parts[i]].push(parts[0]);
				}
			}
		}, this);

		// Reset regexps cache
		this.regexps = {'*': null};
	}

	//
	// Read configuration
	if (typeof config === 'undefined' || !config) return;

	if (typeof config === 'string')
	{
		this.add(config);
	}
	else if (typeof config === 'object')
	{
		// We have already parsed fields
		this.ok = true;
		this.db = config;
		this.no_locals = false;
		var entries = Object.getOwnPropertyNames(this.db);
		if (entries.length === 1)
		{
			this.no_locals = (entries[0] === '*');
		}
		if (typeof this.db['*'] === 'undefined')
		{
			this.db['*'] = [];
		}
	}
};

if (!self.options.gfields_db) return;
var gfields = new GarbageFields(self.options.gfields_db);

var checked_links = {};

var fix_links = function(root)
{
	if (typeof(root) === 'undefined' || !(root instanceof Element))
	{
		return;
	}

	var els = root.nodeName.toLowerCase() === 'a' ? [root] : root.querySelectorAll('a[href]');

	for (var i = 0; i < els.length; i++)
	{
		var el = els[i];
		var href = el.href;
		var host = el.host;
		if (!host) continue;
		var qpos = href.indexOf('?');
		if (qpos === -1 || checked_links.hasOwnProperty(href)) continue;

		var args = href.substring(qpos + 1, href.length);
		var regexp = gfields.getRegExp(host);
		if (regexp)
		{
			var cleaned = args.replace(regexp, '').replace(/^[&]+/i, '');
			if (args !== cleaned)
			{
				href = href.substring(0, qpos);
				if (cleaned) href += '?' + cleaned;
				el.href = href;
			}
		}

		checked_links[el.href] = true;
	}
};

fix_links(document.body);

if (self.options.page_inject_type === 'observe')
{
	var observer = new MutationObserver(function(mutations)
	{
		var checked_els = [];

		mutations.forEach(function(mutation)
		{
			if (mutation.type === 'attributes')
			{
				if (mutation.target.nodeName.toLowerCase() === 'a' && mutation.attributeName === 'href')
				{
					fix_links(mutation.target);
				}
				return;
			}
			for (var i = 0; i < mutation.addedNodes.length; i++)
			{
				var el = mutation.addedNodes[i];

				// Fast checks
				if (!el || !(el instanceof Element) || el.parentNode === null || checked_els.indexOf(el) !== -1)
				{
					continue;
				}

				checked_els.push(el);

				// Slow checks
				if (!document.body.contains(el) || !el.hasChildNodes() && el.nodeName.toLowerCase() !== 'a')
				{
					continue;
				}

				fix_links(el);
			}
		});
	});

	observer.observe(document.body, { childList: true, attributes: true, subtree: true });
}

})();