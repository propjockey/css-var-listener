import QUnit from "steal-qunit"
import cssVarListener from "../css-var-listener.js"

const { test } = QUnit
const domEl = document.getElementById("qunit-fixture")

let lastss = undefined
const head = document.getElementsByTagName("head")[0]
const addStylesheet = function (css) {
  if (lastss) {
    head.removeChild(lastss)
  }
  const styleEl = document.createElement("style")
  styleEl.innerHTML = css
  head.appendChild(styleEl)
  lastss = styleEl
}

QUnit.module("cssVarListener from PropJockey", function (hooks) {
  test("import should work", t => {
    t.ok(cssVarListener, "exists")
    t.ok(cssVarListener.add, "exists")
    t.ok(cssVarListener.remove, "exists")
    t.ok(cssVarListener.getSpecificityOfSingleSelector, "exists")
    t.ok(cssVarListener._step1, "exists")
    t.ok(cssVarListener._step2, "exists")
    t.ok(cssVarListener._step3, "exists")
  })
  test("getSpecificityOfSingleSelector works", t => {
    const sp = cssVarListener.getSpecificityOfSingleSelector
    t.strictEqual(sp("*"),                               0,  "*")
    t.strictEqual(sp("div"),                             1,  "div")
    t.strictEqual(sp("alien > div"),                     2,  "alien > div")
    t.strictEqual(sp(".c"),                            100,  ".c")
    t.strictEqual(sp("*.c"),                           100,  "*.c")
    t.strictEqual(sp("div.c"),                         101,  "div.c")
    t.strictEqual(sp(":first-child"),                  100,  ":first-child")
    t.strictEqual(sp("div:first-child"),               101,  "div:first-child")
    t.strictEqual(sp(".div:first-child"),              200,  ".div:first-child")
    t.strictEqual(sp(":first-child:lang(et)"),         200,  ":first-child:lang(et)")
    t.strictEqual(sp(":first-child:not(*)"),           100,  ":first-child:not(*)")
    t.strictEqual(sp(":first-child:is(div)"),          101,  ":first-child:is(div)")
    t.strictEqual(sp(":first-child:where(#id)"),       100,  ":first-child:where(#id)")
    t.strictEqual(sp(":first-child:not(a#b)"),       10101,  ":first-child:not(a#b)")
    t.strictEqual(sp("::first-letter"),                  1,  "::first-letter")
    t.strictEqual(sp("::unknownpseudoel"),               1,  "::unknownpseudoel")
    t.strictEqual(sp("div::first-letter"),               2,  "div::first-letter")
    t.strictEqual(sp("alien > div::first-letter"),       3,  "alien > div::first-letter")
    t.strictEqual(sp("#id"),                         10000,  "#id")
    t.strictEqual(sp("span#id.bob"),                 10101,  "span#id.bob")
    t.strictEqual(sp("[type='],wtf.stupid sel']"),     100,  "[type='],wtf.stupid sel']")
    t.strictEqual(sp("[type=\"'\\\"\"] div[a=']"),     201,  "[type=\"'\\\"\"] div[a=']")
    t.strictEqual(sp("input[type]:not(.class)"),       201,  "input[type]:not(.class)")
    t.strictEqual(sp("form input[type=number]"),       102,  "form input[type=number]")
    t.strictEqual(sp("div ~ #id + .class:hover"),    10201,  "div ~ #id + .class:hover")
    t.strictEqual(sp("a#id#id2#id3#id4"),            40001,  "a#id#id2#id3#id4")
    t.strictEqual(sp("* > * + * ~ * *"),                 0,  "* > * + * ~ * *")
    t.strictEqual(sp(".a.b.c.d.e"),                    500,  ".a.b.c.d.e")
    t.strictEqual(sp("a b c d e"),                       5,  "a b c d e")
  })
  test("works on register", t => {
    t.expect(3)
    // css has #qunit-fixture { --test: value; }
    cssVarListener.add("--test", ({ target, value, oldValue }) => {
      t.strictEqual(domEl, target, "applied to the correct element")
      t.strictEqual((value || "").trim(), "value", "applied with correct value")
      t.strictEqual(oldValue, undefined, "applied with correct oldValue")
    })
  })
  test("applies values with respect for CSS specificity", t => {
    addStylesheet(`
      #gold {
        --testSpecificity: cyan;
      }
      #gold:not([green]) {
        --testSpecificity: gold;
      }
      .not.red {
        --testSpecificity: blue;
      }
      .red {
        --testSpecificity: red;
      }
      .green,
      [green] {
        --testSpecificity: green;
      }
      .a + .b {
        --testSpecificity: teal;
      }
      .b {
        --testSpecificity: not teal;
      }
    `)
    domEl.innerHTML = `
      <div id="gold" class="not red" green>should be cyan</div>
      <div class="red">should be red</div>
      <div class="red" green>should be green</div>
      <div class="red green">should be green too</div>
      <div class="red not" green>should be blue</div>
      <div id="gold">should be gold</div>
      <div class="a"></div>
      <div class="b"></div>
    `
    t.expect(7)
    cssVarListener.add("--testSpecificity", ({ target, value, oldValue }) => {
      const els = domEl.children
      if (target === els[0]) {
        t.strictEqual(value, " cyan")
      } else if (target === els[1]) {
        t.strictEqual(value, " red")
      } else if (target === els[2]) {
        t.strictEqual(value, " green")
      } else if (target === els[3]) {
        t.strictEqual(value, " green")
      } else if (target === els[4]) {
        t.strictEqual(value, " blue")
      } else if (target === els[5]) {
        t.strictEqual(value, " gold")
      } else if (target === els[7]) {
        t.strictEqual(value, " teal")
      } else {
        t.ok(false, "Should not be calling back to anything else")
      }
    })
    cssVarListener.remove("--testSpecificity")
  })
  test("updates when stylesheets change", t => {
    addStylesheet("") // remove previous one
    domEl.innerHTML = `
      <div id="gold" class="not red" green>should be cyan</div>
      <div class="red">should be red</div>
      <div class="red" green>should be green</div>
      <div class="red green">should be green too</div>
      <div class="red not" green>should be green then blue</div>
      <div id="gold">should be gold</div>
      <div class="a"></div>
      <div class="b"></div>
    `
    t.expect(11)
    var order = 0
    var gb = 0
    cssVarListener.add("--testSpecificity", ({ target, value, oldValue }) => {
      order++
      const els = domEl.children
      if (target === els[0]) {
        t.strictEqual(value, " cyan")
      } else if (target === els[1]) {
        t.strictEqual(value, " red")
      } else if (target === els[2]) {
        t.strictEqual(value, " green")
      } else if (target === els[3]) {
        t.strictEqual(value, " green")
      } else if (target === els[4]) {
        if (gb === 0) {
          t.strictEqual(value, " green")
          gb++
        } else {
          t.strictEqual(value, " blue")
        }
      } else if (target === els[5]) {
        t.strictEqual(value, " gold")
      } else if (target === els[7]) {
        t.strictEqual(value, " teal")
      } else {
        t.ok(false, "Should not be calling back to anything else")
      }
    })
    t.strictEqual(order, 0, "no callbacks happen yet")
    addStylesheet(`
      #gold {
        --testSpecificity: cyan;
      }
      #gold:not([green]) {
        --testSpecificity: gold;
      }
      .red {
        --testSpecificity: red;
      }
      .green,
      [green] {
        --testSpecificity: green;
      }
    `)
    return (
      new Promise(r => setTimeout(() => {
        t.strictEqual(order, 6, "6 callbacks happened now")
        addStylesheet(`
          #gold {
            --testSpecificity: cyan;
          }
          #gold:not([green]) {
            --testSpecificity: gold;
          }
          .not.red {
            --testSpecificity: blue;
          }
          .red {
            --testSpecificity: red;
          }
          .green,
          [green] {
            --testSpecificity: green;
          }
          .a + .b {
            --testSpecificity: teal;
          }
          .b {
            --testSpecificity: not teal;
          }
        `) // replaces the previous stylesheet
        r()
      }, 500))
    ).then(
      new Promise(r => setTimeout(() => {
        t.strictEqual(order, 8, "callbacks happened only for elements with values that change")
        cssVarListener.remove("--testSpecificity")
        r()
      }, 500))
    )
  })
  test("data-css-var-listener-ignore-stylesheets works", t => {
    addStylesheet("") // remove previous one
    head.setAttribute("data-css-var-listener-ignore-stylesheets", "")
    domEl.innerHTML = `
      <div id="gold" class="not red" green>should be cyan</div>
      <div class="red">should be red</div>
      <div class="red" green>should be green</div>
      <div class="red green">should be green too</div>
      <div class="red not" green>should be green then blue</div>
      <div id="gold">should be gold</div>
      <div class="a"></div>
      <div class="b"></div>
    `
    t.expect(1)
    cssVarListener.add("--testSpecificity", ({ target, value, oldValue }) => {
      t.ok(false, "Should not be applying to anything")
    })
    addStylesheet(`
      #gold {
        --testSpecificity: cyan;
      }
      #gold:not([green]) {
        --testSpecificity: gold;
      }
      .red {
        --testSpecificity: red;
      }
      .green,
      [green] {
        --testSpecificity: green;
      }
    `)
    return (
      new Promise(r => setTimeout(() => {
        addStylesheet(`
          #gold {
            --testSpecificity: cyan;
          }
          #gold:not([green]) {
            --testSpecificity: gold;
          }
          .not.red {
            --testSpecificity: blue;
          }
          .red {
            --testSpecificity: red;
          }
          .green,
          [green] {
            --testSpecificity: green;
          }
          .a + .b {
            --testSpecificity: teal;
          }
          .b {
            --testSpecificity: not teal;
          }
        `) // replaces the previous stylesheet
        r()
      }, 500))
    ).then(
      new Promise(r => setTimeout(() => {
        t.ok(true, "stylesheets ignored")
        cssVarListener.remove("--testSpecificity")
        head.removeAttribute("data-css-var-listener-ignore-stylesheets")
        r()
      }, 500))
    )
  })
  test("triggers correctly when elements being removed change the value", t => {
    addStylesheet(`
      .removeTest {
        --test2: 0;
      }
      .removeTest + .sibTest {
        --test2: 1;
      }
      .sibTest {
        --test2: 2;
      }
    `)
    domEl.innerHTML = `
      <div class="removeTest"></div>
      <div class="sibTest startsas1becomes2"></div>
      <div class="sibTest always2"></div>
    `
    t.expect(15)
    cssVarListener.add("--test2", ({ target, value, oldValue }) => {
      const cn = target.className
      const happensOnce = { a: 0, b: 0, c: 0, d: 0, e: 0 }
      if (cn === "removeTest") {
        if (value) {
          happensOnce.a++
          t.strictEqual(happensOnce.a, 1, "only happens once")
          t.strictEqual((value || "").trim(), "0", "removeTest 0")
          t.strictEqual(oldValue, undefined, "applied with correct oldValue")
        } else {
          happensOnce.e++
          t.strictEqual(happensOnce.e, 1, "only happens once")
          t.strictEqual(value, undefined, "element no longer has value applied (because it was removed)")
          t.strictEqual((oldValue || "").trim(), "0", "called with correct oldValue")
        }
      } else if (cn === "sibTest startsas1becomes2") {
        if (domEl.childElementCount === 3) {
          happensOnce.b++
          t.strictEqual(happensOnce.b, 1, "only happens once")
          t.strictEqual((value || "").trim(), "1", "sibTest startsas1becomes2 1")
          t.strictEqual(oldValue, undefined, "applied with correct oldValue")
        } else {
          happensOnce.c++
          t.strictEqual(happensOnce.c, 1, "only happens once")
          t.strictEqual((value || "").trim(), "2", "sibTest startsas1becomes2 2")
          t.strictEqual((oldValue || "").trim(), "1", "oldValue sibTest startsas1becomes2 1")
        }
      } else if (cn === "sibTest always2") {
        happensOnce.d++
        t.strictEqual(happensOnce.d, 1, "only happens once")
        t.strictEqual((value || "").trim(), "2", "sibTest always2 2")
        t.strictEqual(oldValue, undefined, "applied with correct oldValue")
      } else {
        t.ok(false, "Shouldn't be updating anything else.")
      }
    })

    domEl.removeChild(domEl.firstElementChild)

    return new Promise(r => setTimeout(() => {
      cssVarListener.remove("--test2")
      r()
    }, 500))
  })
  test("triggers correctly when elements being added change the value", t => {
    addStylesheet(`
      .addTest {
        --test3: 0;
      }
      .addTest ~ .sibTest {
        --test3: 1;
      }
      .sibTest {
        --test3: 2;
      }
    `)
    domEl.innerHTML = `
      <div class="sibTest always2"></div>
      <div class="sibTest startsas2becomes1"></div>
      <div class="sibTest startsas2becomes1"></div>
    `
    t.expect(18)
    cssVarListener.add("--test3", ({ target, value, oldValue }) => {
      const cn = target.className
      const happenCount = { a: 0, b: 0, c: 0, d: 0 }
      if (cn === "sibTest always2") {
        happenCount.a++
        t.strictEqual(happenCount.a, 1, "only happens once")
        t.strictEqual((value || "").trim(), "2", "sibTest always2 2")
        t.strictEqual(oldValue, undefined, "applied with correct oldValue")
      } else if (cn === "sibTest startsas2becomes1") {
        if (domEl.childElementCount === 3) {
          happenCount.b++
          t.ok(happenCount.b <= 2, "happens once for two")
          t.strictEqual((value || "").trim(), "2", "sibTest startsas2becomes1 2")
          t.strictEqual(oldValue, undefined, "applied with correct oldValue")
        } else {
          happenCount.c++
          t.ok(happenCount.c <= 2, "happens once for two")
          t.strictEqual((value || "").trim(), "1", "sibTest startsas2becomes1 1")
          t.strictEqual((oldValue || "").trim(), "2", "called with correct oldValue")
        }
      } else if (cn === "addTest") {
        happenCount.d++
        t.strictEqual(happenCount.d, 1, "only happens once")
        t.strictEqual((value || "").trim(), "0", "addTest 0")
        t.strictEqual(oldValue, undefined, "added and recieved correct oldValue")
      } else {
        t.ok(false, "Shouldn't be updating anything else.")
      }
    })
    const newEl = document.createElement("div")
    newEl.className = "addTest"
    domEl.insertBefore(newEl, domEl.firstElementChild.nextElementSibling)

    return new Promise(r => setTimeout(() => {
      cssVarListener.remove("--test3")
      r()
    }, 500))
  })
  test("triggers correctly when element attr changing causes a change in the value", t => {
    addStylesheet(`
      [changeTest] {
        --test4: 0;
      }
      [changeTest~="hello"] ~ .sibTest {
        --test4: 1;
      }
      .sibTest {
        --test4: 2;
      }
    `)
    domEl.innerHTML = `
      <div class="sibTest always2"></div>
      <div class="changeTest"></div>
      <div class="sibTest startsas2becomes1"></div>
      <div class="sibTest startsas2becomes1"></div>
    `
    const changeEl = domEl.querySelector(".changeTest")
    t.expect(18)
    cssVarListener.add("--test4", ({ target, value, oldValue }) => {
      const cn = target.className
      const happenCount = { a: 0, b: 0, c: 0, d: 0 }
      if (cn === "sibTest always2") {
        happenCount.a++
        t.strictEqual(happenCount.a, 1, "only happens once")
        t.strictEqual((value || "").trim(), "2", "sibTest always2 2")
        t.strictEqual(oldValue, undefined, "applied with correct oldValue")
      } else if (cn === "sibTest startsas2becomes1") {
        if (changeEl.getAttribute("changeTest") !== "oh hello there") {
          happenCount.b++
          t.ok(happenCount.b <= 2, "happens once for two")
          t.strictEqual((value || "").trim(), "2", "sibTest startsas2becomes1 2")
          t.strictEqual(oldValue, undefined, "applied with correct oldValue")
        } else {
          happenCount.c++
          t.ok(happenCount.c <= 2, "happens once for two")
          t.strictEqual((value || "").trim(), "1", "sibTest startsas2becomes1 1")
          t.strictEqual((oldValue || "").trim(), "2", "called with correct oldValue")
        }
      } else if (cn === "changeTest") {
        happenCount.d++
        t.strictEqual(happenCount.d, 1, "only happens once")
        t.strictEqual((value || "").trim(), "0", "changeTest 0")
        t.strictEqual(oldValue, undefined, "added and recieved correct oldValue")
      } else {
        t.ok(false, "Shouldn't be updating anything else.")
      }
    })
    changeEl.setAttribute("changeTest", "hi") // won't result in any callbacks

    return (
      new Promise(r => {
        setTimeout(() => {
          changeEl.setAttribute("changeTest", "oh hello there")
          r()
        }, 500)
      })
    ).then(
      new Promise(r => setTimeout(() => {
        cssVarListener.remove("--test4")
        r()
      }, 500))
    )
  })
  test("data-css-var-listener-ignore works", t => {
    addStylesheet(`
      .removedLater + .test {
        --testMainIgnore: true;
      }
      .test {
        --testMainIgnore: false;
      }
      .addedLater ~ .test {
        --testMainIgnore: ignored;
      }
    `)
    domEl.innerHTML = `
      <div class="ignore-container" data-css-var-listener-ignore>
        <div class="removedLater"></div>
        <div class="test">always true</div>
      </div>
    `
    const testEl = domEl.querySelector(".test")
    const addEl = document.createElement("div")
    addEl.className = "addedLater"
    t.expect(1)
    cssVarListener.add("--testMainIgnore", ({ target, value, oldValue }) => {
      t.strictEqual(value, " true")
    })

    return (
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.removeChild(testEl.previousElementSibling)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.insertBefore(addEl, testEl)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => setTimeout(() => {
        cssVarListener.remove("--testMainIgnore")
        r()
      }, 500))
    )
  })
  test("data-css-var-listener-ignore works when custom one is defined", t => {
    addStylesheet(`
      .removedLater + .test {
        --testMainIgnore: true;
      }
      .test {
        --testMainIgnore: false;
      }
      .addedLater ~ .test {
        --testMainIgnore: ignored;
      }
    `)
    domEl.innerHTML = `
      <div class="ignore-container" data-css-var-listener-ignore>
        <div class="removedLater"></div>
        <div class="test">always true</div>
      </div>
    `
    const testEl = domEl.querySelector(".test")
    const addEl = document.createElement("div")
    addEl.className = "addedLater"
    t.expect(1)
    cssVarListener.add("--testMainIgnore", ({ target, value, oldValue }) => {
      t.strictEqual(value, " true")
    }, {ignoreAttr: "data-custom-ignore-attr"})

    return (
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.removeChild(testEl.previousElementSibling)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.insertBefore(addEl, testEl)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => setTimeout(() => {
        cssVarListener.remove("--testMainIgnore")
        r()
      }, 500))
    )
  })
  test("custom ignore attr works", t => {
    addStylesheet(`
      .removedLater + .test {
        --testMainIgnore: true;
      }
      .test {
        --testMainIgnore: false;
      }
      .addedLater ~ .test {
        --testMainIgnore: ignored;
      }
    `)
    domEl.innerHTML = `
      <div class="ignore-container" data-custom-ignore-attr>
        <div class="removedLater"></div>
        <div class="test">always true</div>
      </div>
    `
    const testEl = domEl.querySelector(".test")
    const addEl = document.createElement("div")
    addEl.className = "addedLater"
    t.expect(1)
    cssVarListener.add("--testMainIgnore", ({ target, value, oldValue }) => {
      t.strictEqual(value, " true")
    }, {ignoreAttr: "data-custom-ignore-attr"})

    return (
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.removeChild(testEl.previousElementSibling)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => {
        setTimeout(() => {
          testEl.parentNode.insertBefore(addEl, testEl)
          r()
        }, 500)
      })
    ).then(
      new Promise(r => setTimeout(() => {
        cssVarListener.remove("--testMainIgnore")
        r()
      }, 500))
    )
  })

  test("compiledValue works without var in the values", t => {
    addStylesheet(`
      #gold {
        --testCompiledValue: cyan;
      }
      #gold:not([green]) {
        --testCompiledValue: gold;
      }
      .not.red {
        --testCompiledValue: blue;
      }
      .red {
        --testCompiledValue: red;
      }
      .green,
      [green] {
        --testCompiledValue: green;
      }
      .a + .b {
        --testCompiledValue: teal;
      }
      .b {
        --testCompiledValue: not teal;
      }
    `)
    domEl.innerHTML = `
      <div id="gold" class="not red" green>should be cyan</div>
      <div class="red">should be red</div>
      <div class="red" green>should be green</div>
      <div class="red green">should be green too</div>
      <div class="red not" green>should be blue</div>
      <div id="gold">should be gold</div>
      <div class="a"></div>
      <div class="b"></div>
    `
    t.expect(7)
    cssVarListener.add("--testCompiledValue", ({ target, compiledValue, oldValue }) => {
      const value = compiledValue
      const els = domEl.children
      if (target === els[0]) {
        t.strictEqual(value, " cyan")
      } else if (target === els[1]) {
        t.strictEqual(value, " red")
      } else if (target === els[2]) {
        t.strictEqual(value, " green")
      } else if (target === els[3]) {
        t.strictEqual(value, " green")
      } else if (target === els[4]) {
        t.strictEqual(value, " blue")
      } else if (target === els[5]) {
        t.strictEqual(value, " gold")
      } else if (target === els[7]) {
        t.strictEqual(value, " teal")
      } else {
        t.ok(false, "Should not be calling back to anything else")
      }
    })
    cssVarListener.remove("--testCompiledValue")
  })

  test("compiledValue works with var in the values", t => {
    addStylesheet(`
      #gold {
        --val: cyan;
        --testCompiledValue:var(--val);
      }
      #gold:not([green]) {
        --val: gold;
        --testCompiledValue:var(--val);
      }
      .not.red {
        --val: blue;
        --testCompiledValue:var(--val);
      }
      .red {
        --val: red;
        --testCompiledValue:var(--val);
      }
      .green,
      [green] {
        --val: green;
        --testCompiledValue:var(--val);
      }
      .a + .b {
        --val: teal;
        --testCompiledValue:var(--val);
      }
      .b {
        --val: not teal;
        --testCompiledValue:var(--val);
      }
    `)
    domEl.innerHTML = `
      <div id="gold" class="not red" green>should be cyan</div>
      <div class="red">should be red</div>
      <div class="red" green>should be green</div>
      <div class="red green">should be green too</div>
      <div class="red not" green>should be blue</div>
      <div id="gold">should be gold</div>
      <div class="a"></div>
      <div class="b"></div>
    `
    t.expect(7)
    cssVarListener.add("--testCompiledValue", ({ target, compiledValue, oldValue }) => {
      const value = compiledValue
      const els = domEl.children
      if (target === els[0]) {
        t.strictEqual(value, " cyan")
      } else if (target === els[1]) {
        t.strictEqual(value, " red")
      } else if (target === els[2]) {
        t.strictEqual(value, " green")
      } else if (target === els[3]) {
        t.strictEqual(value, " green")
      } else if (target === els[4]) {
        t.strictEqual(value, " blue")
      } else if (target === els[5]) {
        t.strictEqual(value, " gold")
      } else if (target === els[7]) {
        t.strictEqual(value, " teal")
      } else {
        t.ok(false, "Should not be calling back to anything else")
      }
    })
    cssVarListener.remove("--testCompiledValue")
  })
})

// todo: test @supports and @media stuff (includes resize window tests)
// todo: test :hover with funcunit?

// todo: test around cross-domain stylesheets (and put notes in the readme about this)

// todo: var listener remove() needs to tear down dep var callbacks

// todo: get rid of data-css-var-listener hover-events stuff - use internal instead
// todo: tear down hover events on remove()
