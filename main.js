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

var Timer = function(func)
{
	var timers = require('sdk/timers');

	this.func = func;
	this.started = 0;
	this.period = 0;
	this.repeat = false;
	this.handle = false;

	this.run = function(period, repeat)
	{
		if (typeof(period) === 'undefined') period = 0;
		if (typeof(repeat) === 'undefined') repeat = false;

		this.cancel();
		this.started = (new Date).getTime();
		if (period == 0)
		{
			this.func();
			this.started = 0;
		}
		else
		{
			this.period = period;
			this.repeat = repeat;
			this.handle = repeat ? timers.setInterval(this.func, period) : timers.setTimeout(this.func, period);
		}
	};

	this.cancel = function()
	{
		if (!this.handle) return;
		if (this.repeat) timers.clearInterval(this.handle); else timers.clearTimeout(this.handle);
		this.started = 0;
		this.period = 0;
		this.repeat = false;
		this.handle = false;
	};
};

exports.main = function(options, callbacks)
{
	var prefs = require('sdk/simple-prefs');
	var { Ci } = require('chrome');
	var events = require('sdk/system/events');
	var pagemod = require("sdk/page-mod");
	var data = require("sdk/self").data;

	// Add default garbage fields when addon is upgraded
	if (options.loadReason === 'install' || options.loadReason === 'upgrade')
	{
		let current_list = prefs.prefs.garbage_fields.replace(/[^-._@\d\w]+/ig, ' ').replace(/[\s]{2,}/g, ' ').replace(/(^[\s]+|[\s]+$)/g, '').split(' ');
		let default_list = ['utm_source', 'utm_medium', 'utm_term', 'utm_content', 'utm_campaign', 'utm_reader', 'utm_place', 'ga_source', 'ga_medium', 'ga_term', 'ga_content', 'ga_campaign', 'ga_place', 'yclid', '_openstat', 'feature@youtube.com', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source', 'action_object_map', 'action_type_map', 'action_ref_map', 'ref@facebook.com', 'fref@facebook.com', 'hc_location@facebook.com', 'ref_@imdb.com', 'src@addons.mozilla.org', 'fbclid@facebook.com', 'sdsrc', 'c', 'ref', 'trk', '__tn__', 'cid', 'from', 'pfmredir', 'igshid','ved','ei@google.com','gs_l'];
		let changed = false;

		default_list.forEach(function(item)
		{
			if (current_list.indexOf(item) === -1)
			{
				current_list.push(item);
				changed = true;
			}
		});

		if (changed)
		{
			prefs.prefs.garbage_fields = current_list.join(', ');
		}
	}

	var gfields = null;

	// Intercept requests
	var request_hook = function(event)
	{
		var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
		var path = channel.URI.path;
		var qpos = path.indexOf('?');
		var regexp = gfields.getRegExp(channel.URI.host);
		if (regexp !== null && qpos > -1)
		{
			var args = path.substring(qpos + 1, path.length);
			var cleaned = args.replace(regexp, '').replace(/^[&]+/i, '');
			if (args !== cleaned)
			{
				path = path.substring(0, qpos);
				if (cleaned) path += '?' + cleaned;
				channel.URI.path = path;
			}
		}
	};

	// Initialization
	var request_hooked = false;
	var last_garbage_fields = '';
	var last_page_inject_type = '';
	var page_inject_handle = null;

	var init = function()
	{
		var garbage_fields = prefs.prefs.garbage_fields;
		gfields = new GarbageFields(garbage_fields);

		var request_hook_enabled = gfields.ok && prefs.prefs.request_hook_enabled;
		var page_inject_type = gfields.ok ? prefs.prefs.page_inject_type : '';

		// Request hook setup
		if (!request_hooked && request_hook_enabled)
		{
			events.on('http-on-modify-request', request_hook, true);
			request_hooked = true;
		}
		else if (request_hooked && !request_hook_enabled)
		{
			events.off('http-on-modify-request', request_hook);
			request_hooked = false;
		}

		// Page inject setup
		if (page_inject_type)
		{
			if (page_inject_handle)
			{
				if (garbage_fields == last_garbage_fields && page_inject_type == last_page_inject_type)
				{
					return;
				}
				else
				{
					page_inject_handle.destroy();
				}
			}
			page_inject_handle = pagemod.PageMod({
				include: '*',
				attachTo: ['existing', 'top', 'frame'],
				contentScriptFile: data.url('inject.js'),
				contentScriptWhen: 'ready',
				contentScriptOptions: {'page_inject_type': page_inject_type, 'gfields_db': gfields.db},
			});
		}
		else if (page_inject_handle)
		{
			page_inject_handle.destroy();
			page_inject_handle = null;
		}
		last_page_inject_type = page_inject_type;
		last_garbage_fields = garbage_fields;
	};

	init();

	// Delayed configuration changes handling
	var reinit_executer = new Timer(init);
	var reinit = function()
	{
		reinit_executer.run(1000);
	}

	prefs.on('garbage_fields', reinit);
	prefs.on('request_hook_enabled', reinit);
	prefs.on('page_inject_type', reinit);
};
