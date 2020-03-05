function migrationMap(option) {
  const data = option.data;
  const el = option.el;
  const bubbleColor = option.bubbleColor;
  const lineColor = option.lineColor;
  const height = option.height;
  const width = option.width || "";

  const container = d3.select(el).classed("migration-map-viz", true);

  container.append("p").attr("id", "map");

  if (width === "") {
    d3.select("#map")
      .style("left", "0px")
      .style("margin-top", "0px")
      .style("width", "100vw");
  } else {
    d3.select("#map").style("width", width + "px");
  }

  if (height === "") {
    d3.select("#map")
      .style("height", "100vh")
      .style("top", "0px")
      .style("position", "absolute");
  } else {
    d3.select("#map").style("height", height + "px");
  }

  const accessToken =
    "pk.eyJ1Ijoic3RlbmluamEiLCJhIjoiSjg5eTMtcyJ9.g_O2emQF6X9RV69ibEsaIw";
  var map = new L.Map("map", {
    center: [47.8, -110.9],
    zoom: 4,
    minZoom: 3,
    maxZoom: 8
  }).addLayer(
    new L.TileLayer(
      "https://api.mapbox.com/styles/v1/mapbox/dark-v10/tiles/{z}/{x}/{y}?access_token=" +
        accessToken,
      {
        attribution:
          '© <a href="https://apps.mapbox.com/feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    )
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
      v.id = formatIdToFIPS(v.id);
      data.forEach(function(w) {
        if (v.id === w["FIPSA"]) {
          v.properties.AtoB += +w.AtoB;
        }
      });
      totals.push(v.properties.AtoB);
    });

    var maxVal = d3.max(totals);

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
      .append("path");

    var sourcePoint = g
      .selectAll(".source")
      .data([0])
      .enter()
      .append("circle")
      .attr("class", "source");

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
      .style("top", document.getElementById("map").clientHeight - 220 + "px")
      .style("left", document.getElementById("map").clientWidth - 240 + "px")
      .append("svg")
      .attr("width", 220)
      .attr("height", 180);

    legendSVG
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 110)
      .attr("y", 25)
      .text("Population Movement to Autauga");

    var legend_examples = [0.1 * maxVal, maxVal / 2, maxVal];

    legendSVG
      .selectAll(".legend-circle")
      .data(legend_examples)
      .enter()
      .append("circle")
      .attr("fill", "none")
      .attr("stroke", bubbleColor)
      .attr("stroke-width", "2px")
      .attr("cx", 50)
      .attr("cy", function(d) {
        return 90 + z(maxVal) - z(d);
      })
      .attr("r", function(d) {
        return z(d);
      });

    legendSVG
      .selectAll(".legend-circle")
      .data(legend_examples)
      .enter()
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 110)
      .attr("y", function(d) {
        return 90 + z(maxVal) - 2 * z(d);
      })
      .attr("dy", 5)
      .text(function(d) {
        return formatNumber(d);
      });

    d3.select(".legend-container")
      .append("div")
      .attr("class", "dropdown-flow");

    d3.select(".dropdown-flow")
      .append("div")
      .attr("class", "dropdown-content")
      .attr("id", "flow-selector");

    d3.select(".dropdown-flow")
      .append("button")
      .attr("class", "dropbtn")
      .html("<i class='arrow down'></i> Select Migration Flow");

    var dropdown_list = ["out-flow", "in-flow", "net-flow"];

    var industrySelector = d3
      .select("#flow-selector")
      .selectAll("a")
      .data(dropdown_list)
      .enter()
      .append("text")
      .html(function(d) {
        return "<a href='#'>" + d + "</a>";
      })
      .on("click", function(d) {
        console.log(d);
      });

    /* legendSVG
      .append("circle")
      .attr("fill", bubbleColor)
      .attr("cx", 50)
      .attr("cy", 100)
      .attr("r", z(maxVal)); */

    /*
    legendSVG
      .append("line")
      .attr("stroke", lineColor)
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
      .text(formatNumber(maxVal)); */

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

      //feature.attr("d", path).attr("class", "county");

      featureCircle
        .attr("fill", bubbleColor)
        .attr("cx", function(d) {
          return path.centroid(d)[0];
        })
        .attr("cy", function(d) {
          return path.centroid(d)[1];
        })
        .attr("r", function(d) {
          return z(d.properties.AtoB);
        })
        .on("mouseover", elementMouseOver)
        .on("mousemove", moveTooltip)
        .on("mouseout", elementMouseOut);

      featureLine
        .attr("class", "feature-line")
        .style("stroke", lineColor)
        .attr("stroke-width", function(d) {
          return (d.properties.AtoB * 60) / d3.sum(totals);
        })
        .style("opacity", 0.8)
        .attr("d", function(d, i) {
          if (d.AtoB != 0) {
            var x1 = path.centroid(json.features[0])[0];
            var y1 = path.centroid(json.features[0])[1];
            var x2 = path.centroid(d)[0];
            var y2 = path.centroid(d)[1];
            return (
              "M" +
              x2 +
              "," +
              y2 +
              " Q" +
              (x1 + x2) / 2 +
              " " +
              (y1 + y2) / 1.7 +
              " " +
              x1 +
              " " +
              y1
            );
          }
        })
        .on("mouseover", elementMouseOver)
        .on("mousemove", moveTooltip)
        .on("mouseout", elementMouseOut);

      /* featureLine
        .style("stroke", lineColor)
        .attr("x1", path.centroid(json.features[0])[0])
        .attr("y1", path.centroid(json.features[0])[1])
        .attr("x2", function(d) {
          return path.centroid(d)[0];
        })
        .attr("y2", function(d) {
          return path.centroid(d)[1];
        })
        .attr("stroke-width", function(d) {
          if (d.properties.AtoB > 500) {
          }
          return z(d.properties.AtoB);
        }); */

      sourcePoint
        .style("stroke", lineColor)
        .style("stroke-width", "3px")
        .style("fill", "white")
        .attr("cx", path.centroid(json.features[0])[0])
        .attr("cy", path.centroid(json.features[0])[1])
        .attr("r", 10);
    }

    // Use Leaflet to implement a D3 geometric transformation.
    function projectPoint(x, y) {
      var point = map.latLngToLayerPoint(new L.LatLng(y, x));
      this.stream.point(point.x, point.y);
    }

    // Tooltip
    const tooltip = d3
      .select("#map")
      .append("div")
      .attr("class", "chart-tooltip");
    tooltip.append("div").attr("class", "tooltip-desc");
    tooltip.append("div").attr("class", "tooltip-total");
    tooltip.append("div").attr("class", "tooltip-percentage");

    function moveTooltip() {
      let padding = 10;
      const { width, height } = tooltip.datum();
      let x = d3.event.clientX;
      if (x + padding + width > window.innerWidth) {
        x = x - padding - width;
      } else {
        x = x + padding;
      }
      let y = d3.event.clientY;
      if (y + padding + height > window.innerHeight) {
        y = y - padding - height;
      } else {
        y = y + padding;
      }
      tooltip.style("transform", `translate(${x}px,${y}px)`);
    }

    function showTooltip(d) {
      var tt_desc = "Flow from " + d.properties.name + " to " + "Autauga";
      var tt_total = formatNumber(+d.properties.AtoB) + " people";
      var tt_perc =
        Math.round((+d.properties.AtoB / d3.sum(totals)) * 10000) / 100 +
        "% total for " +
        "Autauga";
      tooltip.select(".tooltip-desc").text(tt_desc);
      tooltip.select(".tooltip-total").text(tt_total);
      tooltip.select(".tooltip-percentage").text(tt_perc);
      tooltip.transition().style("opacity", 1);

      const { width, height } = tooltip.node().getBoundingClientRect();
      tooltip.datum({ width, height });
    }

    function hideTooltip() {
      tooltip.transition().style("opacity", 0);
    }

    function elementMouseOver(d) {
      console.log(d);
      featureCircle.style("opacity", function(v) {
        if (d.id === v.id) {
          return 1;
        } else {
          return 0.4;
        }
      });
      featureLine.style("opacity", function(v) {
        if (d.id === v.id) {
          return 1;
        } else {
          return 0.3;
        }
      });
      showTooltip(d);
    }

    function elementMouseOut() {
      featureCircle.style("opacity", 1);
      featureLine.style("opacity", 0.8);
      hideTooltip();
    }

    function lineMouseOver(d) {}
    // code here
  });

  //
  function formatIdToFIPS(d) {
    var padding = 6 - (d + "").length;
    for (let i = 0; i < padding; i++) {
      d = "0" + d;
    }
    return d;
  }
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
