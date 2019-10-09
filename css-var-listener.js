/*
  cssVarListener
  BSD 2-Clause License
  Copyright (c) James0x57, PropJockey, 2019
*/
var cssVarListener = (function () {

  var callbacks = {} // "--prop": [{ fn: callbackfn, options: {ignoreAttr: "data-attr-spliced-ignore"} }]
  var props = new Set()
  var rules = {} // step1 output. --prop: { singleSector, .... }
  var elStatus = {} // step2 output. --prop: Map[el] -> { value, newValue, .... }
  var useSSOrder = []
  var useStyleSheets = new WeakSet()
  var ignoreStyleSheets = new WeakSet()

  var updateFromStyleSheets = function () {
    var ssu = false
    var ssi = false
    var prop = undefined
    var ds = undefined
    var dss = document.styleSheets
    var dssl = dss.length
    var i = 0
    var o = 0
    var updateWasNeeded = false
    for (i = 0; i < dssl; i++) {
      ds = dss[i]
      ssi = ignoreStyleSheets.has(ds)

      if (ssi) {
        continue
      }

      ssu = useStyleSheets.has(ds)

      if (!ssu && ds.ownerNode && ds.ownerNode.closest("[data-css-var-listener-ignore-stylesheets]")) {
        ignoreStyleSheets.add(ds)
        continue
      }

      if (!ssu) {
        updateWasNeeded = true
        useStyleSheets.add(ds)
        useSSOrder[o] = ds
        o++
        continue
      }

      if (useSSOrder[o] !== ds) {
        updateWasNeeded = true
        useSSOrder[o] = ds
        o++
        continue
      }

      o++
    }
    if (o < useSSOrder.length) {
      updateWasNeeded = true
      useSSOrder.length = o
    }
    if (updateWasNeeded) {
      for (prop of props) {
        step1(prop)
      }
    }
    return updateWasNeeded
  }
  updateFromStyleSheets()

  var cssVarListener = function (varprop, cb, options) {
    callbacks[varprop] = callbacks[varprop] || []
    callbacks[varprop].push({
      fn: cb,
      options: options || {}
    })
    props.add(varprop)
    // if observer would have updated stylesheets (stylesheet added the same observer frame, before this was called)
    // then this takes care of it sooner and runs step1 for all props
    // if not, just run step1 for this prop
    if (!updateFromStyleSheets()) {
      step1(varprop)
    }
  }
  var remove = function (varprop, cb) {
    var cba = callbacks[varprop] || []
    if (cb) {
      var cbl = cba.length
      var cbi = 0
      for (cbi = 0; cbi < cbl; cbi++) {
        if (cb === cba[cbi].fn) {
          cba.splice(cbi, 1)
          break
        }
      }
    }
    if (!cb || !cba.length) {
      delete callbacks[varprop]
      props.delete(varprop)
      delete rules[varprop]
      delete elStatus[varprop]
    }
  }

  var styleSetsProp = function (styles, varprop) {
    for (var i = 0; i < styles.length; i++) {
      if (styles[i] === varprop) {
        return true
      }
    }
    return false
  }

  var rxCache = {
    dq:   /"(?:\\"|[^"])*"/g,
    sq:   /'(?:\\'|[^'])*'/g,
    attr: /\[.*?\]/g,
    bb:   /[-_]/g,
    pe:   /:?:(?:after|before|firstletter|firstline|placeholder|selection)/g,
    upe:  /::[^\b ]+?\b/g,
    imn:  /:(?:is|matches|not)\(/g,
    w:    /:where\(.*?\)/g,
    pc:   /:[^\b ]+?\b/g,
    pcwp: /.pc\(.*?\)/g,
    cu:   /[*()>+~]/g,
    fc:   /(#[^\b ]+?\b)|(\.[^\b ]+?\b)|(\b[^\b ]+?\b)/g
  }

  var getSpecificityOfSingleSelector = function (sel) {
    var idc = 0
    var classc = 0
    var elc = 0
    sel = sel.replace(rxCache.dq, "").trim()
    sel = sel.replace(rxCache.sq, "")
    sel = sel.replace(rxCache.attr, ".attr")
    sel = sel.replace(rxCache.bb, "")
    sel = sel.replace(rxCache.pe, " pe")
    sel = sel.replace(rxCache.upe, " unknownpe")
    sel = sel.replace(rxCache.imn, " (")
    sel = sel.replace(rxCache.w, "") // where has 0 specificity
    sel = sel.replace(rxCache.pc, ".pc")
    sel = sel.replace(rxCache.pcwp, ".pcwithparen")
    sel = sel.replace(rxCache.cu, " ")
    sel.replace(rxCache.fc, function (_, id, classn, el) {
      if (id) {
        idc++
      } else if (classn) {
        classc++
      } else if (el) {
        elc++
      }
      return ""
    })
    return idc * 10000 + classc * 100 + elc
  }

  var memoizedDeps = {}
  var setupDone = {}
  var depsRxStart = /\\[\s\S]|\bvar\(|[\s\S]/g
  var varNameRx = /\s*(--[^, )]+)\s*(,)?/g
  var parseStringEnd = {
    "\"": /(?:\\[\s\S]|[^\\])*?"/g,
    "'": /(?:\\[\s\S]|[^\\])*?'/g
  }
  var getMemoizedValDeps = function (propVal, rootVarProp) {
    var memoizedVal = memoizedDeps[propVal]
    if (memoizedVal) {
      if (rootVarProp && !setupDone[propVal + "__" + rootVarProp]) {
        setupDepCallbacks(rootVarProp, memoizedVal.keys)
        setupDone[propVal + "__" + rootVarProp] = true
      }
      return memoizedDeps[propVal]
    }

    var startExec = undefined
    var contextKey = undefined
    var endContextRx = undefined
    var endExec = undefined
    var paren = undefined
    var depKeys = []
    var parenStack = []
    var varNameExec = undefined
    var propValStruct = []
    var valueStackPointer = { stack: propValStruct, parentStack: undefined }
    var tempVal = undefined
    while ((startExec = depsRxStart.exec(propVal))) {
      contextKey = startExec[0]
      if (contextKey === "(") {
        valueStackPointer.stack.push(contextKey)
        parenStack.push({ start: startExec.index })
        continue
      }
      if (contextKey === "var(") {
        varNameRx.lastIndex = depsRxStart.lastIndex
        varNameExec = varNameRx.exec(propVal)
        if (varNameExec && varNameExec.index === depsRxStart.lastIndex) {
          parenStack.push({ varProp: varNameExec[1], start: startExec.index, fallbackStart: varNameExec.lastIndex })
          depsRxStart.lastIndex = varNameRx.lastIndex
          tempVal = {
            depVar: varNameExec[1],
            fallback: []
          }
          valueStackPointer.stack.push(tempVal)
          valueStackPointer = { stack: tempVal.fallback, parentValueStack: valueStackPointer }
        } else {
          // wasn't a valid var
          parenStack.push({ start: startExec.index })
          valueStackPointer.stack.push(contextKey)
        }
        continue
      }
      if (contextKey === ")") {
        paren = parenStack.pop()
        if (paren.varProp) {
          paren.end = startExec.index
          depKeys.push(paren.varProp)
          valueStackPointer = valueStackPointer.parentValueStack
        } else {
          valueStackPointer.stack.push(contextKey)
        }
        continue
      }
      endContextRx = parseStringEnd[contextKey]
      if (!endContextRx) {
        valueStackPointer.stack.push(contextKey)
        continue
      }
      valueStackPointer.stack.push(contextKey) // contextKey is " or '
      endContextRx.lastIndex = depsRxStart.lastIndex
      endExec = endContextRx.exec(propVal)
      // string end parsing bagan matching right away, invalid value if this isn't true?
      if (endExec && endExec.index === depsRxStart.lastIndex) {
        depsRxStart.lastIndex = endContextRx.lastIndex
        valueStackPointer.stack.push(endExec[0]) // the rest of the string
      }
    }

    propValStruct.keys = depKeys
    if (rootVarProp) {
      setupDepCallbacks(rootVarProp, depKeys)
      setupDone[propVal + "__" + rootVarProp] = true
    }
    memoizedDeps[propVal] = propValStruct
    return propValStruct
  }

  var recurseRules = function (varprop, cssRules, mediaCondition, supportsCondition) {
    var rlen = cssRules.length
    var cssomRule = undefined
    var r = 0
    for (r = 0; r < rlen; r++) {
      cssomRule = cssRules[r]
      if (cssomRule.cssRules) {
        var mediaCond = (cssomRule instanceof CSSMediaRule) ? cssomRule.conditionText : undefined
        if (mediaCond) {
          recurseRules(cssomRule.cssRules, mediaCond, supportsCondition)
          continue
        }
        if (
          typeof CSS !== "undefined" &&
          typeof CSS.supports !== "undefined" &&
          typeof CSSSupportsRule !== "undefined" &&
          (cssomRule instanceof CSSSupportsRule) &&
          CSS.supports(cssomRule.conditionText)
        ) {
          recurseRules(cssomRule.cssRules, mediaCondition, cssomRule.conditionText)
        }
        continue
      }

      if (!cssomRule.selectorText || !cssomRule.style || !styleSetsProp(cssomRule.style, varprop)) {
        continue
      }

      var varPropRules = rules[varprop]
      var propVal = cssomRule.style.getPropertyValue(varprop)
      var propValStruct = getMemoizedValDeps(propVal, varprop)
      var valueDependencies = propValStruct.keys || []
      var selectors = cssomRule.selectorText.split(",") // todo: div[asdf="foo, bar"] breaks here
      var slen = selectors.length
      var s = 0
      for (s = 0; s < slen; s++) {
        var sel = selectors[s]
        // todo: not supported if a single selector has 2 :hover rules in the hierarchy. eg: div:hover > .el:hover
        var attachHoverEvents = sel.replace(/(.*?):hover.*|.+/, "$1") || ""
        varPropRules.push({
          cssomRule: cssomRule,
          singleSector: sel,
          attachHoverEvents: attachHoverEvents ? attachHoverEvents + ":not([data-css-var-listener~=\"hover-events" + varprop + "\"])" : "",
          mediaCondition: mediaCondition,
          supportsCondition: supportsCondition,
          propValue: propVal,
          valueDependencies: valueDependencies,
          propValStruct: propValStruct,
          specificity: getSpecificityOfSingleSelector(sel)
        })
      }
    }
  }

  var step1 = function (varprop) {
    var ss = useSSOrder
    var sslen = ss.length
    var i = 0
    rules[varprop] = []
    for (i = 0; i < sslen; i++) {
      var sheet = ss[i] // yatta!
      // todo: learn about the "disabled" flag and media rule directly on stylesheet objects and ignore/observe/update if needed
      recurseRules(varprop, sheet.cssRules)
    }
    step2(varprop)
  }

  // setup media and hover listeners as needed, determine what value css will apply to each element targeted, and flag elements that used to have prop applied but don't now
  var step2 = function (varprop) {
    elStatus[varprop] = elStatus[varprop] || new Map()
    var elStatusForProp = elStatus[varprop]
    var unapplySet = new Set(elStatusForProp.keys())
    unapplySet.delete("unapply")
    elStatusForProp.set("unapply", unapplySet)

    var varPropRules = rules[varprop] || []
    var rlen = varPropRules.length
    var r = 0
    for (r = 0; r < rlen; r++) {
      var ruleInfo = varPropRules[r]
      if (ruleInfo.mediaCondition) {
        // todo: check if we need to set up window resize listeners for this prop
        if (typeof window === "undefined" || !window.matchMedia || !window.matchMedia(ruleInfo.mediaCondition).matches) {
          continue
        }
      }
      if (ruleInfo.attachHoverEvents) {
        var newHoverEls = document.querySelectorAll(ruleInfo.attachHoverEvents)
        var step2bound = step2.bind(undefined, varprop)
        for (var e = 0; e < newHoverEls.length; e++) {
          var hoverel = newHoverEls[e]
          var attrval = hoverel.getAttribute("data-css-var-listener") || ""
          // todo: consider tracking all these elements by stylesheet - if a stylesheet is removed and these elements aren't, unbind each one
          // (worst case for leaving these bound is step2 runs checks unecessarily on hover in/out of the el - it will not cause extra callbacks)
          hoverel.addEventListener("mouseenter", step2bound)
          hoverel.addEventListener("mouseleave", step2bound)
          hoverel.setAttribute("data-css-var-listener", (attrval + " hover-events" + varprop).trim())
        }
      }
      var applyTo = document.querySelectorAll(ruleInfo.singleSector)
      var applyLen = applyTo.length
      var a = 0
      for (a = 0; a < applyLen; a++) {
        var el = applyTo[a]
        var status = elStatusForProp.get(el) || {
          value: undefined,
          compiledValue: undefined,
          newValue: ruleInfo.propValue,
          specificity: ruleInfo.specificity
        }
        if (unapplySet.delete(el)) {
          // element existed last time but this is the first time value is applied to it this cycle, so ignore specificity from previous cycle
          status.newValue = ruleInfo.propValue
          status.specificity = ruleInfo.specificity
        } else if (ruleInfo.specificity >= status.specificity) {
          // override value only if specificity is higher or equal in this rule than whatever rule applied the value before
          // if it's equal, the later one in cssom order overrides previous
          status.newValue = ruleInfo.propValue
          status.specificity = ruleInfo.specificity
        }
        elStatusForProp.set(el, status)
      }
    }
    step3(varprop)
  }

  // call callbacks for newly unapplied elements. Call cb if status has a new value different than previous. Update status when callback called (set value = newValue).
  var step3 = function (varprop) {
    var callbacksForProp = callbacks[varprop] || []
    var cblen = callbacksForProp.length
    var cb = 0
    var elStatusForProp = elStatus[varprop] || new Map()
    var unapplySet = elStatusForProp.get("unapply") || new Set()
    var el = undefined
    var status = undefined
    for (el of unapplySet) {
      // element, newValue, oldValue
      status = elStatusForProp.get(el)
      if (status.value !== undefined) {
        for (cb = 0; cb < cblen; cb++) {
          callbacksForProp[cb].fn({
            target: el,
            prop: varprop,
            value: undefined,
            compiledValue: undefined,
            oldValue: status.value,
            oldCompiledValue: status.compiledValue
          })
        }
      }
      elStatusForProp.delete(el)
    }
    unapplySet.clear()

    for ([el, status] of elStatusForProp) {
      if (el === "unapply") {
        continue
      }
      var compiled = compileValueOnEl(getMemoizedValDeps(status.newValue), el)
      if (status.value !== status.newValue || status.compiledValue !== compiled) {
        for (cb = 0; cb < cblen; cb++) {
          callbacksForProp[cb].fn({
            target: el,
            prop: varprop,
            value: status.newValue,
            compiledValue: compiled,
            oldValue: status.value,
            oldCompiledValue: status.compiledValue
          })
        }
        status.value = status.newValue
        status.compiledValue = compiled
      }
    }
  }

  var depSets = {} // depVar: Set[ ..vars that depend on this depVar.. ]
  var depVarElValues = new WeakMap() // el -> { --depVar: propValStruct }
  var depCallback = function (data) {
    var el = data.target
    var dep = data.prop
    var rootVarProp = this
    var propValStruct = getMemoizedValDeps(data.value)
    var x = depVarElValues.get(el)
    if (x && typeof x[dep] !== "undefined") {
      if (x[dep] !== propValStruct) {
        x[dep] = propValStruct
        step3.call(null, rootVarProp)
      }
    } else if (x) {
      x[dep] = propValStruct
    } else {
      var temp = {}
      temp[dep] = propValStruct
      depVarElValues.set(el, temp)
    }
  }

  var setupDepCallbacks = function (varprop, valueDependencies) {
    var x = 0
    var depSet = undefined
    var depVarProp = undefined
    var len = valueDependencies.length
    for (x = 0; x < len; x++) {
      depVarProp = valueDependencies[x]
      depSet = depSets[depVarProp] || new Set()
      if (!depSet.has(varprop)) {
        depSet.add(varprop)
        cssVarListener(depVarProp, depCallback.bind(varprop), {}) // todo: pass original options
      }
      depSets[depVarProp] = depSet
    }
  }

  var compileValueOnEl = function (propValStruct, el) {
    var output = []
    var x = 0
    var len = propValStruct.length
    var val = undefined
    var depVal = undefined
    var elLoop = el
    for (x = 0; x < len; x++) {
      val = propValStruct[x]
      if (val.depVar) {
        elLoop = el
        while (elLoop) {
          depVal = depVarElValues.get(elLoop)
          depVal = depVal && depVal[val.depVar]
          if (depVal) {
            break
          }
          elLoop = elLoop.parentNode
        }
        output.push(compileValueOnEl(depVal || x.fallback, el))
      } else {
        output.push(val)
      }
    }
    return output.join("")
  }

  var observer = new MutationObserver(function (mutations) {
    var step2props = []
    var step2propsObj = {}
    var mLen = mutations.length
    if (updateFromStyleSheets()) {
      observer.takeRecords()
      return
    }
    for (var m = 0; m < mLen; m++) {
      var mutation = mutations[m]
      var el = mutation.target
      if (el && !el.closest("[data-css-var-listener-ignore]")) {
        var prop = undefined
        for (prop of props) {
          if (step2propsObj[prop]) {
            continue
          }
          var cba = callbacks[prop]
          var cbalen = cba.length
          var cbai = 0
          for (cbai = 0; cbai < cbalen; cbai++) {
            var cbopts = cba[cbai].options
            if (!(cbopts.ignoreAttr && el.closest("[" + cbopts.ignoreAttr + "]"))) {
              break
            }
          }
          if (cbai === cbalen) {
            continue
          }
          step2propsObj[prop] = true
          step2props.push(prop)
        }
      }

      if (step2props.length === props.length) {
        break
      }
    }
    var s2len = step2props.length
    for (var s = 0; s < s2len; s++) {
      // something in dom changed, re-check cascade and apply updates if needed
      try {
        step2(step2props[s])
      } catch (e) {
        remove(step2props[s])
        observer.takeRecords()
        // eslint-disable-next-line no-console
        if (typeof console !== "undefined" && console.warn) {
          // eslint-disable-next-line no-console
          console.warn("cssVarListener: Handling of callbacks for " + step2props[s] + " has been stopped due to the error below.")
        }
        throw e
      }
    }
    observer.takeRecords()
  })

  observer.observe(document, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
  })

  return {
    add: cssVarListener,
    remove: remove,
    getSpecificityOfSingleSelector: getSpecificityOfSingleSelector,
    _step1: step1,
    _step2: step2,
    _step3: step3
  }
})()

export default cssVarListener
