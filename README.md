# poly2geohash

## Installation

```
npm install poly2geohash
```

## Usage

```js
const poly2geohash = require("poly2geohash")

const geohashes = poly2geohash([
  [52.5, 13.0], //[lat, long]
  [52.5, 13.3],
  [52.2, 13.3],
  [52.2, 13.0],
  [52.5, 13.0], // make sure the last coordinate is equal to the first one
])

// returns ["u336s", etc.]
```

### poly2geohash(coordinates, precision = 5)

Returns an array of geohashes that intersect with the given polygon

## Testing

run `npm test`

Afterwards you can open the `index.html` in `test/visualization` to see a visualization of the test.
