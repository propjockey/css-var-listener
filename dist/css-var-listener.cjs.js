/*css-var-listener@0.0.3#css-var-listener*/
define(['exports'], function (exports) {
    'use strict';
    Object.defineProperty(exports, '__esModule', { value: true });
    var _slicedToArray = function () {
        function sliceIterator(arr, i) {
            var _arr = [];
            var _n = true;
            var _d = false;
            var _e = undefined;
            try {
                for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                    _arr.push(_s.value);
                    if (i && _arr.length === i)
                        break;
                }
            } catch (err) {
                _d = true;
                _e = err;
            } finally {
                try {
                    if (!_n && _i['return'])
                        _i['return']();
                } finally {
                    if (_d)
                        throw _e;
                }
            }
            return _arr;
        }
        return function (arr, i) {
            if (Array.isArray(arr)) {
                return arr;
            } else if (Symbol.iterator in Object(arr)) {
                return sliceIterator(arr, i);
            } else {
                throw new TypeError('Invalid attempt to destructure non-iterable instance');
            }
        };
    }();
    var cssVarListener = function () {
        var callbacks = {};
        var props = new Set();
        var rules = {};
        var elStatus = {};
        var useSSOrder = [];
        var useStyleSheets = new WeakSet();
        var ignoreStyleSheets = new WeakSet();
        var updateFromStyleSheets = function updateFromStyleSheets() {
            var ssu = false;
            var ssi = false;
            var prop = undefined;
            var ds = undefined;
            var dss = document.styleSheets;
            var dssl = dss.length;
            var i = 0;
            var o = 0;
            var updateWasNeeded = false;
            for (i = 0; i < dssl; i++) {
                ds = dss[i];
                ssi = ignoreStyleSheets.has(ds);
                if (ssi) {
                    continue;
                }
                ssu = useStyleSheets.has(ds);
                if (!ssu && ds.ownerNode && ds.ownerNode.closest('[data-css-var-listener-ignore-stylesheets]')) {
                    ignoreStyleSheets.add(ds);
                    continue;
                }
                if (!ssu) {
                    updateWasNeeded = true;
                    useStyleSheets.add(ds);
                    useSSOrder[o] = ds;
                    o++;
                    continue;
                }
                if (useSSOrder[o] !== ds) {
                    updateWasNeeded = true;
                    useSSOrder[o] = ds;
                    o++;
                    continue;
                }
                o++;
            }
            if (o < useSSOrder.length) {
                updateWasNeeded = true;
                useSSOrder.length = o;
            }
            if (updateWasNeeded) {
                var _iteratorNormalCompletion = true;
                var _didIteratorError = false;
                var _iteratorError = undefined;
                try {
                    for (var _iterator = props[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                        prop = _step.value;
                        step1(prop);
                    }
                } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return) {
                            _iterator.return();
                        }
                    } finally {
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                }
            }
            return updateWasNeeded;
        };
        updateFromStyleSheets();
        var cssVarListener = function cssVarListener(varprop, cb, options) {
            callbacks[varprop] = callbacks[varprop] || [];
            callbacks[varprop].push({
                fn: cb,
                options: options || {}
            });
            props.add(varprop);
            if (!updateFromStyleSheets()) {
                step1(varprop);
            }
        };
        var remove = function remove(varprop, cb) {
            var cba = callbacks[varprop] || [];
            if (cb) {
                var cbl = cba.length;
                var cbi = 0;
                for (cbi = 0; cbi < cbl; cbi++) {
                    if (cb === cba[cbi].fn) {
                        cba.splice(cbi, 1);
                        break;
                    }
                }
            }
            if (!cb || !cba.length) {
                delete callbacks[varprop];
                props.delete(varprop);
                delete rules[varprop];
                delete elStatus[varprop];
            }
        };
        var styleSetsProp = function styleSetsProp(styles, varprop) {
            for (var i = 0; i < styles.length; i++) {
                if (styles[i] === varprop) {
                    return true;
                }
            }
            return false;
        };
        var rxCache = {
            dq: /"(?:\\"|[^"])*"/g,
            sq: /'(?:\\'|[^'])*'/g,
            attr: /\[.*?\]/g,
            bb: /[-_]/g,
            pe: /:?:(?:after|before|firstletter|firstline|placeholder|selection)/g,
            upe: /::[^\b ]+?\b/g,
            imn: /:(?:is|matches|not)\(/g,
            w: /:where\(.*?\)/g,
            pc: /:[^\b ]+?\b/g,
            pcwp: /.pc\(.*?\)/g,
            cu: /[*()>+~]/g,
            fc: /(#[^\b ]+?\b)|(\.[^\b ]+?\b)|(\b[^\b ]+?\b)/g
        };
        var getSpecificityOfSingleSelector = function getSpecificityOfSingleSelector(sel) {
            var idc = 0;
            var classc = 0;
            var elc = 0;
            sel = sel.replace(rxCache.dq, '').trim();
            sel = sel.replace(rxCache.sq, '');
            sel = sel.replace(rxCache.attr, '.attr');
            sel = sel.replace(rxCache.bb, '');
            sel = sel.replace(rxCache.pe, ' pe');
            sel = sel.replace(rxCache.upe, ' unknownpe');
            sel = sel.replace(rxCache.imn, ' (');
            sel = sel.replace(rxCache.w, '');
            sel = sel.replace(rxCache.pc, '.pc');
            sel = sel.replace(rxCache.pcwp, '.pcwithparen');
            sel = sel.replace(rxCache.cu, ' ');
            sel.replace(rxCache.fc, function (_, id, classn, el) {
                if (id) {
                    idc++;
                } else if (classn) {
                    classc++;
                } else if (el) {
                    elc++;
                }
                return '';
            });
            return idc * 10000 + classc * 100 + elc;
        };
        var memoizedDeps = {};
        var setupDone = {};
        var depsRxStart = /\\[\s\S]|\bvar\(|[\s\S]/g;
        var varNameRx = /\s*(--[^, )]+)\s*(,)?/g;
        var parseStringEnd = {
            '"': /(?:\\[\s\S]|[^\\])*?"/g,
            '\'': /(?:\\[\s\S]|[^\\])*?'/g
        };
        var getMemoizedValDeps = function getMemoizedValDeps(propVal, rootVarProp) {
            var memoizedVal = memoizedDeps[propVal];
            if (memoizedVal) {
                if (rootVarProp && !setupDone[propVal + '__' + rootVarProp]) {
                    setupDepCallbacks(rootVarProp, memoizedVal.keys);
                    setupDone[propVal + '__' + rootVarProp] = true;
                }
                return memoizedDeps[propVal];
            }
            var startExec = undefined;
            var contextKey = undefined;
            var endContextRx = undefined;
            var endExec = undefined;
            var paren = undefined;
            var depKeys = [];
            var parenStack = [];
            var varNameExec = undefined;
            var propValStruct = [];
            var valueStackPointer = {
                stack: propValStruct,
                parentStack: undefined
            };
            var tempVal = undefined;
            while (startExec = depsRxStart.exec(propVal)) {
                contextKey = startExec[0];
                if (contextKey === '(') {
                    valueStackPointer.stack.push(contextKey);
                    parenStack.push({ start: startExec.index });
                    continue;
                }
                if (contextKey === 'var(') {
                    varNameRx.lastIndex = depsRxStart.lastIndex;
                    varNameExec = varNameRx.exec(propVal);
                    if (varNameExec && varNameExec.index === depsRxStart.lastIndex) {
                        parenStack.push({
                            varProp: varNameExec[1],
                            start: startExec.index,
                            fallbackStart: varNameExec.lastIndex
                        });
                        depsRxStart.lastIndex = varNameRx.lastIndex;
                        tempVal = {
                            depVar: varNameExec[1],
                            fallback: []
                        };
                        valueStackPointer.stack.push(tempVal);
                        valueStackPointer = {
                            stack: tempVal.fallback,
                            parentValueStack: valueStackPointer
                        };
                    } else {
                        parenStack.push({ start: startExec.index });
                        valueStackPointer.stack.push(contextKey);
                    }
                    continue;
                }
                if (contextKey === ')') {
                    paren = parenStack.pop();
                    if (paren.varProp) {
                        paren.end = startExec.index;
                        depKeys.push(paren.varProp);
                        valueStackPointer = valueStackPointer.parentValueStack;
                    } else {
                        valueStackPointer.stack.push(contextKey);
                    }
                    continue;
                }
                endContextRx = parseStringEnd[contextKey];
                if (!endContextRx) {
                    valueStackPointer.stack.push(contextKey);
                    continue;
                }
                valueStackPointer.stack.push(contextKey);
                endContextRx.lastIndex = depsRxStart.lastIndex;
                endExec = endContextRx.exec(propVal);
                if (endExec && endExec.index === depsRxStart.lastIndex) {
                    depsRxStart.lastIndex = endContextRx.lastIndex;
                    valueStackPointer.stack.push(endExec[0]);
                }
            }
            propValStruct.keys = depKeys;
            if (rootVarProp) {
                setupDepCallbacks(rootVarProp, depKeys);
                setupDone[propVal + '__' + rootVarProp] = true;
            }
            memoizedDeps[propVal] = propValStruct;
            return propValStruct;
        };
        var recurseRules = function recurseRules(varprop, cssRules, mediaCondition, supportsCondition) {
            var rlen = cssRules.length;
            var cssomRule = undefined;
            var r = 0;
            for (r = 0; r < rlen; r++) {
                cssomRule = cssRules[r];
                if (cssomRule.cssRules) {
                    var mediaCond = cssomRule instanceof CSSMediaRule ? cssomRule.conditionText : undefined;
                    if (mediaCond) {
                        recurseRules(cssomRule.cssRules, mediaCond, supportsCondition);
                        continue;
                    }
                    if (typeof CSS !== 'undefined' && typeof CSS.supports !== 'undefined' && typeof CSSSupportsRule !== 'undefined' && cssomRule instanceof CSSSupportsRule && CSS.supports(cssomRule.conditionText)) {
                        recurseRules(cssomRule.cssRules, mediaCondition, cssomRule.conditionText);
                    }
                    continue;
                }
                if (!cssomRule.selectorText || !cssomRule.style || !styleSetsProp(cssomRule.style, varprop)) {
                    continue;
                }
                var varPropRules = rules[varprop];
                var propVal = cssomRule.style.getPropertyValue(varprop);
                var propValStruct = getMemoizedValDeps(propVal, varprop);
                var valueDependencies = propValStruct.keys || [];
                var selectors = cssomRule.selectorText.split(',');
                var slen = selectors.length;
                var s = 0;
                for (s = 0; s < slen; s++) {
                    var sel = selectors[s];
                    var attachHoverEvents = sel.replace(/(.*?):hover.*|.+/, '$1') || '';
                    varPropRules.push({
                        cssomRule: cssomRule,
                        singleSector: sel,
                        attachHoverEvents: attachHoverEvents ? attachHoverEvents + ':not([data-css-var-listener~="hover-events' + varprop + '"])' : '',
                        mediaCondition: mediaCondition,
                        supportsCondition: supportsCondition,
                        propValue: propVal,
                        valueDependencies: valueDependencies,
                        propValStruct: propValStruct,
                        specificity: getSpecificityOfSingleSelector(sel)
                    });
                }
            }
        };
        var step1 = function step1(varprop) {
            var ss = useSSOrder;
            var sslen = ss.length;
            var i = 0;
            rules[varprop] = [];
            for (i = 0; i < sslen; i++) {
                var sheet = ss[i];
                recurseRules(varprop, sheet.cssRules);
            }
            step2(varprop);
        };
        var step2 = function step2(varprop) {
            elStatus[varprop] = elStatus[varprop] || new Map();
            var elStatusForProp = elStatus[varprop];
            var unapplySet = new Set(elStatusForProp.keys());
            unapplySet.delete('unapply');
            elStatusForProp.set('unapply', unapplySet);
            var varPropRules = rules[varprop] || [];
            var rlen = varPropRules.length;
            var r = 0;
            for (r = 0; r < rlen; r++) {
                var ruleInfo = varPropRules[r];
                if (ruleInfo.mediaCondition) {
                    if (typeof window === 'undefined' || !window.matchMedia || !window.matchMedia(ruleInfo.mediaCondition).matches) {
                        continue;
                    }
                }
                if (ruleInfo.attachHoverEvents) {
                    var newHoverEls = document.querySelectorAll(ruleInfo.attachHoverEvents);
                    var step2bound = step2.bind(undefined, varprop);
                    for (var e = 0; e < newHoverEls.length; e++) {
                        var hoverel = newHoverEls[e];
                        var attrval = hoverel.getAttribute('data-css-var-listener') || '';
                        hoverel.addEventListener('mouseenter', step2bound);
                        hoverel.addEventListener('mouseleave', step2bound);
                        hoverel.setAttribute('data-css-var-listener', (attrval + ' hover-events' + varprop).trim());
                    }
                }
                var applyTo = document.querySelectorAll(ruleInfo.singleSector);
                var applyLen = applyTo.length;
                var a = 0;
                for (a = 0; a < applyLen; a++) {
                    var el = applyTo[a];
                    var status = elStatusForProp.get(el) || {
                        value: undefined,
                        compiledValue: undefined,
                        newValue: ruleInfo.propValue,
                        specificity: ruleInfo.specificity
                    };
                    if (unapplySet.delete(el)) {
                        status.newValue = ruleInfo.propValue;
                        status.specificity = ruleInfo.specificity;
                    } else if (ruleInfo.specificity >= status.specificity) {
                        status.newValue = ruleInfo.propValue;
                        status.specificity = ruleInfo.specificity;
                    }
                    elStatusForProp.set(el, status);
                }
            }
            step3(varprop);
        };
        var step3 = function step3(varprop) {
            var callbacksForProp = callbacks[varprop] || [];
            var cblen = callbacksForProp.length;
            var cb = 0;
            var elStatusForProp = elStatus[varprop] || new Map();
            var unapplySet = elStatusForProp.get('unapply') || new Set();
            var el = undefined;
            var status = undefined;
            var _iteratorNormalCompletion2 = true;
            var _didIteratorError2 = false;
            var _iteratorError2 = undefined;
            try {
                for (var _iterator2 = unapplySet[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                    el = _step2.value;
                    status = elStatusForProp.get(el);
                    if (status.value !== undefined) {
                        for (cb = 0; cb < cblen; cb++) {
                            callbacksForProp[cb].fn({
                                target: el,
                                prop: varprop,
                                value: undefined,
                                compiledValue: undefined,
                                oldValue: status.value,
                                oldCompiledValue: status.compiledValue
                            });
                        }
                    }
                    elStatusForProp.delete(el);
                }
            } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion2 && _iterator2.return) {
                        _iterator2.return();
                    }
                } finally {
                    if (_didIteratorError2) {
                        throw _iteratorError2;
                    }
                }
            }
            unapplySet.clear();
            var _iteratorNormalCompletion3 = true;
            var _didIteratorError3 = false;
            var _iteratorError3 = undefined;
            try {
                for (var _iterator3 = elStatusForProp[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                    var _step3$value = _slicedToArray(_step3.value, 2);
                    el = _step3$value[0];
                    status = _step3$value[1];
                    if (el === 'unapply') {
                        continue;
                    }
                    var compiled = compileValueOnEl(getMemoizedValDeps(status.newValue), el);
                    if (status.value !== status.newValue || status.compiledValue !== compiled) {
                        for (cb = 0; cb < cblen; cb++) {
                            callbacksForProp[cb].fn({
                                target: el,
                                prop: varprop,
                                value: status.newValue,
                                compiledValue: compiled,
                                oldValue: status.value,
                                oldCompiledValue: status.compiledValue
                            });
                        }
                        status.value = status.newValue;
                        status.compiledValue = compiled;
                    }
                }
            } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion3 && _iterator3.return) {
                        _iterator3.return();
                    }
                } finally {
                    if (_didIteratorError3) {
                        throw _iteratorError3;
                    }
                }
            }
        };
        var depSets = {};
        var depVarElValues = new WeakMap();
        var depCallback = function depCallback(data) {
            var el = data.target;
            var dep = data.prop;
            var rootVarProp = this;
            var propValStruct = getMemoizedValDeps(data.value);
            var x = depVarElValues.get(el);
            if (x && typeof x[dep] !== 'undefined') {
                if (x[dep] !== propValStruct) {
                    x[dep] = propValStruct;
                    step3.call(null, rootVarProp);
                }
            } else if (x) {
                x[dep] = propValStruct;
            } else {
                var temp = {};
                temp[dep] = propValStruct;
                depVarElValues.set(el, temp);
            }
        };
        var setupDepCallbacks = function setupDepCallbacks(varprop, valueDependencies) {
            var x = 0;
            var depSet = undefined;
            var depVarProp = undefined;
            var len = valueDependencies.length;
            for (x = 0; x < len; x++) {
                depVarProp = valueDependencies[x];
                depSet = depSets[depVarProp] || new Set();
                if (!depSet.has(varprop)) {
                    depSet.add(varprop);
                    cssVarListener(depVarProp, depCallback.bind(varprop), {});
                }
                depSets[depVarProp] = depSet;
            }
        };
        var compileValueOnEl = function compileValueOnEl(propValStruct, el) {
            var output = [];
            var x = 0;
            var len = propValStruct.length;
            var val = undefined;
            var depVal = undefined;
            var elLoop = el;
            for (x = 0; x < len; x++) {
                val = propValStruct[x];
                if (val.depVar) {
                    elLoop = el;
                    while (elLoop) {
                        depVal = depVarElValues.get(elLoop);
                        depVal = depVal && depVal[val.depVar];
                        if (depVal) {
                            break;
                        }
                        elLoop = elLoop.parentNode;
                    }
                    output.push(compileValueOnEl(depVal || x.fallback, el));
                } else {
                    output.push(val);
                }
            }
            return output.join('');
        };
        var observer = new MutationObserver(function (mutations) {
            var step2props = [];
            var step2propsObj = {};
            var mLen = mutations.length;
            if (updateFromStyleSheets()) {
                observer.takeRecords();
                return;
            }
            for (var m = 0; m < mLen; m++) {
                var mutation = mutations[m];
                var el = mutation.target;
                if (el && !el.closest('[data-css-var-listener-ignore]')) {
                    var prop = undefined;
                    var _iteratorNormalCompletion4 = true;
                    var _didIteratorError4 = false;
                    var _iteratorError4 = undefined;
                    try {
                        for (var _iterator4 = props[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                            prop = _step4.value;
                            if (step2propsObj[prop]) {
                                continue;
                            }
                            var cba = callbacks[prop];
                            var cbalen = cba.length;
                            var cbai = 0;
                            for (cbai = 0; cbai < cbalen; cbai++) {
                                var cbopts = cba[cbai].options;
                                if (!(cbopts.ignoreAttr && el.closest('[' + cbopts.ignoreAttr + ']'))) {
                                    break;
                                }
                            }
                            if (cbai === cbalen) {
                                continue;
                            }
                            step2propsObj[prop] = true;
                            step2props.push(prop);
                        }
                    } catch (err) {
                        _didIteratorError4 = true;
                        _iteratorError4 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                                _iterator4.return();
                            }
                        } finally {
                            if (_didIteratorError4) {
                                throw _iteratorError4;
                            }
                        }
                    }
                }
                if (step2props.length === props.length) {
                    break;
                }
            }
            var s2len = step2props.length;
            for (var s = 0; s < s2len; s++) {
                try {
                    step2(step2props[s]);
                } catch (e) {
                    remove(step2props[s]);
                    observer.takeRecords();
                    if (typeof console !== 'undefined' && console.warn) {
                        console.warn('cssVarListener: Handling of callbacks for ' + step2props[s] + ' has been stopped due to the error below.');
                    }
                    throw e;
                }
            }
            observer.takeRecords();
        });
        observer.observe(document, {
            attributes: true,
            characterData: true,
            childList: true,
            subtree: true
        });
        return {
            add: cssVarListener,
            remove: remove,
            getSpecificityOfSingleSelector: getSpecificityOfSingleSelector,
            _step1: step1,
            _step2: step2,
            _step3: step3
        };
    }();
    exports.default = cssVarListener;
});