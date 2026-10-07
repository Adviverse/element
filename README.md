# @adviverse/element

Framework-agnostic `<adviverse-ad>` web component for Adviverse ad slots. Works in plain HTML, Vue, Svelte, Angular, and anywhere custom elements are supported.

```html
<script type="module">import '@adviverse/element'</script>

<adviverse-ad tag="tk_..." sizes="300x250"></adviverse-ad>
```

- Loads `https://serve.adviverse.com/sdk/v1.js` once per page (override with `window.ADVIVERSE_ENDPOINT`).
- Renders on connect, destroys on disconnect. Does nothing if `tag` is missing.
- SSR-safe: importing touches no DOM globals.

Attributes: `tag` (required), `sizes` (e.g. `300x250`). Also exports `loadSdk()` and `AdviverseAdElement`.
