# Lunr search for docsify.js

Search plugin for [docsify.js](https://docsify.js.org/#/) which uses [lunr](https://lunrjs.com/).

## Usage

For use in browsers with script tags, download `search.js` and include the `lunr.js`
CDN like this:

```html
<script>
  window.$docsify = {
    // complete configuration parameters
    // for more options see https://docsify.js.org/#/plugins?id=full-text-search
    search: {
      maxAge: 86400000,
      namespace: 'website-1',
      depth: 1,
    }
  }
</script>
<script src="//unpkg.com/lunr/lunr.js"></script>
<script src="search.js"></script>
```
