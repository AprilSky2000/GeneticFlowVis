window.onload = checkScreenSize;

// global variable (selectedTopic == null)
let global_graph, global_params, global_years, global_nodes, 
    global_edges, global_polygon, global_paper_field;

// subgraph variable (global / subgraph, the graph to render)
let graph, params, years, nodes, edges, polygon, paper_field;

let processedNodes, processedEdges;

// current variable (for hyperbolic transformation)
let current_graph;
let contextEdges = {}, combinedContextEdges = {};;
let virtualEdges = [];
let id2attr = {};
let paperID2year = {};
let dot = '';
let edgeBundling = 6;
let context_edge_weight = 3;

let edgePathId2Attr = {}
let viewBoxWidth, viewBoxHeight, svgWidth, svgHeight, moveDistance_r, moveDistance_l;
let viz, vizContext, config, visType, authorData;
let g, gr, gl;  // maingroup, fixedgroup_r, fixedgroup_l
let selectedTopic = null;
let adjacent_ids = [];
let extend_ids = [];
let center_node = null;
let paperID2topic = {};
let forceChart = null;
let coverage=5, focus=0.5;
let isMouseDown = false; // 跟踪鼠标是否被按下
let lastMouseX, lastMouseY; // 上一个鼠标X坐标
let y_focus = 0.5;
let enable_y_focus = false, showYears = true;
let highlighted = [];
let TTM = {}, TTMEdges = {};   // topicTransitionMatrix
let arrangement = [], adjacentMatrix;
let originalCost, bestCost;
let bbox, bbox_padding_x=10, bbox_padding_y=100;
let yearGrid = 2, alpha = 10;
let minYear, maxYear;
let virtualOpacity = 0.1;
let topicOpacity = 0.25;
let maxOpacity = 0.8;

const tanh = x => Math.tanh(x);
const sech2 = x => 1 / (Math.cosh(x) ** 2);
const inverse = r => Math.sign(r) * Math.acosh(0.5 * r * r + 1);
let hyperbolicTransform = x => (tanh(inverse(x) * coverage) + 1) / 2

function guidence() {
    if (!localStorage.getItem('guidanceShown')) {
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('info').classList.add('highlight');
        document.getElementById('info-text').style.display = 'inline';

        document.getElementById('overlay').addEventListener('click', function() {
            this.style.display = 'none';
            document.getElementById('info').classList.remove('highlight');
            document.getElementById('info-text').style.display = 'none';

            // 在localStorage中设置标记
            localStorage.setItem('guidanceShown', 'true');
        });
    }
};

function checkScreenSize() {
    if (window.innerWidth <= 800) {
        document.getElementById('screen-size-warning').style.display = 'block';
    } else {
        document.getElementById('screen-size-warning').style.display = 'none';
    }
}

function addAllListeners() {
    $("#topic-slider").change(function () {
        var topic_r = $("#topic-slider").val();
        d3.selectAll(".topic-map")
            .transition()
            .duration(300)
            .attr("r", d => Math.sqrt(d.num) * 10 * topic_r);
        $("#topic-label").text(topic_r);
    });

    $("#yearGridSlider").change(function () {
        yearGrid = $("#yearGridSlider").val();
        if (visType == 5) {
            temporalThematicFlow();
        } else {
            init_graph();
        }
    })

    $("#alphaSlider").change(function () {
        alpha = $("#alphaSlider").val();
        renderDot();
    })

    $("#vis-type").change(updateVisType);

    // 监听滑块值的变化
    rangeSlider.noUiSlider.on("update", function (values, handle) {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        rangeLabel.textContent = `${min}-${max}`;

        d3.selectAll(".topic-map")
        .transition()
        .duration(300)
        .style("opacity", d => {
            if (d.num >= min && d.num <= max) return 1;
            return 0;
        })
        .attr("pointer-events", d => {
            if (d.num >= min && d.num <= max) return "all";
            return "none";
        });
        
        draw_tagcloud(min, max);
        // visual_topics();
    });

    nodeSlider.noUiSlider.on("change", function () {
        $("#node-value").text("≥" + nodeSlider.noUiSlider.get() + " prob.");
        loadAndRender();
    });
    edgeSlider.noUiSlider.on("change", function () {
        $("#edge-value").text("≥" + edgeSlider.noUiSlider.get() + " prob.");
        loadAndRender();
    });
    topicSlider.noUiSlider.on("change", function () {
        $("#topic-value").text("≥" + topicSlider.noUiSlider.get() + " prob.");
        loadAndRender();
    });

    $("#save").click(function () {
        var mainsvg = getZoomSvg('#mainsvg', '#maingroup');
        var tagcloud = getZoomSvg('#tagcloud', null);
        var fileName = name + " GF profile.jpg";
        downloadSvg([mainsvg, tagcloud], fileName);
    });
    // $("#fullscreen").click($("#fullscreen").click(toggleFullscreen));
    document.getElementById("fullscreen").addEventListener("click", toggleFullscreen);
    $("#zoom-in").click(function() {
        d3.select('#mainsvg').transition().duration(300).call(zoom.scaleBy, 1.1);
    });
    $("#zoom-out").click(function() {
        d3.select('#mainsvg').transition().duration(300).call(zoom.scaleBy, 0.9);
    });
    $("#restore").click(function() {
        reset_graph();
    });
    $("#show-years").click(function() {
        showYears = !showYears;
        console.log('showYears', showYears)
        if(showYears) {
            draw_paper_field(gr, paper_field, nodes);
        } else {
            gr.selectAll('*').remove();
        }
    })

    $("#edge-bundling").on('change', function() {
        edgeBundling = parseInt(this.value);
        renderDot();
    })
    

    // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
    $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

    // 点击按钮时的事件处理
    $(".address-text button").click(function () {
        // 将所有按钮的字体设为正常，透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });

        // 将点击的按钮加粗，透明度为1
        $(this).css({ 'font-weight': 'bold', 'opacity': 1 });
    });

    window.addEventListener('resize', onFullscreenChange);
    window.onload = checkScreenSize;
    guidence();

    $(document).click(function(event) {
        // console.log(event.target, $(event.target).parent().parent());
        let grandma = $(event.target).parent().parent();
        if (grandma.is('#draw-area'))
            reset_node(true);
    });

}

function drawYears() {
    var yearSlider = document.getElementById('yearSlider');

    var formatForSlider = {
        from: function (formattedValue) {
            return Number(formattedValue);
        },
        to: function(numericValue) {
            return Math.round(numericValue);
        }
    };

    noUiSlider.create(yearSlider, {
        start: [2000, 2020],
        step: 1,
        limit: 20,
        tooltips: true,
        orientation: 'vertical',
        direction: 'ltr',
        connect: true,
        range: {
            'min': 2000,
            'max': 2020
        },
        pips: { mode: 'steps', format: formatForSlider },
    });

}


