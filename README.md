[![Codecov Coverage](https://img.shields.io/codecov/c/github/marcelreppi/shape2geohash/master.svg?style=flat-square)](https://codecov.io/gh/marcelreppi/shape2geohash/)
[![npm version](https://badge.fury.io/js/shape2geohash.svg)](https://badge.fury.io/js/shape2geohash)
[![Build Status](https://travis-ci.org/marcelreppi/shape2geohash.svg?branch=master)](https://travis-ci.org/marcelreppi/shape2geohash)

# shape2geohash

A small library that turns **any GeoJSON shape** into a list of geohashes.


## Installation

```
npm install shape2geohash
```

## Usage

```js
const shape2geohash = require("shape2geohash")

// Providing polygon as GeoJSON
const geohashes1 = await shape2geohash({
  type: "Polygon",
  coordinates: [
    [
      [13.0, 52.5], //[long, lat]
      [13.3, 52.5],
      [13.3, 52.2],
      [13.0, 52.2],
      [13.0, 52.5], // make sure the last coordinate is equal to the first one
    ]
  ]
})

// returns ["u336xp", etc.]


// Providing polygon as an array of coordinates
const geohashes2 = await shape2geohash([
  [
    [13.0, 52.5], //[long, lat]
    [13.3, 52.5],
    [13.3, 52.2],
    [13.0, 52.2],
    [13.0, 52.5], // make sure the last coordinate is equal to the first one
  ]
])

// returns ["u336xp", etc.]
```

### shape2geohash(geoJSON, options)

* `geoJSON` can be any of these things:
  * Any GeoJSON object of the following type:
    * `FeatureCollection`
    * `Feature`
    * `Polygon`
    * `MultiPolygon`
    * `LineString`
    * `MultiLineString`
    * `Point`
    * `MultiPoint`
  * A single polygon as a simple array of coordinates
  * An array of polygons

Returns a promise that resolves to an array of geohashes that intersect with the given shape(s)

### Options

```js
const defaultOptions = {
  precision: 6,
  hashMode: "intersect",
  minIntersect: 0,
  allowDuplicates: true,
  customWriter: null
}
```

* `precision`: Length of the returned geohashes. Also known as geohash level (Level 6 geohash = u336dc)
* `hashMode`: Determines what kind of hashes are being included. Available modes are:
  * `intersect`: Includes all geohashes that intersect with the shape.
  * `envelope`: Includes all geohashes that are inside the rectangular border of the shape.
  * `insideOnly`: Includes only the geohashes that are fully within the polygon.
  * `border`: Includes only the geohashes that intersect with the border of the polygon.
* `minIntersect`: Percentage value between `0` and `1`. Defines the minimum area of a geohash that needs to be covered by the polygon to be included in the geohash list. This is only relevant for the edge of the polygon when using the hashMode `intersect`.
* `allowDuplicates`: Determines if the output array may contain duplicate geohashes. These can occur when, for example, multiple polygons overlap.
* `customWriter`: Custom `Writable` Stream that can used for custom stream processing. See [Custom Stream Processing](#custom-stream-processing) section for more details.

## Custom Stream Processing

This package uses Node.js Streams to process the incoming shape row-wise from top to bottom. You can substitute the internally used `Writable` Stream with your custom `Writable` Stream. This may be useful if you want to process extremely large polygons. 

You need to implement the `write` method to receive the data. The data passed into the `write` method will be all geohashes that are in the current row from top to bottom. 

Since the incoming data is always an array you MUST enable `objectMode`!

```js
const Stream = require("stream")

const myGeohashes = []
const myCustomWriter = new Stream.Writable({
  objectMode: true, // THIS IS IMPORTANT
  write: (rowGeohashes, enc, callback) => {
    // rowGeohashes = ["u336xp", ...]
    // Do some processing with the incoming geohashes per row
    myGeohashes.push(...rowGeohashes)
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
