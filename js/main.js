// project/js/main.js
(async function() {
    // ────────────────────────────────────────────────────────────────────────────
    // load our two JSON exports
    // ────────────────────────────────────────────────────────────────────────────
    const summary = await d3.json("data/summary_phase1.json");  // 30-min bins
    const hourly  = await d3.json("data/hourly_phase1.json");   // 60-min bins
  
    // common color function
    const color = estrus => estrus ? "#d62728" : "#888";  // red vs. gray
  
    // ────────────────────────────────────────────────────────────────────────────
    // Phase 2: Summary Overlay Charts (mean ±1 SD)
    // ────────────────────────────────────────────────────────────────────────────
    function drawSummary(containerId, metric) {
      // metric = "activity" or "temperature"
      const data = summary;
      const isAct = metric === "activity";
  
      // SVG setup
      const margin = { top: 20, right: 20, bottom: 30, left: 50 };
      const width  = 600 - margin.left - margin.right;
      const height = 200 - margin.top - margin.bottom;
  
      const svg = d3.select(containerId)
        .append("svg")
          .attr("width",  width  + margin.left + margin.right)
          .attr("height", height + margin.top  + margin.bottom)
        .append("g")
          .attr("transform", `translate(${margin.left},${margin.top})`);
  
      // x scale: bins across day
      const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.hour))
        .range([0, width]);
  
      // y scale: depending on metric
      const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d[metric + "_mean"]))
        .nice()
        .range([height, 0]);
  
      // axes
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(8));
      svg.append("g")
        .call(d3.axisLeft(y));
  
      // line & area generators
      const line = d3.line()
        .x(d => x(d.hour))
        .y(d => y(d[metric + "_mean"]));
  
      const area = d3.area()
        .x(d => x(d.hour))
        .y0(d => y(d[metric + "_mean"] - d[metric + "_std"]))
        .y1(d => y(d[metric + "_mean"] + d[metric + "_std"]));
  
      // draw for each estrus group
      [false, true].forEach(flag => {
        const grp = data.filter(d => d.estrus === flag);
        // band
        svg.append("path")
           .datum(grp)
           .attr("fill", color(flag))
           .attr("opacity", 0.2)
           .attr("d", area);
        // line
        svg.append("path")
           .datum(grp)
           .attr("fill", "none")
           .attr("stroke", color(flag))
           .attr("stroke-width", 1.5)
           .attr("d", line);
      });
  
      // titles & labels
      svg.append("text")
        .attr("x", width/2)
        .attr("y", -6)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .text(`${metric[0].toUpperCase() + metric.slice(1)} Profile ±1 SD`);
  
      svg.append("text")
        .attr("x", width/2)
        .attr("y", height + margin.bottom - 4)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("30-min Bins");
  
      svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 12)
        .attr("x", -height/2)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(isAct ? "Mean Activity" : "Mean Temperature");
    }
  
    drawSummary("#summary-activity",    "activity");
    drawSummary("#summary-temperature", "temperature");
  
  
    // ────────────────────────────────────────────────────────────────────────────
    // Phase 3: Static Small-Multiples (60-min bins)
    // ────────────────────────────────────────────────────────────────────────────
    function drawGrid(containerId, metricKey, chartTitle) {
      // group by day
      const byDay = d3.group(hourly, d => d.day);
  
      // dimensions for each mini-chart
      const margin = { top: 10, right: 5, bottom: 20, left: 25 };
      const width  = 150 - margin.left - margin.right;
      const height = 120 - margin.top - margin.bottom;
  
      // compute extents once
      const xExtent = d3.extent(hourly, d => d.hour);
      const yExtent = d3.extent(hourly, d => d[metricKey]);
  
      // scales
      const xScale = d3.scaleLinear().domain(xExtent).range([0, width]);
      const yScale = d3.scaleLinear().domain(yExtent).nice().range([height, 0]);
  
      // line generator
      const line = d3.line()
        .x(d => xScale(d.hour))
        .y(d => yScale(d[metricKey]));
  
      // container grid
      const container = d3.select(containerId);
      byDay.forEach((records, day) => {
        const cell = container.append("div").attr("class","chart");
        const svg  = cell.append("svg")
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
          .attr("fill", "none")
          .attr("stroke", color(records[0].estrus))
          .attr("stroke-width", 1.2)
          .attr("d", line);
  
        // day label
        svg.append("text")
          .attr("class","chart-label")
          .attr("x", width/2)
          .attr("y", height + margin.bottom - 2)
          .text(`Day ${day}`);
      });
  
      // section title above grid
      d3.select(containerId)
        .insert("h3", ":first-child")
        .text(`${chartTitle} (60-min bins)`);
    }
  
    drawGrid("#activity-grid", "activity_mean",    "Activity");
    drawGrid("#temp-grid",     "temperature_mean", "Temperature");
  
})();