function toggleFullscreen() {
    const container = document.getElementsByClassName("middle-column")[0];

    // 检查是否已经处于全屏状态
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
        // 进入全屏
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                document.addEventListener("fullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen().then(() => {
                document.addEventListener("webkitfullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        }
    } else {
        // 退出全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function onFullscreenChange() {
    // 在这里执行其他操作
    console.log('Fullscreen changed!', graph);
    checkScreenSize();

    $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
    init_graph(graph);

    if (nodes.length > 0 && selectedTopic == null) {
        draw_tagcloud();
        visual_topics();
    }
    
    updateSider(name);
}

function onEscKeyPressed(event) {
    if (event.key === "Escape") {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function reset_graph() {
    image_status = image_data.length == 0 ? 0 : 2;
    $("#description").hide();
    $("#tagcloud").show();
    $("#mainsvg").show();
    d3.select('#mainsvg').transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}
function op(key){
    return function(value1, value2){
    // 对属性的访问，obj["key"]与obj.key都是可以的，不过，如果key值并不确定，而是一个变量的时候，则只能通过obj[key]的方式访问。
        var val1 = value1[key];//这块用.key数组没有发生变化
        var val2 = value2[key];
        return val2 - val1;
    }
}

function updateSider (name) {
    // const screenHeight = $(window).height();
    // $("#topic-info").css("height", screenHeight / 4);
    // $("#topic-info").css("height", $("#basic-info").width());
    var left_height = $("#basic-info").height() + $("#graph-info").height() + $("#topic-info").height();
    // var left_height = ($("#paper-list").height() - $("#paper-list-title").height()) *0.96;
    // var left_height = mainPanalHeight * 0.88 - $("#paper-list-title").height();
    
    $("#timeline").css("height", left_height);
    $("#cited-papers").css("height", left_height * 1.03);
    $("#citing-papers").css("height", left_height * 1.03);
    // $("abstract").css("height", screenHeight / 3.4);
    // [0].citationCount    [0].color  [24.7, 0.982876170558304, 1]

    $("#timeline").empty();
    $("#timeline").append(content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: white; display: inline-block;"></i>
        </div>
        <div style="margin-left: 7%; margin-bottom: 2%; display: flex; justify-content: space-between;">
            <b style="margin-left: 0%; font-size:16px;">Paper Name</b>
            <b style="margin-right: 1%; margin-left: 5%; font-size:16px;">#Citation</b>
        </div>`
    );
    nodes = nodes.sort(op("citationCount"));
    for (let i = 0; i < nodes.length; i++) {
        const paperName = String(nodes[i].name);
        const paperVenu = String(nodes[i].venu);
        const paperYear = String(nodes[i].year);

        var authors = String(nodes[i].authors);
        if (authors == "") {
            authors = name;
        }
        var authorList = authors.split(", ");
        var paperAuthors = "";
        for (let i = 0; i < authorList.length; i++) {
            if (authorList[i] == name) 
                paperAuthors += "<span style=\"color: #00A78E\">" + authorList[i] + "</span>, ";
            else 
                paperAuthors += authorList[i] + ", ";
        }
        var color = topic2color(nodes[i].topic, 0.7) // hsvToHex(nodes[i].color[0], 0.7, nodes[i].color[2]);
        var nodeId = nodes[i].id;
        var citationCount = nodes[i].citationCount;
        if (nodes[i].citationCount == '-1') {
            citationCount = "not available";
        }
        var content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></i>
        </div>
        <div style="margin-left: 5%; margin-right: 3%; padding: 3%; margin-top: -3%; border-radius: 5px"; class="paperNode" onmouseover="highlight_node('${nodeId}', false, false)" onmouseleave="reset_node()">
            <div style="display: flex; justify-content: space-between; margin-bottom: 1%;">
                <span style="margin-left: 0%;">${paperName}</span>
                <span style="margin-right: 2%; margin-left: 5%;">${citationCount}</span>
            </div>
            <span style="color: #808080;">
                ${paperAuthors.slice(0, -2)}
            </span>
            <br>
            <span style="color: #808080;">${paperVenu} ${paperYear}</span>
        </div>
        `;
        
        $("#timeline").append(content);
    }
    $("#paper-list").show();
    $("#node-info").css("max-height", $("#paper-list").height() - $("#selector").innerHeight());
    $("#edge-content").css("max-height", $("#paper-list").height() - $("#edge-title").innerHeight());
}

// Function to convert HSV to RGB
function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;

    if (h >= 0 && h < 60) {
        [r, g, b] = [c, x, 0];
    } else if (h >= 60 && h < 120) {
        [r, g, b] = [x, c, 0];
    } else if (h >= 120 && h < 180) {
        [r, g, b] = [0, c, x];
    } else if (h >= 180 && h < 240) {
        [r, g, b] = [0, x, c];
    } else if (h >= 240 && h < 300) {
        [r, g, b] = [x, 0, c];
    } else {
        [r, g, b] = [c, 0, x];
    }

    const rgbColor = [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    return rgbColor;
}

function hsvToHex(h, s, v) {
    let rgbColor = hsvToRgb(h, s, v);
    let r = Math.round(rgbColor[0]);
    let g = Math.round(rgbColor[1]);
    let b = Math.round(rgbColor[2]);

    // 将RGB值转换为十六进制字符串
    const toHex = (value) => {
        const hex = value.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    const red = toHex(r);
    const green = toHex(g);
    const blue = toHex(b);

    return "#" + red + green + blue;
}

function textSize(text, size) {
    let container = d3.select('body').append('svg');
    container.append('text')
      .style("font-size", size + "px")      // todo: these need to be passed to the function or a css style
      .style("font-family", "sans-serif")
      .text(text);
  
    let sel = container.selectAll('text').node();
    let width = sel.getComputedTextLength();
    let height = sel.getExtentOfChar(0).height;
    container.remove();
    return {width, height};
}

function getShortName(topicID) {
    let name = fields[parseInt(topicID)][2];
    return name.split("_").slice(0, 3).join(' ');
}

function calculateWordPosition(sortedData, maxFontSize) {
    let ele = d3.select("#tagcloud").node();
    let svgWidth = ele.getBoundingClientRect().width;
    let svgHeight = ele.getBoundingClientRect().height;
    let lineHeight = maxFontSize * 1.2;
    let emptySpace = maxFontSize * 0.1;
    let wordPosition = [];
    let currentLine = [];
    let currentLineWidth = 0;
    let currentLineHeight = 0;
    let minFontSize = 8;

    for (const d of sortedData) {
        let ratio = Math.cbrt(d.num / sortedData[0].num);
        if (ratio * maxFontSize < minFontSize) {
            ratio = minFontSize / maxFontSize;
        }
        let size = ratio * maxFontSize;
        let height = ratio * lineHeight;
        let opacity = ratio * 0.8 + 0.1;
        let shortName = d.name.split("_").slice(0, 3).join(' ');
        if (ratio < 0.5) {
            shortName = d.name.split("_").slice(0, 2).join(' ');
        }
        shortName = topic2order(d.id) + '. ' + shortName;
        // let width = size * shortName.length * 0.5;
        let width = textSize(shortName, size).width * 0.88;
        if (currentLineWidth + width > svgWidth) {
            if (currentLine.length == 0) return null
            for (const word of currentLine) {
                word.x += (svgWidth - currentLineWidth) / 2;
            }
            currentLineHeight += currentLine[0].height + emptySpace;
            if (currentLineHeight + height > svgHeight) return null;
            wordPosition.push(currentLine);
            currentLine = [];
            currentLineWidth = 0;
        }
        currentLine.push({
            id: d.id,
            size: size,
            width: width,
            height: height,
            name: d.name,
            ratio: ratio,
            shortName: shortName,
            opacity: opacity,
            x: currentLineWidth,
            y: currentLineHeight
        });
        currentLineWidth += width + emptySpace;
    }

    for (const word of currentLine) {
        word.x += (svgWidth - currentLineWidth) / 2;
    }
    wordPosition.push(currentLine);
    return wordPosition;
}

// function topic2order(topic) {
//     let ix = global_paper_field.findIndex(d => d.id == topic);
//     let name = global_paper_field[ix].name;    
//     // name="others"返回'Z'，否则ix=0返回'A'……ix=25返回'Z'
//     return name == "Others" ? 'Z' : String.fromCharCode(65 + ix);
// }

function topic2order(topic) {
    return topic;
}

function draw_tagcloud(min=0, max=Infinity) {
    let ele = d3.select("#tagcloud").node();
    d3.select("#tagcloud").selectAll("*").remove();
    let svg = d3.select("#tagcloud").append("svg")
        .attr("width", ele.getBoundingClientRect().width)
        .attr("height", ele.getBoundingClientRect().height) ;


    let paper_field_filter = global_paper_field.filter(item => item.num >= min && item.num <= max);
    const sortedData = paper_field_filter.sort((a, b) => b.num - a.num);

    // console.log('draw tag cloud', sortedData, min, max)

    const wordCloud = svg.append("g");
        // .attr("transform", "translate(10, 10)");

    let maxFontSize = 60;
    while ((wordPosition=calculateWordPosition(sortedData, maxFontSize)) === null) {
        maxFontSize *= 0.95;
    }

    /* TODO
     * 当nodes没有节点时，下面的wordPosition会因为访问了未知属性`.y`出错
     */
    if (Array.isArray(wordPosition) && wordPosition.length == 1 && Array.isArray(wordPosition[0]) && wordPosition[0].length == 0) {
        return;
    }
    
    const words = wordCloud.selectAll("g")
        .data(wordPosition)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0, ${d[0].y})`);

    words.selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("class", "tag-rect")
        .attr("x", d => d.x)
        .attr("y", d => 0)
        .attr("id", d => `rect_${d.id}`)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", d => maxFontSize * 0.1 * d.ratio)
        .attr("ry", d => maxFontSize * 0.1 * d.ratio)
        .style("fill", d => topic2color(d.id)) //rgba(15, 161, 216, ${d.opacity})
        //`rgb(${d.rgb[0]}, ${d.rgb[1]}, ${d.rgb[2]})`
        .style("fill-opacity", 0.8)
        .on('mouseover', function(d) {
            highlight_field(d.id);
            tip.show(d);
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout', reset_field)
        .on('click', d => {
            selectedTopic = selectedTopic == d.id? null: d.id;
            reset_tag();
            tip.hide(d);
            highlight_tag(d.id);
            loadAndRender();
        })

    words.selectAll("text")
        .data(d => d)
        .enter()
        .append("text")
        .text(d => d.shortName)
        .attr("x", d => d.x + d.width * 0.5)  // Adjusted to the center of the rectangle
        .attr("y", d => d.height / 2) // Adjusted to the center of the rectangle
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")        // Center the text horizontally
        .style("font-family", "Archivo Narrow")
        // .attr("dominant-baseline", "middle")  // Center the text vertically
        .attr("class", "tag-text")
        .attr("id", d => `text_${d.id}`)
        .attr("font-size", d => d.size + "px")
        .style("fill", d => `rgb(0,0,0)`)
        .attr("pointer-events", "none");
        // .on('mouseout', reset_field);

    draw_chord();
}

function draw_chord(){
    let ele = d3.select(".address-text").node();
    d3.select("#chord").selectAll("*").remove();
    let height = ele.getBoundingClientRect().width;
    let width = ele.getBoundingClientRect().width;
    const outerRadius = Math.min(width, height) * 0.5 - 20;
    const innerRadius = outerRadius - 10;
    let data = Object.assign(
        adjacentMatrix, {
            names: global_paper_field.map(d => topic2order(d.id)),
            colors: global_paper_field.map(d => topic2color(d.id))
        }
    )
    console.log(data)

    const {names, colors} = data;
    const sum = d3.sum(data.flat());
    const formatValue = d3.format(".1~%");

    const chord = d3.chord()
      .padAngle(10 / innerRadius)
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

  const ribbon = d3.ribbon()
      .radius(innerRadius - 1)
    //   .padAngle(1 / innerRadius);

  const color = d3.scaleOrdinal(names, colors);

  const svg = d3.select("#chord").append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "width: 100%; height: auto; font: 10px sans-serif;");

  const chords = chord(data);

  const group = svg.append("g")
    .selectAll()
    .data(chords.groups)
    .join("g");

  group.append("path")
      .attr("fill", d => color(names[d.index]))
      .attr("d", arc);

  group.append("title")
      .text(d => `${names[d.index]}\n${d.value}`);

  group.select("text")
      .attr("font-weight", "bold")
      .text(function(d) {
        return this.getAttribute("text-anchor") === "end"
            ? `↑ ${names[d.index]}`
            : `${names[d.index]} ↓`;
      });

  svg.append("g")
      .attr("fill-opacity", 0.8)
    .selectAll("path")
    .data(chords)
    .join("path")
      .style("mix-blend-mode", "multiply")
      .attr("fill", d => color(names[d.source.index]))
      .attr("d", ribbon)
    .append("title")
      .text(d => `${d.source.value} ${names[d.target.index]} → ${names[d.source.index]}${d.source.index === d.target.index ? "" : `\n${d.target.value} ${names[d.source.index]} → ${names[d.target.index]}`}`);
}

function create_svg(viewBox=undefined, transform=undefined) {
    let ele = d3.select("#mainsvg").node();
    d3.select("#mainsvg").selectAll("*").remove();
    svgWidth = ele.getBoundingClientRect().width;
    svgHeight = ele.getBoundingClientRect().height;
    if (!viewBox) {
        viewBox = `0 0 ${svgWidth} ${svgHeight}`;
    }
    let viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    if (!transform) {
        transform = `translate(0,${viewBoxHeight})`;
    }

    svg = d3.select("#mainsvg").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);

    //获取viewBox的宽度
    viewBoxWidth = parseFloat(viewBox.split(' ')[2]);
    viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    moveDistance_r = Math.max(viewBoxWidth, viewBoxWidth / 2 +  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;
    moveDistance_l = Math.min(0, viewBoxWidth / 2 -  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;

    let fixedXTranslation_r = "translate(" + moveDistance_r + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0
    let fixedXTranslation_l = "translate(" + moveDistance_l + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0

    g = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');
    gr = svg.append('g')
        .attr('transform', transform + fixedXTranslation_r)
        .attr('id', 'fixedgroup_r');
    gl = svg.append('g')
        .attr('transform', transform + fixedXTranslation_l)
        .attr('id', 'fixedgroup_l');

    // zoom = d3.zoom()
    //     .scaleExtent([0.05, 10])
    //     .on("zoom", function(){
    //         let transform = d3.event.transform;

    //         g.attr("transform", d3.event.transform + transform);

    //         // 仅更新Y坐标，X坐标保持不变
    //         circle.attr("y", transform.y + 100 * transform.k); // 假设初始Y坐标为100，根据缩放比例更新Y坐标
    //         // 注意：这里的100是圆形初始的Y坐标值，根据您的需要调整

    //         g.attr("transform", d3.event.transform + transform)
    //     });
    // svg.call(zoom);

    
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", function() {
        let currentTransform = d3.event.transform;
    
        // 应用当前的变换到主要元素组g
        g.attr("transform", currentTransform.toString() + " " + transform);
    
        // 为了在Y方向上保持gf元素的同步移动，我们需要提取当前变换的平移和缩放值
        // 并仅将这些应用到Y坐标，而X坐标保持不变（假定fixedX为X坐标的固定值）
        
        let yTranslation = "translate(0," + currentTransform.y + ")"; // 应用当前Y方向的平移
        let yScale = "scale(1," + currentTransform.k + ")"; // 在Y方向上应用缩放，X方向保持1
    
        // 将上述变换组合并应用到gf
        // 注意这里我们使用了空格来分隔不同的变换指令
        gr.attr("transform", yTranslation + yScale + transform + fixedXTranslation_r);
        gl.attr("transform", yTranslation + yScale + transform + fixedXTranslation_l);
    });
    svg.call(zoom);
}


function mouseoverEdge(id, width=10, color='red') {
    g.selectAll('#' + selectorById(id))
        .style("stroke", color)
        .style("stroke-width", width)
        .attr('cursor', 'pointer');
    g.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", color)
        .attr('cursor', 'pointer');
}

function mouseoutEdge(id) {
    if (!highlighted.includes(id)) {
        g.selectAll('#' + selectorById(id))
            .style("stroke", d=>d.color)
            .style("stroke-width", d=>d.width);
        g.selectAll('#' + selectorById(id) + '_polygon')
            .style("fill", d=>d.color);
    }
}

function clickEdge(id) {
    highlighted = [id];
    g.selectAll('.edge-path')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', virtualOpacity);
    g.selectAll('.edge-path-polygon')
        .style("fill", d=>d.color)
        .style('opacity', virtualOpacity);
    g.selectAll('#' + selectorById(id))
        .style("stroke", "red")
        .style("stroke-width", 10)
        .style('opacity', 1);
    g.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", "red")
        .style("opacity", 1);
}

function init_graph(curGraph=graph) {
    [params, years, nodes, edges, polygon] = curGraph;
    [viewBox, transform] = params;
    visType = $("#vis-type").val();
    create_svg(viewBox, transform);

    if (visType == 8) draw_context_edges();

    g.selectAll('circle').data(nodes).enter().append('ellipse')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('rx', d => d.rx)
        .attr('ry', d => d.ry)
        .style("fill", d => topic2color(d.topic))
        .attr('id', d => d.id)
        .attr('class', 'paper')
        .style("stroke", d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .style('stroke-width', d => updateOutlineThickness(d.isKeyPaper, d.citationCount))
        .on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            tip.show(d);
        })
        .on('click', function (d) {
            highlight_node(d.id);
        })
        .on('mouseout', function (d) {
            tip.hide(d);
        });

    draw_paper_field(gr, paper_field, nodes);
    g.selectAll('.text1').data(nodes).enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Archivo Narrow')
        .attr('font-size', 30)
        .attr('class', 'text1')
        .attr("pointer-events", "none")
        .each(function(d) {
            // let text = d.text === undefined? d.text1 + '\n' + d.text2 : String(d.citationCount)
            let text = d.label;
            var lines = text.split('\n');
            for (var i = 0; i < lines.length; i++) {
                d3.select(this).append('tspan')
                    .attr('x', d.x)
                    .attr('dy', 10)  // Adjust dy for subsequent lines
                    .text(lines[i]);
            }
        });
    
    // 绘制每条边的所有路径
    // 为每条边创建一个独立的group元素
    const edgeGroups = g.selectAll('.edge-group')
    .data(edges) // 使用edges数组，每个元素代表一条边
    .enter()
    .append('g')
    .attr('class', 'edge-group');

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        const edgeGroup = d3.select(this);

        // console.log('draw edge', edge, probToOpacity(edge.extends_prob), probToWidth(edge.extends_prob))
        
        edgePathId2Attr[edge.name] = {
            color: 'black',
            width: probToWidth(edge.extends_prob)
        }
        edgeGroup.selectAll('.edge-path')
            .data(edge.path) // 绑定每条边的路径数组
            .enter()
            .append('path')
            .attr('d', d=>{
                d.width = probToWidth(edge.extends_prob);
                d.color = 'black';
                return d.d
            })
            .style("fill", 'none')
            .style("stroke", 'black')
            .style('stroke-opacity', probToOpacity(edge.extends_prob))
            .style('stroke-width', probToWidth(edge.extends_prob))
            .attr('class', 'edge-path')
            .attr('id', selectorById(edge.name))
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show(edge);
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide(edge);
            });
            
        if (!edge.polygon) {
            return true;
        }
        edgeGroup.append('polygon')
            .attr('points', edge.polygon.points)
            .style('stroke', 'none')
            .style('fill', d=>{
                d.color = 'black';
                return 'black'
            })
            .style("fill-opacity", probToOpacity(edge.extends_prob))
            .attr('class', 'edge-path-polygon')
            .attr('id', selectorById(edge.name) + '_polygon')
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show(edge);
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide(edge);
            });
    });



    bbox = g.node().getBBox();

    if (selectedTopic != null) {
        draw_bbox();
        if (visType == 0) draw_topic_matrix();
        else if (visType == 6) draw_topic_bar();
        else if (visType == 7) draw_topic_side();
        else if (visType == 8) draw_context();
    }
}

function get_context_edge_color(name) {
    let edge = combinedContextEdges[name].edges[0];
    let node = global_nodes.find(n => n.id == (name[0] == 'l'? edge.source: edge.target));
    let color = topic2color(node.topic);
    return color;
}

function draw_context() {
    // draw context bar

    context_l = {};
    context_r = {}; 
    // topicID: {"2011": [edge1, edge2, ...], "2012": [], "total": 50}

    let all_years_l = [], all_years_r = [];
    let totalWidth = bbox.width;
    for (let edge of Object.values(combinedContextEdges)) {
        let years = edge.name.split('->');
        if (edge.name[0] == "l") {
            all_years_l.push(years[0].substring(1));
        } else {
            all_years_r.push(years[1].substring(1));
        }
    }
    all_years_l = Array.from(new Set(all_years_l));
    all_years_r = Array.from(new Set(all_years_r));
    console.log('all_years', all_years_l, all_years_r);


    for (let edge of Object.values(combinedContextEdges)) {
        if (edge.name[0] == "l") {
            let year = edge.name.split('->')[0].substring(1);
            for (let e of edge.edges) {
                let topic = paperID2topic[e.source];
                if (context_l[topic] == undefined) {
                    context_l[topic] = {"total": 0};
                    for (let y of all_years_l) context_l[topic][y] = [];
                }
                context_l[topic][year].push(e);
                context_l[topic]["total"] += 1;
            }
        } else {
            let year = edge.name.split('->')[1].substring(1);
            for (let e of edge.edges) {
                let topic = paperID2topic[e.target];
                if (context_r[topic] == undefined) {
                    context_r[topic] = {"total": 0};
                    for (let y of all_years_r) context_r[topic][y] = [];
                }
                context_r[topic][year].push(e);
                context_r[topic]["total"] += 1;
            }
        }
    }

    let totalSize_l = Object.values(context_l).reduce((acc, val) => acc + val.total, 0);
    let totalSize_r = Object.values(context_r).reduce((acc, val) => acc + val.total, 0);

    draw_context_bar(context_l, totalSize_l * totalWidth / (totalSize_l + totalSize_r), 'l');
    draw_context_bar(context_r, totalSize_r * totalWidth / (totalSize_l + totalSize_r), 'r');

}

function draw_context_bar(context, width, dir='l') {
    let sorted_keys = Object.entries(context).sort((a, b) => b[1].total - a[1].total).map(entry => entry[0]);
    console.log('context for', dir,  context);
    let totalSize = sorted_keys.reduce((acc, key) => acc + context[key].total, 0);

    const squareSize = 50; // 正方形大小
    let processedData = [];
    let margin = 5; // 方块之间的间隔
    const xPositions = {};
    sorted_keys.forEach(topicID => {
        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return;
            if (!xPositions[year]) xPositions[year] = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
            
            let nodeCount = 0;
            context[topicID][year].forEach((edge, index) => {
                let nodeID = dir == 'l'? edge.source: edge.target;
                let leftX = dir == 'l'? xPositions[year] - squareSize * (index + 1) - margin * nodeCount: 
                                        xPositions[year] + squareSize * index + margin * nodeCount;
                if (processedData.length > 0 && processedData[processedData.length - 1].id == nodeID) {
                    processedData[processedData.length - 1].edge.push(edge);
                    if (dir == 'l') processedData[processedData.length - 1].x = leftX + margin;
                } else {
                    nodeCount += 1;
                    processedData.push({
                        id: nodeID,
                        node: global_nodes.find(n => n.id == nodeID),
                        topic: topicID,
                        year: year,
                        y: id2attr['l' + year].y - squareSize / 2,
                        x: leftX,
                        edge: [edge]
                    });
                }
            });
            
            let tmp = xPositions[year];
            if (dir == 'l') xPositions[year] -= squareSize * context[topicID][year].length + margin * nodeCount;
            else xPositions[year] += squareSize * context[topicID][year].length + margin * nodeCount;
            context[topicID][year].m = Math.min(xPositions[year], tmp);
            context[topicID][year].M = Math.max(xPositions[year], tmp);
        });
    });

    console.log('processedData', processedData);

    // 创建多边形路径数据
    let topicPaths = {};
    let startX = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
    sorted_keys.forEach(topicID => {
        if (!topicPaths[topicID]) {
            topicPaths[topicID] = [];
        }

        // 添加顶部方块
        let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total / totalSize  * width;
        // let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total  * squareSize / 4;
        let m = Math.min(startX, tmp);
        let M = Math.max(startX, tmp);
        startX = tmp;

        topicPaths[topicID].m = m;
        topicPaths[topicID].M = M;
        if (dir == 'l') {
            topicPaths[topicID].r = (bbox.x - bbox_padding_x) - M;
            topicPaths[topicID].R = (bbox.x - bbox_padding_x) - m;
        } else {
            topicPaths[topicID].r = m - (bbox.x + bbox.width + bbox_padding_x);
            topicPaths[topicID].R = M - (bbox.x + bbox.width + bbox_padding_x);
        }

        let y = bbox.y - bbox_padding_y - squareSize;
        // 先添加右侧点
        topicPaths[topicID].push([M, y - squareSize]); // 右上
        topicPaths[topicID].push([M, y + squareSize]); // 右下
        
        // 然后添加左侧点
        topicPaths[topicID].unshift([m, y - squareSize]); // 左上
        topicPaths[topicID].unshift([m, y + squareSize]); // 左下
        

        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return true;
            // 先添加右侧点
            topicPaths[topicID].push([context[topicID][year].M, id2attr['l' + year].y - squareSize /2]); // 右上
            topicPaths[topicID].push([context[topicID][year].M, id2attr['l' + year].y + squareSize /2]); // 右下
            
            // 然后添加左侧点
            topicPaths[topicID].unshift([context[topicID][year].m, id2attr['l' + year].y - squareSize /2]); // 左上
            topicPaths[topicID].unshift([context[topicID][year].m, id2attr['l' + year].y + squareSize /2]); // 左下
            
        })
    });

    console.log('topicPaths', topicPaths);

    let center = dir == 'l'? [bbox.x - bbox_padding_x, bbox.y - bbox_padding_y - 2 * squareSize]
                            : [bbox.x + bbox.width + bbox_padding_x, bbox.y - bbox_padding_y - 2 * squareSize];
    let suffix = dir=='l'? 'o': 'i';
    let resuffix  = dir=='l'? 'i': 'o';

    const arcGenerator = d3.arc()
        .innerRadius(d => d.r)
        .outerRadius(d => d.R)  // 控制厚度，使其看起来像一个填充的椭圆
        .startAngle(-Math.PI / 2)  // 开始角度
        .endAngle(Math.PI / 2)    // 结束角度
        .cornerRadius(0);

    // 绘制多边形
    Object.keys(topicPaths).forEach(topicID => {
        g.append("path")
           .datum(topicPaths[topicID])
           .attr("fill", topic2color(topicID))
           .attr("fill-opacity", topicOpacity)
           .attr("class", "context-polygon context-polygon_" + topicID)
        //    .attr("stroke", topic2color(topicID))
        //    .attr("stroke-width", 2)
           .attr("d", d3.line()
                        .x(d => d[0])
                        .y(d => d[1])
                        .curve(d3.curveLinearClosed))
            .on('mouseover', function() {
                let field = global_paper_field.find(d => d.id == topicID);
                highlight_field(topicID);
                tip.show({name: field.name + '\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', reset_field);
        
        g.append("path")
              .datum(topicPaths[topicID])
              .attr("fill", topic2color(topicID))
              .attr("fill-opacity", topicOpacity)
              .attr("class", "context-ellipse context-ellipse_" + topicID)
              .attr("d", d=> arcGenerator(d))
              .attr("transform", `translate(${center[0]}, ${center[1]})  scale(1, 0.5)`)
              .on('mouseover', function() {
                let field = global_paper_field.find(d => d.id == topicID);
                highlight_field(topicID);
                tip.show({name: field.name + '\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', reset_field);
            
        g.append("text")
            .attr("x", (topicPaths[topicID].M + topicPaths[topicID].m) / 2)
            .attr("y", center[1] + squareSize)
            .attr("text-anchor", "middle")
            .attr("font-family", "Archivo Narrow")
            .attr("font-size", Math.sqrt(context[topicID].total) * 10)
            .attr("class", "context-text context-text_" + topicID)
            .text(topicID + suffix)
            .attr("pointer-events", "none");
    });

    g.append("rect")
        .attr("x", dir =='l'? center[0]: center[0] - totalSize  * squareSize / 4)
        .attr("y", center[1])
        .attr("width", totalSize  * squareSize / 4)
        .attr("height", squareSize * 2)
        .attr("fill", topic2color(selectedTopic))
        .attr("fill-opacity", topicOpacity)
        .attr("class", "context-polygon context-polygon_" + selectedTopic)
        .on('mouseover', function() {
            let field = global_paper_field.find(d => d.id == selectedTopic);
            highlight_field(selectedTopic);
            tip.show({name: field.name + '\n' + totalSize});
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout', reset_field);

    g.append("text")
        .attr("x", dir == 'l'? center[0] + totalSize  * squareSize / 8: center[0] - totalSize  * squareSize / 8)
        .attr("y", center[1] + squareSize)
        .attr("text-anchor", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", Math.sqrt(totalSize) * 10)
        .attr("class", "context-text context-text_" + selectedTopic)
        .text(selectedTopic + resuffix) // dir=='l'? selectedTopic + '→': '→' + selectedTopic
        .attr("pointer-events", "none");

    // 绘制方块
    g.selectAll("rect_" + dir)
       .data(processedData)
       .enter()
       .append("rect")
       .attr("x", d => d.x)
       .attr("y", d => d.y)
       .attr("width", d => squareSize * d.edge.length)
       .attr("height", squareSize)
       .attr('id', d => d.id)
       .attr('class', "rect_" + dir)
       .attr("fill", d => topic2color(d.topic))
       .on("mouseover", function(d) {  
            // 使用 function 关键字而不是箭头函数
            d3.select(this)
            .attr("cursor", "pointer")
            .style("stroke", "red")
            .style("stroke-width", 2);
            tip.show(d.node);
       })
        .on("mouseout", function(d) {
            d3.select(this)
            .attr("cursor", "default")
            .style("stroke", "none");

            tip.hide(d.node);
        })
        .on("click", d => {
            highlight_node(d.id);
        })

}

function draw_context_edges() {
    console.log('draw context', combinedContextEdges);

    // draw context edges:
    // - edge id in Object.keys(contextEdges)
    // - using id2attr[edge]  to get the Path
    // - using contextEdges[edge].length to get width
    // - using all edges in contextEdges[edge], find the target and use topic of target to get color

    const edgeGroups = g.selectAll('.edge-group-context')
    .data(Object.keys(combinedContextEdges)) // 使用edges数组，每个元素代表一条边
    .enter()
    .append('g')
    .attr('class', 'edge-group-context');

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        if (!Object.keys(id2attr).includes(edge)) {
            console.log('context edge not found, maybe flat edges', edge, id2attr[edge])
            return true;    // continue
        }
        const edgeGroup = d3.select(this);

        edgePathId2Attr[edge] = {
            color: 'lightgray',
            width: combinedContextEdges[edge].weight * context_edge_weight
        }
        edgeGroup.selectAll('.edge-path')
            .data(id2attr[edge].path)
            .enter()
            .append('path')
            .attr('d', d=>{
                d.width = combinedContextEdges[edge].weight * context_edge_weight;
                d.color = 'lightgray';
                return d.d
            })
            .style("fill", 'none')
            .style("stroke", 'lightgray')
            .style('stroke-opacity', 0.5)
            .style('stroke-width', combinedContextEdges[edge].weight * context_edge_weight)
            .attr('class', 'edge-path')
            .attr('id', selectorById(edge))
            .on('mouseover', function () {
                mouseoverEdge(edge);
                tip.show(edge);
            })
            .on('click', function () {
                if (combinedContextEdges[edge].weight == 1) {
                    let e = combinedContextEdges[edge].edges[0];
                    highlight_edge(`${e.source}->${e.target}`);
                }
                clickEdge(edge);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge);
                tip.hide(edge);
            });

        if (!id2attr[edge].polygon) {
            return true;
        }
        // console.log('draw polygon', edge, id2attr[edge].polygon.points)
        d3.select(this).append('polygon')
            .attr('points', id2attr[edge].polygon.points)
            .style("stroke", 'none')
            .style("fill", d=>{
                d.color = 'lightgray';
                return 'lightgray';
            })
            .style('fill-opacity', 0.5)
            .attr('class', 'edge-path-polygon')
            .attr('id', selectorById(edge) + '_polygon')
            .on('mouseover', function () {
                mouseoverEdge(edge);
                tip.show(edge);
            })
            .on('click', function () {
                if (combinedContextEdges[edge].weight == 1) {
                    let e = combinedContextEdges[edge].edges[0];
                    highlight_edge(`${e.source}->${e.target}`);
                }
                clickEdge(edge);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge);
                tip.hide(edge);
            });
    });
}   

function draw_bbox() {
    const defs = g.append('defs');
    const filter = defs.append('filter')
        .attr('id', 'drop-shadow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%') // 增大过滤器的尺寸以包含阴影
        .attr('height', '140%');

    filter.append('feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', 10) // 增大模糊半径
        .attr('result', 'blur');

    filter.append('feOffset')
        .attr('in', 'blur')
        .attr('dx', 0) // 减少水平偏移
        .attr('dy', 0) // 减少垂直偏移
        .attr('result', 'offsetBlur');

    // 使用feFlood创建阴影颜色
    const feFlood = filter.append('feFlood')
        .attr('flood-color', 'black')
        .attr('flood-opacity', 0.5)
        .attr('result', 'color');

    // 使用feComposite将阴影颜色与模糊效果合并
    filter.append('feComposite')
        .attr('in', 'color')
        .attr('in2', 'offsetBlur')
        .attr('operator', 'in')
        .attr('result', 'shadow');

    // 使用feMerge将原图形与阴影效果合并显示
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
        .attr('in', 'shadow');
    feMerge.append('feMergeNode')
        .attr('in', 'SourceGraphic');

    // 绘制g元素的外框
    g.insert('rect', ':first-child')
        .attr('x', bbox.x - bbox_padding_x)
        .attr('y', bbox.y - bbox_padding_y)
        .attr('width', bbox.width + bbox_padding_x * 2)
        .attr('height', bbox.height + bbox_padding_y * 2)
        .style("fill", topic2color(selectedTopic, sat=0.04))
        .style("stroke", 'red')
        .style("stroke-width", 2)
        .attr('filter', 'url(#drop-shadow)')
        .attr('id', 'background');

    let belowY = bbox.y + bbox.height + bbox_padding_y * 2;

    g.insert('text', ':first-child')
        .attr('x', bbox.x + bbox.width / 2)
        .attr('y', belowY)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Archivo Narrow')
        .text(getShortName(selectedTopic))
        .attr('font-size', 48)
        .style("fill", 'red')
        .attr('id', 'background-text');

    function onClick(shift) {
        let currentIndex = arrangement.indexOf(selectedTopic);
        let newIndex = currentIndex + shift;
        if (newIndex < 0 || newIndex >= arrangement.length) return;
        let newTopic = arrangement[newIndex];
        selectedTopic = newTopic;
        loadAndRender();
    }

    const radius = 30; // 圆的半径
    const opacity = 0.8; // 圆与外框的距离

    // 添加左侧圆形按钮
    g.append('circle')
        .attr('cx', bbox.x)
        .attr('cy', belowY)
        .attr('r', radius)
        .style("fill", '#CCE8EB')
        .attr('id', 'leftCircle')
        .style("opacity", opacity)
        .on('mouseover', function() {
            d3.select(this).attr('r', radius * 1.5).style("opacity", 1); // 鼠标悬停时增大半径
        })
        .on('mouseout', function() {
            d3.select(this).attr('r', radius).style("opacity", opacity); // 鼠标离开时恢复半径
        })
        .on('click', _ => onClick(-1));

    // 添加右侧圆形按钮
    g.append('circle')
        .attr('cx', bbox.x + bbox.width)
        .attr('cy', belowY)
        .attr('r', radius)
        .style("fill", '#CCE8EB')
        .attr('id', 'rightCircle')
        .style("opacity", opacity)
        .on('mouseover', function() {
            d3.select(this).attr('r', radius * 1.5).style("opacity", 1);
        })
        .on('mouseout', function() {
            d3.select(this).attr('r', radius).style("opacity", opacity);
        })
        .on('click', _ => onClick(1));

    
    // 添加左箭头按钮
    g.append('path')
        .attr('d', `M ${bbox.x}, ${belowY - 10} l -15,15 l 15,15`)
        .style("stroke", 'black')
        .style("fill", 'none')
        .style("stroke-width", 5)
        .attr('pointer-events', 'none');

    // 添加右箭头按钮
    g.append('path')
        .attr('d', `M ${bbox.x + bbox.width}, ${belowY - 10} l 15,15 l -15,15`)
        .style("stroke", 'black')
        .style("fill", 'none')
        .style("stroke-width", 5)
        .attr('pointer-events', 'none');
}

function draw_topic_bar() {
    // let { processedNodes, processedEdges } = processData(global_nodes, global_edges);
    // console.log('processedNodes', processedNodes, 'processedEdges', processedEdges);

    let paper_field_filter = global_paper_field.filter(item => item.id != selectedTopic);
    
    let nodes_in = [], nodes_out = [];

    for (let [k, v] of Object.entries(processedEdges)) {
        if (k[0] == '-') {
            let targets = v.map(d => d.target);
            console.log('targets', targets)
            global_nodes.forEach(d => {
                if (targets.includes(d.id)) {
                    nodes_out.push(d);
                }
            })
        } else {
            let sources = v.map(d => d.source);
            console.log('sources', sources)
            global_nodes.forEach(d => {
                if (sources.includes(d.id)) {
                    nodes_in.push(d);
                }
            })
        }
    }

    // 删除gr元素
    d3.select("#fixedgroup_r").selectAll("*").remove();
    
    let middle_shift = Math.min(viewBoxWidth, svgWidth * viewBoxHeight / svgHeight / 2);
    console.log('shift', middle_shift, viewBoxWidth / 2 -  middle_shift, viewBoxWidth / 2 +  middle_shift)
    draw_paper_field(g, paper_field_filter, nodes_in, right=false, 
        shift=viewBoxWidth / 2 -  middle_shift);
    draw_paper_field(g, paper_field_filter, nodes_out, right=true, 
        shift=viewBoxWidth / 2 +  middle_shift);

    let edge_data = [], node_data = {};
    contextEdges = {};
    for (let [k, v] of Object.entries(processedEdges)) {
        if (k[0] == '-') {
            v.forEach(d => {
                let srcNode = nodes.find(node => node.id == d.source);
                let tgtNode = global_nodes.find(node => node.id == d.target);
                edge_data.push({
                    source: d.source,
                    target: d.target + 'out',
                    name: `${d.source}->${d.target}`,
                    edge: d,
                    color: topic2color(paperID2topic[d.target], sat=0.7),
                    in: false
                });
                node_data[d.source] = {x: srcNode.x, y: srcNode.y};
                node_data[d.target + 'out'] = {x: tgtNode.outx + 25, y: tgtNode.outy};

                let edge_name = `${d.source}->r${paperID2year[d.target]}`;
                if(contextEdges[edge_name]) contextEdges[edge_name] += 1;
                else contextEdges[edge_name] = 1;
            })
        } else {
            v.forEach(d => {
                let srcNode = global_nodes.find(node => node.id == d.source);
                let tgtNode = nodes.find(node => node.id == d.target);
                edge_data.push({
                    source: d.source + 'in',
                    target: d.target,
                    name: `${d.source}->${d.target}`,
                    edge: d,
                    color: topic2color(paperID2topic[d.source], sat=0.7),
                    in: true
                });
                node_data[d.source + 'in'] = {x: srcNode.inx + 25, y: srcNode.iny};
                node_data[d.target] = {x: tgtNode.x, y: tgtNode.y};

                let edge_name = `l${paperID2year[d.source]}->${d.target}`;
                if(contextEdges[edge_name]) contextEdges[edge_name] += 1;
                else contextEdges[edge_name] = 1;
            })
        }
    }
    console.log('bar fbundling: node_data', node_data, 'edge_data', edge_data);
    var fbundling = d3.ForceEdgeBundling()
            .compatibility_threshold(0.6)
            .iterations(100)
            .nodes(node_data)
            .edges(edge_data);
    var results   = fbundling();
    console.log('fbundling results', results)
    var d3line = d3.line().x(d=>d.x).y(d=>d.y).curve(d3.curveLinear);
    // 按照processedEdges添加边
    // g.selectAll('.link')
    //     .data(edge_data)
    //     .enter()
    //     .append('path')
    //     .attr('d', d => `M ${node_data[d.source].x} ${node_data[d.source].y} L ${node_data[d.target].x} ${node_data[d.target].y}`)
    //     .style("stroke", d=> d.color)
    //     .style("fill", 'none')
    //     .style("stroke-width", d=>probToWidth(d.edge.extends_prob))
    //     .style("stroke-opacity", d=>probToOpacity(d.edge.extends_prob))
    //     .attr('class', d => `link link_${paperID2topic[d.edge.source]} link_${paperID2topic[d.edge.target]}`)
    //     .on('mouseover', function(d) {
    //         d3.select(this).attr('cursor', 'pointer').style("stroke", 'red');
    //         tip.show(d.edge);
    //     })
    //     .on('mouseout', function(d) {
    //         d3.select(this).attr('cursor', 'default').style("stroke", d=> d.color);
    //         tip.hide(d.edge);
    //     })
    //     .on('click', d => {
    //         highlight_edge(d.edge.name);
    //     });
    results.forEach((data, ix) => { 
        // for each of the arrays in the results 
        // draw a line between the subdivions points for that edge
        // let opacity = edge.prob / edge.count / 2;
        let edge = edge_data[ix];
        g.append("path")
            .attr("d", d3line(data))
            .style("stroke", edge.color)
            .style("fill", 'none')
            .style("stroke-width", d=>probToWidth(edge.edge.extends_prob))
            .style("stroke-opacity", d=>probToOpacity(edge.edge.extends_prob))
            .attr('class', 
            `link link_${paperID2topic[edge.edge.source]} link_${paperID2topic[edge.edge.target]} link_${edge.in}
                link_${edge.edge.source} link_${edge.edge.target}`)
            .on('mouseover', function(d) {
                d3.select(this).attr('cursor', 'pointer').style("stroke", 'red');
                tip.show(edge);
            })
            .on('mouseout', function(d) {
                d3.select(this).attr('cursor', 'default').style("stroke", edge.color);
                tip.hide(edge);
            })
            .on('click', function(d) {
                console.log(edge, node_data[edge.source], node_data[edge.target]);
                highlight_edge(edge.name);
            });
    });
}



function draw_topic_matrix() {
    // 在当前有选择单个topic时，绘制背景，包括：
    // - 在当前g元素按照 arrangement 的顺序绘制其他话题的节点
    // - 连接当前话题与其他话题的边

    // let DISTANCE = 100;
    let DISTANCE = d3.select("#mainsvg").node().getBoundingClientRect().width;
    // 根据arrangement顺序，计算processedNodes中每个节点的坐标：
    // 横坐标是 bbox.x - padding - DISTANCE * arrangement差值（在选择话题左边），bbox.x + bbox.width + padding + DISTANCE * arrangement差值（在选择话题右边）
    // 纵坐标与内部节点的 y 一致
    let selectedIndex = arrangement.indexOf(parseInt(selectedTopic));
    // 遍历processedNodes对象的 k, v
    var pie = d3.pie().value(1);
    let topicString={};

    let hyperbolicTransform = x => tanh(inverse(x  / arrangement.length) * 5) * 2;

    for (let [k, v] of Object.entries(processedNodes)) {
        let [year, topic] = k.split('_');
        let currentIndex = arrangement.indexOf(parseInt(topic));
        // console.log(year, topic, k, v)
        v.y = year < minYear? years.find(d => d.id == minYear).y:  years.find(d => d.id == year).y;
        if (currentIndex < selectedIndex) {
            v.x = bbox.x - bbox_padding_x - DISTANCE * hyperbolicTransform(selectedIndex - currentIndex);
        }
        else if (currentIndex > selectedIndex) {
            v.x = bbox.x + bbox.width + bbox_padding_x + DISTANCE * hyperbolicTransform(currentIndex - selectedIndex);
        }

        if (topicString[topic] == undefined) {
            topicString[topic] = {
                x: v.x,
                minY: v.y,
                maxY: v.y
            };
        } else {
            topicString[topic] = {
                x: v.x,
                id: topic,
                minY: Math.min(topicString[topic].minY, v.y),
                maxY: Math.max(topicString[topic].maxY, v.y),
                name: fields[topic][2]
            };
        }
    }

    console.log('topicString', topicString);
    // 根据topicString，绘制一条线连接话题头尾

    edge_data = [];
    let connectedNodes = [];
    console.log('processedEdges', processedEdges, Object.entries(processedEdges))
    for (let [k, v] of Object.entries(processedEdges)) {
        // console.log('k', k, 'v', v);
        if (k[0] == '-') {
            let target = k.substring(1);
            v.forEach(d => {
                edge_data.push({
                    source: d.source,
                    target: target,
                    topic: paperID2topic[d.source],
                    t1: paperID2topic[d.source],
                    t2: paperID2topic[d.target],
                    edge: d,
                    name: d.source + '->' +  d.target,
                    in: false
                });
                connectedNodes.push(d.target);
            })
        } else {
            // k 去掉最后一个字母
            let source = k.substring(0, k.length - 1);
            v.forEach(d => {
                edge_data.push({
                    source: source,
                    target: d.target,
                    topic: source.split('_')[1],
                    t1: paperID2topic[d.source],
                    t2: paperID2topic[d.target],
                    edge: d,
                    name: d.source + '->' + d.target,
                    in: true
                });
                connectedNodes.push(d.source);
            })
        }
    }

    function hasConnectedNodes(topic) {
        for (let k of connectedNodes) {
            if (paperID2topic[k] == topic) {
                return true;
            }
        }
        return false;
    }

    for (let [k, v] of Object.entries(topicString)) {
        // console.log('k', k, 'v', v, topic2color(k));
        let sat = hasConnectedNodes(k)? 1: 0.1;
        g.append('path')
            .attr('d', `M ${v.x} ${v.minY} L ${v.x} ${v.maxY}`)
            .style("stroke-width", 10)
            .style("stroke", topic2color(k, sat=sat))
            .attr('class', "topic-string topic-string_" + k)
            .on("mouseover", function() {
                d3.select(this).attr('cursor', 'pointer')
                .style("stroke", 'red');
                tip.show(v);
                highlight_field(v.id);
            })
            .on("mouseout", function() {
                d3.select(this).attr('cursor', 'default')
                .style("stroke", topic2color(k, sat=1));
                tip.hide(v);
                reset_field();
            })
        
        // 在string底下添加文字k
        g.append('text')
            .attr('x', v.x)
            .attr('y', v.maxY + 30)
            .attr('text-anchor', 'middle')
            .text(getShortName(k))
            .attr('font-size', 30)
            .style("fill", topic2color(k))
            .attr('class', "topic-string topic-string_" + k)
            .on("mouseover", function() {
                d3.select(this).attr('cursor', 'pointer')
                .style("fill", 'red');
                highlight_field(v.id);
                tip.show(v);
            })
            .on("mouseout", function() {
                d3.select(this).attr('cursor', 'default')
                .style("fill", topic2color(k, sat=1));
                reset_field();
            })
    }
    
    for (let [k, v] of Object.entries(processedNodes)) {
        var arc = d3.arc()
            .innerRadius(0) // for a pie chart, inner radius is 0
            .outerRadius(Math.sqrt(v.length)*20);
        // 根据pieData绘制饼状图
        let pieData = pie(v);
        // console.log('pieData', pieData);
        
        // 在 x,y 处添加文字： year + topic
        // g.append('text')
        //     .attr('x', x)
        //     .attr('y', y)
        //     .attr('text-anchor', 'middle')
        //     .selectAll("tspan")
        //     .data([year, topic])
        //     .enter()
        //     .append("tspan")
        //     .attr("x", x)
        //     .attr("dy", (d, i) => i ? "1.2em" : 0) // 为除第一行外的每行设置偏移
        //     .text(d => d);

        // 确保为每个独立的饼状图创建一个唯一的容器（如 g 元素）。如果不这样做，后续的数据绑定可能会影响到前面已经创建的饼图元素
        g.append("g") // 为每个饼状图创建一个新的 g 元素
            .attr("class", "arc-container") // 给这个 g 元素添加类，便于识别
            .attr('transform', `translate(${v.x}, ${v.y})`) // 设置位置
            .selectAll("path.arc")
            .data(pieData)
            .enter()
            .append('path')
            .attr("class", d => "arc arc_" + d.data.topic)
            .attr("d", arc)
            .style("fill", d => {
                // let sat = d.data.citationCount < 50? 0.4: (d.data.citationCount < 100? 0.7: 1);
                let sat = 0.1;
                if (connectedNodes.includes(d.data.id)) {
                    sat=1
                }
                return topic2color(d.data.topic, sat=sat);
            })
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer')
                .style("stroke", 'black');
                tip.show(d.data);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default')
                .style("stroke", 'none');
                tip.hide(d.data);
            })
            .on("click", function(d) {
                console.log(d.data.id);
                highlight_node(d.data.id);
            });
    }

    
    // 绘制边
    node_data = {}
    for (let [k, v] of Object.entries(processedNodes)) {
        node_data[k] = {
            x: v.x,
            y: v.y
        };
    }
    nodes.forEach(d => {
        node_data[d.id] = {
            x: d.x,
            y: d.y
        }; 
    });

    // 检查是否能找到key
    // edge_data.filter(d=>node_data[d.source]==undefined)
    // edge_data.filter(d=>node_data[d.target]==undefined)
    // 发现d.target = 6，而selectedTopic=6，所以node_data里面没有，edge_data理应没有！

    console.log('fbundling: node_data', node_data, 'edge_data', edge_data);
    var fbundling = d3.ForceEdgeBundling()
				.compatibility_threshold(0.6)
                .iterations(100)
				.nodes(node_data)
				.edges(edge_data);
	var results   = fbundling();
    console.log('fbundling results', results)

    var d3line = d3.line().x(d=>d.x).y(d=>d.y).curve(d3.curveLinear);
                    
    results.forEach((data, ix) => {	
    // for each of the arrays in the results 
    // draw a line between the subdivions points for that edge
        // let opacity = edge.prob / edge.count / 2;
        let edge = edge_data[ix];
        let opacity = 1;
        g.append("path")
            .attr("d", d3line(data))
            .style("stroke",  topic2color(edge.topic, sat=0.7))
            .attr("class", `link link_${edge.t1} link_${edge.t2} link_${edge.in} link_${edge.source} link_${edge.target}`)
            .style("fill", "none")
            .style("stroke-width", probToWidth(edge.edge.extends_prob))
            .style("stroke-opacity", probToOpacity(edge.edge.extends_prob))
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer').style("stroke", 'red');
                tip.show(edge);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default').style("stroke",  topic2color(edge.topic, sat=0.7))
                tip.hide(edge);
            })
            .on("click", function(d) {
                // console.log(edge);
                highlight_edge(edge.name);
            });
    });
}


function draw_paper_field(ele, paper_field, nodes, right=true, shift=0) {
    console.log('draw_paper_field', ele, paper_field, nodes, right, shift);
    // 处理柱状图，在ele上绘制话题为paper_field的柱状图，统计所有nodes
    // ele.selectAll('.year-topic').remove();

    ele.selectAll(`.rect_${right}`).data(years).enter().append('rect')
        .attr('x', d => d.x - 80 + shift)
        .attr('y', d => d.y - 40)
        .attr('width', 150)
        .attr('height', 80)
        .style("fill", '#fff')
        .style("opacity", 0.7)
        .attr('class', `.rect_${right}`);

    ele.selectAll(`.text_${right}`).data(years).enter().append('text')
        .attr('x', d => d.x - 20 + shift)
        .attr('y', d => d.y + 20)
        .text(d => d.label)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 50)
        .attr('class', `.text_${right}`);
    
    // 因为需要统计各个年份的各个field的分布，是一个二维向量，要绘制柱状图只能在每年的时候将field柱状分布图画出来，所以没有放到visual_topic函数里
    for (let i = 0; i < years.length; i++) {
        // var year_field = [];    //该学者每一年的field信息
        //初始化每一年的field信息：将paper_field中的所有field移到当前年份，并置num=0
        // for (let j = 0; j < paper_field.length; j++) {
        //     let dic = {};
        //     dic.id = paper_field[j].id;
        //     dic.name = paper_field[j].name.split(':')[0];
        //     dic.num = 0;
        //     dic.color = paper_field[j].color;
        //     year_field.push(dic);
        // }
        // //如果是该年发表的论文，将它的topic和该年的field匹配，匹配上的field数量++
        // for (let j = 0; j < nodes.length; j++) {
        //     if (nodes[j].year == years[i].id) {
        //         let topic = parseInt(nodes[j].topic);
        //         for (let k = 0; k < year_field.length; k++) {
        //             if (topic == year_field[k].id) {
        //                 year_field[k].num += 1;
        //                 break;
        //             }
        //         }
        //     }
        // }
        // var x = years[i].x;
        // var y = years[i].y;
        // for (let j = 0; j < year_field.length; j++) {
        //     year_field[j].name += ': ' + year_field[j].num;
        //     year_field[j].x = x;
        //     year_field[j].y = y;
        //     if (right) x -= year_field[j].num * 40;
        //     else x += year_field[j].num * 40;
        //     year_field[j].yearTopicId = String(years[i].id) + String(year_field[j].id);
        // }
        // ele.selectAll('circle').data(year_field).enter().append('rect')
        //     .attr('x', d => (right? d.x - d.num * 40 - 80: d.x + 80) + shift)
        //     .attr('y', d => d.y - 20)
        //     .attr('width', d => d.num * 40)
        //     .attr('height', 50)
        //     .style("fill", d => hsvToColor(d.color))
        //     .style("opacity", 0.7)
        //     .attr('class', 'year-topic')
        //     .attr('id', d => d.id)
        //     .attr('yearTopicId', d => d.yearTopicId);

        let nodes_year = nodes.filter(d => d.year == years[i].id);
        // 如果right=true，对nodes_year按照 TTM 中selectedTopic行的大小排序，否则按selectedTopic列的大小排序
        let op = right? d3.descending: d3.ascending;
        nodes_year.sort((a, b) => op(a.topic, b.topic));

        var x = years[i].x + shift + (right? -150: 80);
        var y = years[i].y;
        nodes_year.forEach((d, i) => {
            if (right) {
                d.outx = x;
                d.outy = y;
            } else {
                d.inx = x;
                d.iny = y;
            }
            d.barx = x;
            d.bary = y;
            if (right) x -= 50;
            else x += 50;
        });

        // console.log('nodes_year', nodes_year, years[i])

        ele.selectAll('bar').data(nodes_year).enter().append('rect')
            .attr('x', d => d.barx)
            .attr('y', d => d.bary - 20)
            .attr('width', 50)
            .attr('height', 50)
            .style("fill", d => topic2color(d.topic))
            .style("opacity", 0.7)
            .attr('class', d=> `bar bar_${d.id} bar_${d.topic}`)
            .attr('id', d => d.id)
            .on('mouseover', function(d) {
                tip.show(d);
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', function(d) {
                tip.hide(d);
                d3.select(this).attr('cursor', 'default');
            })
            .on('click', function(d) {
                highlight_node(d.id);
            });
    }
}

function generateD3Path(points, curve = false) {
    // 使用D3的线条生成器，根据curve参数决定是否使用curveBasis
    const lineGenerator = d3.line();
    if (curve) {
        lineGenerator.curve(d3.curveBasis);
    }

    const pathData = lineGenerator(points);
    return pathData;
}

function convertToPointsArray(pathString) {
    // 从路径字符串中提取坐标点
    const points = pathString.split(' ')
        .slice(1) // 去除路径字符串开头的 "e," 或其他字符
        .map(pair => {
            const cleanedPair = pair.trim().replace(/ +/g, ',');
            const coords = cleanedPair.split(',');
            if (coords.length === 2 && !isNaN(parseFloat(coords[0])) && !isNaN(parseFloat(coords[1]))) {
                return [parseFloat(coords[0]), -parseFloat(coords[1])]; // 注意：转换y坐标为负值以适应SVG坐标系统
            }
            return null;
        })
        .filter(p => p !== null); // 过滤掉任何无效坐标点

    return points;
}


function removeNewlinesAndAdjust(input) {
    // 将输入字符串分割成行
    const lines = input.split('\n');
    let result = '';

    for (let i = 0; i < lines.length; i++) {
        let currentLine = lines[i];
        // 检查当前行是否以';', '{', 或 '}'结尾
        if (currentLine.trim().match(/[;{}]\s*$/)) {
            // 如果是，保留换行符
            result += currentLine + '\n';
        } else {
            // 如果当前行的末尾有反斜杠，去除它并去除换行符
            if (currentLine.trim().endsWith('\\')) {
                currentLine = currentLine.substring(0, currentLine.lastIndexOf('\\')).trim();
            }

            // 下一行如果以制表符开头，预处理下一行去掉开头的制表符
            if (i < lines.length - 1 && lines[i + 1].startsWith('\t')) {
                lines[i + 1] = lines[i + 1].replace(/^\t+/, '');
            }

            // 将处理过的当前行添加到结果字符串，不添加换行符
            result += currentLine;

            // 如果下一行存在且不是以; } { 开始，添加空格作为分隔
            if (i < lines.length - 1 && !/^[};{]/.test(lines[i + 1].trim())) {
                result += ' ';
            }
        }
    }
    return result;
}

function createDot() {
    /*
    Generates a DOT graph representation.

    Inputs:
        nodes: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        edges: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the nodes.
        maxYear: The maximum year among the nodes.
    */
    let dot = `digraph G {\n${getEdgeBundlingStr()}\n`; // \nnode [shape=circle]
    let yearDic = {};

    for (let year = minYear; year <= maxYear; year++) {
        dot += `year${year} [label="${year}"]\n`;
        yearDic[year] = [`year${year}`]
    }
    nodes.forEach(node => {
        // const label = node.name.replace(/"/g, '\\"'); // 转义名称中的双引号
        dot += `${node.id} [label="${node.citationCount}"]\n`;
        // 对于每个年份，收集节点ID
        yearDic[node.year].push(node.id);
    });
    // 对每个年份的节点使用rank=same来强制它们在同一层
    for (let year of Object.keys(yearDic)) 
        dot += `{ rank=same ${yearDic[year].join(' ')} }\n`;
    for (let year = minYear; year < maxYear; year++) 
        dot += `year${year}->year${year+1}\n`;

    edges.forEach(edge => {
        dot += `${edge.source}->${edge.target}\n`;
    });

    dot += '}';
    console.log('createDot', dot);
    return dot;
}

function transformNodeName(name) {
    // 根据yearGrid调整节点名称
    let match = /^([lr])(\d+)$/.exec(name);
    if (match) {
        let prefix = match[1];
        let number = parseInt(match[2]);
        if (prefix === 'l') {
            return `l${Math.max((Math.floor(number / yearGrid) * yearGrid), minYear)}`;
        } else if (prefix === 'r') {
            return `r${Math.min(((Math.floor(number / yearGrid) + 1) * yearGrid) - 1, maxYear)}`;
        }
    }
    return name;
}

function transfromEdgeName(name) {
    // 根据yearGrid调整边名称
    let [src, dst] = name.split('->');
    return `${transformNodeName(src)}->${transformNodeName(dst)}`;
}

function getEdgeBundlingStr() {
    return edgeBundling == 6? '': 
    `concentrate=true
concentrate_type=${edgeBundling}`;
}

function processDotContext(dot) {
    /*
    Processes a dot graph to adjust and filter nodes and edges based on context edges and a yearGrid system.

    Inputs:
        dot: A string containing the dot graph.
        contextEdges: Dictionary where keys are 'lxxxx->rxxxx' edge strings and values are attributes like weight.
        yearGrid: Integer value representing the yearGrid size for adjusting years in node labels.
        virtualEdges: virtual edges connecting the components 

    Returns:
        output: A string containing the processed dot graph with nodes and edges adjusted based on the context.
    */
    let l = Infinity;
    let r = -Infinity;
    let labels = '';
    let focusEdgesStr = '';
    ranks = '';

    // 解析 .dot 输入以分类行并更新年份
    dot.split('\n').forEach(line => {
        if (line.includes('year')) {
            if (line.includes('rank')) {
                ranks += line + '\n';
            }
        } else if (line.includes('label')) {
            labels += '\t' + line + '\n';
        } else if (line.includes('->')) {
            focusEdgesStr += '\t' + line + '\n';
        }
    });

    // 从上下文边提取最小和最大年份
    Object.keys(contextEdges).forEach(edge => {
        let match = /l(\d+)->(\d+)/.exec(edge);
        if (match) {
            let value = parseInt(match[1], 10);
            l = Math.min(l, value);
        }
        match = /(\d+)->r(\d+)/.exec(edge)
        if (match) {
            let value = parseInt(match[2], 10);
            r = Math.max(r, value);
        }
    });

    // 过滤排名并更新有效年份范围
    ranks.split('\n').forEach(line => {
        // 仅寻找有其他id的行
        let match = /year(\d+) (\d+)/.exec(line);
        if (match) {
            let year = parseInt(match[1], 10);
            if (year < 2100){
                l = Math.min(l, year);
                r = Math.max(r, year);
            } else {
                console.log('year out of range', year);
            }
            
        }
    });
    // 更新全局变量，以便在transfromEdgeName函数中使用
    minYear = l;
    maxYear = r;

    console.log('minYear', l, 'maxYear', r);

    // 替换年份标签
    let newRanks = [];
    ranks.split('\n').forEach(line => {
        let match = /year(\d+)/.exec(line);
        if (match && parseInt(match[1], 10) >=l && parseInt(match[1], 10) <= r) {
            newRanks.push(line.replace(/year(\d+)/, (match, p1) => `l${p1} r${p1}`));
        }
    });
    ranks = newRanks.join('\n');

    // 生成左右节点的链
    let leftNodes = Array.from({ length: r - l + 1 }, (_, i) => `l${l + i}`).join('->');
    let rightNodes = Array.from({ length: r - l + 1 }, (_, i) => `r${l + i}`).join('->');

    // 处理并合并contextEdges，可能把多年合并到一年
    combinedContextEdges = {};
    Object.entries(contextEdges).forEach(([edge, edgeList]) => {
        let weight = edgeList.length;
        let newEdge = transfromEdgeName(edge);
        combinedContextEdges[newEdge] = combinedContextEdges[newEdge] || 
            { topics:{}, name: newEdge, edges: [], weight: 0, penwidth: 0, port: newEdge[0] === 'l' ? 'tailport=e' : 'headport=w' };
        combinedContextEdges[newEdge].weight += weight;
        combinedContextEdges[newEdge].penwidth += weight;  // 假设 penwidth 是累积的
        for (let edge of edgeList) {
            combinedContextEdges[newEdge].edges.push(edge);
            let topic = newEdge[0] == 'l'? paperID2topic[edge.source]: paperID2topic[edge.target];
            combinedContextEdges[newEdge].topics[topic] = (combinedContextEdges[newEdge].topics[topic] || 0) + 1;
        }
    });

    // 生成上下文边字符串
    let contextEdgesStr = Object.entries(combinedContextEdges).map(([edge, data]) =>
        `${edge} [color="lightgray", ${data.port}, weight=${data.weight}, penwidth=${data.penwidth}]`
    ).join('\n');
    let virtualEdgesStr = virtualEdges ? virtualEdges.map(edge => `${edge} [style="invis"]`).join('\n') : '';
    
    // 生成最终输出 DOT 字符串 node [shape=circle]
    return `
digraph G {

crossing_type=1
${getEdgeBundlingStr()}

subgraph left {
    style=filled
    color=lightgrey
    node [style=filled,color=lightblue]
${leftNodes} [weight=10000]
    label = "left"
}

subgraph focus{
    edge [weight=${alpha}]
${labels}
${focusEdgesStr}
}

subgraph right {
    style=filled
    color=lightgrey
    node [style=filled,color=lightgrey]
${rightNodes} [weight=10000]
    label = "right"
}

${ranks}
${contextEdgesStr}
l${l}->r${l} [style="invis"]
${virtualEdgesStr}
}`;
}

function bindSVGToElement(svgElement, elementId) {
    // 从参数获取容器，并清空容器内的所有元素
    let ele = d3.select(elementId).node();
    d3.select(elementId).selectAll("*").remove();

    // 获取容器尺寸
    let svgWidth = ele.getBoundingClientRect().width;
    let svgHeight = ele.getBoundingClientRect().height;

    // 获取并修正 SVG 的 viewBox 和 transform 属性
    let viewBox = svgElement.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;
    let transform = svgElement.getAttribute('transform') || "translate(0,0) scale(1)";

    // 创建新的 SVG 元素，并设置属性
    let svg = d3.select(elementId).append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    // 在新 SVG 中添加一个 <g> 元素，并追加旧 SVG 的所有子节点
    let g = svg.append("g").attr("transform", transform);
    Array.from(svgElement.childNodes).forEach(node => {
        g.node().appendChild(node.cloneNode(true));
    });

    // 添加缩放和拖拽功能
    const zoom = d3.zoom()
        .scaleExtent([0.01, 100]) // 可自行调整缩放比例范围
        .on("zoom", () => {
            let currentTransform = d3.event.transform;
            g.attr("transform", currentTransform);
        });

    svg.call(zoom);
}


function parseSVG(svgElement) {
    id2attr = {};
    // 解析节点
    svgElement.querySelectorAll('g.node').forEach(node => {
        const title = node.querySelector('title').textContent;
        const shape = node.querySelector('ellipse, polygon'); // 支持椭圆或多边形
        const text = node.querySelector('text');
        
        id2attr[title] = {
            id: title,
            fill: shape.getAttribute('fill'),
            stroke: shape.getAttribute('stroke'),
            x: parseFloat(shape.getAttribute('cx')) || 0,
            y: parseFloat(shape.getAttribute('cy')) || 0,
            rx: parseFloat(shape.getAttribute('rx')) || parseFloat(shape.getAttribute('width')) / 2,
            ry: parseFloat(shape.getAttribute('ry')) || parseFloat(shape.getAttribute('height')) / 2,
            label: text ? text.textContent : ''
        };
    });

    // 解析边
    svgElement.querySelectorAll('g.edge').forEach(edge => {
        // dismiss port
        const title = edge.querySelector('title').textContent.replace(/:w|:e/g, '');;
        const paths = edge.querySelectorAll('path');
        const polygon = edge.querySelector('polygon');

        let edgePaths = Array.from(paths).map(path => ({
            fill: path.getAttribute('fill'),
            stroke: path.getAttribute('stroke'),
            d: path.getAttribute('d'),
            s: getEndPoint(path.getAttribute('d'), 's'),
            t: getEndPoint(path.getAttribute('d'), 't')
        })).sort((a, b) => {
            const distanceA = Math.sqrt(Math.pow(a.t.x - b.s.x, 2) + Math.pow(a.t.y - b.s.y, 2));
            const distanceB = Math.sqrt(Math.pow(b.t.x - a.s.x, 2) + Math.pow(b.t.y - a.s.y, 2));
            return distanceA - distanceB; // 排序，使得路径首位相连
        });

        id2attr[title] = {
            id: title,
            name: title,
            path: edgePaths,
            polygon: polygon ? {
                fill: polygon.getAttribute('fill'),
                stroke: polygon.getAttribute('stroke'),
                points: polygon.getAttribute('points')
            } : null
        };
    });

    return id2attr;
}

// 获取路径的起点或终点
function getEndPoint(d, type) {
    let points = d.match(/([0-9.-]+),([0-9.-]+)/g);
    if (!points) return { x: 0, y: 0 };
    points = points.map(pt => {
        const coords = pt.split(',');
        return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });
    return type === 's' ? points[0] : points[points.length - 1];
}



function renderDot() {
    if (visType == 7) {
        renderSide();
        return;
    }

    let dot = createDot();
    let result;
    let svgElement;

    if (visType == 8 && selectedTopic !== null) {
        // subgraph + context
        dot = processDotContext(dot);
        console.log('context dot', dot);

        svgElement = vizContext.renderSVGElement(dot);
        // result = removeNewlinesAndAdjust(vizContext.renderString(dot)).replaceAll(' -> ', '->');
    } else {
        svgElement = viz.renderSVGElement(dot);
        // result = removeNewlinesAndAdjust(viz.renderString(dot)).replaceAll(' -> ', '->');
    }
    
    bindSVGToElement(svgElement, "#originsvg");
    parseSVG(svgElement);
    viewBox = svgElement.getAttribute('viewBox');
    transform = svgElement.getAttribute('transform');

    // 遍历 id2attr，生成最终的节点和边
    let years = [];
    for (let id in id2attr) {
        if (id.startsWith('year') && !id.includes('->')) {
            years.push({ id: id2attr[id].label, ...id2attr[id] });
        }
    }

    nodes.forEach(node => {
        Object.assign(node, id2attr[node.id]);
    });
    edges.forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        Object.assign(edge, id2attr[edgeKey]);  // 合并边的属性
    });

    params = [viewBox, transform]
    polygon = null;
    graph = [params, years, nodes, edges, polygon];
    
    // if (selectedTopic === null) {
    //     global_graph = JSON.parse(JSON.stringify(graph));
    //     [global_params, global_years, global_nodes, global_edges, global_polygon] = global_graph;
    // }
    init_graph(graph);
}

function loadGlobalData() {
    let filteredNodes = authorData['nodes'].filter(d => d.isKeyPaper >= nodeSlider.noUiSlider.get() && d.year > 1900);
    let filteredEdges = authorData['edges'].filter(d => d.extends_prob >= edgeSlider.noUiSlider.get());
    filteredNodes = JSON.parse(JSON.stringify(filteredNodes));
    filteredEdges = JSON.parse(JSON.stringify(filteredEdges));

    let topics = new Set(filteredNodes.map(d => d.topic));
    if (topics.length == 0) {
        console.log('No topics found in the data');
        return;
    }
    if (filteredNodes.length == 0) {
        console.log('No nodes found in the data');
        return;
    }
    
    // 注意year的计算在selectedTopic之前
    minYear = Math.min(...filteredNodes.map(node => node.year));
    maxYear = Math.max(...filteredNodes.map(node => node.year));
    // console.log('minYear', minYear, 'maxYear', maxYear);

    let ln = filteredNodes.length, le = filteredEdges.length;
    let modeValue = document.getElementById('mode').value;
    let surveyValue = document.getElementById('remove-survey').value;
    
    if (surveyValue == '1') filteredNodes = filteredNodes.filter(node => !node.survey);
    let lnr = filteredNodes.length;
    // Compute indegree, outdegree, and total degree
    let indegree = {}, outdegree = {}, alldegree = {};
    // set other nodes in filteredNodes outdegree/indegree =0
    filteredNodes.forEach(node => {
        outdegree[node.id] = 0;
        indegree[node.id] = 0;
        alldegree[node.id] = 0;
    })
    let nodeSet = new Set(filteredNodes.map(node => node.id));
    
    let connectedEdges = [];
    filteredEdges.forEach(edge => {
        src = String(edge.source);
        tgt = String(edge.target);
        if (nodeSet.has(src) && nodeSet.has(tgt)) {
            outdegree[src] += 1;
            indegree[tgt] += 1;
            alldegree[src] += 1;
            alldegree[tgt] += 1;
            connectedEdges.push(edge);
        }
    });

    if (modeValue == '1') {
        // remove isolated
        filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0);
    } else if (modeValue == '2') {
        // partially remove, high citationCount papers are not removed
        filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0 || node.citationCount >= 50);
    }
    filteredEdges = connectedEdges;

    console.log('original data:', authorData, 
        '#nodes:', authorData['nodes'].length, ln, lnr, filteredNodes.length, 
        '#edges:', authorData['edges'].length, le, filteredEdges.length);
    console.log(filteredNodes, filteredEdges);

    $('#node-num').text(`${filteredNodes.length}(rm isolated) / ${lnr}(rm survey) / ${ln}(filter) / ${authorData['nodes'].length}(all)`);
    $('#edge-num').text(`${filteredEdges.length}(rm unconnected) / ${le}(filter) / ${authorData['edges'].length}(all)`);
    
    global_nodes = filteredNodes;
    global_edges = filteredEdges.map(edge => {
        return {
            name: `${edge.source}->${edge.target}`,
            ...edge
        };
    });

    global_nodes = global_nodes.map(d=>{
        if (d.topicDist === undefined || Object.keys(d.topicDist)==0) {
            d.topic = fields.length - 1;
        }
        paperID2topic[d.id] = d.topic;
        paperID2year[d.id] = d.year;
        return d;
    });

    global_paper_field = [];    //该学者个人的field信息
    global_nodes.forEach(node => {
        let topic = parseInt(node.topic);
        let ix = global_paper_field.findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            global_paper_field.push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                color: topic2color(topic),
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            global_paper_field[ix].num += 1;
        }
    })
    global_paper_field.sort(op('num'));
    console.log('global_paper_field', JSON.parse(JSON.stringify(global_paper_field)))
    let total = global_paper_field.reduce((acc, cur) => acc + cur.num, 0);
    let sum = 0;
    let min_num = 0;
    let cnt = 0;
    for (const d of global_paper_field) {
        sum += d.num;
        cnt += 1;
        if (sum >= 0.95 * total || cnt >= 25) {
            min_num = d.num;
            break;
        }
    }
    // 注意逻辑：item.num >= min_num && item.id !== fields.length-1 会过滤others
    global_paper_field = global_paper_field.filter(item => item.num >= min_num || item.id == fields.length-1);
    let global_topics = global_paper_field.map(d => d.id);
    global_nodes.forEach(d => {
        if(!global_topics.includes(parseInt(d.topic))) {
            d.topic = fields.length - 1;
        }
    });
    let other = global_paper_field.find(d => d.id == fields.length-1);
    if (other !== undefined) {
        other.num = global_nodes.filter(d=> d.topic==fields.length-1).length;
    }
    let max_num = Math.max(...global_paper_field.map(d=>d.num));
    rangeSlider.noUiSlider.updateOptions({
        range: {
            'min': min_num,
            'max': max_num+1 // 'range' 'min' and 'max' cannot be equal.
        }
    });
    // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
    rangeSlider.noUiSlider.set([min_num, max_num+1]);

    // global_nodes.map(d=>Object.keys(d.topicDist).length)
    // new Set(global_nodes.map(d=>d.topic)) // 有多少个topic
    // 1. 将所有topicDist = {}的节点设置为最后一个topic
    // 2. 将所有topic总数小的节点设置为最后一个topic
    nodes = JSON.parse(JSON.stringify(global_nodes));
    edges = JSON.parse(JSON.stringify(global_edges));

    if (selectedTopic !== null) {
        nodes = nodes.filter(d => hasTopic(d, selectedTopic));
        if (nodes.length == 0) {
            console.log('No nodes found in the selected topic', selectedTopic);
            return;
        }

        nodeSet = new Set(nodes.map(node => node.id));
        edges = edges.filter(edge => nodeSet.has(edge.source) && nodeSet.has(edge.target));
        edgeStrs = edges.map(edge => edge.source + '->' + edge.target); 

        let G = new Graph();
        nodes.forEach(node => {
            G.addNode(node.id, node);
        });
        edges.forEach(edge => {
            G.addEdge(edge.source, edge.target);
        });
        for (let year = minYear; year <= maxYear; year++) {
            G.addNode(`l${year}`, {year: year});
            G.addNode(`r${year}`, {year: year});
        }
        for (let year = minYear; year < maxYear; year++) {
            G.addEdge(`l${year}`, `l${year+1}`);
            G.addEdge(`r${year}`, `r${year+1}`);
        }

        // 处理上下文边
        contextEdges = {};
        global_edges.forEach(edge => {
            if (!edgeStrs.includes(`${edge.source}->${edge.target}`)) {
                let sourceNode = global_nodes.find(node => node.id === edge.source);
                let targetNode = global_nodes.find(node => node.id === edge.target);

                if (hasTopic(sourceNode, selectedTopic)) {
                    let key = `${sourceNode.id}->r${targetNode.year}`;
                    if (!contextEdges[key]) contextEdges[key] = [];
                    contextEdges[key].push(edge);
                    G.addEdge(sourceNode.id, `r${targetNode.year}`);
                }
                if (hasTopic(targetNode, selectedTopic)) {
                    let key = `l${sourceNode.year}->${targetNode.id}`;
                    if (!contextEdges[key]) contextEdges[key] = [];
                    contextEdges[key].push(edge);
                    G.addEdge(`l${sourceNode.year}`, targetNode.id);
                }
            }
        });

        virtualEdges = [];
        let components = G.findConnectedComponents();
        components.forEach(component => {
            let node = G.findLastNodeInComponent(component);
            if (node) {
                // console.log('findLastNodeInComponent', G.nodeProperties.get(node));
                let nodeYear = G.nodeProperties.get(node).year;
                virtualEdges.push(`${node}->r${nodeYear}`);
            }
        });
    }
    
    paper_field = [];    //该学者个人的field信息
    nodes.forEach(node => {
        let topic = parseInt(node.topic);
        let ix = paper_field.findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            paper_field.push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                color: topic2color(topic),
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            paper_field[ix].num += 1;
        }
    })

    console.log('global_paper_field', JSON.parse(JSON.stringify(global_paper_field)), 
                'paper_field', JSON.parse(JSON.stringify(paper_field)));


    processedNodes = {};
    processedEdges = {};
    // Process nodes data
    global_nodes.forEach(node => {
        // getTopicList(node).forEach(topic => {
            let topic = node.topic;
            let year = Math.floor(node.year / yearGrid) * yearGrid;
            let key = `${year}_${topic}`;

            if (topic != selectedTopic) {
                if (!processedNodes[key])  processedNodes[key] = []
                processedNodes[key].push(node);
            }
        // });
    });

    // Process edges data
    global_edges.forEach(edge => {
        // Assuming source and target in edges are node IDs
        let sourceNode = global_nodes.find(node => node.id === edge.source);
        let targetNode = global_nodes.find(node => node.id === edge.target);

        let srcTopic = sourceNode.topic;
        let tgtTopic = targetNode.topic;
        let srcYear = Math.floor(sourceNode.year / yearGrid) * yearGrid;
        let tgtYear = Math.floor(targetNode.year / yearGrid) * yearGrid;
        
        if (selectedTopic !== null) {
            if (srcTopic !== selectedTopic && tgtTopic !== selectedTopic) return;   // 外部边
            if (srcTopic == selectedTopic && tgtTopic == selectedTopic) return;     // 内部边

            let key = srcTopic == selectedTopic? `-${tgtYear}_${tgtTopic}`: `${srcYear}_${srcTopic}-`;
            
            if (!processedEdges[key]) processedEdges[key] = []
            processedEdges[key].push(edge);
            
        } else {
            
            let key = `${srcYear}_${srcTopic}-${tgtYear}_${tgtTopic}`;
            if (!processedEdges[key]) {
                processedEdges[key] = []
            }
            processedEdges[key].push(edge);
        }
    });
    console.log('processedNodes', processedNodes, 'processedEdges', processedEdges, 'selectedTopic', selectedTopic);


    generateTTM();
    arrangement = simulatedAnnealing(TTM);
    adjacentMatrix = getAdjacentMatrix(arrangement);
    console.log('arrangement:', arrangement);
}


function findLastNodeInComponent(component) {
    let maxYear = -Infinity;
    let lastNode = null;

    // 遍历连通分量中的每个节点
    component.forEach(node => {
        // 检查年份，找到最大的年份
        if (node.data('year') > maxYear) {
            maxYear = node.data('year');
            lastNode = node;
        }
    });

    // 确认找到的最后一个节点是否以 'l' 或 'r' 开头
    if (lastNode && !['l', 'r'].includes(lastNode.id()[0])) {
        return lastNode;
    }

    return null;  // 如果节点以 'l' 或 'r' 开头或未找到合适的节点，返回 null
}

function topic2color(topic, sat=undefined) {
    if (topic == undefined) {
        return hsvToColor([0, 0, 0]);
    }
    // console.log('getTopicColor', topic, fields[topic])
    topic = parseInt(topic);
    let c = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])]
    return sat == undefined? hsvToColor(c): hsvToColor(c, sat);
}

function loadAndRender() {
    loadGlobalData();
    renderDot();
}


function getTopicList(node) {
    if (node.hasOwnProperty('topicDist')) {
        let topicList = [];
        for (let key in node.topicDist) {
            if (node.topicDist[key] >= topicSlider.noUiSlider.get())  topicList.push(key);
        }
        if (!topicList.includes(node.topic))  topicList.push(node.topic);
        return topicList;
    }
    return [node.topic];
}

function hasTopic(node, topic) {
    // if (node.hasOwnProperty('topicDist'))
    //     return Object.keys(node['topicDist']).includes(topic);
    // return node['topic'] == topic;
    // console.log('hasTopic: node', node, 'topic', topic)
    if (node == undefined) {
        console.log('hasTopic: node', node, 'topic', topic)
    }

    let threshold = topicSlider.noUiSlider.get();
    if (parseInt(node.topic) == topic) return true;
    if (node.hasOwnProperty('topicDist') && node.topicDist[topic] >= threshold) return true;
    return false;
}


function highlight_tag(topic_id) {
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .style("stroke", "none");
    d3.select(`#rect_${topic_id}`)
        .attr("fill-opacity", 1)
        .style("stroke", "black");
    d3.select(`#text_${topic_id}`)
        .attr('font-weight', 'bold');
    if (selectedTopic !== null && selectedTopic != topic_id) {
        d3.select(`#rect_${selectedTopic}`)
            .attr("fill-opacity", 1)
            .style("stroke", "black");
        d3.select(`#text_${selectedTopic}`)
            .attr('font-weight', 'bold');
    }
}

function reset_tag() {
    // reset rect color
    // highlight_topic_forceChart(-1);
    // 将所有tag都置为初始状态
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .style("stroke", "none");
    d3.selectAll(".tag-text")
        .attr('font-weight', 'normal');
    if (selectedTopic !== null) {
        d3.select(`#rect_${selectedTopic}`)
            .attr("fill-opacity", 1)
            .style("stroke", "black");
        d3.select(`#text_${selectedTopic}`)
            .attr('font-weight', 'bold');
    }
}


function highlight_field(topic_id) {
    if (visType == 7) return;
    if (image_status == 1)  return;
    let duration = 200;
    // tip.show(d);
    // d3.select(that).attr('cursor', 'pointer');
    // highlight_topic_forceChart(topic_id);
    
    // =========================context-polygen=========================
    d3.selectAll(".context-polygon_" + topic_id)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));
    d3.selectAll(".context-ellipse_" + topic_id)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));

    // =========================tagcloud=========================
    highlight_tag(topic_id);

    // =========================arc & link=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", virtualOpacity)
        .style("stroke", "none");
    d3.selectAll(`.arc_${topic_id}`)
        .attr("fill-opacity", 1)

    d3.selectAll(".link")
        .style("opacity", 0); // virtualOpacity
    d3.selectAll(`.link_${topic_id}`)
        .style("opacity", 1);

    // =========================cell=========================
    d3.selectAll(".cell")
        .style("fill", `rgb(0, 0, 255)`)
    d3.selectAll(`.cell_${topic_id}`)
        .style("fill", `rgb(255, 0, 0)`);

    d3.selectAll(".topic-string")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.topic-string_${topic_id}`)
        .style("opacity", 1);


    // =========================topic map=========================
    // 有了duration之后，如果鼠标滑动较快，则没法恢复
    d3.selectAll(".topic-map")
        .attr("fill-opacity", 0.2)
        .style("stroke", "none");
    d3.select("#circle" + topic_id)
        // .transition()
        // .duration(duration)
        .attr("fill-opacity", 1)
        .style("stroke", "black");

    // =========================bar & bar_link=========================
    // d3.selectAll(".year-topic")
    //     .attr("fill-opacity", d => {if (topic_id != d.id) return virtualOpacity;});
    d3.selectAll(".bar")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.bar_${topic_id}`)
        .style("opacity", 0.7);
    

    var color_papers = [], color_papers_topic = [];  
    // 记录颜色不需要变化的paperID
    
    for (let i = 0; i < nodes.length; i++) {
        if (hasTopic(nodes[i], topic_id)) {
            color_papers.push(nodes[i].id);
            color_papers_topic.push(nodes[i].topic);
        }
    }
    // console.log('color_papers', color_papers, color_papers_topic);


    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', d => {if (color_papers.indexOf(d.id) == -1) return virtualOpacity;})
        .attr('stroke-opacity', function(d) {
            if (color_papers.indexOf(d.id) == -1) return virtualOpacity;
        })

    g.selectAll('.reference').data(edges)
        .style("stroke", d => 
            color_papers.indexOf(d.source) != -1 && color_papers.indexOf(d.target) != -1? "red": "#202020")
        .style("opacity", d=> 
            color_papers.indexOf(d.source) != -1 && color_papers.indexOf(d.target) != -1? 1: virtualOpacity);

    // $("#mainsvg").attr("style", "background-color: #FAFAFA;");
    Object.entries(combinedContextEdges).forEach(([key, value]) => {
        if (Object.keys(value.topics).includes(topic_id)) {
            mouseoverEdge(key, width=value.topics[topic_id] * context_edge_weight, color=topic2color(topic_id));
        }
    })
}

