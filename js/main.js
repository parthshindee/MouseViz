// project/js/main.js
(async function() {
    // ────────────────────────────────────────────────────────────────────────────
    // load data
    // ────────────────────────────────────────────────────────────────────────────
    const summary = await d3.json("data/summary_phase1.json");  // 30-min bins
    const hourly  = await d3.json("data/hourly_phase1.json");   // 60-min bins
  
    // common colors
    const color = estrus => estrus ? "#d62728" : "#888";  // red vs. gray
  
    // ────────────────────────────────────────────────────────────────────────────
    // tooltip (details on demand)
    // ────────────────────────────────────────────────────────────────────────────
    const tooltip = d3.select("body")
      .append("div")
      .attr("class","tooltip")
      .style("position","absolute")
      .style("background","rgba(255,255,255,0.9)")
      .style("padding","5px 8px")
      .style("border","1px solid #ccc")
      .style("border-radius","4px")
      .style("pointer-events","none")
      .style("font-size","12px")
      .style("opacity",0);
  
    // ────────────────────────────────────────────────────────────────────────────
    // Phase 2 + 4: Summary Overlay with annotations + zoom/pan
    // ────────────────────────────────────────────────────────────────────────────
    function drawSummary(containerId, metric) {
      const data  = summary;
      const isAct = metric === "activity";
  
      // dimensions
      const margin = { top: 30, right: 20, bottom: 30, left: 50 };
      const width  = 600 - margin.left - margin.right;
      const height = 200 - margin.top  - margin.bottom;
  
      // base SVG
      const svg = d3.select(containerId)
        .append("svg")
          .attr("width",  width  + margin.left + margin.right)
          .attr("height", height + margin.top  + margin.bottom)
        .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
  
      // x & y scales
      const x0 = d3.scaleLinear()
        .domain(d3.extent(data, d => d.hour))
        .range([0, width]);
      const y  = d3.scaleLinear()
        .domain(d3.extent(data, d => d[metric + "_mean"]))
        .nice()
        .range([height, 0]);
  
      // axes groups (for updates)
      const xAxisG = svg.append("g")
        .attr("class","x-axis")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x0).ticks(8));
  
      svg.append("g")
        .call(d3.axisLeft(y));
  
      // annotation lines for lights-off/on (0h & 12h)
      [0,24].forEach((bin,i) => {
        svg.append("line")
          .attr("x1", x0(bin)).attr("x2", x0(bin))
          .attr("y1", 0).attr("y2", height)
          .attr("stroke","#000")
          .attr("stroke-dasharray","4,4");
        svg.append("text")
          .attr("x", x0(bin) + 4)
          .attr("y", i===0 ?  -8 : -8)
          .style("font-size","10px")
          .text(i===0 ? "Lights Off" : "Lights On");
      });
  
      // clip‐path so zoom doesn’t overflow
      svg.append("clipPath")
        .attr("id",`clip-${metric}`)
        .append("rect")
          .attr("width", width)
          .attr("height", height);
  
      // line & area generators (bound to x0)
      const line = d3.line()
        .x(d => x0(d.hour))
        .y(d => y(d[metric + "_mean"]));
  
      const area = d3.area()
        .x(d => x0(d.hour))
        .y0(d => y(d[metric + "_mean"] - d[metric + "_std"]))
        .y1(d => y(d[metric + "_mean"] + d[metric + "_std"]));
  
      // group for paths (clipped)
      const pathsG = svg.append("g")
        .attr("clip-path",`url(#clip-${metric})`);
  
      // draw area + line for each estrus group
      [false, true].forEach(flag => {
        const grp = data.filter(d => d.estrus === flag);
        // shaded band
        pathsG.append("path")
          .datum(grp)
          .attr("class","area")
          .attr("fill", color(flag))
          .attr("opacity", 0.2)
          .attr("d", area);
        // main line
        pathsG.append("path")
          .datum(grp)
          .attr("class","line")
          .attr("fill","none")
          .attr("stroke", color(flag))
          .attr("stroke-width", 1.5)
          .attr("d", line);
      });
  
      // zoom behavior
      const zoom = d3.zoom()
        .scaleExtent([1, 5])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", event => {
          const zx = event.transform.rescaleX(x0);
          // update axes & paths
          xAxisG.call(d3.axisBottom(zx).ticks(8));
          pathsG.selectAll("path.area")
            .attr("d", d3.area()
              .x(d => zx(d.hour))
              .y0(d => y(d[metric + "_mean"] - d[metric + "_std"]))
              .y1(d => y(d[metric + "_mean"] + d[metric + "_std"])));
          pathsG.selectAll("path.line")
            .attr("d", d3.line()
              .x(d => zx(d.hour))
              .y(d => y(d[metric + "_mean"])));
        });
  
      // transparent rect for zoom capture
      svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill","none")
        .style("pointer-events","all")
        .call(zoom);
  
      // titles
      svg.append("text")
        .attr("x", width/2).attr("y", -16)
        .attr("text-anchor","middle")
        .style("font-size","14px")
        .text(`${metric[0].toUpperCase() + metric.slice(1)} Profile ±1 SD`);
  
      svg.append("text")
        .attr("x", width/2).attr("y", height + margin.bottom - 4)
        .attr("text-anchor","middle")
        .style("font-size","12px")
        .text("30-minute bins");
  
      svg.append("text")
        .attr("transform","rotate(-90)")
        .attr("y", -margin.left + 12)
        .attr("x", -height/2)
        .attr("text-anchor","middle")
        .style("font-size","12px")
        .text(isAct ? "Mean Activity" : "Mean Temperature");
    }
  
    drawSummary("#summary-activity","activity");
    drawSummary("#summary-temperature","temperature");
  
  
    // ────────────────────────────────────────────────────────────────────────────
    // Phase 3 + 4: Interactive Small-Multiples (60-min bins)
    // ────────────────────────────────────────────────────────────────────────────
    function drawGrid(containerId, metricKey) {
      const byDay = d3.group(hourly, d => d.day);
      const container = d3.select(containerId);
  
      // dims for mini-charts
      const margin = { top: 10, right: 5, bottom: 20, left: 25 };
      const width  = 150 - margin.left - margin.right;
      const height = 120 - margin.top  - margin.bottom;
  
      // global scales
      const xScale = d3.scaleLinear()
        .domain(d3.extent(hourly, d => d.hour))
        .range([0, width]);
      const yScale = d3.scaleLinear()
        .domain(d3.extent(hourly, d => d[metricKey]))
        .nice()
        .range([height, 0]);
  
      // line generator
      const line = d3.line()
        .x(d => xScale(d.hour))
        .y(d => yScale(d[metricKey]));
  
      // draw each mini-chart
      byDay.forEach((records, day) => {
        const estrusFlag = records[0].estrus;
        const cell = container.append("div")
          .attr("class","chart")
          .datum({ day, estrus: estrusFlag })
          // tooltip on hover
          .on("mouseover", (event,d) => {
            tooltip
              .html(`Day ${d.day}<br>${d.estrus? "Estrus":"Non-Estrus"}`)
              .style("opacity",1);
          })
          .on("mousemove", event => {
            tooltip
              .style("left",  (event.pageX + 10) + "px")
              .style("top",   (event.pageY + 10) + "px");
          })
          .on("mouseout", () => {
            tooltip.style("opacity",0);
          })
          // select on click
          .on("click", function(event,d) {
            container.selectAll(".chart").classed("selected", false);
            d3.select(this).classed("selected", true);
          });
  
        const svg = cell.append("svg")
          .attr("width",  width  + margin.left + margin.right)
          .attr("height", height + margin.top  + margin.bottom)
          .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
  
        // axes
        svg.append("g")
          .call(d3.axisLeft(yScale).ticks(3).tickSize(-width))
          .selectAll("text").style("font-size","8px");
        svg.append("g")
          .attr("transform", `translate(0,${height})`)
          .call(d3.axisBottom(xScale).ticks(3))
          .selectAll("text").style("font-size","8px");
  
        // line path
        svg.append("path")
          .datum(records)
          .attr("fill","none")
          .attr("stroke", color(estrusFlag))
          .attr("stroke-width",1.2)
          .attr("d", line);
  
        // day label
        svg.append("text")
          .attr("class","chart-label")
          .attr("x", width/2)
          .attr("y", height + margin.bottom - 2)
          .text(`Day ${day}`);
      });
    }
  
    drawGrid("#activity-grid", "activity_mean");
    drawGrid("#temp-grid",     "temperature_mean");
  
})();
  
