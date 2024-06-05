window.onload = checkScreenSize;

// global variable (STopic == null)
let global_nodes, global_edges, global_paper_field, minYear, maxYear, global_colors;
let paperID2topic = {};

// subgraph variable (global / subgraph, the graph to render)

let topic2graph = {};
let STopic = null;
let g;  // 当前正在focus的元素


let svgWidth, svgHeight;
let paperID2year = {};
let dot = '';
let edgeBundling = 6;
let context_edge_weight = 3;
let prismRadius = 800;

let viz, vizContext, config, visType, authorData;

let adjacent_ids = [];
let extend_ids = [];
let center_node = null;
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
let bbox_padding_x=10, bbox_padding_y=100;
let yearGrid = 2, alpha = 10;
let virtualOpacity = 0.1;
let topicOpacity = 0.25;
let maxOpacity = 0.8;
let polygenView = false;

// 在函数外部缓存选择结果
let defaultOpacity = 0.8;
let chord_arcs = d3.selectAll(".chord-arc");
let chord_ribbons = d3.selectAll(".chord-ribbon");

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
        loadAndRender()
    })

    $("#alphaSlider").change(function () {
        alpha = $("#alphaSlider").val();
        loadAndRender()
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

    $("#edge-bundling").on('change', function() {
        edgeBundling = parseInt(this.value);
        loadAndRender();
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

    document.getElementById('toggle-polygen').addEventListener('click', function() {
        polygenView = !polygenView;
        this.textContent = polygenView ? 'Chord View' : 'Polygen View';
        draw_chord();
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
    checkScreenSize();

    $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
    loadAndRender();
    draw_tagcloud();
    visual_topics();
    
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
    
    global_nodes = global_nodes.sort(op("citationCount"));
    for (let i = 0; i < global_nodes.length; i++) {
        const paperName = String(global_nodes[i].name);
        const paperVenu = String(global_nodes[i].venu);
        const paperYear = String(global_nodes[i].year);

        var authors = String(global_nodes[i].authors);
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
        var color = topic2color(global_nodes[i].topic, 0.7) // hsvToHex(graph['nodes'][i].color[0], 0.7, graph['nodes'][i].color[2]);
        var nodeId = global_nodes[i].id;
        var citationCount = global_nodes[i].citationCount;
        if (global_nodes[i].citationCount == '-1') {
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
        // let width = size * shortName.length * 0.5;
        let width = textSize(d.shortName, size).width * 0.88;
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
            shortName: d.shortName,
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

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);


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
            STopic = STopic == d.id? null: d.id;
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

function sumRowsAndColumns(matrix) {
    let rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
    let colSums = matrix[0].map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));

    return { rowSums, colSums }; // 返回一个对象
}

function polarToCartesian(radius, angle) {
    return {
        x: radius * Math.cos(angle - Math.PI / 2),
        y: radius * Math.sin(angle - Math.PI / 2)
    };
}

function lineIntersection(angle, point1, point2) {
    console.log('intersect', angle, point1, point2);

    // 通过给定角度计算直线的斜率和截距
    const m1 = Math.tan(angle - Math.PI / 2);
    const b1 = 0;  // 给定角度的直线通过原点

    // 通过两个点计算另一条直线的斜率和截距
    const m2 = (point2.y - point1.y) / (point2.x - point1.x);
    const b2 = point1.y - m2 * point1.x;

    // 如果两条直线平行，则没有交点
    if (m1 === m2) {
        return null;
    }

    // 计算交点
    const intersectX = (b2 - b1) / (m1 - m2);
    const intersectY = m1 * intersectX;

    console.log('intersect', intersectX, intersectY);

    return {
        x: intersectX,
        y: intersectY
    };
}


function draw_chord() {
    // let ele = d3.select(".address-text").node();
    // d3.select("#chord-content").selectAll("*").remove();
    // let height = ele.getBoundingClientRect().width;
    // let width = ele.getBoundingClientRect().width;

    let svgElement = init_chord(polygenView);
    bindSVG(svgElement, "#chord-content");
}

function highlight_arc(index) {
    chord_arcs.transition().style("opacity", defaultOpacity / 2);
    chord_ribbons.transition().style("opacity", defaultOpacity / 2);

    chord_arcs.filter(`.chord-arc-${index}`).transition().style("opacity", 1);
    chord_ribbons.filter(`.chord-ribbon-from-${index}`).transition().style("opacity", 1);
    chord_ribbons.filter(`.chord-ribbon-to-${index}`).transition().style("opacity", 1);
}

function init_chord(isPolygenView=false) {
    // 创建一个无主的SVG元素
    let width = prismRadius * 2;
    let height = width;
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute("width", width);
    svgElement.setAttribute("height", height);
    svgElement.setAttribute("viewBox", [-width / 2, -height / 2, width, height]);

    let svg = d3.select(svgElement)
        .attr("style", "width: 100%; height: auto; font: 10px Archivo Narrow;");


    const outerRadius = Math.min(width, height) * 0.5;
    const innerRadius = outerRadius - 20;
    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(adjacentMatrix); // 解构赋值

    let names = global_paper_field.map(d => d.shortName),
        colors = global_paper_field.map(d => topic2color(d.id)),
        weights = global_paper_field.map(d => d.size);
    // 使用size而不是num作为权重

    let degree = outdegree.map((d, i) => d + indegree[i]);

    let totalWeight = d3.sum(weights);
    let interval = 0;
    if (!isPolygenView){
        interval = totalWeight / 100;
        totalWeight += interval * names.length;
    }

    console.log('degree', degree);
    const angleScale = d3.scaleLinear().domain([0, totalWeight]).range([0, 2 * Math.PI]);
    let cumulativeAngle = 2 * Math.PI;
    const nodeAngles = weights.map((weight, ix) => {
        const endAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(weight);
        const startAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(interval);
        return {
            index: ix,
            startAngle: startAngle,
            endAngle: endAngle,
            weight: weight
        };
    });

    const chords = [];
    let angles = JSON.parse(JSON.stringify(nodeAngles));
    adjacentMatrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (value > 0) {
                const source = nodeAngles[i];
                const target = nodeAngles[j];
                chords.push({
                    source: {
                        index: i,
                        startAngle: source.startAngle,
                        endAngle: source.startAngle + angleScale(value / degree[i] * source.weight),
                        value: value
                    },
                    target: {
                        index: j,
                        startAngle: target.endAngle - angleScale(value / degree[j] * target.weight),
                        endAngle: target.endAngle,
                        value: value
                    }
                });
                source.startAngle += angleScale(value / degree[i] * source.weight);
                target.endAngle -= angleScale(value / degree[j] * target.weight);
            }
        });
    });
    angles.forEach((d, i) => d.splitAngle = nodeAngles[i].startAngle)
    console.log('angles', angles)
    console.log('chords', chords)

    function highlight_ribbon(d) {
        const sourceIndex = d.source.index;
        const targetIndex = d.target.index;
        // 将所有元素透明度设为默认值的一半
        chord_arcs.transition().style("opacity", defaultOpacity / 2);
        chord_ribbons.transition().style("opacity", defaultOpacity / 2);
    
        // 高亮特定元素
        chord_arcs.filter(`.chord-arc-${sourceIndex}, .chord-arc-${targetIndex}`)
            .transition()
            .style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-${sourceIndex}-${targetIndex}`)
            .transition()
            .style("opacity", 1);
    }
    
    function mouseout() {
        // 将所有元素的透明度恢复为默认值
        chord_arcs.transition().style("opacity", defaultOpacity);
        chord_ribbons.transition().style("opacity", defaultOpacity);
    }

    if (isPolygenView) {
        // 计算多边形的顶点。添加多边形蒙版。
        const polygonPoints = angles.map(d => {
            const startPoint = polarToCartesian(innerRadius - 5, d.startAngle);
            const endPoint = polarToCartesian(innerRadius - 5, d.endAngle);
            return [endPoint, startPoint];
        }).flat();

        const polygonChunks = angles.map(d => {
            const innerStart = polarToCartesian(innerRadius, d.startAngle);
            const innerEnd = polarToCartesian(innerRadius, d.endAngle);
            const outerStart = polarToCartesian(outerRadius, d.startAngle);
            const outerEnd = polarToCartesian(outerRadius, d.endAngle);
            const intersect = lineIntersection(d.splitAngle, innerStart, innerEnd);
            ret = [innerStart, innerEnd, outerEnd, outerStart];

            Object.assign(ret, {
                radius: Math.sqrt(intersect.x ** 2 + intersect.y ** 2),
                splitAngle: d.splitAngle,
            })
            return ret;
        });
        
        // 创建蒙版
        const mask = svg.append("defs")
            .append("mask")
            .attr("id", "polygon-mask");
        
        mask.append("polygon")
            .attr("points", polygonPoints.map(d => `${d.x},${d.y}`).join(" "))
            .attr("fill", "white");
        
        // 应用蒙版到chords
        svg.append("g")
            .attr("fill-opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("mask", "url(#polygon-mask)")  // 应用蒙版
            .style("mix-blend-mode", "multiply")
            .attr("fill", d => colors[d.source.index])
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", highlight_ribbon)
            .on("mouseout", mouseout)
            .append("title")
            .text(d => `\n${d.target.value} ${names[d.source.index]} → ${names[d.target.index]}`);
        
        polygonChunks.forEach((chunk, ix) => {
            console.log('chunk', chunk)
            svg.append("polygon")
                .style("opacity", defaultOpacity)
                .attr('class', 'chord-arc chord-arc-' + ix)
                .attr("points", chunk.map(d => `${d.x},${d.y}`).join(" "))
                .attr("fill", d => {
                    let c = colors[ix];
                    return hsvToColor([c.h, c.s, c.v], 0.8)
                })
                .on("mouseover", highlight_arc(ix))
                .on("mouseout", mouseout);
            
            svg.append("path")
                .attr('class', 'chord-arc chord-arc-' + ix)
                .style("opacity", defaultOpacity)
                .attr("fill", d => {
                    let c = colors[ix];
                    return hsvToColor([c.h, c.s, c.v], 0.8)
                })
                .attr("d", d3.arc()
                    .innerRadius(chunk.radius-10)
                    .outerRadius(chunk.radius+30)
                    .startAngle(chunk.splitAngle - 0.003)
                    .endAngle(chunk.splitAngle + 0.003)
                )
                .on("mouseover", highlight_arc(ix))
                .on("mouseout", mouseout);
        });
        chord_arcs = d3.selectAll(".chord-arc");
        chord_ribbons = d3.selectAll(".chord-ribbon");
    } else {
        const group = svg.append("g")
            .selectAll("g")
            .data(angles)
            .join("g");

        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(d => d.startAngle)
                .endAngle(d => d.endAngle)
            )
            .style("opacity", defaultOpacity)
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", d=> highlight_arc(d.index))
            .on("mouseout", mouseout);


        group.append("title")
            .text(d => `${names[d.index]}\n${d.weight}`);

        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius-10)
                .outerRadius(outerRadius+10)
                .startAngle(d => d.splitAngle - 0.003)
                .endAngle(d => d.splitAngle + 0.003)
            )
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", d=> highlight_arc(d.index))
            .on("mouseout", mouseout);

        svg.append("g")
            .attr("opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .style("mix-blend-mode", "multiply")
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("fill", d => colors[d.source.index])
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", highlight_ribbon)
            .on("mouseout", mouseout)
            .append("title")
            .text(d => `${d.target.value} ${names[d.source.index]} → ${names[d.target.index]}`);
    }

    // 每次生成新的SVG元素时，我们都需要更新选择器
    chord_arcs = d3.selectAll(".chord-arc");
    chord_ribbons = d3.selectAll(".chord-ribbon");
    return svgElement;
}

function create_svg(viewBox=undefined, transform=undefined) {
    let ele = d3.select("#mainsvg").node();
    d3.select("#mainsvg").selectAll("*").remove();
    svgWidth = ele.getBoundingClientRect().width;
    svgHeight = ele.getBoundingClientRect().height;
    if (!viewBox) {
        viewBox = `0 0 ${svgWidth} ${svgHeight}`;
    }

    let viewBoxWidth = parseFloat(viewBox.split(' ')[2]);
    let viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    if (!transform) {
        transform = `translate(0,${viewBoxHeight})`;
    }

    svg = d3.select("#mainsvg").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    //获取viewBox的宽度
    let moveDistance_r = Math.max(viewBoxWidth, viewBoxWidth / 2 +  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;
    let moveDistance_l = Math.min(0, viewBoxWidth / 2 -  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;

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
    d3.selectAll('#' + selectorById(id))
        .style("stroke", color)
        .style("stroke-width", width)
        .attr('cursor', 'pointer');
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", color)
        .attr('cursor', 'pointer');
}

function mouseoutEdge(id) {
    if (!highlighted.includes(id)) {
        d3.selectAll('#' + selectorById(id))
            .style("stroke", d=>d.color)
            .style("stroke-width", d=>d.width);
        d3.selectAll('#' + selectorById(id) + '_polygon')
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
    d3.selectAll('#' + selectorById(id))
        .style("stroke", "red")
        .style("stroke-width", 10)
        .style('opacity', 1);
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", "red")
        .style("opacity", 1);
}

function init_graph(graph) {
    visType = $("#vis-type").val();

    if (graph['topic'] !== null) {
        // subgraph + context
        processDotContext(graph);
        graph['svgElement'] = vizContext.renderSVGElement(graph['dotContext']);
    } else {
        graph['svgElement'] = viz.renderSVGElement(graph['dot']);
    }
    parseSVG(graph);

    // 创建一个无主的SVG元素
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    svgElement.setAttribute('viewBox', graph['viewBox']);
    // svgElement.setAttribute('transform', graph['transform']);

    let svg = d3.select(svgElement);
    g = svg.append('g');
    graph['g'] = g;

    draw_context_edges(graph);
    g.selectAll('circle').data(graph['nodes']).enter().append('ellipse')
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

    g.selectAll('.text1')
        .data(graph['nodes'])
        .enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y + 10)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Archivo Narrow')
        .attr('font-size', 30)
        .attr('class', 'text1')
        .attr("pointer-events", "none")
        .text(d => String(d.citationCount));
        
        // .each(function(d) {
        //     // let text = d.text === undefined? d.text1 + '\n' + d.text2 : String(d.citationCount)
        //     let text = d.label;
        //     var lines = text.split('\n');
        //     for (var i = 0; i < lines.length; i++) {
        //         d3.select(this).append('tspan')
        //             .attr('x', d.x)
        //             .attr('dy', 10)  // Adjust dy for subsequent lines
        //             .text(lines[i]);
        //     }
        // });
    
    // 绘制每条边的所有路径
    // 为每条边创建一个独立的group元素
    const edgeGroups = g.selectAll('.edge-group')
    .data(graph['edges']) // 使用edges数组，每个元素代表一条边
    .enter()
    .append('g')
    .attr('class', 'edge-group');

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        const edgeGroup = d3.select(this);

        // console.log('draw edge', edge, probToOpacity(edge.extends_prob), probToWidth(edge.extends_prob))
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

    graph['svg'] = svgElement;
}

function draw_context(graph) {
    // draw context bar

    context_l = {};
    context_r = {}; 
    // topicID: {"2011": [edge1, edge2, ...], "2012": [], "total": 50}

    let bbox = graph['g'].node().getBBox();
    let all_years_l = [], all_years_r = [];
    let totalWidth = bbox.width;
    for (let edge of Object.values(graph['combinedContextEdges'])) {
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


    for (let edge of Object.values(graph['combinedContextEdges'])) {
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

    draw_context_bar(graph, context_l, totalSize_l * totalWidth / (totalSize_l + totalSize_r), 'l');
    draw_context_bar(graph, context_r, totalSize_r * totalWidth / (totalSize_l + totalSize_r), 'r');

}

function draw_context_bar(graph, context, width, dir='l') {
    let sorted_keys = Object.entries(context).sort((a, b) => b[1].total - a[1].total).map(entry => entry[0]);
    console.log('context for', dir,  context);
    let totalSize = sorted_keys.reduce((acc, key) => acc + context[key].total, 0);
    let g = graph['g'];
    let bbox = g.node().getBBox();

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
                        y: graph['id2attr']['l' + year].y - squareSize / 2,
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
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y - squareSize /2]); // 右上
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y + squareSize /2]); // 右下
            
            // 然后添加左侧点
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y - squareSize /2]); // 左上
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y + squareSize /2]); // 左下
            
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
        .attr("fill", topic2color(STopic))
        .attr("fill-opacity", topicOpacity)
        .attr("class", "context-polygon context-polygon_" + STopic)
        .on('mouseover', function() {
            let field = global_paper_field.find(d => d.id == STopic);
            highlight_field(STopic);
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
        .attr("class", "context-text context-text_" + STopic)
        .text(STopic + resuffix) // dir=='l'? STopic + '→': '→' + STopic
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

function draw_context_edges(graph) {
    if (graph['topic'] == null) return;
    console.log('draw context', graph['combinedContextEdges']);

    // draw context graph['edges']:
    // - edge id in Object.keys(graph['contextEdges'])
    // - using graph['id2attr'][edge]  to get the Path
    // - using graph['contextEdges'][edge].length to get width
    // - using all graph['edges'] in graph['contextEdges'][edge], find the target and use topic of target to get color

    const edgeGroups = graph['g'].selectAll('.edge-group-context')
    .data(Object.keys(graph['combinedContextEdges'])) // 使用edges数组，每个元素代表一条边
    .enter()
    .append('g')
    .attr('class', 'edge-group-context');

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        if (!Object.keys(graph['id2attr']).includes(edge)) {
            console.log('context edge not found, maybe flat-edges', edge, graph['id2attr'][edge])
            return true;    // continue
        }
        const edgeGroup = d3.select(this);

        edgeGroup.selectAll('.edge-path')
            .data(graph['id2attr'][edge].path)
            .enter()
            .append('path')
            .attr('d', d=>{
                d.width = graph['combinedContextEdges'][edge].weight * context_edge_weight;
                d.color = 'lightgray';
                return d.d
            })
            .style("fill", 'none')
            .style("stroke", 'lightgray')
            .style('stroke-opacity', 0.5)
            .style('stroke-width', graph['combinedContextEdges'][edge].weight * context_edge_weight)
            .attr('class', 'edge-path')
            .attr('id', selectorById(edge))
            .on('mouseover', function () {
                mouseoverEdge(edge);
                tip.show(edge);
            })
            .on('click', function () {
                if (graph['combinedContextEdges'][edge].weight == 1) {
                    let e = graph['combinedContextEdges'][edge].edges[0];
                    highlight_edge(`${e.source}->${e.target}`);
                }
                clickEdge(edge);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge);
                tip.hide(edge);
            });

        if (!graph['id2attr'][edge].polygon) {
            return true;
        }
        // console.log('draw polygon', edge, graph['id2attr'][edge].polygon.points)
        d3.select(this).append('polygon')
            .attr('points', graph['id2attr'][edge].polygon.points)
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
                if (graph['combinedContextEdges'][edge].weight == 1) {
                    let e = graph['combinedContextEdges'][edge].edges[0];
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

function draw_bbox(graph) {
    let g = graph['g'];
    let bbox = g.node().getBBox();

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
        .style("fill", topic2color(graph['topic'], sat=0.05))
        .style("stroke", 'red')
        .style("stroke-width", 2)
        .attr('filter', 'url(#drop-shadow)')
        .attr('id', 'background');
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


function createDot(graph) {
    /*
    Generates a DOT graph representation.

    Inputs:
        graph['nodes']: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        graph['edges']: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the graph['nodes'].
        maxYear: The maximum year among the graph['nodes'].
    */
    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
    }

    let dot = `digraph G {\n${size}\n${getEdgeBundlingStr()}\n`; // \nnode [shape=circle]
    let yearDic = {};

    for (let year = minYear; year <= maxYear; year++) {
        dot += `year${year} [label="${year}"]\n`;
        yearDic[year] = [`year${year}`]
    }
    graph['nodes'].forEach(node => {
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

    graph['edges'].forEach(edge => {
        dot += `${edge.source}->${edge.target}\n`;
    });

    dot += '}';
    graph['dot'] = dot
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

function processDotContext(graph) {
    /*
    Processes a dot graph to adjust and filter graph['nodes'] and graph['edges'] based on context graph['edges'] and a yearGrid system.

    Inputs:
        dot: A string containing the dot graph.
        graph['contextEdges']: Dictionary where keys are 'lxxxx->rxxxx' edge strings and values are attributes like weight.
        yearGrid: Integer value representing the yearGrid size for adjusting years in node labels.
        graph['virtualEdges']: virtual graph['edges'] connecting the components 

    Returns:
        output: A string containing the processed dot graph with graph['nodes'] and graph['edges'] adjusted based on the context.
    */
    let l = minYear;
    let r = maxYear;
    let labels = '';
    let focusEdgesStr = '';
    ranks = '';

    // 解析 .dot 输入以分类行并更新年份
    graph['dot'].split('\n').forEach(line => {
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
    graph['combinedContextEdges'] = {};
    Object.entries(graph['contextEdges']).forEach(([edge, edgeList]) => {
        let weight = edgeList.length;
        let newEdge = transfromEdgeName(edge);
        graph['combinedContextEdges'][newEdge] = graph['combinedContextEdges'][newEdge] || 
            { topics:{}, name: newEdge, edges: [], weight: 0, penwidth: 0, port: newEdge[0] === 'l' ? 'tailport=e' : 'headport=w' };
        graph['combinedContextEdges'][newEdge].weight += weight;
        graph['combinedContextEdges'][newEdge].penwidth += weight;  // 假设 penwidth 是累积的
        for (let edge of edgeList) {
            graph['combinedContextEdges'][newEdge].edges.push(edge);
            let topic = newEdge[0] == 'l'? paperID2topic[edge.source]: paperID2topic[edge.target];
            graph['combinedContextEdges'][newEdge].topics[topic] = (graph['combinedContextEdges'][newEdge].topics[topic] || 0) + 1;
        }
    });

    // 生成上下文边字符串
    let contextEdgesStr = Object.entries(graph['combinedContextEdges']).map(([edge, data]) =>
        `${edge} [color="lightgray", ${data.port}, weight=${data.weight}, penwidth=${data.penwidth}]`
    ).join('\n');
    let virtualEdgesStr = graph['virtualEdges'] ? graph['virtualEdges'].map(edge => `${edge} [style="invis"]`).join('\n') : '';
    
    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
        console.log('size', size);
    }

    // 生成最终输出 DOT 字符串 node [shape=circle]
    graph['dotContext'] = `digraph G {
${size}
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

function bindSVGToElement(graph, key, elementId) {
    let svgElement = graph[key];
    let {svg: svg, g: g} = bindSVG(svgElement, elementId);

    graph[key] = svg; // 更新 svgElement 为新的 SVG 元素
    if (key === 'svg') graph['g'] = g;
}


function bindSVG(svgElement, elementId) {
    // console.log('before', svgElement.childNodes.length);
    // 从参数获取容器，并清空容器内的所有元素
    let ele = d3.select(elementId).node();
    d3.select(elementId).selectAll("*").remove();

    let wasHidden = $(ele).is(':hidden');
    if (wasHidden) $(ele).show();
    // 获取容器尺寸
    let svgWidth = ele.getBoundingClientRect().width;
    let svgHeight = ele.getBoundingClientRect().height;
    console.log('svg size', svgWidth, svgHeight, elementId)
    
    if (wasHidden) $(ele).hide();
    

    // 获取并修正 SVG 的 viewBox 和 transform 属性
    let viewBox = svgElement.getAttribute('viewBox') || `0 0 ${svgWidth} ${svgHeight}`;
    let transform = svgElement.getAttribute('transform') || "translate(0,0) scale(1)";

    // 创建新的 SVG 元素，并设置属性
    const svg = d3.select(elementId).append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    // 在新 SVG 中添加一个 <g> 元素，并追加旧 SVG 的所有子节点
    let g = svg.append("g").attr("transform", transform);
    // Array.from(svgElement.childNodes).forEach(node => {
    //     g.node().appendChild(node.cloneNode(true));
    // });
    // d3.select(svgElement).selectAll('*').each(function() {
    //     g.node().appendChild(this);
    // });
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        g.node().appendChild(this);
    });

    // 添加缩放和拖拽功能
    const zoom = d3.zoom()
        .scaleExtent([0.01, 100]) // 可自行调整缩放比例范围
        .on("zoom", () => {
            let currentTransform = d3.event.transform;
            g.attr("transform", transform + currentTransform);
        });

    svg.call(zoom);
    // console.log('after', svgElement.childNodes.length); // 输出子节点的数量

    return {svg, g};
}

function parseSVG(graph) {
    graph['id2attr'] = {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // 解析节点
    graph['svgElement'].querySelectorAll('g.node').forEach(node => {
        const title = node.querySelector('title').textContent;
        const shape = node.querySelector('ellipse, polygon'); // 支持椭圆或多边形
        const text = node.querySelector('text');

        const cx = parseFloat(shape.getAttribute('cx')) || 0;
        const cy = parseFloat(shape.getAttribute('cy')) || 0;
        const rx = parseFloat(shape.getAttribute('rx')) || parseFloat(shape.getAttribute('width')) / 2 || 0;
        const ry = parseFloat(shape.getAttribute('ry')) || parseFloat(shape.getAttribute('height')) / 2 || 0;


        minX = Math.min(minX, cx - rx);
        maxX = Math.max(maxX, cx + rx);
        minY = Math.min(minY, cy - ry);
        maxY = Math.max(maxY, cy + ry);
        
        graph['id2attr'][title] = {
            id: title,
            fill: shape.getAttribute('fill'),
            stroke: shape.getAttribute('stroke'),
            x: cx,
            y: cy,
            rx: rx,
            ry: ry,
            label: text ? text.textContent : ''
        };
    });

    // 解析边
    graph['svgElement'].querySelectorAll('g.edge').forEach(edge => {
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

        graph['id2attr'][title] = {
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
    // graph['viewBox'] = graph['svgElement'].getAttribute('viewBox');
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    // graph['transform'] = graph['svgElement'].getAttribute('transform');

    graph['viewBox'] = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    graph['transform'] = `translate(0,${maxY - minY})`;

    graph['nodes'].forEach(node => {
        Object.assign(node, graph['id2attr'][node.id]);
    });
    graph['edges'].forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        Object.assign(edge, graph['id2attr'][edgeKey]);  // 合并边的属性
    });
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
        console.log('No node found in the data');
        return;
    }
    
    let ln = filteredNodes.length, le = filteredEdges.length;
    let modeValue = document.getElementById('mode').value;
    let surveyValue = document.getElementById('remove-survey').value;
    
    if (surveyValue == '1') filteredNodes = filteredNodes.filter(node => !node.survey);
    let lnr = filteredNodes.length;
    // Compute indegree, outdegree, and total degree
    let indegree = {}, outdegree = {}, alldegree = {};
    // set other graph['nodes'] in filteredNodes outdegree/indegree =0
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

    // 注意year的计算在selectedTopic之前，但是在过滤之后
    minYear = Math.min(...filteredNodes.map(node => node.year));
    maxYear = Math.max(...filteredNodes.map(node => node.year));

    console.log('original data:', authorData, 
        '#node:', authorData['nodes'].length, ln, lnr, filteredNodes.length, 
        '#edge:', authorData['edges'].length, le, filteredEdges.length);
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
        // 注意global_nodes的topic可能有更新，所以不能在这里更新paperID2topic
        // paperID2topic[d.id] = d.topic;
        paperID2year[d.id] = d.year;
        return d;
    });

    global_paper_field = [];    //该学者个人的field信息
    global_nodes.forEach(node => {
        let topic = parseInt(node.topic);
        let ix = global_paper_field.findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            // num是直接对应话题的文章数，size是所有 TopicProb > threshold的文章数，需要在后面重新计算
            global_paper_field.push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            global_paper_field[ix].num += 1;
        }
    })
    global_paper_field.sort(op('num'));
    console.log('original global_paper_field', JSON.parse(JSON.stringify(global_paper_field)))
    let total = global_paper_field.reduce((acc, cur) => acc + cur.num, 0);
    let sum = 0;
    let min_num = 2;    // 话题的最小值是2
    let cnt = 0;
    for (const d of global_paper_field) {
        sum += d.num;
        cnt += 1;
        if (sum >= 0.95 * total || cnt >= 25 || d.num == min_num) {
            min_num = d.num;
            break;
        }
    }
    // 注意逻辑：item.num >= min_num && item.id !== fields.length-1 会过滤others
    global_paper_field = global_paper_field.filter(item => item.num >= min_num);
    let topic = fields.length-1;
    let num = 0;
    let global_topics = global_paper_field.map(d => d.id);
    global_nodes.forEach(d => {
        if(!global_topics.includes(parseInt(d.topic))) {
            num += 1;
            d.topic = topic;
        }
        paperID2topic[d.id] = d.topic;
    });
    global_paper_field.push({
        id: topic,
        num: num,
        name: fields[topic][2],
        x: parseFloat(fields[topic][3]),
        y: parseFloat(fields[topic][4]),
        label: parseInt(fields[topic][8])
    })
    
    
    let max_num = Math.max(...global_paper_field.map(d=>d.num));
    rangeSlider.noUiSlider.updateOptions({
        range: {
            'min': min_num,
            'max': max_num+1 // 'range' 'min' and 'max' cannot be equal.
        }
    });
    // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
    rangeSlider.noUiSlider.set([min_num, max_num+1]);
    let maxNum = Math.max(...global_paper_field.map(d=>d.num));
    let colors = generateRainbowColors(global_paper_field.length);
    global_colors = {}
    global_paper_field.forEach((topic, i)=>{
        let ratio = Math.cbrt(topic.num / maxNum);
        let shortName = topic.name.split("_").slice(0, 3).join(' ');
        if (ratio < 0.5) {
            shortName = topic.name.split("_").slice(0, 2).join(' ');
        }
        topic.shortName = shortName;
        topic.color = colors[i];
        global_colors[topic.id] = colors[i];
    })
    console.log('global_paper_field', JSON.parse(JSON.stringify(global_paper_field)))

    generateTTM();
    arrangement = simulatedAnnealing(TTM);
    adjacentMatrix = getAdjacentMatrix();
    console.log('arrangement:', arrangement);

    // 加载所有话题图
    loadTopicGraph(null);
    global_paper_field.forEach(d => {
        loadTopicGraph(d.id);
    })
}

function generateRainbowColors(numColors) {
    let colors = [];
    for (let i = 0; i < numColors; i++) {
        let hue = i * (360 / numColors); // 色相均匀分布
        colors.push(hsvToColor([hue, 1, 1]));
    }
    return colors;
}


function loadTopicGraph(STopic) {
    // global_nodes.map(d=>Object.keys(d.topicDist).length)
    // new Set(global_nodes.map(d=>d.topic)) // 有多少个topic
    // 1. 将所有topicDist = {}的节点设置为最后一个topic
    // 2. 将所有topic总数小的节点设置为最后一个topic
    graph = {}
    graph['topic'] = STopic;
    graph['nodes'] = JSON.parse(JSON.stringify(global_nodes));
    graph['edges'] = JSON.parse(JSON.stringify(global_edges));

    if (STopic !== null) {
        graph['nodes'] = graph['nodes'].filter(d => hasTopic(d, STopic));
        global_paper_field.find(d => d.id == STopic).size = graph['nodes'].length;
        if (graph['nodes'].length == 0) {
            console.log('No node found in the selected topic', STopic);
            return;
        }

        nodeSet = new Set(graph['nodes'].map(node => node.id));
        graph['edges'] = graph['edges'].filter(edge => nodeSet.has(edge.source) && nodeSet.has(edge.target));
        edgeStrs = graph['edges'].map(edge => edge.source + '->' + edge.target); 

        let G = new Graph();
        graph['nodes'].forEach(node => {
            G.addNode(node.id, node);
        });
        graph['edges'].forEach(edge => {
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
        graph['contextEdges'] = {};
        global_edges.forEach(edge => {
            if (!edgeStrs.includes(`${edge.source}->${edge.target}`)) {
                let sourceNode = global_nodes.find(node => node.id === edge.source);
                let targetNode = global_nodes.find(node => node.id === edge.target);

                if (hasTopic(sourceNode, STopic)) {
                    let key = `${sourceNode.id}->r${targetNode.year}`;
                    if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                    graph['contextEdges'][key].push(edge);
                    G.addEdge(sourceNode.id, `r${targetNode.year}`);
                }
                if (hasTopic(targetNode, STopic)) {
                    let key = `l${sourceNode.year}->${targetNode.id}`;
                    if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                    graph['contextEdges'][key].push(edge);
                    G.addEdge(`l${sourceNode.year}`, targetNode.id);
                }
            }
        });

        graph['virtualEdges'] = [];
        let components = G.findConnectedComponents();
        components.forEach(component => {
            let node = G.findLastNodeInComponent(component);
            if (node) {
                // console.log('findLastNodeInComponent', G.nodeProperties.get(node));
                let nodeYear = G.nodeProperties.get(node).year;
                graph['virtualEdges'].push(`${node}->r${nodeYear}`);
            }
        });
    }
    
    graph['paper_field'] = [];    //该学者个人的field信息
    graph['nodes'].forEach(node => {
        let topic = parseInt(node.topic);
        let ix = graph['paper_field'].findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            graph['paper_field'].push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                color: topic2color(topic),
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            graph['paper_field'][ix].num += 1;
        }
    })

    createDot(graph);
    topic2graph[STopic] = graph
}


function topic2color(topic, sat=undefined) {
    if (topic == undefined || topic == null) {
        return hsvToColor([0, 0, 0]);
    }
    topic = parseInt(topic);
    let c = global_colors[topic];
    c = [c.h, c.s, c.v];
    // let c = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])]
    ret= sat == undefined? hsvToColor(c): hsvToColor(c, sat);
    // console.log(ret)
    return ret;
}

function showPopup(topic) {
    console.log('showPopup', topic)
    let graph = topic2graph[topic.id];
    // 创建弹窗背景
    const popupBackground = document.createElement('div');
    popupBackground.style.position = 'fixed';
    popupBackground.style.top = 0;
    popupBackground.style.left = 0;
    popupBackground.style.width = '100%';
    popupBackground.style.height = '100%';
    popupBackground.style.backgroundColor = 'rgba(0,0,0,0.5)';
    popupBackground.style.display = 'flex';
    popupBackground.style.justifyContent = 'center';
    popupBackground.style.alignItems = 'center';
    popupBackground.style.zIndex = 1000;

    // 创建弹窗
    const popup = document.createElement('div');
    // height设置为窗口高度
    let height = Math.min(window.innerHeight, Math.sqrt(graph['height']) * 500);
    let width = Math.min(window.innerWidth * 0.8, Math.sqrt(graph['width']) * 500);

    popup.style.width = width + 'px';
    popup.style.height = height + 'px';
    popup.style.backgroundColor = 'white';
    popup.style.position = 'relative';
    popup.style.padding = '0px';
    popup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    popupBackground.appendChild(popup);
        
    // 创建标题
    const title = document.createElement('h1');
    title.textContent = topic.shortName;
    title.style.fontSize = '24px';
    title.style.fontFamily = 'Archivo Narrow';
    title.style.color = 'black'
    title.style.padding = '10px';
    popup.appendChild(title);

    // 创建内容容器
    const content = document.createElement('div');
    content.setAttribute('class', 'popup');
    content.setAttribute('id', 'popup-' + topic.id);
    content.style.width = '100%';
    content.style.height = 'calc(100% - 40px)';
    content.style.overflow = 'visible';
    popup.appendChild(content);

    // 添加关闭功能
    popupBackground.addEventListener('click', function(event) {
        if (event.target === popupBackground) {
            document.body.removeChild(popupBackground);
        }
    });

    document.body.appendChild(popupBackground);

    init_graph(graph);
    bindSVGToElement(graph, 'svg', `#popup-${topic.id}`)
    draw_bbox(graph);
    draw_context(graph);
}

function drawTopicPrism() {
    const prism = document.getElementById('prism');
    const container = document.getElementById('prism-container');
    let isRotating = true;
    let lastMouseX, lastMouseY;
    let rotationAngleY = 0;
    let rotationAngleX = -20;
    let isMouseDown = false;
    let scale = 0.5;
    let highlightOpacity = 0.8;
    // prism.style.transform = `scale(${scale})`
    
    // container.style
    let height = container.offsetHeight;
    const prismWidth = container.offsetWidth;
    const style = window.getComputedStyle(container);
    let perspectiveDistance = parseFloat(style.perspective);
    prism.style.transform = `scale(${scale}) rotateX(${rotationAngleX}deg)`;

    // const topics = [
    //   { name: "Topic 1", size: 120 },
    //   { name: "Topic 2", size: 96 },
    //   { name: "Topic 3", size: 72 },
    //   { name: "Topic 4", size: 48 },
    //   { name: "Topic 5", size: 24 }
    // ];
    let topics = global_paper_field;
    const totalSize = d3.sum(topics, d => d.size);
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    let currentAngle = 0;
    const rects = [];
    const topicRanges = [];
    let rotateInterval;
    let currentIndex = -1;

    topics.forEach((topic, i) => {
        console.log('prism topic', topic)
        const topicAngle = (topic.size / totalSize) * 360;
        const startAngle = currentAngle;
        currentAngle += topicAngle / 2;
        const theta = (topic.size / totalSize) * 2 * Math.PI;
        
        const width = 2 * prismRadius * Math.sin(theta / 2);
        const distance = prismRadius * Math.cos(theta / 2);

        svgWrapper = d3.select("#prism").append("div")
            .attr("id", `svg-wrapper-${topic.id}`)
            .attr("class", "svg-wrapper")
            .style("transform", `rotateY(${currentAngle}deg) translateZ(${distance}px) translateX(${prismWidth/2}px)`);

        // height 与 svg-wrapper 的高度一致
        // const height = svgWrapper._groups[0][0].offsetHeight;

        let graph = topic2graph[topic.id];
        graph['width'] = width / 72;    // 英寸转为pt
        graph['height'] = height / 72;
        init_graph(graph);
        let svgElement = graph['svg'];
        console.log(graph);

        const svg = svgWrapper.append("svg")
            .style("overflow", "visible")
            .attr('id', `svg-${topic.id}`);

        const rect = svg.append("rect")
            .attr("x", -width / 2)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", topic2color(graph['topic'], sat=0.1))
            .attr("fill-opacity", highlightOpacity / 2)
            .on("mouseover", function() {
                d3.select(this).attr("fill-opacity", highlightOpacity);
                tip.show(topic);
            })
            .on("mouseout", function() {
                if (Math.abs(rotationAngleX) < 80 && currentIndex != i)
                    d3.select(this).attr("fill-opacity", highlightOpacity / 2);
                tip.hide();
            })
            // .on("click", function() {
            //     showPopup(topic);
            // });

        svg.append("text")
            .attr("x", 0)
            .attr("y", height / 15 - (i % 2) * height / 30)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Archivo Narrow")
            .attr("font-size", Math.sqrt(width) * 2 + "px")
            .attr("fill", "black")
            .text(topic.shortName);

        // 创建一个新的嵌套 svg 元素并设置 viewBox 和 transform
        let nestedSvg = svg.append("svg")
            .attr("x", -width / 2)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", graph['viewBox']) // 设置 viewBox
            .attr("transform", graph['transform'])
            .attr('id', `nestedSvg-${topic.id}`);; // 设置 transform

        // 将 svgElement 的子元素移动到嵌套的 svg 元素中
        d3.select(svgElement).selectAll('*').filter(function() {
            return this.parentNode === svgElement;
        }).each(function() {
            nestedSvg.node().appendChild(this);
        });

        // Array.from(svgElement.childNodes).forEach(node => {
        //     nestedSvg.node().appendChild(node.cloneNode(true));
        // });

        currentAngle += topicAngle / 2;
        const endAngle = currentAngle;
        topicRanges.push({ startAngle, endAngle });
        rects.push(rect);
    });

    // 绘制topview弦图
    svgWrapper = d3.select("#prism").append("div")
        .attr("id", `svg-wrapper-chord`)
        .attr("class", "svg-wrapper")
        .style("transform", `rotateX(90deg) translateZ(${height/2}px) rotateZ(180deg) translate(${prismWidth/2}px, ${height/2}px)`);

    const svg = svgWrapper.append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-chord`);

    let svgElement = init_chord(true);
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        svg.node().appendChild(this);
    });


    function updateOpacity() {
        if(Math.abs(rotationAngleX) > 80) {
            rects.forEach(rect => rect.attr("fill-opacity", highlightOpacity));
            currentIndex = -1;
            return;
        } else {
            if (currentIndex == -1)
                rects.forEach(rect => rect.attr("fill-opacity", highlightOpacity / 2));
        }

        const activeAngle = (720 - rotationAngleY) % 360;
        let newIndex = -1;
        for (let i = 0; i < topicRanges.length; i++) {
            const { startAngle, endAngle } = topicRanges[i];
            if (startAngle <= activeAngle && activeAngle < endAngle) {
            newIndex = i;
            break;
            }
        }

        if (newIndex !== currentIndex) {
            highlight_arc(newIndex);

            if (currentIndex !== -1) {
                rects[currentIndex].attr("fill-opacity", highlightOpacity / 2);
            }
            if (newIndex !== -1) {
                rects[newIndex].attr("fill-opacity", highlightOpacity);
            }
            currentIndex = newIndex;
            // console.log(`Current index: ${currentIndex}`);
        }
    }

    function startRotation() {
        rotateInterval = setInterval(() => {
          rotationAngleY -= 0.3; // 控制旋转速度
          if(rotationAngleY <= 0) rotationAngleY += 360;
          prism.style.transform = `scale(${scale}) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`; // 保持缩小状态
          updateOpacity()
        }, 1000 / 30); // 每秒60帧
      }
  
      function stopRotation() {
        clearInterval(rotateInterval);
      }
  
      document.getElementById('toggle-rotation').addEventListener('click', function() {
        isRotating = !isRotating;
        this.textContent = isRotating ? 'Stop Rotating' : 'Start Rotating';
        if (isRotating) {
          startRotation();
        } else {
          stopRotation();
        }
      });

    document.getElementById('show-detail').addEventListener('click', function() {
        const topic = topics[currentIndex];
        if (topic) {
            showPopup(topic);
        }
    });

    container.addEventListener('mousedown', function(event) {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', function() {
            document.removeEventListener('mousemove', mouseMoveHandler);
        });
    });

    function mouseMoveHandler(event) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        rotationAngleY += deltaX / 5;
        rotationAngleX -= deltaY / 5;
        rotationAngleX = Math.max(-90, Math.min(90, rotationAngleX));
        requestAnimationFrame(() => {
            prism.style.transform = `scale(${scale}) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
            updateOpacity()
        });
    }

    container.addEventListener('wheel', function(event) {
      perspectiveDistance += event.deltaY * 2;
      container.style.perspective = `${perspectiveDistance}px`;
    });


    startRotation(); // 初始化时开始旋转
}