function hsvToColor(color, sat=0.4) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], sat, color[2]) //  color[1]
}

function generateTTM() {
    TTM = {};
    TTMEdges = {};
    // 填充矩阵（因为是外部转移矩阵，不计相同话题的转移）
    // 注意，存在部分话题只有转入，没有转出，所以不再keys里面
    // 注意TTM相同的node只取一个，不是m*n，而是m+n

    function addEdge(src, tgt) {
        if (src == tgt) return;
        if(!TTM[src]) TTM[src] = {};
        if(!TTM[src][tgt]) TTM[src][tgt] = 0;
        TTM[src][tgt]++;
    }

    global_edges.forEach(edge => {
        let sourceNode = global_nodes.find(node => node.id === edge.source);
        let targetNode = global_nodes.find(node => node.id === edge.target);
        let sourceTopicList = getTopicList(sourceNode);
        let targetTopicList = getTopicList(targetNode);
        // 去除相同元素，不能相继filter
        let sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        // sourceTopicList.forEach(src => {
        //     targetTopicList.forEach(tgt => {
        //         if (!TTM[src]) TTM[src] = {};
        //         if (!TTM[src][tgt]) TTM[src][tgt] = 0;
        //         TTM[src][tgt]++;

        //         if (!TTMEdges[src]) TTMEdges[src] = {};
        //         if (!TTMEdges[src][tgt]) TTMEdges[src][tgt] = [];
        //         TTMEdges[src][tgt].push(edge);
        //     })
        // })
        sourceTopicList.forEach(src => {
            addEdge(src, targetNode.topic);
        })
        targetTopicList.forEach(tgt => {
            addEdge(sourceNode.topic, tgt);
        })
    });
}

