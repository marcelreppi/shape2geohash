# shape2geohash

A small library that turns any GeoJSON shape **(polygon(s) or lines)** into a list of geohashes.


## Installation

```
npm install shape2geohash
```

## Usage

```js
const shape2geohash = require("shape2geohash")

const geohashes = await shape2geohash([
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

### shape2geohash(geoJSON, options)

* `geoJSON` can be any of these things:
  * A single polygon in GeoJSON format
  * An array of polygons in GeoJSON format
  * A line in GeoJSON format
  * An array of lines in GeoJSON format

Returns a promise that resolves to an array of geohashes that intersect with the given shape(s)

### Options

```js
const defaultOptions = {
  precision: 6,
  hashMode: "intersect",
}
```

* `precision`: Length of the returned geohashes. Also known as geohash level (Level 6 geohash = u336dc)
* `hashMode`: Determines what kind of hashes are being included. Available modes are:
  * `intersect`: Includes all geohashes that intersect with the shape.
  * `envelope`: Includes all geohashes that are inside the rectangular border of the shape.
  * `insideOnly`: Includes only the geohashes that are fully within the polygon.
  * `border`: Includes only the geohashes that intersect with the border of the polygon.

## Testing

run `npm test`

Afterwards you can open the `index.html` in `test/visualization` to see a visualization of the test.
