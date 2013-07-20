var ProxyElementCollection = function(proxyIds) {
	this.proxyIds = proxyIds;
	this.length = proxyIds.length;
};

var jQueryIsLoaded = false;
function checkForjQuery(casper) {
	casper.on('load.finished', function() {
		jQueryIsLoaded = casper.evaluate(function() {
			return !!window.jQuery;
		});
	});
};

function initializeBrowserCasperHelpers(casper) {

	casper.on('load.finished', function() {

		casper.evaluate(function() {

			(function($) {

				var proxyAttribute = 'data-proxy-id',
						mouseEvents = 'click contextmenu dblclick mousedown mouseenter mouseleave mousemove mouseout mouseover mouseup show'.split(' '),
						focusEvents = 'blur focus'.split(' ');

				if (typeof($) === 'undefined') {
					$ = function() {};
				}
				else {
					$.fn.trigger = (function(jQueryTrigger) {
						return function(type, extraParams) {
							this.each(function() {
								dispatchEvent(this, type);
							});

							return jQueryTrigger.apply(this, arguments);
						};

					})($.fn.trigger);
				}

				function getEventInfo(type) {
					var eventType = 'Event'

					if (~(mouseEvents.indexOf(type))) {
						eventType = 'MouseEvent';
					}
					else if (~(focusEvents.indexOf(type))) {
						eventType = 'FocusEvent';
					}

					return eventType;
				}

				function dispatchEvent(element, type) {
					var event = document.createEvent(getEventInfo(type));

					event.initEvent(type, true, true);

					element.dispatchEvent(event);
				}

				function getjQueryFunctions() {
					var jQ = $();
					var functions = [];

					for (var prop in jQ) {
						if (typeof jQ[prop] === 'function') {
							functions.push(prop);
						}
					}

					return functions;
				}

				function getByIds(proxyIds) {
					var selector = proxyIds.map(function(id) {
						return '[' + proxyAttribute + '="' + id + '"]';
					}).join(',');

					return $(selector);
				}

				function getProxyIdsFromjQueryCollection(elements) {
					return elements.toArray().map(function(el) {

						if (!el.getAttribute(proxyAttribute)) {
							CasperProxy.guid++;
							el.setAttribute(proxyAttribute, CasperProxy.guid);
						}

						return el.getAttribute(proxyAttribute);
					});
				}

				window.CasperProxy = {
					guid: 1,
					getjQueryFunctions: getjQueryFunctions,
					getByIds: getByIds,
					getProxyIdsFromjQueryCollection: getProxyIdsFromjQueryCollection
				};

			})(window.jQuery);

		});

	});

}

function initializeProxyMethods(casper) {

	casper.on('load.finished', function() {

		var jQueryFunctions = casper.evaluate(function() {
			return CasperProxy.getjQueryFunctions();
		});

		jQueryFunctions.forEach(function(fnName) {
			ProxyElementCollection.prototype[fnName] = function() {

				var results = casper.evaluate(function(proxyIds, fnName, args) {
					var jQueryCollection = CasperProxy.getByIds(proxyIds);
					var results = null;

					if (args.length) {
						results = jQueryCollection[fnName].apply(jQueryCollection, args);
					}
					else {
						results = jQueryCollection[fnName].apply(jQueryCollection);
					}

					if (results instanceof jQuery) {
						results = {
							isjQueryCollection: true,
							elementIds: CasperProxy.getProxyIdsFromjQueryCollection(results)
						};
					}

					return results;

				}, this.proxyIds, fnName, Array.prototype.slice.call(arguments));

				return (results && results.isjQueryCollection) ? new ProxyElementCollection(results.elementIds) : results;
			};
		});
	});
}

function $() {
	if (!jQueryIsLoaded) {
		$.casper.warn('The jQuery object must be loaded and present on the window object.');
		$.casper.exit(1);
	}

	var args = Array.prototype.slice.call(arguments);

	args.unshift(function() {
		return CasperProxy.getProxyIdsFromjQueryCollection(jQuery.apply(jQuery, arguments));
	});

	return new ProxyElementCollection($.casper.evaluate.apply(casper, args));
}

function create(casper) {
	checkForjQuery(casper);
	initializeBrowserCasperHelpers(casper);
	initializeProxyMethods(casper);

	$.casper = casper;
	return $;
};

module.exports = {
	create: create
};