function getAllTopics(matrix) {
    let topics = new Set();
    for (let src in matrix) {
        for (let tgt in matrix[src]) {
            topics.add(src);
            topics.add(tgt);
        }
    }
    let arr = Array.from(topics);
    arr.sort((a, b) => a - b);
    return arr;
}
    

function simulatedAnnealing(matrix) {
    let temperature = 100.0; // 初始温度
    const coolingRate = 0.995; // 冷却率
    const minTemperature = 1.0; // 最小温度
    // let currentSolution = getAllTopics(matrix); // 初始解决方案
    let currentSolution = global_paper_field.map(d => d.id);
    console.log('currentSolution', currentSolution);
    let bestSolution = [...currentSolution];
    bestCost = calculateCost(matrix, bestSolution);
    originalCost = bestCost;
    // console.log('initial cost', bestCost)

    while (temperature > minTemperature) {
        let newSolution = [...currentSolution];
        // 产生新的解决方案：随机交换两个话题
        const [idx1, idx2] = [Math.floor(Math.random() * newSolution.length), Math.floor(Math.random() * newSolution.length)];
        [newSolution[idx1], newSolution[idx2]] = [newSolution[idx2], newSolution[idx1]];

        // 计算新解决方案的成本
        const currentCost = calculateCost(matrix, currentSolution);
        const newCost = calculateCost(matrix, newSolution);

        // 计算接受概率
        if (acceptanceProbability(currentCost, newCost, temperature) > Math.random()) {
            currentSolution = [...newSolution];
        }

        // 更新最佳解决方案
        if (newCost < bestCost) {
            bestSolution = [...currentSolution];
            bestCost = newCost;
            // console.log('new best cost', bestCost)
        }

        // 冷却过程
        temperature *= coolingRate;
    }

    return bestSolution;
}

