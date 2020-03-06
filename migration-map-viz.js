function migrationMap(option) {
  const fips = option.fips;
  const el = option.el;
  const height = option.height;
  const width = option.width || "";

  var mode = "TO";
  const bubbleColor = "#5aaeae";
  const lineOutColor = "#cdd399";
  const lineInColor = "#93836b";
  var maxVal = 0;
  var exportOpen = 0;
  var elementActive = "";

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
    maxZoom: 11
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

  var countyVar = fips.slice(-3);
  var stateVar = fips.slice(0, fips.length - 3);

  var baseUrl =
    "https://api.census.gov/data/2017/acs/flows?get=MOVEDIN,GEOID1,GEOID2,MOVEDOUT,FULL1_NAME,FULL2_NAME,MOVEDNET&for=county:" +
    countyVar +
    "&in=state:" +
    stateVar +
    "&key=acabde7bbffe0325b739c46e81e6305110af434e";

  d3.csv(baseUrl).then(function(data) {
    d3.json("us-counties.json").then(function(json) {
      console.log(data);
      console.log(json);
      var transform = d3.geoTransform({ point: projectPoint }),
        path = d3.geoPath().projection(transform);

      // Process Data
      var totalsTO = [];
      var totalsFROM = [];
      var totalsNET = [];
      json.features.forEach(function(v) {
        v.properties.TO = 0;
        v.properties.FROM = 0;
        v.properties.NET = 0;
        v.id = formatIdToFIPS(v.id);
        data.forEach(function(w) {
          if (v.id === formatIdToFIPS(w["GEOID2"])) {
            // may have the TO & FROM switched
            v.properties.FROM += +w["MOVEDOUT"];
            v.properties.NET += +w["MOVEDNET"];
            v.properties.TO += +w["MOVEDOUT"] + +w["MOVEDNET"];
          }
        });
        if (v.id === formatIdToFIPS(fips)) {
          sourceData = v;
          sourceName = v.properties.name;
          sourceFullName = data[0]["FULL1_NAME"];
        }
        totalsTO.push(v.properties.TO);
        totalsFROM.push(v.properties.FROM);
        totalsNET.push(Math.abs(v.properties.NET));
      });

      var maxValTO = d3.max(totalsTO);
      var maxValFROM = d3.max(totalsFROM);
      var maxValNET = d3.max(totalsNET);

      console.log("maxValTO", maxValTO);
      console.log("maxValFROM", maxValFROM);
      console.log("maxValNET", maxValNET);

      console.log("sourceData", sourceData);
      console.log("sourceName", sourceName);
      console.log("sourceFullName", sourceFullName);

      /*var feature = g
      .selectAll("path")
      .data(json.features)
      .enter()
      .append("path"); */

      var z = d3
        .scaleLinear()
        .domain([0, maxValTO])
        .rangeRound([0, 30]);

      var featureLine = g
        .selectAll(".line")
        .data(json.features)
        .enter()
        .append("path");

      var sourcePoint = g
        .selectAll(".source")
        .data([sourceData])
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

      var legendContainer = d3
        .select("#map")
        .append("div")
        .attr("class", "legend-container")
        .style("top", "20px")
        .style("left", document.getElementById("map").clientWidth - 420 + "px");

      legendContainer
        .append("div")
        .attr("class", "legend-title")
        .text("Migration Trend");

      legendContainer
        .append("div")
        .attr("class", "legend-area-title")
        .text(sourceFullName);

      var flowPickerContainer = legendContainer
        .append("div")
        .attr("class", "flow-picker-container");

      flowPickerContainer
        .append("div")
        .attr("class", "flow-picker-text")
        .text("Pick flow type");

      flowPickerContainer.append("div").attr("class", "dropdown-flow");

      d3.select(".dropdown-flow")
        .append("div")
        .attr("class", "dropdown-content")
        .attr("id", "flow-selector");

      d3.select(".dropdown-flow")
        .append("button")
        .attr("class", "dropbtn")
        .html("Out-Flow <i class='arrow down'></i>");

      var dropdown_list = [
        { name: "Out-Flow", mode: "TO" },
        { name: "In-Flow", mode: "FROM" },
        { name: "Net-Flow", mode: "NET" }
      ];

      d3.select("#flow-selector")
        .selectAll("a")
        .data(dropdown_list)
        .enter()
        .append("text")
        .html(function(d) {
          return "<a href='#'>" + d.name + "</a>";
        })
        .on("click", function(d) {
          mode = d.mode;
          reset();
          updateLegend();
        });

      var legendSVG = legendContainer
        .append("svg")
        .attr("width", 200)
        .attr("height", 120);

      /*legendSVG
        .append("text")
        .attr("class", "legend-text")
        .attr("x", 110)
        .attr("y", 225)
        .text("Migration Trends");*/

      var legend_examples = [0.1 * maxValTO, maxValTO / 2, maxValTO];

      legendSVG
        .selectAll(".legend-axis")
        .data(legend_examples)
        .enter()
        .append("line")
        .attr("class", "legend-axis")
        .attr("x1", 50)
        .attr("x2", 105)
        .attr("y1", function(d) {
          return 70 + z(maxValTO) - 2 * z(d);
        })
        .attr("y2", function(d) {
          return 70 + z(maxValTO) - 2 * z(d);
        })
        .attr("dy", 5);

      legendSVG
        .selectAll(".legend-circle")
        .data(legend_examples)
        .enter()
        .append("circle")
        .attr("fill", "none")
        .attr("stroke", bubbleColor)
        .attr("stroke-width", "2px")
        .attr("cx", 50)
        .attr("cy", function(d, i) {
          return 70 + z(maxValTO) - z(d);
        })
        .attr("r", function(d) {
          return z(d);
        });

      legendSVG
        .selectAll(".legend-text")
        .data(legend_examples)
        .enter()
        .append("text")
        .attr("class", "legend-text")
        .attr("x", 110)
        .attr("y", function(d) {
          return 72 + z(maxValTO) - 2 * z(d);
        })
        .attr("dy", 5)
        .text(function(d) {
          return formatNumber(d);
        });

      var exportOptionContainer = legendContainer
        .append("div")
        .attr("class", "export-option-container");

      exportOptionContainer
        .append("div")
        .attr("class", "export-option-label")
        .text("Export Options");

      exportOptionContainer.append("div").attr("class", "export-option-arrow");

      d3.select(".export-option-container").on("click", function() {
        if (exportOpen === 0) {
          exportOpen = 1;
          d3.select(".legend-container").style("height", "400px");
        } else {
          exportOpen = 0;
          d3.select(".legend-container").style("height", "305px");
        }
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
          .attr("width", bottomRight[0] - topLeft[0] + 100)
          .attr("height", bottomRight[1] - topLeft[1] + 100)
          .style("left", topLeft[0] + "px")
          .style("top", topLeft[1] + "px");

        g.attr(
          "transform",
          "translate(" + -topLeft[0] + "," + -topLeft[1] + ")"
        );

        if (mode === "TO") {
          maxVal = maxValTO;
          totals = totalsTO;
        }
        if (mode === "FROM") {
          maxVal = maxValFROM;
          totals = totalsFROM;
        }
        if (mode === "NET") {
          maxVal = maxValNET;
          totals = totalsNET;
        }

        var z = d3
          .scaleLinear()
          .domain([0, maxVal])
          .rangeRound([0, 30]);

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
            return Math.abs(z(d.properties[mode]));
          })
          .on("mouseover", elementMouseOver)
          .on("mousemove", moveTooltip)
          .on("mouseout", elementMouseOut)
          .on("click", elementclick);

        featureLine
          .attr("class", "feature-line")
          .style("stroke", function(d) {
            if (mode === "TO") {
              return lineOutColor;
            }
            if (mode === "FROM") {
              return lineInColor;
            }
            if (mode === "NET") {
              if (d.properties["NET"] >= 0) {
                return lineOutColor;
              } else {
                return lineInColor;
              }
            }
          })
          .attr("stroke-width", function(d) {
            if (mode != "NET") {
              return (d.properties[mode] * 60) / d3.sum(totals);
            } else {
              return (
                ((d.properties["TO"] + d.properties["FROM"]) * 60) /
                (d3.sum(totalsTO) + d3.sum(totalsFROM))
              );
            }
          })
          .style("opacity", 0.8)
          .attr("d", function(d, i) {
            if (d.AtoB != 0) {
              var x1 = path.centroid(sourceData)[0];
              var y1 = path.centroid(sourceData)[1];
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
          .style("stroke", function() {
            if (mode !== "FROM") {
              return lineOutColor;
            } else {
              return lineInColor;
            }
          })
          .style("stroke-width", "3px")
          .style("fill", "white")
          .attr("cx", function(d) {
            return path.centroid(d)[0];
          })
          .attr("cy", function(d) {
            return path.centroid(d)[1];
          })
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

      function updateLegend() {
        d3.selectAll(".legend-text").text(function(d, i) {
          if (i === 0) {
            return formatNumber(0.1 * maxVal);
          }
          if (i === 1) {
            return formatNumber(maxVal / 2);
          }
          if (i === 2) {
            return formatNumber(maxVal);
          }
        });
        d3.selectAll(".legend-circle")
          .attr("cy", function(d, i) {
            if (i === 0) {
              value = 0.1 * maxVal;
            }
            if (i === 1) {
              value = maxVal / 2;
            }
            if (i === 2) {
              value = maxVal;
            }
            return 70 + z(maxVal) - z(value);
          })
          .attr("r", function(d, i) {
            if (i === 0) {
              value = 0.1 * maxVal;
            }
            if (i === 1) {
              value = maxVal / 2;
            }
            if (i === 2) {
              value = maxVal;
            }
            return z(value);
          });
      }

      function showTooltip(d) {
        var tt_desc = "Flow from " + d.properties.name + " to " + sourceName;
        var tt_total = formatNumber(+d.properties[mode]) + " people";
        var tt_perc =
          Math.round((+d.properties[mode] / d3.sum(totals)) * 10000) / 100 +
          "% total for " +
          sourceName;
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

      function elementclick(d) {
        if (d.id === elementActive) {
          elementActive = "";
          elementMouseOut();
          d3.select(".legend-container").style("height", "305px");
        } else {
          elementActive = "";
          elementMouseOver(d);
          elementActive = d.id;
          var windowHeight = window.innerHeight;
          d3.select(".legend-container").style(
            "height",
            windowHeight - 40 + "px"
          );
        }
      }

      function elementMouseOver(d) {
        if (elementActive === "") {
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
        }
        showTooltip(d);
      }

      function elementMouseOut() {
        if (elementActive === "") {
          featureCircle.style("opacity", 1);
          featureLine.style("opacity", 0.8);
        }
        hideTooltip();
      }

      function lineMouseOver(d) {}
      // code here
    });
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
