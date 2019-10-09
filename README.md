![James0x57](https://img.shields.io/badge/James0x57%20%F0%9F%91%BD-I%20made%20a%20thing!-blueviolet.svg?labelColor=222222)

# cssVarListener

doesn't rely on `getComputedStyle()` or other [functions that cause reflow](https://gist.github.com/paulirish/5d52fb081b3570c81e3a)

`npm install css-var-listener`

# Usage

```js
import cssVarListener from "css-var-listener"

cssVarListener.add("--yourvar", callback, options)
```

Where:
 * `"--yourvar"` is any custom property you want to add functionality to
 * callback is a function that takes 1 argument, wich is an object containing:
   - `target` - the element your CSS is applying `"--yourvar"` to
   - `value` - the value of `"--yourvar"` as determined by the document's stylesheets (see `Value determination and specificity` at the bottom of this readme)
   - `oldValue` - the previous value of `"--yourvar"` if a change in the DOM, :hover states, or stylesheet adding/removal caused it to change
   - `compiledValue` - the value of `"--yourvar"` with any `var(--dep)` replaced with its value as determined by the document's stylesheets
   - `oldCompiledValue` - the previous compiled value
   - `prop` - the css variable name `"--yourvar"`
 * options is an object with optional properties:
   - `ignoreAttr: "data-optional-ignore-attr"` causes DOM changes within to be ignored (see `Ignoring Observer Changes` below)

# Lifecycle

 * when cssVarListener is called with a prop, it searches the style tags and link'd stylesheets for that prop and caches selectors that set it (plus the specificity and the var value of that rule).
 * The callback is called for every element it applies to initially - just once with the final value.
 * Rules in the CSS with :hover selectors (that set your var) will result in mouseenter and mouseleave events being attached so the var value will be recalculated as needed (and callbacks will be called if/when the var's value changes for an element)
   - CSS selectors with unnecessary/extra :hover at multiple levels are not currently supported
   - for example: `div:hover > a:hover` is not supported
   - but `div:hover > a, div > a:hover` is fine
 * an internal observer watches for elements or attributes to be added/changed/removed from the DOM. On any change, it runs the selector cache to determine any callbacks that need to happen
 * if an element is removed or otherwise has your var no longer applied, the callback will be called with the element and `undefined` for the `newValue`
 * When a style tag or link'd stylesheet is added or removed, the selector cache is rebuilt and callbacks are called only for elements with a changed value
 * ::pseudo-elements aren't captured by `document.querySelectorAll` so no callbacks happen for these rules

# Ignoring Observer Changes

You can use the built in `data-css-var-listener-ignore` to ignore all element changes within for all vars enhanced with cssVarListener. This prevents the cascade from checking if the cached selectors apply (or stop applying) to new/different elements.

The ignore attribute is especially important to add to javascript animation containers since every DOM change is observed.

Adding `ignoreAttr` to cssVarListener's options param (`ignoreAttr: "data-optional-ignore-attr"`) allows specific callbacks (or depentant packages) to individually opt-out of cascade checks from dom changes if needed.

Note: Initial callbacks and initially applied :hover checks for your CSS var still happen if they apply to elements within. Only further changes are ignored. Stylesheets added within are still tracked.

# Ignoring styleSheets

Putting `data-css-var-listener-ignore-stylesheets` on a stylesheet's element or ancestor will cause the stylesheet to be ignored. This prevents newly added or removed stylesheets from rebuilding the selector cache (and subsequent cascade check).

# Value determination and specificity

 * If your style has a space ( `between: these;` ), the value will start with the space. All values are strings (or `undefined`)
 * !important flag is ignored in the specificity calculation
 * Inline styles (style attribute on the element) are not considered (your callback could override the var inline without blocking potential future callbacks)
 * Any other deviation from CSS in specificity is unintentional, please file an issue if you encounter one

