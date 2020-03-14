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
  var nodeInfoOpen = 1;
  var statsOpen = 1;
  var drillCounty = "";
  var mapType = "Bubble + Flow";

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
    "https://api.census.gov/data/2017/acs/flows?get=MOVEDIN,GEOID1,GEOID2,MOVEDOUT,FULL1_NAME,FULL2_NAME,MOVEDNET,STATE2_NAME,COUNTY2_NAME&for=county:" +
    countyVar +
    "&in=state:" +
    stateVar +
    "&key=acabde7bbffe0325b739c46e81e6305110af434e";

  d3.csv(baseUrl).then(function(data) {
    d3.json("us-counties.json").then(function(json) {
      var transform = d3.geoTransform({ point: projectPoint }),
        path = d3.geoPath().projection(transform);

      var z,
        z_alt,
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
        currentData,
        toNest,
        fromNest,
        netNest,
        toHeat,
        fromHeat,
        netHeat,
        heatData,
        barSVG,
        heat;

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
        toHeat = [];
        fromHeat = [];
        netHeat = [];
        heatData = [];
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
              var x = v.geometry.coordinates[0][0][0];
              var y = v.geometry.coordinates[0][0][1];
              var a = doStuff(x, y),
                b = doStuff(x, y),
                c = doStuff(x, y);
              a.push(v.properties.FROM);
              b.push(v.properties.TO);
              c.push(v.properties.FROM + v.properties.TO);
              fromHeat.push(a);
              toHeat.push(b);
              netHeat.push(c);
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

        tmp_toHeat = [];
        tmp_fromHeat = [];
        tmp_netHeat = [];
        toHeat.forEach(function(v) {
          v[2] = v[2] / maxValTO;
          var test = Math.round((v[2] * 10) ** 2);
          if (v[2] > 0) {
            test += 1;
          }
          for (let i = 0; i <= test; i++) {
            tmp_toHeat.push(v);
          }
        });
        fromHeat.forEach(function(v) {
          v[2] = v[2] / maxValFROM;
          var test = Math.round((v[2] * 10) ** 2);
          if (v[2] > 0) {
            test += 1;
          }
          for (let i = 0; i <= test; i++) {
            tmp_fromHeat.push(v);
          }
        });
        netHeat.forEach(function(v) {
          v[2] = v[2] / (maxValFROM + maxValTO);
          var test = Math.round((v[2] * 10) ** 2);
          if (v[2] > 0) {
            test += 1;
          }
          for (let i = 0; i <= test; i++) {
            tmp_netHeat.push(v);
          }
        });

        toHeat = tmp_toHeat;
        fromHeat = tmp_fromHeat;
        netHeat = tmp_netHeat;

        console.log("toHeat", toHeat);
        console.log("fromHeat", fromHeat);
        console.log("netHeat", netHeat);

        if (type === "TO") {
          maxValue = maxValTO;
        }
        if (type === "FROM") {
          maxValue = maxValFROM;
        }
        if (type === "NET") {
          maxValue = maxValNET;
        }

        // Bar Chart data:
        toNest = d3
          .nest()
          .key(function(d) {
            return d["STATE2_NAME"];
          })
          .rollup(function(v) {
            var totalTo = d3.sum(v, function(d) {
              return +d["MOVEDOUT"] + +d["MOVEDNET"];
            });
            v.total = totalTo;
            return totalTo;
          })
          .key(function(d) {
            return d["COUNTY2_NAME"];
          })
          .entries(
            data.filter(function(d) {
              return d["GEOID2"] != "null";
            })
          );

        toNest.forEach(function(v) {
          v.values.sort(function(a, b) {
            var valA = a.value;
            var valB = b.value;
            return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
          });
          v.value = d3.sum(v.values, function(w) {
            return w.value;
          });
        });

        toNest.sort(function(a, b) {
          var valA = a.value;
          var valB = b.value;
          return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
        });

        fromNest = d3
          .nest()
          .key(function(d) {
            return d["STATE2_NAME"];
          })
          .rollup(function(v) {
            var totalTo = d3.sum(v, function(d) {
              return +d["MOVEDOUT"];
            });
            v.total = totalTo;
            return totalTo;
          })
          .key(function(d) {
            return d["COUNTY2_NAME"];
          })
          .entries(
            data.filter(function(d) {
              return d["GEOID2"] != "null";
            })
          );

        fromNest.forEach(function(v) {
          v.values.sort(function(a, b) {
            var valA = a.value;
            var valB = b.value;
            return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
          });
          v.value = d3.sum(v.values, function(w) {
            return w.value;
          });
        });

        fromNest.sort(function(a, b) {
          var valA = a.value;
          var valB = b.value;
          return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
        });

        netNest = d3
          .nest()
          .key(function(d) {
            return d["STATE2_NAME"];
          })
          .rollup(function(v) {
            var totalTo = d3.sum(v, function(d) {
              return +d["MOVEDNET"];
            });
            v.total = totalTo;
            return totalTo;
          })
          .key(function(d) {
            return d["COUNTY2_NAME"];
          })
          .entries(
            data.filter(function(d) {
              return d["GEOID2"] != "null";
            })
          );

        netNest.forEach(function(v) {
          v.values.sort(function(a, b) {
            var valA = a.value;
            var valB = b.value;
            return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
          });
          v.value = d3.sum(v.values, function(w) {
            return w.value;
          });
        });

        netNest.sort(function(a, b) {
          var valA = a.value;
          var valB = b.value;
          return valA > valB ? -1 : valA < valB ? 1 : valA <= valB ? 0 : NaN;
        });

        z = d3
          .scaleLinear()
          .domain([0, maxValue])
          .range([1.5, 30]);

        z_alt = d3
          .scaleLinear()
          .domain([0, maxValue])
          .range([8, 40]);

        curveScale = d3
          .scaleLinear()
          .domain([0, d3.max(distance_list)])
          .range([2, 1]);

        featureLine = g
          .selectAll(".feature-line")
          .data(json_copy.features)
          .enter()
          .append("path");

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
        .attr("id", "legend-container")
        .style("top", "20px")
        .style("left", document.getElementById("map").clientWidth - 420 + "px")
        .style("height", window.innerHeight - 40 + "px");

      var noScrollTarget = document.getElementById("legend-container");
      L.DomEvent.disableScrollPropagation(noScrollTarget);

      var legendHeader = legendContainer
        .append("div")
        .attr("class", "legend-header");

      legendHeader
        .append("div")
        .attr("class", "legend-title")
        .text("2012-2017 Migration Trends");

      legendHeader
        .append("div")
        .attr("class", "legend-area-title")
        .text(sourceFullName);

      var flowPickerContainer = legendHeader
        .append("div")
        .attr("class", "flow-picker-container");

      flowPickerContainer.append("div").attr("class", "dropdown-flow");

      d3.select(".dropdown-flow")
        .append("div")
        .attr("class", "dropdown-content")
        .attr("id", "flow-selector");

      d3.select(".dropdown-flow")
        .append("button")
        .attr("class", "dropbtn")
        .html(
          capitalizeFlow(flowDirection) +
            " <i class='fas dropbtn-icon fa-chevron-down'></i>"
        );

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
          map.eachLayer(function(d) {
            if (d._heat) {
              map.removeLayer(d);
            }
          });
          reset();
          updateLegend();
          updateStats("");
          d3.select(".dropbtn").html(
            d.name + " <i class='fas dropbtn-icon fa-chevron-down'></i>"
          );
          if (elementActive !== "") {
            node_info(active_node);
          }
        });

      var mapTypePickerContainer = legendHeader
        .append("div")
        .attr("class", "map-type-picker-container");

      mapTypePickerContainer.append("div").attr("class", "dropdown-map-type");

      d3.select(".dropdown-map-type")
        .append("div")
        .attr("class", "dropdown-content")
        .attr("id", "map-type-selector");

      d3.select(".dropdown-map-type")
        .append("button")
        .attr("class", "dropbtn")
        .attr("id", "dropbtn-map-type")
        .html(mapType + " <i class='fas dropbtn-icon fa-chevron-down'></i>");

      var mapType_list = ["Bubble + Flow", "Bubble", "Heatmap"];

      d3.select("#map-type-selector")
        .selectAll("a")
        .data(mapType_list)
        .enter()
        .append("text")
        .html(function(d) {
          return "<a href='#'>" + d + "</a>";
        })
        .on("click", function(d) {
          mapType = d;
          d3.select("#dropbtn-map-type").html(
            d + " <i class='fas dropbtn-icon fa-chevron-down'></i>"
          );
          updateMapType();
          reset();
        });

      var legendSubHeader = legendContainer
        .append("div")
        .attr("class", "legend-sub-header");

      var exportOptionContainer = legendSubHeader
        .append("div")
        .attr("class", "export-option-container");

      var legendSVG = legendSubHeader
        .append("svg")
        .style("position", "relative")
        .attr("width", 140)
        .attr("height", 95);

      /*legendSVG
        .append("text")
        .attr("class", "legend-text")
        .attr("x", 110)
        .attr("y", 225)
        .text("Migration Trends");*/

      var legendColorScale = d3
        .scaleLinear()
        .domain([65, 0])
        .interpolate(d3.interpolateHslLong)
        .range(["blue", "red"]);

      var legend_examples = [0.1 * maxValue, maxValue / 2, maxValue];

      legendSVG
        .selectAll(".bars")
        .data(d3.range(65), function(d) {
          return d;
        })
        .enter()
        .append("rect")
        .attr("class", "bars")
        .attr("y", function(d, i) {
          return i + 25;
        })
        .attr("x", 35)
        .attr("width", 30)
        .attr("height", 1)
        .style("fill", function(d, i) {
          return legendColorScale(d);
        })
        .style("opacity", 0);

      legendSVG
        .append("rect")
        .attr("class", "legend-heatbar")
        .attr("x", 35)
        .attr("y", 25)
        .attr("width", 30)
        .attr("height", 0)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 0);

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
        .attr("class", "legend-circle")
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

      var statsContainer = legendContainer
        .append("div")
        .attr("class", "stats-container");

      statsContainer
        .append("div")
        .attr("class", "stats-label")
        .text("Stats");

      statsContainer
        .append("div")
        .attr("class", "stats-label-drill")
        .html("")
        .style("display", "none")
        .on("click", function() {
          updateStats("");
        });

      statsContainer
        .append("div")
        .html("<i class='fas stats-toggle fa-chevron-up'></i>")
        .on("click", function() {
          if (statsOpen === 1) {
            statsOpen = 0;
            barSVG.style("display", "none");
            d3.select(".stats-toggle").attr(
              "class",
              "fas stats-toggle fa-chevron-down"
            );
            d3.select(".stats-label-drill").style("display", "none");
          } else {
            statsOpen = 1;
            barSVG.style("display", "block");
            d3.select(".stats-toggle").attr(
              "class",
              "fas stats-toggle fa-chevron-up"
            );
            d3.select(".stats-label-drill").style("display", "block");
          }
        });

      var barContainer = statsContainer
        .append("div")
        .attr("class", "stats-bar-container")
        .style("height", window.innerHeight - 320 + "px");

      barSVG = barContainer.append("svg").attr("width", 370);

      var nodeInfoContainer = legendContainer
        .append("div")
        .attr("class", "node-info-container")
        .style("display", "none");

      nodeInfoContainer
        .append("i")
        .attr("class", "fas node-info-toggle fa-chevron-up")
        .on("click", function() {
          if (nodeInfoOpen === 1) {
            nodeInfoOpen = 0;
            d3.select(this).attr(
              "class",
              "fas node-info-toggle fa-chevron-down"
            );
            d3.select(".node-info-1").style("display", "none");
            d3.select(".node-info-2").style("display", "none");
            d3.select(".node-info-3").style("display", "none");
            d3.select(".node-info-4").style("display", "none");
            d3.select(".node-info-5").style("display", "none");
            d3.select(".node-info-6").style("display", "none");
            d3.select(".node-info-link").style("display", "none");
          } else {
            nodeInfoOpen = 1;
            d3.select(this).attr("class", "fas node-info-toggle fa-chevron-up");
            d3.select(".node-info-1").style("display", "block");
            d3.select(".node-info-2").style("display", "block");
            d3.select(".node-info-3").style("display", "block");
            d3.select(".node-info-4").style("display", "block");
            d3.select(".node-info-5").style("display", "block");
            d3.select(".node-info-6").style("display", "block");
            d3.select(".node-info-link").style("display", "block");
          }
        });

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

      updateStats("");
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

        map.eachLayer(function(d) {
          if (d._heat) {
            map.removeLayer(d);
          }
        });

        if (mapType !== "Heatmap") {
          map.eachLayer(function(d) {
            if (d._heat) {
              map.removeLayer(d);
            }
          });
        }

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
          flowDirection = "in-flow";
          heatData = toHeat;
        }
        if (mode === "FROM") {
          maxVal = maxValFROM;
          totals = totalsFROM;
          flowDirection = "out-flow";
          heatData = fromHeat;
        }
        if (mode === "NET") {
          maxVal = maxValNET;
          totals = totalsNET;
          flowDirection = "net-flow";
          heatData = netHeat;
        }

        if (mapType === "Heatmap") {
          var heat = L.heatLayer(heatData, {
            maxZoom: 11,
            minOpacity: 0.2,
            radius: 20
          }).addTo(map);
        }

        var z = d3
          .scaleLinear()
          .domain([0, maxVal])
          .rangeRound([1.5, 30]);

        var z_alt = d3
          .scaleLinear()
          .domain([0, maxValue])
          .range([8, 40]);

        //feature.attr("d", path).attr("class", "county");

        featureCircle
          .attr("fill", bubbleColor)
          .attr("opacity", 1)
          .attr("cx", function(d) {
            return path.centroid(d)[0];
          })
          .attr("cy", function(d) {
            return path.centroid(d)[1];
          })
          .attr("r", function(d) {
            if (d.properties[mode] > 0) {
              if (mapType === "Bubble + Flow") {
                return Math.abs(z(d.properties[mode]));
              } else {
                if (mapType === "Bubble") {
                  return Math.abs(z_alt(d.properties[mode]));
                }
              }
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
              if (d.properties[mode] > 0) {
                var r = Math.abs(z(d.properties[mode]));
              } else {
                var r = 0;
              }
              var x1 = path.centroid(sourceData)[0];
              var y1 = path.centroid(sourceData)[1];
              var x2 = path.centroid(d)[0];
              var y2 = path.centroid(d)[1];
              /* var angle = Math.atan((y2 - y1) / (x2 - x1));
              var xDiff = r * Math.sin(angle);
              var yDiff = r * Math.cos(angle);
              if (x1 < x2) {
                x2 = x2 - (r + xDiff);
              } else {
                x2 = x2 + (r - xDiff);
              }
              if (y1 < y2) {
                y2 = y2 - (r + yDiff);
              } else {
                y2 = y2 + (r - yDiff);
              } */
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
            if (mode !== "FROM" || mapType === "Heatmap") {
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
          .attr("r", function() {
            if (mapType !== "Heatmap") {
              return 10;
            } else {
              return 6;
            }
          });
      }

      function doStuff(x, y) {
        //console.log(e.latlng);
        // coordinates in tile space
        //var x = e.layerPoint.x;
        //var y = e.layerPoint.y;
        //console.log([x, y]);

        // calculate point in xy space
        var pointXY = L.point(x, y);
        //console.log("Point in x,y space: " + pointXY);

        // convert to lat/lng space
        var pointlatlng = map.layerPointToLatLng(pointXY);
        // why doesn't this match e.latlng?
        //console.log("Point in lat,lng space: " + pointlatlng);

        var test = new L.LatLng(y, x);
        //console.log(" test: " + test);
        return [test.lat, test.lng];
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

      function updateMapType() {
        console.log("mapType", mapType);
        if (mapType === "Bubble + Flow") {
          updateLegend();
          d3.selectAll(".feature-line").style("display", "");
          d3.select(".source").attr("r", 10);
          d3.selectAll(".feature-circle")
            .attr("r", function(d) {
              if (d.properties[mode] > 0) {
                return Math.abs(z(d.properties[mode]));
              } else {
                return 0;
              }
            })
            .attr("stroke-width", 0)
            .attr("fill-opacity", 1);
        }
        if (mapType === "Bubble") {
          //z2
          updateLegend();
          d3.selectAll(".feature-line").style("display", "none");
          d3.select(".source").attr("r", 10);
          d3.selectAll(".feature-circle")
            .attr("r", function(d) {
              if (d.properties[mode] > 0) {
                return Math.abs(z_alt(d.properties[mode]));
              } else {
                return 0;
              }
            })
            .attr("stroke", bubbleColor)
            .attr("stroke-width", 2)
            .attr("fill-opacity", 0.3);
        }
        if (mapType === "Heatmap") {
          d3.selectAll(".feature-line").style("display", "none");
          d3.selectAll(".feature-circle")
            .attr("r", 0)
            .attr("stroke", bubbleColor)
            .attr("stroke-width", 0);
          d3.select(".source").attr("r", 6);
          //
          updateLegend();
          reset();
        }
      }

      function updateStats(drillCounty) {
        drillCounty = drillCounty;
        barSVG.selectAll("*").remove();
        if (mode === "TO") {
          statsData = toNest;
        }
        if (mode === "FROM") {
          statsData = fromNest;
        }
        if (mode === "NET") {
          statsData = netNest;
        }
        if (drillCounty != "") {
          statsData.forEach(function(w) {
            if (w.key === drillCounty) {
              statsData = w.values;
              d3.select(".stats-label-drill")
                .style("display", "block")
                .html("States > " + w.key);
              d3.select(".stats-toggle").style("top", "-10px");
            }
          });
        } else {
          d3.select(".stats-label-drill")
            .style("display", "none")
            .html("");
          d3.select(".stats-toggle").style("top", "-10px");
        }

        statsHeight = 20 + (5 + 20) * statsData.length;
        barSVG.attr("height", statsHeight);

        if (mode === "NET") {
          maxBar = d3.max(statsData, function(d) {
            return d.value;
          });
          minBar = d3.min(statsData, function(d) {
            return d.value;
          });

          maxVal = d3.max([maxBar, Math.abs(minBar)]);

          sumBar = d3.sum(statsData, function(d) {
            return d.value;
          });

          d3.select(".stats-label").text(
            "Stats (Total: " + formatNumber(sumBar) + ")"
          );

          barScale = d3
            .scaleLinear()
            .domain([0, maxVal])
            .range([0, 85]);

          barSVG
            .selectAll(".bars")
            .data(statsData)
            .enter()
            .append("rect")
            .attr("fill", bubbleColor)
            .style("cursor", "pointer")
            .attr("x", function(d) {
              if (d.value < 0) {
                return 225 - barScale(Math.abs(d.value));
              } else {
                return 225;
              }
            })
            .attr("y", function(d, i) {
              return i * 25;
            })
            .attr("width", function(d) {
              return barScale(Math.abs(d.value));
            })
            .attr("height", 20)
            .on("click", function(d) {
              if (drillCounty === "") {
                updateStats(d.key);
              } else {
                updateStats("");
              }
            })
            .on("mouseover", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 1);
            })
            .on("mouseout", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 0);
            });

          barSVG
            .selectAll(".bar-label")
            .data(statsData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", 0)
            .attr("y", function(d, i) {
              return i * 25 + 15;
            })
            .text(function(d) {
              return d.key;
            })
            .style("cursor", "pointer")
            .on("click", function(d) {
              if (drillCounty === "") {
                updateStats(d.key);
              } else {
                updateStats("");
              }
            })
            .on("mouseover", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 1);
            })
            .on("mouseout", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 0);
            });

          barSVG
            .selectAll(".bar-label-value")
            .data(statsData)
            .enter()
            .append("text")
            .attr("id", function(d) {
              return d.key.toLowerCase().replace(/ /g, "-") + "-value";
            })
            .attr("class", function(d) {
              if (d.value < 0) {
                if (barScale(Math.abs(d.value)) > 60) {
                  return "bar-label-value-neg";
                } else {
                  return "bar-label-value-neg-alt";
                }
              } else {
                if (barScale(Math.abs(d.value)) > 60) {
                  return "bar-label-value";
                } else {
                  return "bar-label-value-alt";
                }
              }
            })
            .attr("x", function(d) {
              if (d.value < 0) {
                if (barScale(Math.abs(d.value)) > 60) {
                  return 235 - barScale(Math.abs(d.value));
                } else {
                  return 215 - barScale(Math.abs(d.value));
                }
              } else {
                if (barScale(Math.abs(d.value)) > 60) {
                  return 215 + barScale(Math.abs(d.value));
                } else {
                  return 235 + barScale(Math.abs(d.value));
                }
              }
            })
            .attr("y", function(d, i) {
              return i * 25 + 15;
            })
            .text(function(d) {
              return formatNumber(d.value);
            });
          //
        } else {
          maxBar = d3.max(statsData, function(d) {
            return Math.abs(d.value);
          });

          sumBar = d3.sum(statsData, function(d) {
            return Math.abs(d.value);
          });

          d3.select(".stats-label").text(
            "Stats (Total: " + formatNumber(sumBar) + ")"
          );

          barScale = d3
            .scaleLinear()
            .domain([0, maxBar])
            .range([0, 170]);

          barSVG
            .selectAll(".bars")
            .data(statsData)
            .enter()
            .append("rect")
            .attr("fill", bubbleColor)
            .style("cursor", "pointer")
            .attr("x", 140)
            .attr("y", function(d, i) {
              return i * 25;
            })
            .attr("width", function(d) {
              return barScale(Math.abs(d.value));
            })
            .attr("height", 20)
            .on("click", function(d) {
              if (drillCounty === "") {
                updateStats(d.key);
              } else {
                updateStats("");
              }
            })
            .on("mouseover", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 1);
            })
            .on("mouseout", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 0);
            });

          barSVG
            .selectAll(".bar-label")
            .data(statsData)
            .enter()
            .append("text")
            .attr("class", "bar-label")
            .attr("x", 0)
            .attr("y", function(d, i) {
              return i * 25 + 15;
            })
            .text(function(d) {
              return d.key;
            })
            .style("cursor", "pointer")
            .on("click", function(d) {
              if (drillCounty === "") {
                updateStats(d.key);
              } else {
                updateStats("");
              }
            })
            .on("mouseover", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 1);
            })
            .on("mouseout", function(d) {
              d3.select(
                "#" + d.key.toLowerCase().replace(/ /g, "-") + "-value"
              ).style("opacity", 0);
            });

          barSVG
            .selectAll(".bar-label-value")
            .data(statsData)
            .enter()
            .append("text")
            .attr("id", function(d) {
              return d.key.toLowerCase().replace(/ /g, "-") + "-value";
            })
            .attr("class", function(d) {
              if (barScale(d.value) > 60) {
                return "bar-label-value";
              } else {
                return "bar-label-value-alt";
              }
            })
            .attr("x", function(d) {
              if (barScale(d.value) > 60) {
                return 130 + barScale(Math.abs(d.value));
              } else {
                return 150 + barScale(Math.abs(d.value));
              }
            })
            .attr("y", function(d, i) {
              return i * 25 + 15;
            })
            .text(function(d) {
              return formatNumber(Math.abs(d.value));
            });

          barSVG
            .selectAll(".bar-label-perc")
            .data(statsData)
            .enter()
            .append("text")
            .attr("class", "bar-label-perc")
            .attr("x", function(d) {
              return 320;
            })
            .attr("y", function(d, i) {
              return i * 25 + 15;
            })
            .text(function(d) {
              return (
                Math.round((Math.abs(d.value) / sumBar) * 10000) / 100 + "%"
              );
            });
        }
      }

      function exportPNG() {
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
        let csvContent = "";
        currentData.columns.forEach(function(v, i) {
          if (i < 9) {
            csvContent += cleanCSVContent(v) + ",";
          }
        });
        csvContent += "\r\n";
        console.log(csvContent);

        currentData.forEach(function(rowArray) {
          rowList = [];
          currentData.columns.forEach(function(v, i) {
            if (v != "") {
              console.log(v, rowArray[v]);
              rowList.push(cleanCSVContent(rowArray[v]));
            }
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
        d3.selectAll(".legend-text")
          .text(function(d, i) {
            if (mapType !== "Heatmap") {
              if (i === 0) {
                return formatNumber(0.1 * maxVal);
              }
              if (i === 1) {
                return formatNumber(maxVal / 2);
              }
              if (i === 2) {
                return formatNumber(maxVal);
              }
            } else {
              if (i === 0) {
                return formatNumber(0);
              }
              if (i === 2) {
                console.log(mode);
                if (mode === "NET") {
                  return formatNumber(maxValTO + maxValFROM);
                } else {
                  return formatNumber(maxVal);
                }
              }
            }
          })
          .attr("y", function(d, i) {
            if (mapType !== "Heatmap") {
              if (i === 0) {
                return 57 + z(maxValue) - 2 * z(0.1 * maxVal);
              }
              if (i === 1) {
                return 57 + z(maxValue) - 2 * z(maxVal / 2);
              }
              if (i === 2) {
                return 57 + z(maxValue) - 2 * z(maxVal);
              }
            } else {
              if (i === 0) {
                return 90;
              } else {
                return 25;
              }
            }
          })
          .attr("x", function(d, i) {
            if (mapType !== "Heatmap") {
              return 110;
            } else {
              return 80;
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
            return 55 + z(maxVal) - z(value);
          })
          .attr("r", function(d, i) {
            if (mapType !== "Heatmap") {
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
            } else {
              return 0;
            }
          });
        d3.selectAll(".legend-axis")
          .attr("y1", function(d) {
            if (mapType !== "Heatmap") {
              return 55 + z(maxValue) - 2 * z(d);
            } else {
              return 0;
            }
          })
          .attr("y2", function(d) {
            if (mapType !== "Heatmap") {
              return 55 + z(maxValue) - 2 * z(d);
            } else {
              return 0;
            }
          })
          .attr("x1", function() {
            if (mapType !== "Heatmap") {
              return 50;
            } else {
              return 0;
            }
          })
          .attr("x2", function() {
            if (mapType !== "Heatmap") {
              return 105;
            } else {
              return 0;
            }
          });
        d3.select(".legend-heatbar")
          .attr("height", function() {
            if (mapType !== "Heatmap") {
              return 0;
            } else {
              return 65;
            }
          })
          .attr("stroke-width", function() {
            if (mapType !== "Heatmap") {
              return 0;
            } else {
              return 2;
            }
          });
        d3.selectAll(".bars").style("opacity", function() {
          if (mapType !== "Heatmap") {
            return 0;
          } else {
            return 1;
          }
        });
      }

      function showTooltip(d) {
        if (mode === "FROM") {
          var word1 = " from ";
          var word2 = " to ";
          var word0 = "Flow";
        }
        if (mode === "TO") {
          var word1 = " to ";
          var word2 = " from ";
          var word0 = "Flow";
        }
        if (mode === "NET") {
          var word1 = " from ";
          var word2 = " to ";
          var word0 = "Net Flow";
        }
        var tt_desc = word0 + word1 + sourceName + word2 + d.properties.name;
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
          d3.select(".node-info-container")
            .style("display", "none")
            .style("height", "0px");
          d3.select(".stats-bar-container").style(
            "height",
            window.innerHeight - 320 + "px"
          );
        } else {
          elementActive = "";
          elementMouseOver(d);
          elementActive = d.id;
          //
          d3.select(".node-info-container")
            .style("display", "block")
            .style("height", window.innerHeight - 600 + "px");
          d3.select(".stats-bar-container").style("height", "200px");
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
          "https://api.census.gov/data/2017/acs/flows?get=MOVEDIN,GEOID1,GEOID2,MOVEDOUT,FULL1_NAME,FULL2_NAME,MOVEDNET,STATE2_NAME,COUNTY2_NAME&for=county:" +
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
              //d3.select(".legend-container").style("height", "200px");
              d3.select(".node-info-container")
                .style("display", "none")
                .style("height", "0px");
              d3.select(".legend-area-title").text(sourceFullName);
              updateLegend();
              updateStats("");
              d3.select(".dropbtn").html(
                modeOptionText +
                  " <i class='fas dropbtn-icon fa-chevron-down'></i>"
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

  function cleanCSVContent(string) {
    string = string
      .replace(/\[/g, "")
      .replace(/"/g, "")
      .replace(/,/g, '","');
    return string;
  }

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