function loadAndRender() {

    if (visType==9) {
        $("#mainsvg").hide();
        $("#originsvg").hide();
        $("#TopicPrism").show();

        drawTopicPrism();
    } else {
        $("#mainsvg").show();
        $("#originsvg").hide();
        $("#TopicPrism").hide();

        let graph = topic2graph[STopic];
        console.log('current graph:', graph);
        
        init_graph(graph);
        bindSVGToElement(graph, 'svgElement', "#originsvg");
        bindSVGToElement(graph, 'svg', "#mainsvg");
        if (graph['topic'] != null) {
            console.log('context', graph)
            draw_bbox(graph);
            draw_context(graph);
        }
    }
    
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
    if (STopic !== null && STopic != topic_id) {
        d3.select(`#rect_${STopic}`)
            .attr("fill-opacity", 1)
            .style("stroke", "black");
        d3.select(`#text_${STopic}`)
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
    if (STopic !== null) {
        d3.select(`#rect_${STopic}`)
            .attr("fill-opacity", 1)
            .style("stroke", "black");
        d3.select(`#text_${STopic}`)
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
    d3.selectAll(".bar")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.bar_${topic_id}`)
        .style("opacity", 0.7);

    // $("#mainsvg").attr("style", "background-color: #FAFAFA;");
    // 在 Stopic 面上展示所有highlight 的 edge
    if (STopic != null) {
        Object.entries(topic2graph[STopic]['combinedContextEdges']).forEach(([key, value]) => {
            if (Object.keys(value.topics).includes(topic_id)) {
                mouseoverEdge(key, width=value.topics[topic_id] * context_edge_weight, color=topic2color(topic_id));
            }
        })
    }
    
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

        
    // $("#mainsvg").attr("style", "background-color: white;");
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

function find_child_nodes(id, graph) { 
    var ids = [];
    for (let i = 0; i < graph['edges'].length; i++) {
        if (id == graph['edges'][i].source) {
            ids.push(graph['edges'][i].target);
        }
    }
    return ids;

}

function find_parent_nodes(id, graph) {
    var ids = [];
    for (let i = 0; i < graph['edges'].length; i++) {
        if (id == graph['edges'][i].target) {
            ids.push(graph['edges'][i].source);
        }
    }
    return ids;
}

function get_extend_ids(id, graph) {
    var parent_ids = [];
    var new_parent_ids = [id];
    while (new_parent_ids.length != parent_ids.length) {
        parent_ids = new_parent_ids;
        for (let i = 0; i < parent_ids.length; i++) {
            new_parent_ids = new_parent_ids.concat(find_parent_nodes(parent_ids[i], graph));
        }
        new_parent_ids = Array.from(new Set(new_parent_ids));
    }
    var child_ids = [];
    var new_child_ids = [id];
    while (new_child_ids.length != child_ids.length) {
        child_ids = new_child_ids;
        for (let i = 0; i < child_ids.length; i++) {
            new_child_ids = new_child_ids.concat(find_child_nodes(child_ids[i], graph));
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
}

function highlight_node(id, draw_hypertree=true, show_node_info=true) {   // 输入：当前node的 id
    // if (image_switch == 0)  return;
    if (visType == 7) return;
    reset_node();
    center_node = id;
    highlighted = [id];
    // 仅仅显示当前所选topic的extend_ids
    extend_ids = get_extend_ids(id, topic2graph[STopic]);

    if (draw_hypertree) draw_hyper_tree(id);
    
    d3.selectAll('.link').style('opacity', 0);
    d3.selectAll(`.link_${id}`).style('opacity', 1);
    
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
        let ns = global_nodes;
        for (let i = 0; i < ns.length; i++) {
            if (global_nodes[i].id == id) {
                $('#paper-id').text(ns[i].id);
                $('#paper-name').text(ns[i].name);
                $('#paper-year').text(ns[i].year);
                $('#paper-citation').text(ns[i].citationCount);
                if (ns[i].citationCount == '-1') {
                    $('#paper-citation').text("Not available");
                }
                $('#paper-authors').text(ns[i].authors);
                $('#paper-prob').text((parseFloat(ns[i].isKeyPaper)).toFixed(2));
                $('#paper-venue').text(ns[i].venu);

                let topic = parseInt(ns[i].topic);
                topic = fieldLevelVal == 1 ? parseInt(fields[topic][8]) : topic;
                $('#paper-field').text(fields[topic][2].split('_').join(', '));
                $('#abstract').text(ns[i].abstract);
            }
        }
    }
}

function reset_node(reset_info=false) {
    console.log('reset_node called')

    d3.selectAll('.bar')
        .style('opacity', 0.7)
        .style("stroke", "none");
        
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

    var maxNum = d3.max(global_paper_field, d => d.num);
    var topic_r = (4 / Math.sqrt(maxNum)).toFixed(2);
    if (topic_r > 2) {
        topic_r = 2;
    }
    $("#topic-label").text(topic_r);
    $("#topic-slider").val(topic_r);

    var xScale = d3.scaleLinear()
        .domain([d3.min(global_paper_field, d => d.x), d3.max(global_paper_field, d => d.x)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(global_paper_field, d => d.y), d3.max(global_paper_field, d => d.y)])
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
    
    if (global_paper_field.length == 0) {
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

    // g.selectAll('.edge-path').style('stroke', 'black').style('opacity', virtualOpacity);
    // g.select('#' + selectorById(id))
    //     .style('stroke', 'red')
    //     .style('fill', 'red')
    //     .style('opacity', 1);
    
    $("#paper-list, #selector, #node-info, #node-info-blank, #up-line, #down-line").hide();
    $("#edge-info").show();
    
    if (show_edge_info) {
        //更新edge-info中的内容
        let ns = global_nodes, es = global_edges;
        for (var i = 0; i < ns.length; i++) {
            if (ns[i].id == source) {
                $('#source-paper').text(ns[i].name);
                $('#source-paper-year').text(ns[i].year);
                $('#source-paper-venu').text(ns[i].venu);
                $('#source-paper-citation').text(ns[i].citationCount);
            }
            if (ns[i].id == target) {
                $('#target-paper').text(ns[i].name);
                $('#target-paper-year').text(ns[i].year);
                $('#target-paper-venu').text(ns[i].venu);
                $('#target-paper-citation').text(ns[i].citationCount);
            }
        }
        for (var i = 0; i < es.length; i++) {
            if (es[i].source == source && es[i].target == target) {
                $('#citation-context').text(es[i].citation_context);
                $('#extend-prob').text(String(es[i].extends_prob));
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


function updateVisType() {
    visType = $("#vis-type").val();
    loadAndRender();
}


function downloadSVGElement(elementId) {
    // 获取 SVG 元素
    const svgElement = document.getElementById(elementId);

    // 确保元素存在
    if (svgElement) {
        // 将 SVG 元素序列化为字符串
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgElement);

        // 创建 Blob 对象
        const svgBlob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n' + source], { type: 'image/svg+xml;charset=utf-8' });

        // 创建 URL 对象
        const url = URL.createObjectURL(svgBlob);

        // 创建临时下载链接
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = elementId + '.svg';

        // 触发下载
        document.body.appendChild(downloadLink);
        downloadLink.click();

        // 清理临时链接和 URL 对象
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    } else {
        console.error(`SVG element with id "${elementId}" not found.`);
    }
}