// 计算解决方案的成本
function calculateCost(matrix, solution) {
    let cost = 0;
    solution.forEach((topic, i) => {
        solution.forEach((innerTopic, j) => {
            const distance = Math.abs(i - j);
            if (matrix[topic] && matrix[topic][innerTopic])
                cost += matrix[topic][innerTopic] * distance; // 假设成本与距离成正比
        });
    });
    return cost;
}

// 接受概率
function acceptanceProbability(currentCost, newCost, temperature) {
    if (newCost < currentCost) {
        return 1.0;
    }
    return Math.exp((currentCost - newCost) / temperature);
}

function reset_field(d) {
    if (visType == 7) return;
    if (image_status == 1)  return;
    reset_tag();

    d3.selectAll(".context-polygon")
        .style("fill-opacity", topicOpacity);
    d3.selectAll(".context-ellipse")
        .style("fill-opacity", topicOpacity);

    // =========================arc=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", 1)
        .style("stroke", "none");
    d3.selectAll(`.topic-string`)
        .style("opacity", 1);
    
    // =========================topic map=========================
    tip.hide(d);

    d3.selectAll(".topic-map")
        // .transition()
        // .duration(200)
        .attr("fill-opacity", 0.6)
        .style("stroke", `rgba(0,0,0,0.5)`);

    d3.selectAll(".cell")
        .style("fill", `rgb(0, 0, 255)`)

    // 恢复左侧年份主题柱状图
    gr.selectAll('.rect1, .year-topic')
        .attr('fill-opacity', 1);
    gl.selectAll('.rect1, .year-topic')
        .attr('fill-opacity', 1);
    //恢复节点填充色和边缘色
    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', 1)
        .style("stroke", d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .attr('stroke-opacity', 1);
    //恢复边的颜色
    g.selectAll(".reference")
        .style("stroke", "#202020")
        .style("opacity", d => probToOpacity(d.extends_prob))
        .style("stroke-width", d => probToWidth(d.extends_prob));

    // $("#mainsvg").attr("style", "background-color: white;");
    // gr.selectAll('.year-topic').attr('fill-opacity', 1);
    d3.selectAll(".bar").style("opacity", 0.7);
    // d3.selectAll(".bar_link").style("opacity", 1);

    g.selectAll('.edge-path')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', 1);
    g.selectAll('.edge-path-polygon')
        .style("fill", d=>d.color)
        .style('opacity', 1);
}

function find_child_nodes(id) { 
    var ids = [];
    for (let i = 0; i < edges.length; i++) {
        if (id == edges[i].source) {
            ids.push(edges[i].target);
        }
    }
    return ids;

}

function find_parent_nodes(id) {
    var ids = [];
    for (let i = 0; i < edges.length; i++) {
        if (id == edges[i].target) {
            ids.push(edges[i].source);
        }
    }
    return ids;
}

function buildTree(centerNodeId, nodes, edges) {
    const idToNodeMap = new Map(nodes.map(node => [node.id, { ...node, children: [] }]));
    edges.forEach(edge => {
        if (idToNodeMap.has(edge.source) && idToNodeMap.has(edge.target)) {
            idToNodeMap.get(edge.source).children.push(idToNodeMap.get(edge.target));
        }
    });
    return idToNodeMap.get(centerNodeId);
}

function getAdjacentNodes(nodeId) {
    let children = edges.filter(edge => edge.source === nodeId).map(edge => edge.target);
    let parents = edges.filter(edge => edge.target === nodeId).map(edge => edge.source);
    return Array.from(new Set(children.concat(parents)));
}

function simplifyNode(node) {
    return {
        name: node.name,
        numLeafs: 0, // 初始设置为 0，稍后计算
        ottId: node.paperID,
        children: [],
        parents: []
    };
}

function buildTreeBFS(id) {
    var parent_ids = [];
    var new_parent_ids = [id];
    let idToNodeMap = new Map(nodes.map(node => [node.id, simplifyNode(node)]));
    console.log('idToNodeMap', idToNodeMap)

    while (new_parent_ids.length != parent_ids.length) {
        parent_ids = new_parent_ids;
        for (let i = 0; i < parent_ids.length; i++) {
            // console.log('node:', parent_ids[i], idToNodeMap[String(parent_ids[i])])
            let parents = find_parent_nodes(parent_ids[i]);
            new_parent_ids = new_parent_ids.concat(parents);
            idToNodeMap.get(parent_ids[i]).parents = parents.map(id => idToNodeMap.get(id))
        }
        new_parent_ids = Array.from(new Set(new_parent_ids));
    }

    var child_ids = [];
    var new_child_ids = [id];
    while (new_child_ids.length != child_ids.length) {
        child_ids = new_child_ids;
        for (let i = 0; i < child_ids.length; i++) {
            let childs = find_child_nodes(child_ids[i])
            new_child_ids = new_child_ids.concat(childs);
            idToNodeMap.get(child_ids[i]).children = childs.map(id => idToNodeMap.get(id))
        }
        new_child_ids = Array.from(new Set(new_child_ids));
    }

    // DAG图中出现了环！！！！！！！！！！！！！！！！！需要修复
    // 删除没有子节点的节点的 children 属性
    function removeEmptyChildren(node) {
        if (node.children === undefined) return;
        // console.log('node', node)
        delete node.parents;
        if (node.children.length === 0) {
            delete node.children;
        } else {
            // node.children = node.children.concat(node.parents)
            node.children.forEach(child => removeEmptyChildren(child));
            node.numLeafs = node.children.reduce((sum, child) => sum + child.numLeafs, 0);
            node.numLeafs += node.children.length;
        }
    }
    removeEmptyChildren(idToNodeMap.get(id));
    return idToNodeMap.get(id);
}

function draw_hyper_tree(id) {
    return;
    const hypertreeData = buildTreeBFS(id);
    console.log('hypertreeData', hypertreeData);
    const root = d3.hierarchy(hypertreeData);

    const iframeWindow = document.getElementById('hypertreeFrame').contentWindow;

    // 使用 postMessage 发送 hypertreeData
    iframeWindow.postMessage({ hypertreeData: hypertreeData }, '*');

    // const ht = new hyt.Hypertree(
    //     {
    //         parent: d3.select("#radialgraph").node()    
    //         //d3.select("#radialgraph").node() // 获取 DOM 元素
    //     },
    //     {
    //         dataloader:  hyt.loaders.fromFile('/src/json/test.d3.json'),
    //         // ok => ok(root),
    //         langInitBFS: (ht, n)=> n.precalc.label = n.data.name,
    //     }
    // )
    // ht.initPromise
    //     .then(()=> new Promise((ok, err)=> ht.animateUp(ok, err)))            
    //     .then(()=> ht.drawDetailFrame());
}

function get_extend_ids(id) {
    var parent_ids = [];
    var new_parent_ids = [id];
    while (new_parent_ids.length != parent_ids.length) {
        parent_ids = new_parent_ids;
        for (let i = 0; i < parent_ids.length; i++) {
            new_parent_ids = new_parent_ids.concat(find_parent_nodes(parent_ids[i]));
        }
        new_parent_ids = Array.from(new Set(new_parent_ids));
    }
    var child_ids = [];
    var new_child_ids = [id];
    while (new_child_ids.length != child_ids.length) {
        child_ids = new_child_ids;
        for (let i = 0; i < child_ids.length; i++) {
            new_child_ids = new_child_ids.concat(find_child_nodes(child_ids[i]));
        }
        new_child_ids = Array.from(new Set(new_child_ids));
    }
    var extend_ids = new_child_ids.concat(new_parent_ids);
    // console.log('extend_ids:', extend_ids)
    return extend_ids;
}

function getAdjacentMatrix(arrangement=null) {
    if (arrangement === null) {
        arrangement = global_paper_field.map(d => d.id);
    }
    let matrix = [];
    arrangement.forEach((src, i) => {
        matrix.push([]);
        arrangement.forEach((tgt, j) => {
            matrix[i].push(TTM[src] && TTM[src][tgt] ? TTM[src][tgt] : 0);
        });
    }
    );
    return matrix;
}

function drawTTM() {
    d3.select("#TTM-graph").html("");
    // 创建 SVG 画布
    const svgSize = 400;  // 画布宽度
    let margin = 30;
    const svg = d3.select("#TTM-graph")
                .append("svg")
                .attr("width", svgSize)
                .attr("height", svgSize);

    const cellSize = (svgSize - margin * 2) / arrangement.length;
    let maxTransition = 0;
    // 根据topicTransitionMatrix计算最大转移概率
    for (let src in TTM) {
        for (let tgt in TTM[src]) {
            maxTransition = Math.max(maxTransition, TTM[src][tgt]);
        }
    }
    arrangement.forEach((src, i) => {
        arrangement.forEach((tgt, j) => {
            svg.append('rect')
                .attr('x', i * cellSize + margin)
                .attr('y', j * cellSize + margin)
                .attr('width', cellSize - 1) // 留出一点空隙以分隔列
                .attr('height', cellSize - 1)
                .attr('class', `cell cell_${src} cell_${tgt}`)
                .style("fill", `rgba(0, 0, 255)`)// i === j? `gray`: `rgba(0, 0, 255)`)
                .style("opacity", _ => {
                    if (i == j) return 1
                    if (TTM[src] && TTM[src][tgt]) {
                        return TTM[src][tgt] / maxTransition;
                    }
                    return 0;
                })
                // .style("stroke", 'black');
        });
    });

    // 绘制横坐标轴
    const xAxisScale = d3.scaleBand()
        .domain(arrangement.map(d => `${topic2order(d)}`))
        .range([0, svgSize]);

    const xAxis = d3.axisBottom(xAxisScale);

    const xAxisGroup = svg.append('g')
        .attr('transform', `translate(${cellSize / 2}, ${svgSize - margin})`)
        .call(xAxis);

    // append text on the middle up of svg
    svg.append('text')
        .attr('x', svgSize / 2)
        .attr('y', margin)
        .attr('text-anchor', 'middle')
        .text('initial cost: ' + originalCost + ',  current cost: ' + bestCost);

    xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        // .attr('transform', 'rotate(-90)');
    
    
    // 添加列的拖拽交互逻辑
    xAxisGroup.selectAll('text')
        .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));
    
    let dragStartIndex;
    
    function dragStarted(event, d) {
        dragStartIndex = arrangement.indexOf(parseInt(d));
    }
    
    function dragged(event, d) {
        // 拖拽过程中可以显示一些交互效果，例如高亮当前拖拽的列
    }
    
    function dragEnded(event, d) {
        const x = event.x;
        const dragEndIndex = Math.floor(x / cellSize);
        if (dragEndIndex >= 0 && dragEndIndex < topicCount) {
            moveColumn(dragStartIndex, dragEndIndex);
            drawTTM(); // 重新绘制整个图表以反映新的排列
        }
    }
    
    function moveColumn(from, to) {
        // 移动列，并更新全局变量arrangement
        const [removed] = arrangement.splice(from, 1);
        arrangement.splice(to, 0, removed);
        drawTTM();
    }
}

