function migrationMap(option) {
  const data = option.data;
  const el = option.el;
  const fillColor = option.fillColor;
  console.log(data);
  var map = new L.Map("map", {
    center: [37.8, -96.9],
    zoom: 4,
    minZoom: 4,
    maxZoom: 8
  }).addLayer(
    new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
  );

  var svg = d3.select(map.getPanes().overlayPane).append("svg"),
    g = svg.append("g").attr("class", "leaflet-zoom-hide");

  d3.json("us-counties.json").then(function(json) {
    console.log(data);
    console.log(json);
    var transform = d3.geoTransform({ point: projectPoint }),
      path = d3.geoPath().projection(transform);

    var totals = [];
    json.features.forEach(function(v) {
      v.properties.AtoB = 0;
      data.forEach(function(w) {
        if (v.properties.name === w.CountyA) {
          v.properties.AtoB += +w.AtoB;
        }
      });
      totals.push(v.properties.AtoB);
    });

    var maxVal = d3.max(totals);

    console.log(maxVal);

    /* var colorScale = d3
      .scaleSequential()
      .domain([0, maxVal])
      .interpolate(d3.interpolateBlues); */

    var z = d3
      .scaleLinear()
      .domain([0, maxVal])
      .rangeRound([0, 30]);

    /*var feature = g
      .selectAll("path")
      .data(json.features)
      .enter()
      .append("path"); */

    var featureLine = g
      .selectAll(".line")
      .data(json.features)
      .enter()
      .append("line")
      .attr("class", "feature-line");

    var featureCircle = g
      .selectAll("circle")
      .data(json.features)
      .enter()
      .append("circle")
      .attr("class", "feature-circle");

    map.on("viewreset", reset);
    reset();

    var legendSVG = d3
      .select("#map")
      .append("div")
      .attr("class", "legend-container")
      .style("top", document.getElementById("map").clientHeight - 200 + "px")
      .style("left", document.getElementById("map").clientWidth - 240 + "px")
      .append("svg")
      .attr("width", 220)
      .attr("height", 180);

    legendSVG
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 110)
      .attr("y", 30)
      .text("Population Movement to Autauga");

    legendSVG
      .append("circle")
      .attr("fill", "#13B1F4")
      .attr("cx", 50)
      .attr("cy", 100)
      .attr("r", z(maxVal));

    legendSVG
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 50)
      .attr("y", 150)
      .text(formatNumber(maxVal));

    legendSVG
      .append("line")
      .attr("stroke", "#fffa9e")
      .attr("x1", 130)
      .attr("x2", 190)
      .attr("y1", 100)
      .attr("y2", 100)
      .style("stroke-width", z(maxVal));

    legendSVG
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 160)
      .attr("y", 150)
      .text(formatNumber(maxVal));

    function reset() {
      var bounds = path.bounds(json),
        topLeft = bounds[0],
        bottomRight = bounds[1];

      svg
        .attr("width", bottomRight[0] - topLeft[0])
        .attr("height", bottomRight[1] - topLeft[1])
        .style("left", topLeft[0] + "px")
        .style("top", topLeft[1] + "px");

      g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

      console.log(document.getElementById("map").clientWidth);

      //feature.attr("d", path).attr("class", "county");

      featureCircle
        .attr("fill", "#13B1F4")
        .attr("cx", function(d) {
          return path.centroid(d)[0];
        })
        .attr("cy", function(d) {
          return path.centroid(d)[1];
        })
        .attr("r", function(d) {
          return z(d.properties.AtoB);
        });

      featureLine
        .attr("x1", path.centroid(json.features[0])[0])
        .attr("y1", path.centroid(json.features[0])[1])
        .attr("x2", function(d) {
          return path.centroid(d)[0];
        })
        .attr("y2", function(d) {
          return path.centroid(d)[1];
        })
        .attr("stroke-width", function(d) {
          return z(d.properties.AtoB);
        });
    }

    // Use Leaflet to implement a D3 geometric transformation.
    function projectPoint(x, y) {
      var point = map.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }

    // code here
  });
  // Format number
  function formatNumber(d) {
    if (d < 1e3) {
      return d3.format(".3s")(d);
    } else if (d < 1e5) {
      return `${(d / 1e3).toFixed(1)}K`;
    } else if (d < 1e6) {
      return `${(d / 1e3).toFixed(0)}K`;
    } else if (d < 1e8) {
      return `${(d / 1e6).toFixed(1)}M`;
    } else if (d < 1e9) {
      return `${(d / 1e6).toFixed(0)}M`;
    } else if (d < 1e11) {
      return `${(d / 1e9).toFixed(1)}B`;
    } else if (d < 1e12) {
      return `${(d / 1e9).toFixed(0)}B`;
    } else if (d < 1e14) {
      return `${(d / 1e12).toFixed(1)}T`;
    } else {
      return `${(d / 1e12).toFixed(1)}T`;
    }
  }
}
