/*
 * Hammer.JS
 * version 0.6.4
 * author: Eight Media
 * https://github.com/EightMedia/hammer.js
 * Licensed under the MIT license.
 */

/*jslint nomen: true, white: false, maxlen: 80*/


function Hammer(element, options) {
    "use strict";
    var self = this,
        gestures,
        _distance = 0,      // holds the distance that has been moved
        _angle = 0,         // holds the exact angle that has been moved
        _direction = 0,     // holds the direction that has been moved
        _pos = { },         // holds position movement for sliding
        _fingers = 0,       // how many fingers are on the screen
        _first = false,
        _gesture = null,
        _prev_gesture = null,
        _touch_start_time = null,
        _prev_tap_pos = {x: 0, y: 0},
        _prev_tap_end_time = null,
        _hold_timer = null,
        _offset = {},
        _mousedown = false, // keep track of the mouse status
        _event_start,
        _event_move,
        _event_end,
        _has_touch = (window.ontouchstart !== undefined) ? true : false,
        //_has_touch = ('ontouchstart' in window),
        _can_tap = false,
        defaults = {
            // prevent the default event or not... might be buggy when false
            prevent_default    : false,
            css_hacks          : true,

            swipe              : true,
            swipe_time         : 200,   // ms
            swipe_min_distance : 20,    // pixels

            drag               : true,
            drag_vertical      : true,
            drag_horizontal    : true,
            // minimum distance before the drag event starts
            drag_min_distance  : 20,    // pixels

            // pinch zoom and rotation
            transform          : true,
            scale_treshold     : 0.1,
            rotation_treshold  : 15,    // degrees

            tap                : true,
            tap_double         : true,
            tap_max_interval   : 300,
            tap_max_distance   : 10,
            tap_double_distance: 20,

            hold               : true,
            hold_timeout       : 500
        };

    /**
     * merge 2 objects into a new object
     * @param   object  obj1
     * @param   object  obj2
     * @return  object  merged object
     */
    function mergeObject(obj1, obj2) {
        var output = {},
            prop;

        if (!obj2) {
            return obj1;
        }

        for (prop in obj1) {
            if (obj1.hasOwnProperty(prop)) {
                //if (prop in obj2) {
                if (obj2[prop] !== undefined) {
                    output[prop] = obj2[prop];
                } else {
                    output[prop] = obj1[prop];
                }
            }
        }
        return output;
    }

    /**
     * attach event
     * @param   node    element
     * @param   string  types
     * @param   object  callback
     */
    function addEvent(element, types, callback) {
        var t,
            len;

        types = types.split(" ");
        for (t = 0, len = types.length; t < len; t += 1) {
            if (element.addEventListener) {
                element.addEventListener(types[t], callback, false);
            } else if (document.attachEvent) {
                element.attachEvent("on" + types[t], callback);
            }
        }
    }


    /**
     * detach event
     * @param   node    element
     * @param   string  types
     * @param   object  callback
     */
    function removeEvent(element, types, callback) {
        var t,
            len;

        types = types.split(" ");
        for (t = 0, len = types.length; t < len; t += 1) {
            if (element.removeEventListener) {
                element.removeEventListener(types[t], callback, false);
            } else if (document.detachEvent) {
                element.detachEvent("on" + types[t], callback);
            }
        }
    }

    options = mergeObject(defaults, options);

    // some css hacks
    (function () {
        if (!options.css_hacks) {
            return false;
        }

        var i,
            p,
            prop = '',
            vendors = ['webkit', 'moz', 'ms', 'o', ''],
            css_props = {
                "userSelect": "none",
                "touchCallout": "none",
                "userDrag": "none",
                "tapHighlightColor": "rgba(0,0,0,0)"
            };

        for (i = 0; i < vendors.length; i += 1) {
            for (p in css_props) {
                if (css_props.hasOwnProperty(p)) {
                    prop = p;
                    if (vendors[i]) {
                        prop = vendors[i] +
                            prop.substring(0, 1).toUpperCase() +
                            prop.substring(1);
                    }
                    element.style[prop] = css_props[p];
                }
            }
        }
    }());


    /**
     * option setter/getter
     * @param   string  key
     * @param   mixed   value
     * @return  mixed   value
     */
    this.option = function (key, val) {
        if (val !== undefined) {
            options[key] = val;
        }

        return options[key];
    };


    /**
     * angle to direction define
     * @param  float    angle
     * @return string   direction
     */
    this.getDirectionFromAngle = function (angle) {
        var direction,
            key,
            directions = {
                down: angle >= 45 && angle < 135,   //90
                left: angle >= 135 || angle <= -135,//180
                up: angle < -45 && angle > -135,    //270
                right: angle >= -45 && angle <= 45  //0
            };

        for (key in directions) {
            if (directions.hasOwnProperty(key)) {
                if (directions[key]) {
                    direction = key;
                    break;
                }
            }
        }
        return direction;
    };


    /**
     * count the number of fingers in the event
     * when no fingers are detected, one finger is returned (mouse pointer)
     * @param  event
     * @return int  fingers
     */
    function countFingers(event) {
        // there is a bug on android (until v4?) that touches is always 1,
        // so no multitouch is supported, e.g. no, zoom and rotation...
        return event.touches ? event.touches.length : 1;
    }


    /**
     * get the x and y positions from the event object
     * @param  event
     * @return array  [{ x: int, y: int }]
     */
    function getXYfromEvent(event) {
        var t,
            len,
            src,
            pos = [],
            doc,
            body,
            x,
            y;

        event = event || window.event;

        // no touches, use the event pageX and pageY
        if (!_has_touch) {
            doc = document;
            body = doc.body;

            x = event.pageX || event.clientX +
                (doc && (doc.scrollLeft || body) &&
                (body.scrollLeft || 0)) -
                (doc && (doc.clientLeft || body) &&
                (doc.clientLeft || 0));
            y = event.pageY || event.clientY +
                (doc && (doc.scrollTop || body) &&
                (body.scrollTop || 0)) -
                (doc && (doc.clientTop || body) &&
                (doc.clientTop || 0));
            return [{
                x: x,
                y: y
            }];
        }

        // multitouch, return array with positions
        for (t = 0, len = event.touches.length; t < len; t += 1) {
            src = event.touches[t];
            pos.push({ x: src.clientX, y: src.clientY });
        }
        return pos;
    }


    /**
     * calculate the angle between two points
     * @param   object  pos1 { x: int, y: int }
     * @param   object  pos2 { x: int, y: int }
     */
    function getAngle(pos1, pos2) {
        return Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x) * 180 / Math.PI;
    }

    /**
     * calculate the distance between two points
     * @param   object  pos1 { x: int, y: int }
     * @param   object  pos2 { x: int, y: int }
     */
    function getDistance(pos1, pos2) {
        var x = pos2.x - pos1.x,
            y = pos2.y - pos1.y;
        return Math.sqrt((x * x) + (y * y));
    }


    /**
     * calculate the scale size between two fingers
     * @param   object  pos_start
     * @param   object  pos_move
     * @return  float   scale
     */
    function calculateScale(pos_start, pos_move) {
        if (pos_start.length === 2 && pos_move.length === 2) {
            var start_distance = getDistance(pos_start[0], pos_start[1]),
                end_distance = getDistance(pos_move[0], pos_move[1]);
            return end_distance / start_distance;
        }
        return 0;
    }


    /**
     * calculate the rotation degrees between two fingers
     * @param   object  pos_start
     * @param   object  pos_move
     * @return  float   rotation
     */
    function calculateRotation(pos_start, pos_move) {
        if (pos_start.length === 2 && pos_move.length === 2) {
            var start_rotation = getAngle(pos_start[1], pos_start[0]),
                end_rotation = getAngle(pos_move[1], pos_move[0]);
            return end_rotation - start_rotation;
        }
        return 0;
    }

    /**
     * check if object is a function
     * @param   object  obj
     * @return  bool    is function
     */
    function isFunction(obj) {
        return Object.prototype.toString.call(obj) === "[object Function]";
    }

    /**
     * trigger an event/callback by name with params
     * @param string name
     * @param array  params
     */
    function triggerEvent(eventName, params) {
        // return touches object
        params.touches = getXYfromEvent(params.originalEvent);
        params.type = eventName;

        // trigger callback
        if (isFunction(self["on" + eventName])) {
            self["on" + eventName].call(self, params);
        }
    }


    /**
     * cancel event
     * @param   object  event
     * @return  void
     */
    function cancelEvent(event) {
        event = event || window.event;
        if (event.preventDefault) {
            event.preventDefault();
            event.stopPropagation();
        } else {
            event.returnValue = false;
            event.cancelBubble = true;
        }
    }


    /**
     * reset the internal vars to the start values
     */
    function reset() {
        _pos = {};
        _first = false;
        _fingers = 0;
        _distance = 0;
        _angle = 0;
        _gesture = null;
    }


    gestures = {
        // hold gesture
        // fired on touchstart
        hold : function (event) {
            // only when one finger is on the screen
            if (options.hold) {
                _gesture = 'hold';
                clearTimeout(_hold_timer);

                _hold_timer = setTimeout(function () {
                    if (_gesture === 'hold') {
                        triggerEvent("hold", {
                            originalEvent   : event,
                            position        : _pos.start
                        });
                    }
                }, options.hold_timeout);
            }
        },

        // swipe gesture
        // fired on touchend
        swipe : function (event) {
            if (!_pos.move || _gesture === "transform") {
                return;
            }
            var _distance_x,
                _distance_y,
                now,
                touch_time,
                position,
                event_obj;

            // get the distance we moved
            _distance_x = _pos.move[0].x - _pos.start[0].x;
            _distance_y = _pos.move[0].y - _pos.start[0].y;
            _distance = Math.sqrt(_distance_x * _distance_x +
                    _distance_y * _distance_y);

            // compare the kind of gesture by time
            now = new Date().getTime();
            touch_time = now - _touch_start_time;

            if (options.swipe &&
                    (options.swipe_time > touch_time) &&
                    (_distance > options.swipe_min_distance)) {
                // calculate the angle
                _angle = getAngle(_pos.start[0], _pos.move[0]);
                _direction = self.getDirectionFromAngle(_angle);

                _gesture = 'swipe';

                position = { x: _pos.move[0].x - _offset.left,
                    y: _pos.move[0].y - _offset.top };

                event_obj = {
                    originalEvent   : event,
                    position        : position,
                    direction       : _direction,
                    distance        : _distance,
                    distanceX       : _distance_x,
                    distanceY       : _distance_y,
                    angle           : _angle
                };

                // normal slide event
                triggerEvent("swipe", event_obj);
            }
        },


        // drag gesture
        // fired on mousemove
        drag : function (event) {
            var _distance_x,
                _distance_y,
                is_vertical,
                position,
                event_obj;

            // get the distance we moved
            _distance_x = _pos.move[0].x - _pos.start[0].x;
            _distance_y = _pos.move[0].y - _pos.start[0].y;
            _distance = Math.sqrt(_distance_x * _distance_x +
                _distance_y * _distance_y);

            // drag
            // minimal movement required
            if (options.drag &&
                    ((_distance > options.drag_min_distance) ||
                    _gesture === 'drag')) {
                // calculate the angle
                _angle = getAngle(_pos.start[0], _pos.move[0]);
                _direction = self.getDirectionFromAngle(_angle);

                // check the movement and stop if we go in the wrong direction
                is_vertical = (_direction === 'up' || _direction === 'down');

                if ((((is_vertical && !options.drag_vertical) ||
                    (!is_vertical && !options.drag_horizontal))) &&
                        (_distance > options.drag_min_distance)) {
                    return;
                }

                _gesture = 'drag';

                position = { x: _pos.move[0].x - _offset.left,
                    y: _pos.move[0].y - _offset.top };

                event_obj = {
                    originalEvent   : event,
                    position        : position,
                    direction       : _direction,
                    distance        : _distance,
                    distanceX       : _distance_x,
                    distanceY       : _distance_y,
                    angle           : _angle
                };

                // on the first time trigger the start event
                if (_first) {
                    triggerEvent("dragstart", event_obj);
                    _first = false;
                }

                // normal slide event
                triggerEvent("drag", event_obj);

                cancelEvent(event);
            }
        },


        // transform gesture
        // fired on touchmove
        transform : function (event) {
            if (options.transform) {
                var count,
                    rotation,
                    scale,
                    _distance_x,
                    _distance_y,
                    event_obj;

                count = countFingers(event);
                if (count !== 2) {
                    return false;
                }

                rotation = calculateRotation(_pos.start, _pos.move);
                scale = calculateScale(_pos.start, _pos.move);

                if (_gesture === 'transform' ||
                        Math.abs(1 - scale) > options.scale_treshold ||
                        Math.abs(rotation) > options.rotation_treshold) {

                    _gesture = 'transform';
                    _pos.center = {
                        x: ((_pos.move[0].x + _pos.move[1].x) / 2),
                        y: ((_pos.move[0].y + _pos.move[1].y) / 2)
                    };

                    if (_first) {
                        _pos.startCenter = _pos.center;
                    }

                    _distance_x = _pos.center.x - _pos.startCenter.x;
                    _distance_y = _pos.center.y - _pos.startCenter.y;
                    _distance = Math.sqrt(_distance_x * _distance_x +
                        _distance_y * _distance_y);

                    event_obj = {
                        originalEvent   : event,
                        position        : _pos.center,
                        scale           : scale,
                        rotation        : rotation,
                        distance        : _distance,
                        distanceX       : _distance_x,
                        distanceY       : _distance_y
                    };

                    // on the first time trigger the start event
                    if (_first) {
                        triggerEvent("transformstart", event_obj);
                        _first = false;
                    }

                    triggerEvent("transform", event_obj);
                    cancelEvent(event);

                    return true;
                }
            }
            return false;
        },


        // tap and double tap gesture
        // fired on touchend
        tap : function (event) {
            var now,
                touch_time,
                is_double_tap,
                x_distance,
                y_distance;

            // compare the kind of gesture by time
            now = new Date().getTime();
            touch_time = now - _touch_start_time;

            // dont fire when hold is fired
            if (options.hold &&
                    !(options.hold && options.hold_timeout > touch_time)) {
                return;
            }

            // when previous event was tap and the tap was max_interval ms ago
            is_double_tap = (function () {
                if (_prev_tap_pos &&
                        options.tap_double &&
                        _prev_gesture === 'tap' &&
                        _pos.start &&
                        (_touch_start_time - _prev_tap_end_time) <
                        options.tap_max_interval) {
                    x_distance = Math.abs(_prev_tap_pos[0].x - _pos.start[0].x);
                    y_distance = Math.abs(_prev_tap_pos[0].y - _pos.start[0].y);
                    return (_prev_tap_pos && _pos.start &&
                        Math.max(x_distance, y_distance) <
                        options.tap_double_distance);
                }
                return false;
            }());

            if (is_double_tap) {
                _gesture = 'double_tap';
                _prev_tap_end_time = null;

                triggerEvent("doubletap", {
                    originalEvent   : event,
                    position        : _pos.start
                });
                cancelEvent(event);
            } else { // single tap is single touch
                x_distance = (_pos.move) ? Math.abs(_pos.move[0].x -
                    _pos.start[0].x) : 0;
                y_distance =  (_pos.move) ? Math.abs(_pos.move[0].y -
                    _pos.start[0].y) : 0;
                _distance = Math.max(x_distance, y_distance);

                if (_distance < options.tap_max_distance) {
                    _gesture = 'tap';
                    _prev_tap_end_time = now;
                    _prev_tap_pos = _pos.start;

                    if (options.tap) {
                        triggerEvent("tap", {
                            originalEvent   : event,
                            position        : _pos.start
                        });
                        cancelEvent(event);
                    }
                }
            }
        }
    };


    function handleEvents(event) {
        var count,
            callReset,
            _distance_x,
            _distance_y;

        /**
         * Performs a blank setup.
         * @private
         */
        function _setup() {
            var box,
                clientTop,
                clientLeft,
                scrollTop,
                scrollLeft;

            _pos.start = getXYfromEvent(event);
            _touch_start_time = new Date().getTime();
            _fingers = countFingers(event);
            _first = true;
            _event_start = event;

            // borrowed from jquery offset
            // https://github.com/jquery/jquery/blob/master/src/offset.js
            box = element.getBoundingClientRect();
            clientTop = element.clientTop  || document.body.clientTop  || 0;
            clientLeft = element.clientLeft || document.body.clientLeft || 0;
            scrollTop = window.pageYOffset ||
                element.scrollTop  ||
                document.body.scrollTop;
            scrollLeft = window.pageXOffset ||
                element.scrollLeft ||
                document.body.scrollLeft;

            _offset = {
                top: box.top + scrollTop - clientTop,
                left: box.left + scrollLeft - clientLeft
            };

            _mousedown = true;

            // hold gesture
            gestures.hold(event);
        }

        switch (event.type) {
        case 'mousedown':
        case 'touchstart':
            count = countFingers(event);
            _can_tap = count === 1;

            // We were dragging and now we are zooming.
            if (count === 2 && _gesture === "drag") {
                // The user needs to have the dragend to be fired to ensure that
                // there is proper cleanup from the drag and move onto
                // transforming.
                triggerEvent("dragend", {
                    originalEvent   : event,
                    direction       : _direction,
                    distance        : _distance,
                    angle           : _angle
                });
            }
            _setup();

            if (options.prevent_default) {
                cancelEvent(event);
            }
            break;
        case 'mousemove':
        case 'touchmove':
            count = countFingers(event);

            // The user has gone from transforming to dragging.  The
            // user needs to have the proper cleanup of the state and
            // setup with the new "start" points.
            if (!_mousedown && count === 1) {
                return false;
            }
            if (!_mousedown && count === 2) {
                _can_tap = false;

                reset();
                _setup();
            }

            _event_move = event;
            _pos.move = getXYfromEvent(event);

            if (!gestures.transform(event)) {
                gestures.drag(event);
            }
            break;
        case 'mouseup':
        case 'mouseout':
        case 'touchcancel':
        case 'touchend':
            callReset = true;

            _mousedown = false;
            _event_end = event;

            // swipe gesture
            gestures.swipe(event);

            // drag gesture
            // dragstart is triggered, so dragend is possible
            if (_gesture === 'drag') {
                triggerEvent("dragend", {
                    originalEvent   : event,
                    direction       : _direction,
                    distance        : _distance,
                    angle           : _angle
                });
            } else if (_gesture === 'transform') {
                // transform
                // transformstart is triggered, so transformed is possible
                // define the transform distance
                _distance_x = _pos.center.x - _pos.startCenter.x;
                _distance_y = _pos.center.y - _pos.startCenter.y;

                triggerEvent("transformend", {
                    originalEvent   : event,
                    position        : _pos.center,
                    scale           : calculateScale(_pos.start, _pos.move),
                    rotation        : calculateRotation(_pos.start, _pos.move),
                    distance        : _distance,
                    distanceX       : _distance_x,
                    distanceY       : _distance_y
                });

                // If the user goes from transformation to drag there
                // needs to be a state reset so that way
                // a dragstart/drag/dragend will be properly fired.
                if (countFingers(event) === 1) {
                    reset();
                    _setup();
                    callReset = false;
                }
            } else if (_can_tap) {
                gestures.tap(_event_start);
            }

            _prev_gesture = _gesture;

            // trigger release event
            // "release" by default doesn't return the co-ords where your finger
            // was released. "position" will return "the last touched co-ords"

            triggerEvent("release", {
                originalEvent   : event,
                gesture         : _gesture,
                position        : _pos.move || _pos.start
            });

            // reset vars if this was not a transform->drag touch end operation.
            if (callReset) {
                reset();
            }
            break;
        } // end switch
    }

    /**
     * find if element is (inside) given parent element
     * @param   object  element
     * @param   object  parent
     * @return  bool    inside
     */
    function isInsideHammer(parent, child) {
        // get related target for IE
        if (!child && window.event && window.event.toElement) {
            child = window.event.toElement;
        }

        if (parent === child) {
            return true;
        }

        // loop over parentNodes of child until we find hammer element
        if (child) {
            var node = child.parentNode;
            while (node !== null) {
                if (node === parent) {
                    return true;
                }
                node = node.parentNode;
            }
        }
        return false;
    }

    function handleMouseOut(event) {
        if (!isInsideHammer(element, event.relatedTarget)) {
            handleEvents(event);
        }
    }

    /**
     * destroy events
     * @return  void
     */
    this.destroy = function () {
        if (_has_touch) {
            removeEvent(
                element,
                "touchstart touchmove touchend touchcancel",
                handleEvents
            );
        } else { // for non-touch
            removeEvent(element, "mouseup mousedown mousemove", handleEvents);
            removeEvent(element, "mouseout", handleMouseOut);
        }
    };

    // bind events for touch devices
    // except for windows phone 7.5, it doesnt support touch events..!
    if (_has_touch) {
        addEvent(element, "touchstart touchmove touchend touchcancel",
            handleEvents);
    }
    // for non-touch
    // else {
        // addEvent(element, "mouseup mousedown mousemove", handleEvents);
        // addEvent(element, "mouseout", handleMouseOut);
    // }
}