function highlight_node(id, draw_hypertree=true, show_node_info=true) {   // 输入：当前node的 id
    // if (image_switch == 0)  return;
    if (visType == 7) return;
    reset_node();
    center_node = id;
    highlighted = [id];

    // adjacent_ids = [];
    // for (let i = 0; i < edges.length; i++) {
    //     if (id == edges[i].source) {
    //         adjacent_ids.push(edges[i].target);
    //     }
    //     else if (id == edges[i].target) {
    //     } else if (id == edges[i].target) {
    //         adjacent_ids.push(edges[i].source);
    //     }
    // }
    extend_ids = get_extend_ids(id);

    if (draw_hypertree) draw_hyper_tree(id);
    
    // 改变当前节点颜色和相邻节点
    d3.selectAll(".paper")  //.data(nodes)
        .attr("fill-opacity", d => {
            if (d.id != id && extend_ids.indexOf(d.id) == -1) return virtualOpacity;
        })
        .attr("stroke-opacity", d => {
            if (d.id != id && extend_ids.indexOf(d.id) == -1) return virtualOpacity;
        });

    // 改变当前节点与其相邻节点间线的颜色为红色
    d3.selectAll('.reference')
        .style("stroke", d => {
            if (highlighted.includes(d.target) || highlighted.includes(d.source)) return 'red';
        })
        .style("opacity", d => {
            if (extend_ids.includes(d.source) & extend_ids.includes(d.target)) return probToOpacity(d.extends_prob);
            return virtualOpacity;
        });
    
    d3.selectAll('.link').style('opacity', 0);
    d3.selectAll(`.link_${id}`).style('opacity', 1);

    // 将当前节点及其邻接点所对应year的topic显示出来
    let extend_year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (extend_ids.indexOf(nodes[i].id) != -1) {
            extend_year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
        }
    }

    // adjacent_ids.push(id);
    // year_topics = [];
    // for (let i = 0; i < nodes.length; i++) {
    //     if (adjacent_ids.indexOf(nodes[i].id) != -1) {
    //         year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
    //     }
    // }
    // g.selectAll(".year-topic")
    //     .attr("fill-opacity", d => {
    //         if (year_topics.indexOf(d.yearTopicId) != -1) return 1
    //         if (extend_year_topics.indexOf(d.yearTopicId) != -1) return 0.5
    //         return virtualOpacity;
    //     });
    
    d3.selectAll('.bar')
        .style("opacity", virtualOpacity)
    d3.selectAll(`.bar_${id}`)
        .style("opacity", 0.7)
        .style("stroke", "red")
        .style("stroke-width", 3);
    extend_ids.forEach(id => {
        d3.selectAll(`.bar_${id}`)
            .style("opacity", 0.7);
    });
    

    if (show_node_info) {
        $("#paper-list, #up-line, #down-line, #edge-info").hide();
        $("#selector, #node-info, #node-info-blank").show();

        // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });
        $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

        //更新node-info里的内容
        let fieldLevelVal = $("#field-level").val();
        let nodes = global_nodes;
        for (let i = 0; i < global_nodes.length; i++) {
            if (global_nodes[i].id == id) {
                $('#paper-id').text(nodes[i].id);
                $('#paper-name').text(nodes[i].name);
                $('#paper-year').text(nodes[i].year);
                $('#paper-citation').text(nodes[i].citationCount);
                if (nodes[i].citationCount == '-1') {
                    $('#paper-citation').text("Not available");
                }
                $('#paper-authors').text(nodes[i].authors);
                $('#paper-prob').text((parseFloat(nodes[i].isKeyPaper)).toFixed(2));
                $('#paper-venue').text(nodes[i].venu);

                let topic = parseInt(nodes[i].topic);
                topic = fieldLevelVal == 1 ? parseInt(fields[topic][8]) : topic;
                $('#paper-field').text(fields[topic][2].split('_').join(', '));
                $('#abstract').text(nodes[i].abstract);
            }
        }
    }
}

