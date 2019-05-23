# shape2geohash

A small library that turns any GeoJSON shape **(polygons or lines)** into a list of geohashes.


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
  customWriter: null
}
```

* `precision`: Length of the returned geohashes. Also known as geohash level (Level 6 geohash = u336dc)
* `hashMode`: Determines what kind of hashes are being included. Available modes are:
  * `intersect`: Includes all geohashes that intersect with the shape.
  * `envelope`: Includes all geohashes that are inside the rectangular border of the shape.
  * `insideOnly`: Includes only the geohashes that are fully within the polygon.
  * `border`: Includes only the geohashes that intersect with the border of the polygon.
* `customWriter`: Custom `Writable` Stream that can used for custom stream processing. See [Custom Stream Processing](#custom-stream-processing) section for more details.

## Custom Stream Processing

This package uses Node.js Streams to process the incoming shape row-wise from top to bottom. You can substitute the internally used `Writable` Stream with your custom `Writable` Stream. This may be useful if you want to process extremely large polygons. 

You need to implement the `write` method to receive the data. The data passed into the `write` method will be all geohashes that are in the current row from top to bottom. 

Since the incoming data is always an array you MUST enable `objectMode`!

```js
const Stream = require("stream")

const myCustomWriter = new Stream.Writable({
  objectMode: true, // THIS IS IMPORTANT
  write: (rowGeohashes, enc, callback) => {
    // rowGeohashes = ["u336x", ...]
    // Do some processing with the incoming geohashes per row
    callback()
  },
})

shape2geohash(polygon, { 
  customWriter: myCustomWriter,
  // ...other options
})
```

## Testing

run `npm test`

Afterwards you can open the `index.html` in `test/visualization` to see a visualization of the test.
