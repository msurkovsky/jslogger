/*
 * JsLogger.js
 * version 0.1
 * author: Martin Surkovsky
 * https://github.com/sur096Kaira/jslogger.git 
 * Licensed under GPL.
 */

var closeArrow = "&#x25B6;",
    openArrow = "&#x25BC;",
    emptyArrow = "&#x25B7;";

function IdGenerator() {

    this.value = 0;
}

(function(ctx) {

    /**
     * Return new free value as an id number
     * @return {Int} new id
     */
    ctx.getNext = function (){
        this.value += 1;
        return this.value;
    };

    /**
     * Return last used id
     * @return {Int} last used id
     */
    ctx.getLast = function () {
        return this.value;
    };

    ctx.toString = function () {
        return "jsl_id_generator";
    };

} (IdGenerator.prototype));

function JsLogger(divId) {

    this.id = new IdGenerator();
    this.logger = document.getElementById(divId);
    logger.style.overflow = "scroll"; 
    logger.style.background = "#fff";
    logger.style.border = "1px solid #000";
    logger.style.fontFamily = "monospace";
    logger.style.fontSize = "9pt";
    logger.style.paddingTop = "0.5em";

    var version = this._getHTMLElement(
        "span",
        {}, 
        {color: "#666", fontWeight: "bold", margin: "0.5em", fontStyle: "italic"});

    version.innerHTML = "JsLogger v0.1";
    logger.appendChild(version);

}

(function(ctx) {
    
    /**
     * It log a new object
     * @param {Object} logged object
     * @param {String} name of the object
     */
    ctx.log = function(obj, name) {
        var obj = this._makeEntry(obj, 1, name);
        this.logger.appendChild(obj);
    };

    ctx._makeEntry = function(obj, level, name) {
        var objDiv = null,
            innerDiv = null,
            sign = null,
            touchListener = null,
            propertyName = null,
            text = null;

        if (obj === null) {
            obj = "null";
        }

        if (typeof name === "undefined") {
            name = null;
        }

        objDiv = this._getHTMLElement(
            "div",
            {},
            {paddingLeft: (0.6 + 0.3*(level-1)) + "em", paddingRight: "0.6em"});

        if (typeof obj === "object") {
            sign = this._getHTMLElement(
                "span", 
                {id: "jsl" + this.id.getNext(),
                 onclick: "showHideContent(" + this.id.getLast() + ")"},
                {fontSize: "16pt", padding: "0.1em 0.3em"});

            sign.innerHTML = closeArrow;
            touchListener = new Hammer(sign);
            touchListener.ontap = (function () {
                return function() {
                    showHideContent(this.id.getLast());
                }
            })(this)

            objDiv.appendChild(sign);

            if (name != null) {
                propertyName = this._getHTMLElement("span", {}, {color: "#a0a"});
                propertyName.innerHTML = name + ": ";
                objDiv.appendChild(propertyName);
            }
            text = this._getHTMLElement("span", {}, {});
            text.innerHTML = obj.toString() + " :" + (typeof obj);
            objDiv.appendChild(text);

            // inner div
            innerDiv = this._getHTMLElement(
                "div",
                {id: "jsl_d" + this.id.getLast()},
                {display: "none"});

            if (level <= 6) { // max depth
                for (var property in obj) {
                    innerDiv.appendChild(
                        this._makeEntry(obj[property], level+1, property));
                }
            } else {
                text = this._getHTMLElement("span", {}, {fontWeight: "bold"});
                text.innerHTML = "...";
                innerDiv.appendChild(text);
            }
            objDiv.appendChild(innerDiv);

        } else if (typeof obj === "undefined") {
            sign = this._getHTMLElement(
                "span",
                {},
                {fontSize: "16pt", fontWeight: "bold", padding: "0.1em 0.3em"});
            sign.innerHTML = "!";
            objDiv.appendChild(sign);

            text = this._getHTMLElement(
                "span",
                {},
                {color: "#fff", fontWeight: "bold", background: "#f00", 
                 padding: "0.2em"});


            if (name != null) {
                propertyName = this._getHTMLElement("span", {}, {color: "#a0a"});
                propertyName.innerHTML = name + ": ";
                objDiv.appendChild(propertyName);
            }
            text.innerHTML = (typeof obj);
            objDiv.appendChild(text);

        } else if (obj === "null") {
            sign = this._getHTMLElement(
                "span",
                {},
                {fontSize: "16pt", fontWeight: "bold", padding: "0.1em 0.3em"});
            sign.innerHTML = "!";
            objDiv.appendChild(sign);

            text = this._getHTMLElement(
                "span",
                {},
                {color: "#f00", fontWeight: "bold", padding: "0.2em"});

            if (name != null) {
                propertyName = this._getHTMLElement("span", {}, {color: "#a0a"});
                propertyName.innerHTML = name + ": ";
                objDiv.appendChild(propertyName);
            }
            text.innerHTML = "null";
            objDiv.appendChild(text);

        } else {
            sign = this._getHTMLElement(
                "span",
                {},
                {fontSize: "16pt", padding: "0.1em 0.3em"});
            sign.innerHTML = emptyArrow;
            objDiv.appendChild(sign);

            text = this._getHTMLElement("span", {}, {});

            if (name != null) {
                propertyName = this._getHTMLElement("span", {}, {color: "#a0a"});
                propertyName.innerHTML = name + ": ";
                objDiv.appendChild(propertyName);
            }
            text.innerHTML = obj.toString() + " :" + (typeof obj);
            objDiv.appendChild(text);
        }

        if (level === 1) {
            objDiv.appendChild(this._getHTMLElement("hr", {}, {}));
        }

        return objDiv;
    };

    ctx._getHTMLElement = function (name, attributes, styleSetting) {
        var htmlElem = document.createElement(name);
        this._setAttributesToElem(htmlElem, attributes, styleSetting);

        return htmlElem;
    };

    ctx._setAttributesToElem = function (element, attributes, styleSetting) {
        var attr = null;

        for (attrName in attributes) {
            attr = document.createAttribute(attrName);
            attr.value = attributes[attrName];
            element.setAttributeNode(attr);
        }
        
        for (key in styleSetting) {
            element.style[String(key)] = String(styleSetting[key]);
        }
    };

    ctx.toString = function () {
        return "JsLogger";
    };
} (JsLogger.prototype));

function  showHideContent (id) {
    var block = document.getElementById("jsl_d" + id),
        sign = document.getElementById("jsl" + id); 

    if (block != null && sign != null) {
        if (block.style.display === "none") {
            block.style.display = "block";
            sign.innerHTML = openArrow;
        } else {
            block.style.display = "none";
            sign.innerHTML = closeArrow;
        }
    }
}