function reset_node(reset_info=false) {
    // if (image_switch == 0)  return;
    if (visType == 7) return;

    console.log('reset_node called')

    // d3.selectAll('.year-topic').attr('fill-opacity', 1);
    d3.selectAll('.bar')
        .style('opacity', 0.7)
        .style("stroke", "none");
    g.selectAll('.paper').data(nodes)
        .style('fill-opacity', 1)
        .style('stroke-opacity', 1);
    d3.selectAll('.reference')
        .style("stroke", "#202020")
        .style('opacity', d => probToOpacity(d.extends_prob))
        .style('stroke-width', d => probToWidth(d.extends_prob));
    d3.selectAll('.link')
        .style("opacity", 1);

    g.selectAll('.edge-path')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', 1);
    g.selectAll('.edge-path-polygon')
        .style("fill", d=>d.color)
        .style('opacity', 1);
    
    highlighted = [];
    extend_ids = [];
    if (reset_info) { 
        $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
        $("#paper-list").show();
    }
}

function visual_topics() {
    $("#topic-slider").val(0.5);
    $("#topic-slider").show();

    console.log('visual_topics');

    // let topic_width = $("#topic-map-graph").width();
    let ele = d3.select('.address-text').node();
    let topic_width = ele.getBoundingClientRect().width;
    let topic_height = topic_width - $("#topic-map-banner").height();
    const topic_margin1 = 35;
    const topic_margin2 = 20;

    d3.select("#topic-map-svg").remove();

    var maxNum = d3.max(paper_field, d => d.num);
    var topic_r = (4 / Math.sqrt(maxNum)).toFixed(2);
    if (topic_r > 2) {
        topic_r = 2;
    }
    $("#topic-label").text(topic_r);
    $("#topic-slider").val(topic_r);

    var xScale = d3.scaleLinear()
        .domain([d3.min(paper_field, d => d.x), d3.max(paper_field, d => d.x)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(paper_field, d => d.y), d3.max(paper_field, d => d.y)])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    const topic_map_svg = d3.select("#topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "topic-map-svg");
        
    const topic_map_g = topic_map_svg.append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);
    
    const topics = topic_map_g.selectAll(".topic-map").data(global_paper_field).enter().append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d => Math.sqrt(d.num) * 10 * topic_r)
        .style("fill", d => topic2color(d.id))
        .style("stroke", `rgba(0, 0, 0, 0.2)`)
        .style("stroke-width", 0.5)
        // .attr("filter", "url(#f1)")
        .style('fill-opacity', 0.6)
        .attr("id", d => 'circle' + d.id)
        .attr("class", "topic-map");

    topics
    .on('mouseover', function(d) {
        highlight_field(d.id);
        tip.show(d);
        d3.select(this).attr('cursor', 'pointer');
    })
    .on('mouseout', reset_field);
    
    if (paper_field.length == 0) {
        $("#topic-slider").hide();
    }

}

