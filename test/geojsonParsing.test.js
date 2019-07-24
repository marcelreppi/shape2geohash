const helpers = require("../helpers")
const geojsonExamples = require("./geojsonExamples")

describe("Test GeoJSON parsing", () => {
  test("Type: FeatureCollection", async () => {
    const FeatureCollection = geojsonExamples.FeatureCollection()
    const a = helpers.extractCoordinatesFromGeoJSON(FeatureCollection)
    const b = []
    for (let feature of FeatureCollection.features) {
      b.push(feature.geometry)
    }

    expect(a.length).toBe(b.length)
  })

  test("Type: Feature", async () => {
    const Feature = geojsonExamples.Feature()
    const a = helpers.extractCoordinatesFromGeoJSON(Feature)
    const b = Feature.geometry.coordinates

    expect(a.length).toBe(1)
    expect(a[0]).toBe(b)
  })

  test("Type: Polygon", async () => {
    const Polygon = geojsonExamples.Polygon()
    const a = helpers.extractCoordinatesFromGeoJSON(Polygon)
    const b = Polygon.coordinates

    expect(a.length).toBe(1)
    expect(a[0]).toBe(b)
  })

  test("Type: MultiPolygon", async () => {
    const MultiPolygon = geojsonExamples.MultiPolygon()
    const a = helpers.extractCoordinatesFromGeoJSON(MultiPolygon)
    const b = MultiPolygon.coordinates

    expect(a.length).toBe(b.length)
  })

  test("Type: LineString", async () => {
    const LineString = geojsonExamples.LineString()
    const a = helpers.extractCoordinatesFromGeoJSON(LineString)
    const b = LineString.coordinates

    expect(a.length).toBe(1)
    expect(a[0]).toBe(b)
  })

  test("Type: MultiLineString", async () => {
    const MultiLineString = geojsonExamples.MultiLineString()
    const a = helpers.extractCoordinatesFromGeoJSON(MultiLineString)
    const b = MultiLineString.coordinates

    expect(a.length).toBe(b.length)
  })

  test("Type: Point", async () => {
    const Point = geojsonExamples.Point()
    const a = helpers.extractCoordinatesFromGeoJSON(Point)
    const b = Point.coordinates

    expect(a.length).toBe(1)
    expect(a[0]).toBe(b)
  })

  test("Type: MultiPoint", async () => {
    const MultiPoint = geojsonExamples.MultiPoint()
    const a = helpers.extractCoordinatesFromGeoJSON(MultiPoint)
    const b = MultiPoint.coordinates

    expect(a.length).toBe(b.length)
  })
})

describe("Test GeoJSON parsing errors", () => {
  test("Missing type", async () => {
    const Polygon = geojsonExamples.Polygon()
    delete Polygon.type
    expect(() => helpers.extractCoordinatesFromGeoJSON(Polygon)).toThrowError()
  })

  test("Missing coordinates (1)", async () => {
    const Polygon = geojsonExamples.Polygon()
    delete Polygon.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(Polygon)).toThrowError()
  })

  test("Missing coordinates (2)", async () => {
    const MultiPolygon = geojsonExamples.MultiPolygon()
    delete MultiPolygon.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(MultiPolygon)).toThrowError()
  })

  test("Missing coordinates (3)", async () => {
    const LineString = geojsonExamples.LineString()
    delete LineString.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(LineString)).toThrowError()
  })

  test("Missing coordinates (4)", async () => {
    const MultiLineString = geojsonExamples.MultiLineString()
    delete MultiLineString.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(MultiLineString)).toThrowError()
  })

  test("Missing coordinates (5)", async () => {
    const Point = geojsonExamples.Point()
    delete Point.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(Point)).toThrowError()
  })

  test("Missing coordinates (6)", async () => {
    const MultiPoint = geojsonExamples.MultiPoint()
    delete MultiPoint.coordinates
    expect(() => helpers.extractCoordinatesFromGeoJSON(MultiPoint)).toThrowError()
  })

  test("Missing geometry", async () => {
    const Feature = geojsonExamples.Feature()
    delete Feature.geometry
    expect(() => helpers.extractCoordinatesFromGeoJSON(Feature)).toThrowError()
  })

  test("Non-Multi MultiPolygon", async () => {
    const wrongMultiPolygon = geojsonExamples.wrongMultiPolygon()
    expect(() => helpers.extractCoordinatesFromGeoJSON(wrongMultiPolygon)).toThrowError()
  })
})
