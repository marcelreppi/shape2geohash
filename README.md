# poly2geohash

## Installation

```
npm install poly2geohash
```

## Usage

```js
const poly2geohash = require("poly2geohash")

const geohashes = await poly2geohash([
  [
    [13.0, 52.5], //[long, lat]
    [13.3, 52.5],
    [13.3, 52.2],
    [13.0, 52.2],
    [13.0, 52.5], // make sure the last coordinate is equal to the first one
  ]
])

// returns ["u336s", etc.]
```

### poly2geohash(polygons, options)

* `polygons` can be a single polygon or an array of polygons in the GeoJSON format

Returns a promise that resolves to an array of geohashes that intersect with the given polygon(s)

### Options

* `precision`: Length of the returned geohashes. Also known as geohash level (Level 6 geohash = u336dc)

## Testing

run `npm test`

Afterwards you can open the `index.html` in `test/visualization` to see a visualization of the test.