function probToOpacity(prob, a=0.2) {
    // 将透明度从[0.3, 0.8]映射到 [a, 1] 范围
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    return a + (maxOpacity - a) * opacity;
}

function probToWidth(prob, a=1, b=5) {
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    let ret = a + opacity * (b - a);
    return ret / 2;
}

function get_graph() {
    console.log('field_roots', field_roots)
    var categories = field_roots.map(line=> {
        color = label2color[line[0]]
        return {
            "name": String(line[0]),
            "color": hsvToHex(color[0], 0.7, color[2])
        }
    });
    var topic2catagory = {};
    for (let i = 0; i < fields.length; i++) {
        topic2catagory[i] = fields[i][8];
    }
    let node_data = nodes.map(node=> {
        return {
            "id": node.id,
            "name": node.name,
            "symbolSize": Math.cbrt(node.citationCount) + 5,
            "category": topic2catagory[node.topic],
            "value": node.citationCount,
            "year": node.year,
            "label": {
                "normal": {
                    "show": node.symbolSize > 10
                }
            }
        }
    });
    let link_data = edges.map(edge=> {
        return {
            "source": edge.source,
            "target": edge.target,
        }
    }).filter(edge=> {
        return edge.source.length > 4;
    });
    return {
        "nodes": node_data,
        "links": link_data,
        "categories": categories
    }
}

function updateChart(graph, year) {
    // 过滤节点
    let filteredNodes = graph.nodes.filter(node => node.year <= year);

    // 过滤边（只包括过滤后存在的节点）
    let filteredLinks = graph.links.filter(link => {
        return filteredNodes.find(node => node.id === link.source) &&
               filteredNodes.find(node => node.id === link.target);
    });

    // 设置新的图表数据
    forceChart.setOption({
        series: [{
            data: filteredNodes,
            links: filteredLinks
        }]
    });
}

function selectorById(id) {
    if (id.indexOf('->'))
        return 'e' + id.replace('->', '_');

    return 'n' + id;
}


function highlight_edge(id, show_edge_info=true) {
    console.log('highlight_edge', id)
    let id_arr = id.split('->');
    var source = id_arr[0], target = id_arr[1];
    highlighted = [id];

    // 改变边的起点和终点颜色
    g.selectAll(".paper").data(nodes)
        .style("fill-opacity", d => {
            if (d.id != source && d.id != target) return virtualOpacity;
        })
        .style('stroke-opacity', d => {
            if (d.id != source && d.id != target) return virtualOpacity;
        })

    d3.selectAll('.reference').data(edges)
        .style("stroke", d => highlighted.includes(d.id)? 'red': "#202020")
        .style('opacity', d => highlighted.includes(d.id)? 1: virtualOpacity)
        .style('stroke-width', d => {if (d.id == id) return 10;})

    // g.selectAll('.edge-path').style('stroke', 'black').style('opacity', virtualOpacity);
    // g.select('#' + selectorById(id))
    //     .style('stroke', 'red')
    //     .style('fill', 'red')
    //     .style('opacity', 1);
        

    let year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (source == nodes[i].id || target == nodes[i].id) {
            year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
        }
    }
    d3.selectAll(".year-topic")
        .style("fill-opacity", d => {
            if (year_topics.indexOf(d.id) == -1) return virtualOpacity;
        });
    
    $("#paper-list, #selector, #node-info, #node-info-blank, #up-line, #down-line").hide();
    $("#edge-info").show();
    
    if (show_edge_info) {
        //更新edge-info中的内容
        let nodes = global_nodes, edges = global_edges;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id == source) {
                $('#source-paper').text(nodes[i].name);
                $('#source-paper-year').text(nodes[i].year);
                $('#source-paper-venu').text(nodes[i].venu);
                $('#source-paper-citation').text(nodes[i].citationCount);
            }
            if (nodes[i].id == target) {
                $('#target-paper').text(nodes[i].name);
                $('#target-paper-year').text(nodes[i].year);
                $('#target-paper-venu').text(nodes[i].venu);
                $('#target-paper-citation').text(nodes[i].citationCount);
            }
        }
        for (var i = 0; i < edges.length; i++) {
            if (edges[i].source == source && edges[i].target == target) {
                $('#citation-context').text(edges[i].citation_context);
                $('#extend-prob').text(String(edges[i].extends_prob));
                break;
            }
        }
    }
}

function updateOutlineColor(isKeyPaper, citationCount) {
    let outlineColorVal = $("#outline-color").val();
    if (outlineColorVal == 0)  return 'black';
    if (outlineColorVal == 1)  return isKeyPaper >= 0.5? 'red': 'black';
    
    // outlineColorVal == 2
    if (citationCount < 50)   return 'black';
    else if (citationCount < 100) return 'DarkOrange';
    return 'red';
}

function updateOutlineThickness(isKeyPaper, citationCount) {
    let outlineThicknessVal = $("#outline-thickness").val();
    if (outlineThicknessVal == 0)  return 0;
    if (outlineThicknessVal == 1)  return isKeyPaper >= 0.5? 10: (isKeyPaper >= 0.5? 5: 0);
    
    if (citationCount >= 50)   return 5;
    return 0;
}

function getFillColorFunc() {
    let defaultColor = "#b3ddff";
    let fillColorVal = $("#fill-color").val();
    if (fillColorVal == 0)  return d => hsvToColor(d.color);
    if (fillColorVal == 1)  return defaultColor;
    if (fillColorVal == 2) {
        return d => {
            return d.isKeyPaper == 1? "#40a6ff": (d.isKeyPaper >= 0.5? "#95cdff": defaultColor);
        }
    }
    // if (fillColorVal == 3) {
    return d => {
        return d.citationCount < 10? defaultColor: (d.citationCount < 50? "#95cdff": "#40a6ff");
    }
}

function updateFillColor() {
    let fillColorVal = $("#fill-color").val();
    if (fillColorVal == 0) {
        d3.selectAll('.paper').data(nodes)
            .style("fill", d => hsvToColor(d.color));
        visual_topics();
        
        draw_tagcloud();
    }
    else {
        let fillColor = getFillColorFunc();
        d3.selectAll(".paper").style("fill", fillColor);
        d3.selectAll('.year-topic').style("fill", fillColor);
        d3.selectAll('.topic-map').style("fill", fillColor);
        d3.selectAll('.tag-rect').style("fill", fillColor);
    }
}

function updateFieldLevel() {
    updateFillColor();
}

function updateVisType() {
    visType = $("#vis-type").val();
    if (visType == 0 || visType == 3 || visType == 6 || visType == 7 || visType == 8) {
        // onFullscreenChange();
        loadAndRender();
    } else if (visType == 1) {
        force_layout();
    } else if (visType == 2) {
        force_layout(true);
    } else if (visType == 4) {
        // ajaxRequest(true);
        
        document.getElementById('toggle-switch').onchange = function() {
            enable_y_focus = this.checked;
            graph = hyperbolicDistortion(global_graph);
            console.log('toogle graph', graph)
            init_graph();
        };

        graph = hyperbolicDistortion(global_graph);
        init_graph();

        $("#mainsvg").on("wheel", function(event) {
            // 防止页面滚动
            event.preventDefault();
        
            // 获取滚轮的滚动方向
            let delta = event.originalEvent.deltaY;
        
            if (delta > 0) {
                coverage = Math.max(0.05, coverage * 0.9);
            } else {
                coverage = Math.min(20, coverage / 0.9);
            }
        
            graph = hyperbolicDistortion(global_graph);
            console.log("Current coverage value:", coverage);
            init_graph();
        });

        // 当鼠标在SVG元素上按下时
        $("#mainsvg").on("mousedown", function(event) {
            reset_graph();
            isMouseDown = true;
            lastMouseX = event.pageX; // 记录当前鼠标X坐标
            lastMouseY = event.pageY; // 记录当前鼠标Y坐标
        });

        // 当鼠标在SVG元素上移动时
        $("#mainsvg").on("mousemove", function(event) {
            if (isMouseDown) {
                // 计算鼠标移动的距离
                let deltaX = event.pageX - lastMouseX;
                lastMouseX = event.pageX;
                focus=focus-deltaX/window.innerWidth;

                let deltaY = event.pageY - lastMouseY;
                lastMouseY = event.pageY;
                y_focus=y_focus-deltaY/window.innerHeight;

                graph = hyperbolicDistortion(global_graph);
                console.log("Current focus value:", focus, y_focus);
                init_graph();
            }
        });

        // 当鼠标释放时
        $(document).on("mouseup", function() {
            isMouseDown = false;
        });
    } else if (visType == 5) {
        temporalThematicFlow();
    }
}


function sugiyama(years, nodes, edges) {
    var layers = new Array;
    years.forEach(year => {
        let l = new Array;
        nodes.forEach(node => {
            if (node.year == year.id) {
                l.push({id: node.id, x: node.x, y: node.y});
            }
        });
        layers.push(l);
    });
    
    var Gp = new Array;
    let cnt = 0;
    edges.forEach(edge => {
        let d = edge.d;
        let t = d.split('C');
        let M = t[0].substring(1).split(',');       // ['29.52', '-1450.22']
        let C = t[1].substring(1).split(' ');       // ['9.52,-1436.7', '29.52,-1417.88', '29.52,-1404.28']
        let pre = edge.source;
        for (let i = 0; i < C.length; i++) {
            let x_id = parseFloat(C[i].split(',')[0]);
            let y_id = parseFloat(C[i].split(',')[1]);
            if (i + 1 == C.length) {
                Gp.push({source: pre, target: edge.target});
                break;
            }
            if (i % 3 == 2) {
                for (let j = 0; j < years.length; j++) {
                    if (years[j].y - years[j].ry < y_id && y_id < years[j].y + years[j].ry) {
                        layers[j].push({id: "VN" + String(cnt), x: x_id, y: years[j].y});
                        Gp.push({source: pre, target: "VN" + String(cnt)});
                        pre = "VN" + String(cnt);
                        cnt += 1;
                    }
                }
            }
        }
    });
}

function parseGraphProperties(graphStrings) {
    // 正则表达式匹配数字
    const numberPattern = /-?\d+(\.\d+)?/g;

    // 从第一个字符串中提取宽度和高度
    let dimensions = graphStrings[0].match(numberPattern);
    let width = parseFloat(dimensions[2]);
    let height = parseFloat(dimensions[3]);

    // 从第二个字符串中提取平移值，这里假设 "translate(x y)" 之后是平移值
    let translateValues = graphStrings[1].match(numberPattern);
    let translateX = parseFloat(translateValues[translateValues.length - 2]);
    let translateY = parseFloat(translateValues[translateValues.length - 1]);

    return {
        width: width,
        height: height,
        translateX: translateX,
        translateY: translateY
    };
}

function hyperbolicDistortion(graph, windowWidth=3000, windowHeight=1600) {
    console.log('hyperbolicDistortion', focus, enable_y_focus, y_focus, coverage)

    // Extracting graph dimensions and translation
    const properties = parseGraphProperties(graph[0]);
    console.log('properties', properties)
    const graphWidth = properties.width;
    const graphHeight = properties.height;
    const translateX = properties.translateX;
    const translateY = properties.translateY;

    function transformCoordinate(x, y) {
        // Apply hyperbolic transformation to x-coordinate
        let xNorm = (x - focus * graphWidth) / graphWidth;
        let transformedX = hyperbolicTransform(xNorm) * windowWidth;

        if (enable_y_focus) {
            let yNorm = (y - y_focus * graphHeight) / graphHeight;
            let transformedY = hyperbolicTransform(yNorm) * windowHeight;
            return [transformedX, transformedY];
        }

        let transformedY = y / graphHeight * windowHeight;
        return [transformedX, transformedY];
    }

    function transformNode(node) {
        let newNode = Object.assign({}, node);
        let ret = transformCoordinate(node.x + translateX, node.y + translateY);
        // console.log(ret)
        newNode.x = ret[0];
        newNode.y = ret[1];
        // Adjust the node's size - Assuming rx, ry are radii
        let xNorm = (node.x + translateX - focus * graphWidth) / graphWidth;
        newNode.rx *= 1.5 * sech2(xNorm * coverage) * windowWidth / graphWidth;

        if (enable_y_focus) {
            let yNorm = (node.y + translateY - y_focus * graphHeight) / graphHeight;
            newNode.ry *= 1.5 * sech2(yNorm * coverage) * windowHeight / graphHeight;
            return newNode;
        }

        newNode.ry *= windowHeight / graphHeight;
        return newNode
    }

    function transformPath(d) {
        return d.replace(/([MLCQSTAZVH])|(-?\d+(\.\d+)?),(-?\d+(\.\d+)?)/g, (match, command, x, _, y) => {
            if (command) {
                return command;
            }
            let ret = transformCoordinate(parseFloat(x) + translateX, parseFloat(y) + translateY);
            return `${ret[0]},${ret[1]}`;
        });
    }

    function transformPolygon(polygonString) {
        return polygonString.split(' ').map(coordPair => {
            const [x, y] = coordPair.split(',').map(Number);
            let ret = transformCoordinate(x + translateX, y + translateY);
            return `${ret[0]},${ret[1]}`;
        }).join(' ');
    }

    let years = graph[1].map(node=> {
        return transformNode(node);
    })
    

    let nodes = graph[2].map(node => {
        let n = transformNode(node);
        // console.log(node, n)
        return n;
    });
    
    let edges = graph[3].map(edge => {
        return {
            source: edge.source,
            target: edge.target,
            d: transformPath(edge.d),
            extends_prob: edge.extends_prob,
            citation_context: edge.citation_context,
        }
    });

    let polygon = graph[4].map(polygon => {
        return transformPolygon(polygon);
    });
    

    return [
        ['0 0 ' + windowWidth + ' ' + windowHeight, 'translate(0, 0)'],
        years,
        nodes,
        edges,
        polygon
    ];
    // {
    //     nodes: nodes,
    //     edges: edges,
    //     polygon: polygon
    // };
}

