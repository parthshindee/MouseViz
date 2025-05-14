// js/main.js
(async function() {
  // ────────────────────────────────────────────────────────────────────────────
  // Config & State
  // ────────────────────────────────────────────────────────────────────────────
  const binSizes = [5,15,30,60];
  const metricOptions = {
    activity_mean:    "Activity",
    temperature_mean: "Temperature",
    ratio_mean:       "Temp / Activity"
  };
  let state = {
    binSize:  60,
    metric:   "activity_mean",
    dayRange: [0, 13]
  };
  const dataByBin = {};

  // ────────────────────────────────────────────────────────────────────────────
  // Load JSON data
  // ────────────────────────────────────────────────────────────────────────────
  await Promise.all(
    binSizes.map(bs =>
      d3.json(`data/hourly_${bs}min.json`)
        .then(arr => dataByBin[bs] = arr)
    )
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Controls
  // ────────────────────────────────────────────────────────────────────────────
  const rangeLabel    = d3.select("#range-label");
  const binSelect     = d3.select("#bin-select");
  const metricButtons = d3.selectAll(".toggle-button");
  const subtitle      = d3.select("#subtitle");

  // single noUiSlider
  const daySliderEl = document.getElementById("day-slider");
  noUiSlider.create(daySliderEl, {
    start: state.dayRange,
    connect: true,
    step: 1,
    range: { min: 0, max: 13 },
    tooltips: [true, true],
    format: { to: Math.round, from: Math.round }
  });
  daySliderEl.noUiSlider.on("update", vals => {
    state.dayRange = vals.map(v=>+v);
    rangeLabel.text(`${state.dayRange[0]}-${state.dayRange[1]}`);
    updateChart();
  });

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
  // SVG Boilerplate
  // ────────────────────────────────────────────────────────────────────────────
  const container = d3.select("#chart-container"),
        svgEl     = d3.select("#main-chart"),
        margin    = { top:20, right:20, bottom:40, left:50 },
        height    = 400 - margin.top - margin.bottom;

  function getWidth() {
    return parseInt(container.style("width"))
         - margin.left - margin.right;
  }
  let width = getWidth();

  svgEl
    .attr("width",  width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

  const svg = svgEl.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const xAxisG   = svg.append("g")
                      .attr("class","x-axis")
                      .attr("transform",`translate(0,${height})`);
  const yAxisG   = svg.append("g").attr("class","y-axis");
  const yLabel   = svg.append("text")
                      .attr("class","axis-label")
                      .attr("transform","rotate(-90)")
                      .attr("x",-height/2).attr("y",-margin.left+15)
                      .attr("text-anchor","middle")
                      .style("font-size","12px");
  const xLabel   = svg.append("text")
                      .attr("class","axis-label")
                      .attr("x", width/2).attr("y", height + margin.bottom -4)
                      .attr("text-anchor","middle")
                      .style("font-size","12px");
  const linePath = svg.append("path")
                      .attr("class","line")
                      .attr("fill","none")
                      .attr("stroke","#d62728")
                      .attr("stroke-width",2);
  const annG     = svg.append("g").attr("class","annotations");

  const tooltip  = d3.select("body").append("div").attr("class","tooltip");
  const hoverRect= svg.append("rect")
                      .attr("class","hover-rect")
                      .attr("fill","none")
                      .attr("pointer-events","all");

  // ────────────────────────────────────────────────────────────────────────────
  // updateChart: the single redraw function
  // ────────────────────────────────────────────────────────────────────────────
  function updateChart() {
    width = getWidth();
    svgEl.attr("width", width + margin.left + margin.right);

    // filter days
    const raw  = dataByBin[state.binSize],
          filt = raw.filter(d =>
            d.day >= state.dayRange[0] &&
            d.day <= state.dayRange[1]
          );

    // choose proper key
    const key = state.metric === "ratio_mean" ? "ratio" : state.metric;

    // aggregate by bin
    const rolls = d3.rollups(
      filt,
      vs => d3.mean(vs, d=>+d[key]),
      d => +d.bin
    );
    const data = rolls.map(([b,v])=>({bin:b,value:v}))
                      .sort((a,b)=>a.bin-b.bin);

    // scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(data,d=>d.bin))
      .range([0, width]);
    const yScale = d3.scaleLinear()
      .domain(d3.extent(data,d=>d.value)).nice()
      .range([height, 0]);

    // axes
    xAxisG.call(d3.axisBottom(xScale).ticks(8))
          .selectAll("text").style("font-size","10px");
    yAxisG.call(d3.axisLeft(yScale).ticks(6))
          .selectAll("text").style("font-size","10px");

    // axis labels
    xLabel.text(`Time of day (bin = ${state.binSize} min)`);
    yLabel.text(metricOptions[state.metric]);

    // line
    const lineGen = d3.line()
      .x(d=>xScale(d.bin))
      .y(d=>yScale(d.value));
    linePath.datum(data)
            .transition().duration(300)
            .attr("d", lineGen);

    // lights annotations
    annG.selectAll("*").remove();
    [0, 720/state.binSize].forEach((b,i)=>{
      annG.append("line")
          .attr("class","annotation-line")
          .attr("x1",xScale(b)).attr("x2",xScale(b))
          .attr("y1",0).attr("y2",height);
      annG.append("text")
          .attr("class","annotation-text")
          .attr("x",xScale(b)+4)
          .attr("y",-4)
          .text(i===0?"Lights Off":"Lights On");
    });

    // tooltip handler
    hoverRect
      .attr("width", width)
      .attr("height", height)
      .on("mousemove", event => {
        const [mx] = d3.pointer(event),
              bin = Math.round(xScale.invert(mx)),
              m   = data.find(d=>d.bin===bin);
        if (!m) return;
        tooltip.html(
          `Bin: <strong>${bin}</strong><br>` +
          `${metricOptions[state.metric]}: <strong>${m.value.toFixed(2)}</strong>`
        )
        .style("opacity",1)
        .style("left", (event.pageX+10)+"px")
        .style("top", (event.pageY+10)+"px");
      })
      .on("mouseout", ()=>tooltip.style("opacity",0));

    // estrus days in subtitle
    const estrusDays = Array.from(new Set(
      raw.filter(d=>
        d.day>=state.dayRange[0] && d.day<=state.dayRange[1] && d.estrus
      ).map(d=>d.day)
    )).sort((a,b)=>a-b);

    subtitle.html(
      `Showing days <strong>${state.dayRange[0]}-${state.dayRange[1]}</strong>` +
      (estrusDays.length
        ? ` (estrus: ${estrusDays.join(", ")})`
        : "") +
      `, bin = <strong>${state.binSize} min</strong>, `+
      `metric = <strong>${metricOptions[state.metric]}</strong>`
    );
  }

  // initial draw & resize
  updateChart();
  window.addEventListener("resize", updateChart);

})();
