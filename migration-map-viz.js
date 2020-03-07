function migrationMap(option) {
  const flowDirections = ["out-flow", "in-flow", "net-flow"];

  // Verify options
  if (!flowDirections.includes(option.flowDirection)) {
    throw Error("Calc can only be out-flow, in-flow, or net-flow.");
  }

  // Extract options
  var fips = option.fips;
  var flowDirection = option.flowDirection.toLowerCase();
  const el = option.el;
  const height = option.height;
  const width = option.width || "";

  if (flowDirection === "out-flow") {
    var mode = "FROM";
  }
  if (flowDirection === "in-flow") {
    var mode = "TO";
  }
  if (flowDirection === "net-flow") {
    var mode = "NET";
  }

  const bubbleColor = "#5aaeae";
  const lineOutColor = "#c84d45";
  const lineInColor = "#cdd399";
  var maxVal = 0;
  var exportOpen = 0;
  var elementActive = "";
  var active_node;

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

      var z,
        featureLine,
        featureCircle,
        sourcePoint,
        sourceFullName,
        totalsTO,
        totalsFROM,
        totalsNET,
        sourceData,
        sourceName,
        maxValTO,
        maxValFROM,
        maxValNET,
        currentData;

      function plot(data, type) {
        currentData = data;
        document.getElementsByClassName("leaflet-zoom-hide").innerHTML = "";
        d3.selectAll(".feature-circle").remove();
        d3.selectAll(".feature-line").remove();
        d3.selectAll(".source").remove();
        json_copy = JSON.parse(JSON.stringify(json));
        // Process Data
        totalsTO = [];
        totalsFROM = [];
        totalsNET = [];
        json_copy.features.forEach(function(v) {
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
              v.properties.fullName = w["FULL2_NAME"];
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

        distance_list = [];
        json_copy.features.forEach(function(d) {
          var x1 = path.centroid(sourceData)[0];
          var y1 = path.centroid(sourceData)[1];
          var x2 = path.centroid(d)[0];
          var y2 = path.centroid(d)[1];
          var distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
          distance_list.push(distance);
        });

        maxValTO = d3.max(totalsTO);
        maxValFROM = d3.max(totalsFROM);
        maxValNET = d3.max(totalsNET);

        if (type === "TO") {
          maxValue = maxValTO;
        }
        if (type === "FROM") {
          maxValue = maxValFROM;
        }
        if (type === "NET") {
          maxValue = maxValNET;
        }

        console.log("maxValTO", maxValTO);
        console.log("maxValFROM", maxValFROM);
        console.log("maxValNET", maxValNET);

        console.log("sourceData", sourceData);
        console.log("sourceName", sourceName);
        console.log("sourceFullName", sourceFullName);

        z = d3
          .scaleLinear()
          .domain([0, maxValue])
          .range([1.5, 30]);

        curveScale = d3
          .scaleLinear()
          .domain([0, d3.max(distance_list)])
          .range([2, 1]);

        featureCircle = g
          .selectAll(".feature-circle")
          .data(json_copy.features)
          .enter()
          .append("circle")
          .attr("class", "feature-circle");

        /*featureMask = g
          .selectAll(".feature-mask")
          .data(json_copy.features)
          .enter()
          .append("mask")
          .attr("class", "feature-mask");*/

        featureLine = g
          .selectAll(".feature-line")
          .data(json_copy.features)
          .enter()
          .append("path");

        sourcePoint = g
          .selectAll(".source")
          .data([sourceData])
          .enter()
          .append("circle");
      }

      plot(data, "FROM");

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
        .text("2012-2017 Migration Trends");

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
        .html(capitalizeFlow(flowDirection) + " <i class='arrow down'></i>");

      var dropdown_list = [
        { name: "Out-Flow", mode: "FROM" },
        { name: "In-Flow", mode: "TO" },
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
          d3.select(".dropbtn").html(d.name + " <i class='arrow down'></i>");
          if (elementActive !== "") {
            node_info(active_node);
          }
        });

      var legendSVG = legendContainer
        .append("svg")
        .attr("width", 140)
        .attr("height", 95);

      /*legendSVG
        .append("text")
        .attr("class", "legend-text")
        .attr("x", 110)
        .attr("y", 225)
        .text("Migration Trends");*/

      var legend_examples = [0.1 * maxValue, maxValue / 2, maxValue];

      legendSVG
        .selectAll(".legend-axis")
        .data(legend_examples)
        .enter()
        .append("line")
        .attr("class", "legend-axis")
        .attr("x1", 50)
        .attr("x2", 105)
        .attr("y1", function(d) {
          return 55 + z(maxValue) - 2 * z(d);
        })
        .attr("y2", function(d) {
          return 55 + z(maxValue) - 2 * z(d);
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
          return 55 + z(maxValue) - z(d);
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
          return 57 + z(maxValue) - 2 * z(d);
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
        .attr("class", "export-option-title")
        .html("Export Options");

      exportOptionContainer
        .append("div")
        .attr("class", "export-option export-option-1")
        .html("Map Link (copy url)")
        .on("click", function() {
          var queryString = window.location;
          const urlRegex = /.+?(?=\?f\=)/;

          window.prompt(
            "Copy to clipboard: Ctrl+C",
            urlRegex.exec(queryString) + "/?=" + fips + "&t=" + flowDirection
          );
        });

      exportOptionContainer
        .append("div")
        .attr("class", "export-option export-option-2")
        .html("Map Image (.png)")
        .on("click", function() {
          exportPNG();
        });
      exportOptionContainer
        .append("div")
        .attr("class", "export-option export-option-3")
        .html("Map Data (.csv)")
        .on("click", function() {
          exportCSV();
        });

      var nodeInfoContainer = legendContainer
        .append("div")
        .attr("class", "node-info-container")
        .style("display", "none");

      nodeInfoContainer.append("div").attr("class", "node-info node-info-1");
      nodeInfoContainer.append("div").attr("class", "node-value node-info-2");
      nodeInfoContainer.append("div").attr("class", "node-info node-info-3");
      nodeInfoContainer.append("div").attr("class", "node-value node-info-4");
      nodeInfoContainer.append("div").attr("class", "node-info node-info-5");
      nodeInfoContainer.append("div").attr("class", "node-value node-info-6");
      nodeInfoContainer
        .append("div")
        .attr("class", "node-info-link")
        .attr("id", "node-change");

      /*
      d3.select(".export-option-btn").on("click", function() {
        if (elementActive === "") {
          if (exportOpen === 0) {
            exportOpen = 1;
            d3.select(".legend-container").style("height", "360px");
            d3.select(".export-option-container").style("display", "block");
            d3.select(".export-option-1")
              .html("Export map as image")
              .style("display", "block");
            d3.select(".export-option-2")
              .html("Export map data")
              .style("display", "block");
          } else {
            exportOpen = 0;
            d3.select(".legend-container").style("height", "305px");
            d3.select(".export-option-container").style("display", "none");
          }
        }
      }); */

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
        var bounds = path.bounds(json_copy),
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
          .rangeRound([1.5, 30]);

        //feature.attr("d", path).attr("class", "county");

        featureCircle
          .attr("fill", bubbleColor)
          .attr("opacity", 0.6)
          .attr("cx", function(d) {
            return path.centroid(d)[0];
          })
          .attr("cy", function(d) {
            return path.centroid(d)[1];
          })
          .attr("r", function(d) {
            if (d.properties[mode] > 0) {
              return Math.abs(z(d.properties[mode]));
            } else {
              return 0;
            }
          })
          .on("mouseover", elementMouseOver)
          .on("mousemove", moveTooltip)
          .on("mouseout", elementMouseOut)
          .on("click", elementclick);

        /* featureMask
          .attr("id", function(d) {
            return "fc-" + d.id;
          })
          .attr("cx", function(d) {
            return path.centroid(d)[0];
          })
          .attr("cy", function(d) {
            return path.centroid(d)[1];
          })
          .attr("r", function(d) {
            if (d.properties[mode] > 0) {
              return Math.abs(z(d.properties[mode]));
            } else {
              return 0;
            }
          });*/

        featureLine
          .attr("class", "feature-line")
          .style("mask", function(d) {
            return "url(#fc-" + d.id + ")";
          })
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
            if (d.properties[mode] > 0) {
              if (mode != "NET") {
                return 0.5 + (d.properties[mode] * 100) / d3.sum(totals);
              } else {
                return (
                  0.5 +
                  ((d.properties["TO"] + d.properties["FROM"]) * 100) /
                    (d3.sum(totalsTO) + d3.sum(totalsFROM))
                );
              }
            } else {
              return 0;
            }
          })
          .style("opacity", 0.8)
          .attr("d", function(d, i) {
            if (d[mode] != 0) {
              var x1 = path.centroid(sourceData)[0];
              var y1 = path.centroid(sourceData)[1];
              var x2 = path.centroid(d)[0];
              var y2 = path.centroid(d)[1];
              var distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
              return (
                "M" +
                x2 +
                "," +
                y2 +
                " Q" +
                (x1 + x2) / 2 +
                " " +
                (y1 + y2) / curveScale(distance) + //1.7
                " " +
                x1 +
                " " +
                y1
              );
            }
          })
          .on("mouseover", elementMouseOver)
          .on("mousemove", moveTooltip)
          .on("mouseout", elementMouseOut)
          .on("click", elementclick);

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
          .attr("class", "source")
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

      function exportPNG() {
        console.log("test");

        domtoimage.toBlob(document.getElementById("map")).then(function(blob) {
          window.saveAs(
            blob,
            sourceName.replace(/ /g, "-") +
              "-" +
              capitalizeFlow(flowDirection) +
              ".png"
          );
        });
      }

      function capitalizeFlow(string) {
        var result = string.split("-");
        return (
          result[0].charAt(0).toUpperCase() +
          result[0].slice(1) +
          "-" +
          result[1].charAt(0).toUpperCase() +
          result[1].slice(1)
        );
      }

      function exportCSV() {
        let csvContent = currentData.columns.join(",") + "\r\n";

        currentData.forEach(function(rowArray) {
          rowList = [];
          currentData.columns.forEach(function(v) {
            rowList.push(rowArray[v]);
          });
          let row = rowList.join(",");
          csvContent += row + "\r\n";
        });
        var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        saveAs(
          blob,
          sourceName.replace(/ /g, "-") +
            "-" +
            capitalizeFlow(flowDirection) +
            ".csv"
        );
      }

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
          d3.select(".legend-container").style("height", "245px");
          d3.select(".node-info-container")
            .style("display", "none")
            .style("height", "0px");
        } else {
          elementActive = "";
          elementMouseOver(d);
          elementActive = d.id;
          //
          var windowHeight = window.innerHeight;
          d3.select(".legend-container").style(
            "height",
            windowHeight - 40 + "px"
          );
          d3.select(".node-info-container")
            .style("display", "block")
            .style("height", windowHeight - 600 + "px");
          //
          active_node = d;
          node_info(active_node);
        }
      }

      function node_info(d) {
        var nextCountyVar = d.id.slice(-3);
        var nextStateVar = d.id.slice(0, d.id.length - 3);
        if (nextStateVar.slice(0, 1) === "0") {
          nextStateVar = nextStateVar.slice(1);
        }

        var nextBaseUrl =
          "https://api.census.gov/data/2017/acs/flows?get=MOVEDIN,GEOID1,GEOID2,MOVEDOUT,FULL1_NAME,FULL2_NAME,MOVEDNET&for=county:" +
          nextCountyVar +
          "&in=state:" +
          nextStateVar +
          "&key=acabde7bbffe0325b739c46e81e6305110af434e";
        console.log(nextBaseUrl);
        d3.csv(nextBaseUrl).then(function(nodeData) {
          if (mode === "FROM") {
            var word1 = "From ";
            var word2 = " to ";
            var modeOption = "TO";
            var modeOptionText = "In-Flow";
            var currentModeOption = "Out-Flow";
          }
          if (mode === "TO") {
            var word1 = "To ";
            var word2 = " from ";
            var modeOption = "FROM";
            var modeOptionText = "Out-Flow";
            var currentModeOption = "In-Flow";
          }
          if (mode === "NET") {
            var word1 = " from ";
            var word2 = " to ";
            var modeOption = "TO";
            var modeOptionText = "In-Flow";
            var currentModeOption = "Out-Flow";
          }
          var targetTotal = [];
          nodeData.forEach(function(v) {
            if (modeOption === "TO") {
              if (!isNaN(v["MOVEDNET"]) && !isNaN(v["MOVEDOUT"])) {
                targetTotal.push(+v["MOVEDOUT"] + +v["MOVEDNET"]);
              }
            }
            if (modeOption === "FROM") {
              if (!isNaN(v["MOVEDOUT"])) {
                targetTotal.push(+v["MOVEDOUT"]);
              }
            }
          });
          console.log(d);
          d3.select(".node-info-1").html(
            word1 +
              "<b>" +
              sourceFullName +
              "</b>" +
              word2 +
              "<b class='highlighted'>" +
              d.properties.fullName +
              "</b>"
          );
          d3.select(".node-info-2").html(formatNumber(maxVal));
          d3.select(".node-info-3").html(
            "Percentage of total " + word1.toLowerCase() + sourceFullName
          );
          d3.select(".node-info-4").html(
            Math.round((+d.properties[mode] / d3.sum(totals)) * 10000) / 100 +
              "% (Total: " +
              d3.sum(totals) +
              ")"
          );
          d3.select(".node-info-5").html(
            "Percentage of total" +
              word2.toLowerCase() +
              "<span class='highlighted'>" +
              d.properties.fullName +
              "</span>"
          );
          d3.select(".node-info-6").html(
            Math.round((+d.properties[mode] / d3.sum(targetTotal)) * 10000) /
              100 +
              "% (Total: " +
              d3.sum(targetTotal) +
              ")"
          );
          d3.select("#node-change")
            .html(
              "See " +
                modeOptionText.toLowerCase() +
                " " +
                word2.toLowerCase() +
                d.properties.fullName
            )
            .on("click", function() {
              mode = modeOption;
              elementActive = "";
              fips = d.id;
              plot(nodeData, modeOption);
              reset();
              elementMouseOut();
              d3.select(".legend-container").style("height", "305px");
              d3.select(".node-info-container")
                .style("display", "none")
                .style("height", "0px");
              d3.select(".legend-area-title").text(sourceFullName);
              updateLegend();
              d3.select(".dropbtn").html(
                modeOptionText + " <i class='arrow down'></i>"
              );
            });
          /* d3.select(".export-option-container").style("display", "block");
          d3.select(".export-option-1").style("display", "block");
          d3.select(".export-option-2").style("display", "block");
          d3.select(".export-option-3").style("display", "block"); */
        });
      }

      function elementMouseOver(d) {
        if (elementActive === "") {
          featureCircle.style("opacity", function(v) {
            if (d.id === v.id) {
              return 0.6;
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
          featureCircle.style("opacity", 0.6);
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
