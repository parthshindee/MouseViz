(async function() {
  // ────────────────────────────────────────────────────────────────────────────
  // Configuration & state
  // ────────────────────────────────────────────────────────────────────────────
  const binSizes = [5, 15, 30, 60]; // available resolutions
  const metricOptions = {
    activity_mean: "Activity",
    temperature_mean: "Temperature",
    ratio_mean: "Temp / Activity"
  };

  let state = {
    binSize: 60,
    metric: "activity_mean",
    dayRange: [0, 13]
  };

  const dataByBin = {};

  // ────────────────────────────────────────────────────────────────────────────
  // Load JSON for each bin size into dataByBin
  // ────────────────────────────────────────────────────────────────────────────
  await Promise.all(
    binSizes.map(bs =>
      d3.json(`data/hourly_${bs}min.json`)
        .then(data => dataByBin[bs] = data)
    )
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Set up controls
  // ────────────────────────────────────────────────────────────────────────────
  const binSelect = d3.select("#bin-select");
  const metricButtons = d3.selectAll(".toggle-button");
  const subtitle = d3.select("#subtitle");

  binSelect.on("change", function() {
    state.binSize = +this.value;
    updateChart();
  });

  metricButtons.on("click", function() {
    metricButtons.classed("active", false);
    d3.select(this).classed("active", true);
    state.metric = d3.select(this).attr("data-metric");
    updateChart();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SVG & scales setup
  // ────────────────────────────────────────────────────────────────────────────
  const container = d3.select("#chart-container");
  const svgEl = d3.select("#main-chart");
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const height = 400 - margin.top - margin.bottom;

  // responsive width
  function getWidth() {
    return parseInt(container.style("width")) - margin.left - margin.right;
  }

  let width = getWidth();

  svgEl
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const svg = svgEl.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // axes groups
  const xAxisG = svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height})`);
  const yAxisG = svg.append("g")
    .attr("class", "y-axis");

  // axis labels
  const yLabel = svg.append("text")
    .attr("class","axis-label")
    .attr("transform","rotate(-90)")
    .attr("x",-height/2)
    .attr("y",-margin.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px");

  const xLabel = svg.append("text")
    .attr("class","axis-label")
    .attr("x", width/2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor","middle")
    .style("font-size","12px");

  // line path
  const linePath = svg.append("path")
    .attr("class","line")
    .attr("fill","none")
    .attr("stroke","#d62728")
    .attr("stroke-width",2);

  const annG = svg.append("g").attr("class","annotations");
  const tooltip = d3.select("body").append("div").attr("class","tooltip");

  const hoverRect = svg.append("rect")
    .attr("class","hover-rect")
    .attr("fill","none")
    .attr("pointer-events","all");

  // ────────────────────────────────────────────────────────────────────────────
  // TIMELINE BRUSH SETUP
  // ────────────────────────────────────────────────────────────────────────────
  const tlSvg = d3.select("#timeline");
  const tlMargin = { top:0, right:20, bottom:20, left:20 };
  const tlHeight = 60 - tlMargin.top - tlMargin.bottom;
  function getTlWidth() {
    return parseInt(d3.select("#timeline-container").style("width"))
           - tlMargin.left - tlMargin.right;
  }
  let tlWidth = getTlWidth();

  tlSvg
    .attr("width",  tlWidth + tlMargin.left + tlMargin.right)
    .attr("height", tlHeight + tlMargin.top + tlMargin.bottom);

  const tlG = tlSvg.append("g")
    .attr("transform", `translate(${tlMargin.left},${tlMargin.top})`);

  // x‐scale for days 0–13
  const xTl = d3.scaleLinear()
    .domain([0,13])
    .range([0, tlWidth]);

  // draw tick axis
  tlG.append("g")
    .attr("class","axis-tl")
    .attr("transform", `translate(0,${tlHeight})`)
    .call(d3.axisBottom(xTl).ticks(14).tickFormat(d3.format("d")))
    .selectAll("text")
      .style("font-size","10px");

  // brush
  const brush = d3.brushX()
    .extent([[0,0],[tlWidth, tlHeight]])
    .on("brush end", brushed);

  tlG.append("g")
    .attr("class","brush")
    .call(brush)
    // initial full‐range selection
    .call(brush.move, xTl.range());

  // on brush, update state.dayRange & chart
  function brushed({selection}) {
    if (!selection) return;
    let [x0,x1] = selection;
    let d0 = Math.round(xTl.invert(x0));
    let d1 = Math.round(xTl.invert(x1));
    d0 = Math.max(0, Math.min(13, d0));
    d1 = Math.max(0, Math.min(13, d1));
    state.dayRange = [Math.min(d0,d1), Math.max(d0,d1)];
    updateChart();
  }

  // handle resize of both charts and timeline
  function handleResize() {
    width = getWidth();
    svgEl.attr("width", width + margin.left + margin.right);
    xLabel.attr("x", width/2);

    // update timeline width
    tlWidth = getTlWidth();
    tlSvg.attr("width", tlWidth + tlMargin.left + tlMargin.right);
    xTl.range([0, tlWidth]);
    tlG.select(".axis-tl")
      .call(d3.axisBottom(xTl).ticks(14).tickFormat(d3.format("d")));
    tlG.select(".brush")
      .call(brush.extent([[0,0],[tlWidth, tlHeight]]))
      .call(brush.move, xTl.range());
    
    updateChart();
  }
  window.addEventListener("resize", handleResize);

  // ────────────────────────────────────────────────────────────────────────────
  // updateChart: filter, aggregate, redraw
  // ────────────────────────────────────────────────────────────────────────────
  function updateChart() {
    width = getWidth();
    svgEl.attr("width", width + margin.left + margin.right);
    xLabel.attr("x", width/2);

    const raw = dataByBin[state.binSize];
    const filt = raw.filter(d =>
      d.day >= state.dayRange[0] && d.day <= state.dayRange[1]
    );

    // pick the correct field for aggregation
    const key = state.metric === "ratio_mean" ? "ratio" : state.metric;

    const rolls = d3.rollups(
      filt,
      v => d3.mean(v, d => +d[key]),
      d => +d.bin
    );

    const data = rolls.map(([bin,val]) => ({ bin, value: val })).sort((a,b) => a.bin - b.bin);

    const xScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.bin))
      .range([0, width]);
    const yScale = d3.scaleLinear()
      .domain(d3.extent(data, d => d.value)).nice()
      .range([height, 0]);

    xAxisG.call(d3.axisBottom(xScale).ticks(8)).selectAll("text").style("font-size","10px");
    yAxisG.call(d3.axisLeft(yScale).ticks(6)).selectAll("text").style("font-size","10px");


    xLabel.text(`Time of Day (bins of ${state.binSize} min)`);
    yLabel.text(metricOptions[state.metric]);

    const lineGen = d3.line()
      .x(d => xScale(d.bin))
      .y(d => yScale(d.value));

    linePath.datum(data)
      .transition().duration(300)
      .attr("d", lineGen);

    // redraw annotations
    annG.selectAll("*").remove();
    [0, 720 / state.binSize].forEach((b,i) => {
      annG.append("line")
        .attr("class","annotation-line")
        .attr("x1", xScale(b)).attr("x2", xScale(b))
        .attr("y1", 0).attr("y2", height);
      annG.append("text")
        .attr("class","annotation-text")
        .attr("x", xScale(b) + 4)
        .attr("y", -4)
        .text(i===0 ? "Lights Off" : "Lights On");
    });

    hoverRect
      .attr("width", width)
      .attr("height", height)
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const bin = Math.round(xScale.invert(mx));
        const match = data.find(d => d.bin === bin);
        if (!match) return;
        tooltip
          .html(`Bin: <strong>${bin}</strong><br>${metricOptions[state.metric]}: <strong>${match.value.toFixed(2)}</strong>`)
          .style("opacity",1)
          .style("left", `${event.pageX+10}px`)
          .style("top",  `${event.pageY+10}px`);
        })
        .on("mouseout", () => tooltip.style("opacity",0));

    // subtitle: include estrus days count
    const [d0,d1] = state.dayRange;
    const totalDays = d1 - d0 + 1;
    const estrusCount = d3.sum(d3.range(d0,d1+1), day=>day%4===2);

    subtitle.html(
      `Showing days <strong>${d0}-${d1}</strong> `
      + `(Estrus days: <strong>${estrusCount}/${totalDays}</strong>), `
      + `bin = <strong>${state.binSize} min</strong>, `
      + `metric = <strong>${metricOptions[state.metric]}</strong>`
    );
  }

  // initial render & resize handling
  updateChart();
  window.addEventListener("resize", updateChart);

})();
