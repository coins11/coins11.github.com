/**
 * impress.js
 *
 * impress.js is a presentation tool based on the power of CSS3 transforms and transitions
 * in modern browsers and inspired by the idea behind prezi.com.
 *
 * MIT Licensed.
 *
 * Copyright 2011 Bartek Szopka (@bartaz)
 */

(function ( document, window ) {
    'use strict';

	// HELPER FUNCTIONS
	
	var pfx = (function () {

		var style = document.createElement('dummy').style,
			prefixes = 'Webkit Moz O ms Khtml'.split(' '),
			memory = {};
			
		return function ( prop ) {
			if ( typeof memory[ prop ] === "undefined" ) {

				var ucProp  = prop.charAt(0).toUpperCase() + prop.substr(1),
					props   = (prop + ' ' + prefixes.join(ucProp + ' ') + ucProp).split(' ');

				memory[ prop ] = null;
				for ( var i in props ) {
					if ( style[ props[i] ] !== undefined ) {
						memory[ prop ] = props[i];
						break;
					}
				}

			}

			return memory[ prop ];
		}

	})();

	var arrayify = function ( a ) {
		return [].slice.call( a );
	};
	
	var css = function ( el, props ) {
		var key, pkey;
		for ( key in props ) {
			if ( props.hasOwnProperty(key) ) {
				pkey = pfx(key);
				if ( pkey != null ) {
					el.style[pkey] = props[key];
				}
			}
		}
		return el;
	}
	
	var byId = function ( id ) {
		return document.getElementById(id);
	}
	
	var $ = function ( selector, context ) {
		context = context || document;
		return context.querySelector(selector);
	};
	
	var $$ = function ( selector, context ) {
		context = context || document;
		return arrayify( context.querySelectorAll(selector) );
	};
	
	var translate = function ( t ) {
		return " translate3d(" + t.x + "px," + t.y + "px," + t.z + "px) ";
	};
	
	var rotate = function ( r, revert ) {
		var rX = " rotateX(" + r.x + "deg) ",
			rY = " rotateY(" + r.y + "deg) ",
			rZ = " rotateZ(" + r.z + "deg) ";
		
		return revert ? rZ+rY+rX : rX+rY+rZ;
	};
	
	var scale = function ( s ) {
		return " scale(" + s + ") ";
	}
	
	// CHECK SUPPORT
	
	var ua = navigator.userAgent.toLowerCase();
	var impressSupported = ( pfx("perspective") != null ) &&
						   ( ua.search(/(iphone)|(ipod)|(ipad)|(android)/) == -1 );
	
	// DOM ELEMENTS
	
	var impress = byId("impress");
	
	if (!impressSupported) {
		impress.className = "impress-not-supported";
		return;
	} else {
		impress.className = "";
	}
	
	var canvas = document.createElement("div");
	canvas.className = "canvas";
	
	arrayify( impress.childNodes ).forEach(function ( el ) {
		canvas.appendChild( el );
	});
	impress.appendChild(canvas);
	
	
	// SETUP
	// set initial values and defaults
	
	document.documentElement.style.height = "100%";
	
	css(document.body, {
		height: "100%",
		overflow: "hidden"
	});

    var props = {
        position: "absolute",
        transformOrigin: "top left",
        transition: "all 0s ease-in-out",
        transformStyle: "preserve-3d"
    };
    
    css(impress, props);
    css(impress, {
        top: "50%",
        left: "50%",
        perspective: "1000px"
    });
    css(canvas, props);
    
    var setCSS = function (l, position, depth) {
        var data = l.dataset,
            step = { 
                translate: {
                    x: data.x || position.x * 2000,
                    y: data.y || position.y * 1000,
                    z: data.z || 0
                },
                rotate: {
                    x: data.rotateX || 0,
                    y: data.rotateY || 0,
                    z: data.rotateZ || data.rotate || 0
                },
                scale: data.scale || depth
            };

	
		css(l, {
			position: "absolute",
			transform: "translate(-50%, -50%)" +
			translate(step.translate) +
			rotate(step.rotate) + 
			scale(step.scale),
			transformStyle: "preserve-3d"
		});
	};

    (function searchSection(layer, currentPosition, parentDepth) {
        var l, childLayers, currentDepth,
			children = arrayify(layer.childNodes);

		childLayers = children.filter(function(c) {
			return c.tagName == "SECTION" || c.tagName == "STEP";
		}).map(function(c, idx, nodes) {
			var currentStepNum = nodes.slice(0, idx).filter(function(c) {
				return c.tagName == "STEP";
			}).length;

			if (c.tagName == "SECTION") {
				return {
					layer: c,
					position: {
						x: currentPosition.x + idx - currentStepNum,
						y: currentPosition.y + currentStepNum
					}
				};
			}
		}).filter( function(c) { return c; } );

        currentDepth = childLayers.sort( function(a, b) {
			return $$("section", a.layer).length > $$("section", b.layer).length;
		}).map(function (c) {
            return searchSection(c.layer, c.position, parentDepth);
        }).shift() || 1;
        
		children.filter(function(c) {
			return c.tagName == "STEP";	
		}).forEach(function(c) {
			setCSS(c, currentPosition, currentDepth);
			currentPosition.y++;
        });

		return currentDepth + 1;
    })(canvas, {x: 0, y: 0}, 0);

	var steps = $$(".step", impress);

	steps.forEach(function ( el, idx ) {
		if ( !el.id ) {
			el.id = "step-" + (idx + 1);
		}
	});

	// making given step active

	var current = {
		translate: { x: 0, y: 0, z: 0 },
		rotate:	{ x: 0, y: 0, z: 0 },
		scale:	 1
	};
	var active = null;
	var hashTimeout = null;

	var select = function ( el ) {
		if ( !el || !el.stepData || el == active) {
			// selected element is not defined as step or is already active
			return false;
		}
		
		// Sometimes it's possible to trigger focus on first link with some keyboard action.
		// Browser in such a case tries to scroll the page to make this element visible
		// (even that body overflow is set to hidden) and it breaks our careful positioning.
		//
		// So, as a lousy (and lazy) workaround we will make the page scroll back to the top
		// whenever slide is selected
		//
		// If you are reading this and know any better way to handle it, I'll be glad to hear about it!
		window.scrollTo(0, 0);
		
		var step = el.stepData;
		
		if ( active ) {
			active.classList.remove("active");
		}
		el.classList.add("active");
		
		impress.className = "step-" + el.id;
		
		// `#/step-id` is used instead of `#step-id` to prevent default browser
		// scrolling to element in hash
		//
		// and it has to be set after animation finishes, because in chrome it
		// causes transtion being laggy
		window.clearTimeout( hashTimeout );
		hashTimeout = window.setTimeout(function () {
			window.location.hash = "#/" + el.id;
		}, 1000);
		
		var target = {
			rotate: {
				x: -parseInt(step.rotate.x, 10),
				y: -parseInt(step.rotate.y, 10),
				z: -parseInt(step.rotate.z, 10)
			},
			translate: {
				x: -step.translate.x,
				y: -step.translate.y,
				z: -step.translate.z
			},
			scale: 1 / parseFloat(step.scale)
		};
		
		var zoomin = target.scale >= current.scale;
		
		css(impress, {
			// to keep the perspective look similar for different scales
			// we need to 'scale' the perspective, too
			perspective: step.scale * 1000 + "px",
			transform: scale(target.scale),
			transitionDelay: (zoomin ? "500ms" : "0ms")
		});
		
		css(canvas, {
			transform: rotate(target.rotate, true) + translate(target.translate),
			transitionDelay: (zoomin ? "0ms" : "500ms")
		});
		
		current = target;
		active = el;
		
		return el;
	};
	
	var selectPrev = function () {
		var prev = steps.indexOf( active ) - 1;
		prev = prev >= 0 ? steps[ prev ] : steps[ steps.length-1 ];
		
		return select(prev);
	};
	
	var selectNext = function () {
		var next = steps.indexOf( active ) + 1;
		next = next < steps.length ? steps[ next ] : steps[ 0 ];
		
		return select(next);
	};
	
	// EVENTS
	
	document.addEventListener("keydown", function ( event ) {
		if ( event.keyCode == 9 || ( event.keyCode >= 32 && event.keyCode <= 34 ) || (event.keyCode >= 37 && event.keyCode <= 40) ) {
			switch( event.keyCode ) {
				case 33: ; // pg up
				case 37: ; // left
				case 38:   // up
						 selectPrev();
						 break;
				case 9:  ; // tab
				case 32: ; // space
				case 34: ; // pg down
				case 39: ; // right
				case 40:   // down
						 selectNext();
						 break;
			}
			
			event.preventDefault();
		}
	}, false);

	document.addEventListener("click", function ( event ) {
		// event delegation with "bubbling"
		// check if event target (or any of its parents is a link or a step)
		var target = event.target;
		while ( (target.tagName != "A") &&
				(!target.stepData) &&
				(target != document.body) ) {
			target = target.parentNode;
		}
		
		if ( target.tagName == "A" ) {
			var href = target.getAttribute("href");
			
			// if it's a link to presentation step, target this step
			if ( href && href[0] == '#' ) {
				target = byId( href.slice(1) );
			}
		}
		
		if ( select(target) ) {
			event.preventDefault();
		}
	}, false);
	
	var getElementFromUrl = function () {
		// get id from url # by removing `#` or `#/` from the beginning,
		// so both "fallback" `#slide-id` and "enhanced" `#/slide-id` will work
		return byId( window.location.hash.replace(/^#\/?/,"") );
	}
	
	window.addEventListener("hashchange", function () {
		select( getElementFromUrl() );
	}, false);
	
	// START 
	// by selecting step defined in url or first step of the presentation
	select(getElementFromUrl() || steps[0]);

})(document, window);

