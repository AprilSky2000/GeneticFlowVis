window.onload = checkScreenSize;

// global variable (selectedTopic == null)
let global_graph, global_params, global_years, global_nodes, 
    global_edges, global_polygon, global_paper_field;

// subgraph variable (global / subgraph, the graph to render)
let graph, params, years, nodes, edges, polygon, paper_field;

// current variable (for hyperbolic transformation)
let current_graph;

let viz, config, visType, authorData;
let g, gf;  // maingroup, fixedgroup(right, fix-x)
let selectedTopic = null;
let tagCloudRatio = 0.2;
let adjacent_ids = [];
let extend_ids = [];
let center_node = null;
let paperID2topic = {};
let forceChart = null;
let label2color, topic2color;
let coverage=5, focus=0.5;
let isMouseDown = false; // 跟踪鼠标是否被按下
let lastMouseX, lastMouseY; // 上一个鼠标X坐标
let y_focus = 0.5;
let enable_y_focus = false;
let highlighted = [];
let topicTransitionMatrix = {};
let arrangement = [];
let originalCost, bestCost;


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

    // 监听滑块值的变化
    rangeSlider.noUiSlider.on("update", function (values, handle) {
        const min = Math.round(values[0]);
        const max = Math.round(values[1]);
        rangeLabel.textContent = `${min}-${max}`;

        d3.selectAll(".topic-map")
        .transition()
        .duration(300)
        .attr("opacity", d => {
            if (d.num >= min && d.num <= max) return 1;
            return 0;
        })
        .attr("pointer-events", d => {
            if (d.num >= min && d.num <= max) return "all";
            return "none";
        });
        
        // update_fields();
        // filter paper filed with num between min and max
        
        draw_tag_cloud(min, max);
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
        d3.select('#mainsvg').transition().duration(500).call(zoom.scaleBy, 1.1);
    });
    $("#zoom-out").click(function() {
        d3.select('#mainsvg').transition().duration(500).call(zoom.scaleBy, 0.9);
    });
    $("#restore").click(function() {
        reset_graph();
    });

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

    document.getElementById('toggle-fisheye').onchange = function() {
        if(this.checked) {
            var fisheye = d3.fisheye.circular()
                .radius(200)
                .distortion(2);

            d3.select('#mainsvg').on("mousemove", function() {
                fisheye.focus(d3.mouse(this));
                
                fisheye.focus(d3.mouse(this));

                var papers = d3.selectAll('.paper');
                if (papers.empty()) return;

                papers.each(function(d) {
                    // if (!d) return;
                    d.fisheye = fisheye(d);
                })
                .attr("cx", function(d) { return d.fisheye.x; })
                .attr("cy", function(d) { return d.fisheye.y; })
                .attr("r", function(d) { return d.fisheye.z * 4.5; });

                var references = d3.selectAll('.reference');
                if (references.empty()) return;

                // references.each(function(d) {
                //     // if (!d.source || !d.target) return;
                //     d.source.fisheye = fisheye(d.source);
                //     d.target.fisheye = fisheye(d.target);
                // })
                // .attr("x1", function(d) { return d.source.fisheye.x; })
                // .attr("y1", function(d) { return d.source.fisheye.y; })
                // .attr("x2", function(d) { return d.target.fisheye.x; })
                // .attr("y2", function(d) { return d.target.fisheye.y; });
            });
        } else {
            d3.select('#mainsvg').on("mousemove", null);
            reset_graph();
        }
    };
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
    d3.select("#topic-map-svg").remove();

    $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
    
    const windowHeight = $(window).height();
    const navigationHeight = $('.navigation').toArray().reduce(function(sum, element) {
        return sum + $(element).outerHeight();
    }, 0);
    mainPanalHeight = Math.max(windowHeight - navigationHeight, 600);
    mainPanalWidth = $('.main-panel').width();
    virtualOpacity = 0.05;

    $('.main-panel').css('max-height', mainPanalHeight);
    $('.right-column').css('max-height', mainPanalHeight);
    mainPanalHeight *= 0.95
    $('#mainsvg').css('height', mainPanalHeight * 0.8);
    $('#tagcloud').css('height', mainPanalHeight * 0.2);
    
    update_nodes();
    init_graph(graph);
    update_fields();

    if (nodes.length > 0) {
        draw_tag_cloud();
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
        var color = hsvToHex(nodes[i].color[0], 0.7, nodes[i].color[2]);
        var nodeId = nodes[i].id;
        var citationCount = nodes[i].citationCount;
        if (nodes[i].citationCount == '-1') {
            citationCount = "not available";
        }
        var content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></i>
        </div>
        <div style="margin-left: 5%; margin-right: 3%; padding: 3%; margin-top: -3%; border-radius: 5px"; class="paperNode" onmouseover="highlight_node('${nodeId}')" onmouseleave="reset_node()">
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
    let svgWidth = $(".middle-column").width();
    let svgHeight = mainPanalHeight * tagCloudRatio;
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
        // let width = size * shortName.length * 0.5;
        let width = textSize(shortName, size).width * 1.06;
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
            rgb: hsvToRgb(d.color[0], d.color[1], d.color[2]),
            color: d.color,
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

function draw_tag_cloud(min=0, max=Infinity) {
    d3.select("#tagcloud").selectAll("*").remove();
    let svg = d3.select("#tagcloud").append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

    let paper_field_filter = global_paper_field.filter(item => item.num >= min && item.num <= max);
    const sortedData = paper_field_filter.sort((a, b) => b.num - a.num);

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
        .attr("fill", d => hsvToColor(d.color)) //rgba(15, 161, 216, ${d.opacity})
        //`rgb(${d.rgb[0]}, ${d.rgb[1]}, ${d.rgb[2]})`
        .attr("fill-opacity", 0.8)
        .on('mouseover', function(d) {highlight_field(d, this)})
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
        // .attr("dominant-baseline", "middle")  // Center the text vertically
        .attr("class", "tag-text")
        .attr("id", d => `text_${d.id}`)
        .attr("font-size", d => d.size + "px")
        .attr("fill", d => `rgb(0,0,0)`)
        .attr("pointer-events", "none");
    // .on('mouseover', function(d) {highlight_field(d, this)})
        // .on('mouseout', reset_field);
}

function init_graph(curGraph=graph) {
    [params, years, nodes, edges, polygon] = curGraph;
    [viewBox, transform] = params;

    d3.select("#mainsvg").selectAll("*").remove();
    let svg = d3.select("#mainsvg").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", viewBox);

    //获取viewBox的宽度
    let viewBoxWidth = parseFloat(viewBox.split(' ')[2]);
    let viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    let svgWidth = d3.select("#mainsvg").node().getBoundingClientRect().width;
    let svgHeight = d3.select("#mainsvg").node().getBoundingClientRect().height;
    moveDistance = Math.max(viewBoxWidth, viewBoxWidth / 2 +  svgWidth * viewBoxHeight / svgHeight / 2) * 0.98;

    let fixedXTranslation = "translate(" + moveDistance + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0

    g = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');
    gf = svg.append('g')
        .attr('transform', transform + fixedXTranslation)
        .attr('id', 'fixedgroup');

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
        gf.attr("transform", yTranslation + yScale + transform + fixedXTranslation);
    });
    svg.call(zoom);
    
    
    // if (visType!=4) {
        
    // }
    
    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);

    

    g.selectAll('circle').data(nodes).enter().append('ellipse')
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)
        .attr('rx', d => d.rx)
        .attr('ry', d => d.ry)
        .attr('fill', d => hsvToColor(d.color))
        .attr('id', d => d.id)
        .attr('class', 'paper')
        .attr('stroke', d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .attr('stroke-width', d => updateOutlineThickness(d.isKeyPaper, d.citationCount))
        .on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            tip.show(d);
        })
        .on('click', function () {
            var id = d3.select(this).attr('id');    //当前节点id
            highlight_node(id, true, true);
        })
        .on('mouseout', function (d) {
            tip.hide(d);
        });

    // if polygon != null
    if (polygon != null) {
        g.selectAll('polygon').data(polygon).enter().append('polygon')
            .attr('fill', 'black')
            .attr('stroke', 'black')
            .attr('points', d => d);
    }

    gf.selectAll('.rect3').data(years).enter().append('rect')
        .attr('x', d => d.x - 80)
        .attr('y', d => d.y - 40)
        .attr('width', 300)
        .attr('height', 80)
        .attr('fill', '#eee')

    gf.selectAll('.text3').data(years).enter().append('text')
        .attr('x', d => d.x - 20)
        .attr('y', d => d.y + 20)
        .text(d => d.label)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 50)
        .attr('class', 'text3');
    
    g.selectAll('.text1').data(nodes).enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 28)
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
    

    g.selectAll('.reference').data(edges).enter().append('path')
        .attr('fill', 'none')
        .attr('stroke', `#202020`)
        .attr('opacity', d => probToOpacity(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob))
        .attr('d', d => d.d)
        .attr('id', d => d.source + '->' + d.target)
        .attr('class', 'reference')
        .on('mouseover', function (d) {
            d3.select(this)
                .attr("stroke", "red")
                .attr("opacity", 1)
                .attr("stroke-width", 10)
                .attr('cursor', 'pointer');
        })
        .on('click', function () {
            //得到source和target的id
            let id = d3.select(this).attr('id');
            highlight_edge(id);
        })
        .on('mouseout', function () {
            d3.select(this)
                .attr("stroke", d=> highlighted.includes(d.id) || highlighted.includes(d.target) || highlighted.includes(d.source) ? "red" : "#202020")
                .attr('opacity', d => {
                    if (highlighted.length == 0)  return probToOpacity(d.extends_prob);
                    if (highlighted.includes(d.id) || highlighted.includes(d.target) || highlighted.includes(d.source))  return 1;
                    if (extend_ids.includes(d.source) & extend_ids.includes(d.target)) return probToOpacity(d.extends_prob);
                    return virtualOpacity;
                })
                .attr("stroke-width", d => probToWidth(d.extends_prob))
                
        });

    if (selectedTopic != null) {
        draw_background();
    }
}


function draw_background() {
    
    // 在当前有选择单个topic时，绘制背景，包括：
    // 1. 当前 g 元素的外框
    // 2. 在当前g元素按照 arrangement 的顺序绘制其他话题的节点
    // 3. 连接当前话题与其他话题的边
    
    let { processedNodes, processedEdges } = processData(global_nodes, global_edges);
    console.log('processedNodes', processedNodes, 'processedEdges', processedEdges);

    // 绘制g元素的外框
    let bbox = g.node().getBBox();
    let padding = 20;
    let rect = g.insert('rect', ':first-child')
        .attr('x', bbox.x - padding)
        .attr('y', bbox.y - padding)
        .attr('width', bbox.width + 2 * padding)
        .attr('height', bbox.height + 2 * padding)
        .attr('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 2)
        .attr('id', 'background');

    let DISTANCE = 100;
    // 根据arrangement顺序，计算processedNodes中每个节点的坐标：
    // 横坐标是 bbox.x - padding - DISTANCE * arrangement差值（在选择话题左边），bbox.x + bbox.width + padding + DISTANCE * arrangement差值（在选择话题右边）
    // 纵坐标与内部节点的 y 一致
    let selectedIndex = arrangement.indexOf(String(selectedTopic));
    // 遍历processedNodes对象的 k, v
    var pie = d3.pie().value(1);
    let topicString={};


    for (let [k, v] of Object.entries(processedNodes)) {
        let [year, topic] = k.split('_');
        if (topic == selectedTopic) continue;

        let currentIndex = arrangement.indexOf(topic);
        v.y = v[0].y;
        if (currentIndex < selectedIndex) {
            v.x = bbox.x - padding - DISTANCE * (selectedIndex - currentIndex);
        }
        else if (currentIndex > selectedIndex) {
            v.x = bbox.x + bbox.width + padding + DISTANCE * (currentIndex - selectedIndex);
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
                minY: Math.min(topicString[topic].minY, v.y),
                maxY: Math.max(topicString[topic].maxY, v.y),
                name: field_leaves[topic][2]
            };
        }
    }

    console.log('topicString', topicString);
    // 根据topicString，绘制一条线连接话题头尾

    for (let [k, v] of Object.entries(topicString)) {
        // console.log('k', k, 'v', v, topic2color[parseInt(k)]);
        g.append('path')
            .attr('d', `M ${v.x} ${v.minY} L ${v.x} ${v.maxY}`)
            .attr('stroke-width', 4)
            .attr('stroke', hsvToColor(topic2color[parseInt(k)], sat=1))
            .attr('class', "topic-string topic-string_" + k)
            .on("mouseover", function() {
                d3.select(this).attr('cursor', 'pointer')
                .attr('stroke', 'red');
                tip.show(v);
            })
            .on("mouseout", function() {
                d3.select(this).attr('cursor', 'default')
                .attr('stroke', hsvToColor(topic2color[parseInt(k)], sat=1));
                tip.hide(v);
            })
    }
    
    for (let [k, v] of Object.entries(processedNodes)) {
        var arc = d3.arc()
            .innerRadius(0) // for a pie chart, inner radius is 0
            .outerRadius(Math.sqrt(v.length)*20);
        // 根据pieData绘制饼状图
        let pieData = pie(v);
        // console.log('pieData', pieData, x, y);
        
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
            .attr("fill", d => {
                let c = hsvToColor(topic2color[d.data.topic], sat=d.data.citationCount < 50? 0.4: 
                    (d.data.citationCount < 100? 0.7: 1));
                // console.log('d', d, c);
                return c 
            })
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer')
                .attr('stroke', 'black');
                tip.show(d.data);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default')
                .attr('stroke', 'none');
                tip.hide(d.data);
            })
            .on("click", function(d) {
                console.log(d.data.id);
                highlight_node(d.data.id, true, true);
            });
    }

    
    // 绘制边
    let node_data = {}
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

    let edge_data = [];
    console.log('processedEdges', processedEdges, Object.entries(processedEdges))
    for (let [k, v] of Object.entries(processedEdges)) {
        console.log('k', k, 'v', v);
        if (k[0] == '_') {
            let target = k.substring(1);
            v.forEach(d => {
                edge_data.push({
                    source: d.source,
                    target: target,
                    topic: paperID2topic[d.source],
                    edge: d,
                    name: d.source + '->' +  d.target
                });
            })
        } else {
            // k 去掉最后一个字母
            let source = k.substring(0, k.length - 1);
            v.forEach(d => {
                edge_data.push({
                    source: source,
                    target: d.target,
                    topic: source.split('_')[1],
                    edge: d,
                    name: d.source + '->' + d.target
                });
            })
        }
    }
    console.log('fbundling: node_data', node_data, 'edge_data', edge_data);
    var fbundling = d3.ForceEdgeBundling()
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
        let c = topic2color[String(edge.topic)]

        let opacity = 1;
        g.append("path")
            .attr("d", d3line(data))
            .style("stroke",  c !== undefined? hsvToHex(c[0], 0.7, c[2]): "#999")
            .attr("class", "link link_" + edge.topic)
            .style("fill", "none")
            .style('stroke-opacity',opacity) //use opacity as blending
            .style("stroke-width", 2)
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer')
                .style('stroke-opacity',1)
                tip.show(edge);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default')
                .style('stroke-opacity',opacity)
                tip.hide(edge);
            })
            .on("click", function(d) {
                // console.log(edge);
                highlight_edge(edge.name);
            });
    });
}


function update_nodes() {
    let fieldLevelVal = $("#field-level").val();
    label2color = field_roots.map(d => (d[0], [parseFloat(d[5]), parseInt(d[6]), parseInt(d[7])]));
    topic2color = field_leaves.map(d => (d[0], [parseFloat(d[5]), parseInt(d[6]), parseInt(d[7])]));

    for (let i = 0; i < nodes.length; i++) {
        // fields为当前是顶层field还是底层field，topic为当前论文在1层/2层情况下对应的topicID
        let topic = parseInt(nodes[i].topic);
        // console.log(topic);
        let fields = field_leaves;
        let label = parseInt(field_leaves[topic][8]);
        if (fieldLevelVal == 1) {
            topic = parseInt(field_leaves[topic][8]);
            fields = field_roots;
        }

        // console.log('topic', fields[topic], fields.length, topic, nodes[i])
        if (fields[topic] == undefined) {
            console.log('topic > fields.length !!!')
        }

        // 根据当前为1层/2层给节点赋上不同的颜色
        nodes[i].color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
        paperID2topic[nodes[i].id] = topic;
    }
    // sort nodes by citationCount
    nodes.sort((a, b) =>  b.citationCount - a.citationCount);
}

function update_fields() {
    paper_field = [];    //该学者个人的field信息
    let fields = field_leaves;
    for (let i = 0; i < nodes.length; i++) {
        // 判断该论文节点的topic是叶子层还是顶层
        let topic = parseInt(nodes[i].topic);
        // console.log(topic);
        // 统计该学者的topic信息，如果已经统计(纳入了paper_field)，num++
        for (var j = 0; j < paper_field.length; j++) {
            if (topic == paper_field[j].id) {
                paper_field[j].num += 1;
                break;
            }
        }
        // 如果没有统计，在paper_field中新建k-v
        if (j == paper_field.length) {
            let dic = {};
            dic.id = topic;
            dic.num = 1;
            dic.name = fields[topic][2];
            dic.color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
            dic.x = parseFloat(fields[topic][3]);
            dic.y = parseFloat(fields[topic][4]);
            dic.label = parseInt(fields[topic][8]);
            paper_field.push(dic);
        }
    }
    paper_field.sort(op('num'));
    paper_field.sort(op('label'));

    console.log('paper_field', paper_field)

    // 处理左侧柱状图
    gf.selectAll('.year-topic').remove();
    // 因为需要统计各个年份的各个field的分布，是一个二维向量，要绘制柱状图只能在每年的时候将field柱状分布图画出来，所以没有放到visual_topic函数里
    for (let i = 0; i < years.length; i++) {
        var year_field = [];    //该学者每一年的field信息
        //初始化每一年的field信息：将paper_field中的所有field移到当前年份，并置num=0
        for (let j = 0; j < paper_field.length; j++) {
            let dic = {};
            dic.id = paper_field[j].id;
            dic.name = paper_field[j].name.split(':')[0];
            dic.num = 0;
            dic.color = paper_field[j].color;
            year_field.push(dic);
        }
        //如果是该年发表的论文，将它的topic和该年的field匹配，匹配上的field数量++
        for (let j = 0; j < nodes.length; j++) {
            if (nodes[j].year == years[i].id) {
                let topic = parseInt(nodes[j].topic);
                for (let k = 0; k < year_field.length; k++) {
                    if (topic == year_field[k].id) {
                        year_field[k].num += 1;
                        break;
                    }
                }
            }
        }
        var x = years[i].x;
        var y = years[i].y;
        for (let j = 0; j < year_field.length; j++) {
            year_field[j].name += ': ' + year_field[j].num;
            year_field[j].x = x;
            year_field[j].y = y;
            x -= year_field[j].num * 40;
            year_field[j].yearTopicId = String(years[i].id) + String(year_field[j].id);
        }

        gf.selectAll('circle').data(year_field).enter().append('rect')
            .attr('x', d => d.x - d.num * 40 - 80)
            .attr('y', d => d.y - 25)
            .attr('width', d => d.num * 40)
            .attr('height', 50)
            .attr('fill', d => hsvToColor(d.color))
            .attr('class', 'year-topic')
            .attr('id', d => d.id)
            .attr('yearTopicId', d => d.yearTopicId);
    }

    gf.selectAll('.year-topic')
        .on('mouseover', function(d) {highlight_field(d, this)})
        .on('mouseout', reset_field);

    if (selectedTopic == null) {
        global_paper_field = paper_field;
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

function renderDot(viz, dot, filteredNodes, filteredEdges) {
    let result = removeNewlinesAndAdjust(viz.renderString(dot)).replaceAll(' -> ', '->');
    console.log('viz result', result);
    // 解析节点和边
    let id2attr = {};
    let lines = result.split(';');
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    lines.forEach(line => {
        if (line.includes('pos=')) {
            const id = line.match(/(\S+)\s*\[/)[1];
            const pos = line.match(/pos="([^"]+)"/)[1];

            if (line.includes('->')) { // 处理边
                let points = convertToPointsArray(pos);
                id2attr[id] = generateD3Path(points, true); // 用d3或其他方法生成平滑路径
                // console.log('line', pos, id,id2attr[id] )
            } else { // 处理节点
                let label = line.match(/label=([^,]+)/)[1].replace(/"/g, '');
                let [x, y] = pos.split(',').map(Number);
                y = -y;
                const width = parseFloat(line.match(/width=([^,]+)/)[1]);
                const height = parseFloat(line.match(/height=([^,]+)/)[1]);
                id2attr[id] = { x: x, y: y, rx: width, ry: height, label:label };
                
                // console.log(id,id2attr[id] )
                // 更新边界值
                minX = Math.min(minX, x - width);
                maxX = Math.max(maxX, x + width);
                minY = Math.min(minY, y - height);
                maxY = Math.max(maxY, y + height);
            }
        }
    });
    viewBox = `0 0 ${maxX - minX} ${maxY - minY}`;
    transform = `translate(${-minX}, ${-minY})`;
    // transform = `translate(0, 0)`;
    
    // console.log('id2attr', id2attr)
    // 遍历 id2attr，生成最终的节点和边
    let years = [];
    for (let id in id2attr) {
        if (id.startsWith('year') && !id.includes('->')) {
            years.push({ id: id2attr[id].label, ...id2attr[id] });
        }
    }

    filteredNodes.forEach(node => {
        node.x = id2attr[node.id].x;
        node.y = id2attr[node.id].y;
        node.rx = id2attr[node.id].rx * 40;
        node.ry = id2attr[node.id].ry * 40;
        node.label = id2attr[node.id].label;
    });
    filteredEdges.forEach(edge => {
        edge.d = id2attr[edge.source + '->' + edge.target];
    });

    
    console.log('filtered:', JSON.parse(JSON.stringify([filteredNodes, filteredEdges])));
    
    params = [viewBox, transform]
    graph = [params, years, filteredNodes, filteredEdges, null];
    [params, years, nodes, edges, polygon] = graph;
    
    if (selectedTopic == null) {
        global_graph = JSON.parse(JSON.stringify(graph));
        [global_params, global_years, global_nodes, global_edges, global_polygon] = global_graph;
    }
    
    onFullscreenChange();

}

function loadAndRender() {
    let filteredNodes = authorData['nodes'].filter(d => d.isKeyPaper >= nodeSlider.noUiSlider.get());
    let filteredEdges = authorData['edges'].filter(d => d.extends_prob >= edgeSlider.noUiSlider.get());
    
    if (selectedTopic) {
        filteredNodes = filteredNodes.filter(d => hasTopic(d, selectedTopic));
    }

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
    
    let edgeCount = 0;
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
    if (selectedTopic !== null) {
        // 如果有选择话题，那么只需要节点在 global_nodes 即可，不需要判断 modeValue
        filteredNodes = filteredNodes.filter(node => global_nodes.map(d => d.id).includes(node.id));
    } else {
        if (modeValue == '1') {
            // remove isolated
            filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0);
        } else if (modeValue == '2') {
            // partially remove, high citationCount papers are not removed
            filteredNodes = filteredNodes.filter(node => alldegree[node.id] > 0 || node.citationCount >= 50);
        }
    }
    filteredEdges = connectedEdges;
    
    console.log('original data:', authorData, 
        '#nodes:', authorData['nodes'].length, ln, lnr, filteredNodes.length, 
        '#edges:', authorData['edges'].length, le, filteredEdges.length,
        filteredNodes, filteredEdges);

    $('#node-num').text(`${filteredNodes.length}(rm isolated) / ${lnr}(rm survey) / ${ln}(filter) / ${authorData['nodes'].length}(all)`);
    $('#edge-num').text(`${filteredEdges.length}(rm unconnected) / ${le}(filter) / ${authorData['edges'].length}(all)`);
    
    const minYear = Math.min(...filteredNodes.map(node => node.year));
    const maxYear = Math.max(...filteredNodes.map(node => node.year));

    let dot = 'digraph G {\n';
    let yearDic = {};

    for (let year = minYear; year <= maxYear; year++) {
        dot += `year${year} [label="${year}"];\n`;
        yearDic[year] = [`year${year}`]
    }
    filteredNodes.forEach(node => {
        // const label = node.name.replace(/"/g, '\\"'); // 转义名称中的双引号
        let label = node.topic;
        dot += `${node.id} [label="${node.citationCount}"];\n`;
        // 对于每个年份，收集节点ID
        yearDic[node.year].push(node.id);
    });
    // 对每个年份的节点使用rank=same来强制它们在同一层
    for (let year of Object.keys(yearDic)) {
        dot += `{ rank=same; ${yearDic[year].join('; ')}; }\n`;
    }
    for (let year = minYear; year < maxYear; year++) {
        dot += `year${year}->year${year+1};\n`;
    }
    filteredEdges.forEach(edge => {
        dot += `${edge.source}->${edge.target};\n`;
    });

    dot += '}';
    console.log('dot', dot);

    // 使用viz.js计算布局
    // 注意：你需要在你的项目中引入viz.js库
    
    
    renderDot(viz, dot, filteredNodes, filteredEdges);
}

function getTopicList(node) {
    if (node.hasOwnProperty('topicDist')) {
        let topicList = [];
        for (let key in node.topicDist) {
            if (node.topicDist[key] >= topicSlider.noUiSlider.get())  topicList.push(key);
        }
        return topicList;
    }
    return [node.topic];
}

function hasTopic(node, topic) {
    let threshold = topicSlider.noUiSlider.get();
    if (parseInt(node.topic) == topic) return true;
    if (node.hasOwnProperty('topicDist') && node.topicDist[topic] >= threshold) return true;
    return false;
}

function highlight_tag(topic_id) {
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    d3.select(`#rect_${topic_id}`)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");
    d3.select(`#text_${topic_id}`)
        .attr('font-weight', 'bold');
}

function reset_tag() {
    // reset rect color
    highlight_topic_forceChart(-1);
    // 将所有tag都置为初始状态
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    d3.selectAll(".tag-text")
        .attr('font-weight', 'normal');
}


function highlight_field(d, that) {
    if (image_status == 1)  return;
    let duration = 200;
    let topic_id = d.id;
    tip.show(d);
    highlight_topic_forceChart(topic_id);

    // =========================tagcloud=========================
    highlight_tag(topic_id);
    d3.select(that).attr('cursor', 'pointer');

    // =========================arc & link=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", virtualOpacity)
        .attr("stroke", "none");
    d3.selectAll(`.arc_${d.id}`)
        .attr("fill-opacity", 1)

    // console.log(d.id, `.link_${d.id}`);
    d3.selectAll(".link")
        .attr("opacity", virtualOpacity);
    d3.selectAll(`.link_${d.id}`)
        .attr("opacity", 1);

    // =========================cell=========================
    d3.selectAll(".cell")
        .attr("fill", `rgb(0, 0, 255)`)
    d3.selectAll(`.cell_${d.id}`)
        .attr("fill", `rgb(255, 0, 0)`);

    d3.selectAll(".topic-string")
        .attr("opacity", virtualOpacity);
    d3.selectAll(`.topic-string_${d.id}`)
        .attr("opacity", 1);


    // =========================topic map=========================
    // 有了duration之后，如果鼠标滑动较快，则没法恢复
    d3.selectAll(".topic-map")
        .attr("fill-opacity", 0.2)
        .attr("stroke", "none");
    d3.select("#circle" + topic_id)
        // .transition()
        // .duration(duration)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");

    gf.selectAll(".year-topic")
        .attr("fill-opacity", d => {if (topic_id != d.id) return virtualOpacity;});

    var color_papers = [], color_papers_topic = [];  
    // 记录颜色不需要变化的paperID
    
    for (let i = 0; i < nodes.length; i++) {
        if (hasTopic(nodes[i], topic_id)) {
            color_papers.push(nodes[i].id);
            color_papers_topic.push(nodes[i].topic);
        }
    }
    console.log('color_papers', color_papers, color_papers_topic);


    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', d => {if (color_papers.indexOf(d.id) == -1) return virtualOpacity;})
        .attr('stroke-opacity', function(d) {
            if (color_papers.indexOf(d.id) == -1) return virtualOpacity;
        })

    g.selectAll('.reference').data(edges)
        .attr('stroke', d => 
            color_papers.indexOf(d.source) != -1 && color_papers.indexOf(d.target) != -1? "red": "#202020")
        .attr('opacity', d=> 
            color_papers.indexOf(d.source) != -1 && color_papers.indexOf(d.target) != -1? 1: virtualOpacity);

    // $("#mainsvg").attr("style", "background-color: #FAFAFA;");
}

function hsvToColor(color, sat=0.4) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], sat, color[2]) //  color[1]
}

function generateTTM() {
    topicTransitionMatrix = {};
    // 填充矩阵（因为是外部转移矩阵，不计相同话题的转移）
    edges.forEach(edge => {
        let sourceNode = nodes.find(node => node.id === edge.source);
        let targetNode = nodes.find(node => node.id === edge.target);
        let sourceTopicList = getTopicList(sourceNode);
        let targetTopicList = getTopicList(targetNode);
        // 去除相同元素，不能相继filter
        let sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        sourceTopicList.forEach(src => {
            targetTopicList.forEach(tgt => {
                if (!topicTransitionMatrix[src]) {
                    topicTransitionMatrix[src] = {};
                }
                if (!topicTransitionMatrix[src][tgt]) {
                    topicTransitionMatrix[src][tgt] = 0;
                }
                topicTransitionMatrix[src][tgt]++;
            })
        })
    });
}

function simulatedAnnealing(matrix) {
    let temperature = 100.0; // 初始温度
    const coolingRate = 0.995; // 冷却率
    const minTemperature = 1.0; // 最小温度
    let currentSolution = Object.keys(matrix); // 初始解决方案
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
            cost += (matrix[topic][innerTopic] || 0) * distance; // 假设成本与距离成正比
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
    if (image_status == 1)  return;
    reset_tag();

    // =========================arc=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", 1)
        .attr("stroke", "none");
    d3.selectAll(`.topic-string`)
        .attr("opacity", 1);
    
    // =========================topic map=========================
    tip.hide(d);

    d3.selectAll(".topic-map")
        // .transition()
        // .duration(200)
        .attr("fill-opacity", 0.6)
        .attr("stroke", `rgba(0,0,0,0.5)`);

    d3.selectAll(".cell")
        .attr("fill", `rgb(0, 0, 255)`)

    // 恢复左侧年份主题柱状图
    gf.selectAll('.rect1, .year-topic')
        .attr('fill-opacity', 1);
    //恢复节点填充色和边缘色
    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', 1)
        .attr('stroke', d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .attr('stroke-opacity', 1);
    //恢复边的颜色
    g.selectAll(".reference")
        .attr('stroke', "#202020")
        .attr('opacity', d => probToOpacity(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob));

    // $("#mainsvg").attr("style", "background-color: white;");
    gf.selectAll('.year-topic').attr('fill-opacity', 1);
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

function draw_TTM() {
    d3.select("#TTM-graph").html("");
    // 创建 SVG 画布
    const svgSize = 400;  // 画布宽度
    let margin = 30;
    const svg = d3.select("#TTM-graph")
                .append("svg")
                .attr("width", svgSize)
                .attr("height", svgSize);
    generateTTM();
    arrangement = simulatedAnnealing(topicTransitionMatrix);
    console.log('arrangement:', arrangement);

    const cellSize = (svgSize - margin * 2) / arrangement.length;
    let maxTransition = 0;
    // 根据topicTransitionMatrix计算最大转移概率
    for (let src in topicTransitionMatrix) {
        for (let tgt in topicTransitionMatrix[src]) {
            maxTransition = Math.max(maxTransition, topicTransitionMatrix[src][tgt]);
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
                .attr('fill', `rgba(0, 0, 255)`)// i === j? `gray`: `rgba(0, 0, 255)`)
                .attr('opacity', i === j? 1: (topicTransitionMatrix[src][tgt] || 0) / maxTransition)
                // .attr('stroke', 'black');
        });
    });

    // 绘制横坐标轴
    const xAxisScale = d3.scaleBand()
        .domain(arrangement.map(d => `${d}`))
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
        .attr('transform', 'rotate(-90)');
    
    
    // 添加列的拖拽交互逻辑
    xAxisGroup.selectAll('text')
        .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));
    
    let dragStartIndex;
    
    function dragStarted(event, d) {
        dragStartIndex = arrangement.indexOf(d);
    }
    
    function dragged(event, d) {
        // 拖拽过程中可以显示一些交互效果，例如高亮当前拖拽的列
    }
    
    function dragEnded(event, d) {
        const x = event.x;
        const dragEndIndex = Math.floor(x / columnWidth);
        if (dragEndIndex >= 0 && dragEndIndex < topicCount) {
            moveColumn(dragStartIndex, dragEndIndex);
            draw_TTM(); // 重新绘制整个图表以反映新的排列
        }
    }
    
    function moveColumn(from, to) {
        // 移动列，并更新全局变量arrangement
        const [removed] = arrangement.splice(from, 1);
        arrangement.splice(to, 0, removed);
        draw_TTM();
    }
}

function draw_radial_graph(centerNodeId, adjacent_ids) {
    adjacent_nodes = nodes.filter(d => adjacent_ids.indexOf(d.id) != -1);
    adjacent_edges = edges.filter(d => adjacent_ids.indexOf(d.source) != -1 && adjacent_ids.indexOf(d.target) != -1);

    console.log('highlight nodes:', adjacent_nodes)
    console.log('highlight edges:', adjacent_edges)

    // 假设 centerNodeId 是中心节点的 ID
    const width = 300;  // 画布宽度
    const height = width; // 画布高度

    d3.select("#radialgraph").html("");
    // 创建 SVG 画布
    const svg = d3.select("#radialgraph")
                .append("svg")
                .attr("width", width)
                .attr("height", height);

    // 查找中心节点
    const centerNode = nodes.find(node => node.id === centerNodeId);
    if (!centerNode) {
        throw new Error("Center node not found");
    }

    // 计算其他节点的位置
    const radiusScale = d3.scaleLinear()
        .domain(d3.extent(nodes, d => Math.abs(d.year - centerNode.year)))
        .range([width/20, width/2]); // 节点离中心的最小和最大半径

    nodes.forEach(node => {
        if (node.id !== centerNodeId) {
            const angle = Math.random() * Math.PI * 2; // 随机角度
            const radius = radiusScale(Math.abs(node.year - centerNode.year));
            node.x = width / 2 + radius * Math.cos(angle);
            node.y = height / 2 + radius * Math.sin(angle);
        } else {
            // 将中心节点固定在画布的中心
            node.x = width / 2;
            node.y = height / 2;
        }
    });

    // 设置渐变背景
    const radialGradient = svg.append("defs")
        .append("radialGradient")
        .attr("id", "radial-gradient");

    radialGradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "skyblue");

    radialGradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "white");

    // 在 SVG 中添加一个覆盖整个画布的圆，应用径向渐变
    svg.append("circle")
        .attr("cx", width / 2)
        .attr("cy", height / 2)
        .attr("r", Math.max(width, height) / 2) // 确保圆覆盖整个 SVG
        .style("fill", "url(#radial-gradient)");

    // 计算每个不同年份的半径
    const yearDifferences = new Set(nodes.map(d => Math.abs(d.year - centerNode.year)));
    const yearRadii = Array.from(yearDifferences).sort((a, b) => a - b).map(diff => radiusScale(diff));

    // 绘制同心圆
    yearRadii.forEach(radius => {
        svg.append("circle")
            .attr("cx", width / 2)
            .attr("cy", height / 2)
            .attr("r", radius)
            .style("fill", "none")
            .style("stroke", "grey")
            .style("stroke-dasharray", "2,2"); // 可以设置为虚线以提高可读性
    });

    // 创建节点
    svg.selectAll(".node")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.id === centerNodeId ? 10 : 5) // 中心节点更大
        .style("fill", d => hsvToColor(d.color, sat=0.7));

    // 创建边
    // 定义箭头标记
    svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10") // 视图框的大小和位置
        .attr("refX", 5) // 控制箭头的位置
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 10) // 箭头大小
        .attr("markerHeight", 10)
        .append("path")
        .attr("d", "M0,-5L10,0L0,5") // 箭头形状
        .attr("class", "arrowHead")
        .style("fill", "grey");

        // 创建边
    svg.selectAll(".edge")
        .data(edges)
        .enter()
        .append("line")
        .attr("class", "edge")
        .attr("x1", d => nodes.find(node => node.id === d.source).x)
        .attr("y1", d => nodes.find(node => node.id === d.source).y)
        .attr("x2", d => nodes.find(node => node.id === d.target).x)
        .attr("y2", d => nodes.find(node => node.id === d.target).y)
        .style("stroke", "grey")
        .style("stroke-width", 1)
        .attr("marker-end", "url(#arrowhead)"); // 应用箭头标记
    
}

function highlight_node(id, draw_hypertree=false, show_node_info=false) {   // 输入：当前node的 id
    // if (image_switch == 0)  return;
    reset_node();
    center_node = id;
    highlighted = [id];

    adjacent_ids = [];
    for (let i = 0; i < edges.length; i++) {
        if (id == edges[i].source) {
            adjacent_ids.push(edges[i].target);
        }
        else if (id == edges[i].target) {
        } else if (id == edges[i].target) {
            adjacent_ids.push(edges[i].source);
        }
    }
    extend_ids = get_extend_ids(id);

    if (draw_hypertree) draw_hyper_tree(id);
    
    // 改变当前节点颜色和相邻节点
    g.selectAll(".paper").data(nodes)
        .attr("fill-opacity", d => {
            if (d.id != id && extend_ids.indexOf(d.id) == -1) return virtualOpacity;
        })
        .attr("stroke-opacity", d => {
            if (d.id != id && extend_ids.indexOf(d.id) == -1) return virtualOpacity;
        });

    // 改变当前节点与其相邻节点间线的颜色为红色
    d3.selectAll('.reference')
        .attr('stroke', d => {
            if (highlighted.includes(d.target) || highlighted.includes(d.source))   return 'red';
            return "#202020";
        })
        .attr('opacity', d => {
            if (extend_ids.includes(d.source) & extend_ids.includes(d.target)) return probToOpacity(d.extends_prob);
            return virtualOpacity;
        });

    // 将当前节点及其邻接点所对应year的topic显示出来
    let extend_year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (extend_ids.indexOf(nodes[i].id) != -1) {
            extend_year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
        }
    }

    adjacent_ids.push(id);
    year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (adjacent_ids.indexOf(nodes[i].id) != -1) {
            year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
        }
    }
    g.selectAll(".year-topic")
        .attr("fill-opacity", d => {
            if (year_topics.indexOf(d.yearTopicId) != -1) return 1
            if (extend_year_topics.indexOf(d.yearTopicId) != -1) return 0.5
            return virtualOpacity;
        });

    if (show_node_info) {
        $("#paper-list, #up-line, #down-line, #edge-info").hide();
        $("#selector, #node-info, #node-info-blank").show();

        // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });
        $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

        //更新node-info里的内容
        let fieldLevelVal = $("#field-level").val();
        let fields = fieldLevelVal == 1 ? field_roots : field_leaves;
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id == id) {
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
                topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
                $('#paper-field').text(fields[topic][2].split('_').join(', '));
                $('#abstract').text(nodes[i].abstract);
            }
        }
    }
}

function reset_node(reset_info=false) {
    // if (image_switch == 0)  return;

    d3.selectAll('.year-topic').attr('fill-opacity', 1);
    g.selectAll('.paper').data(nodes)
        .attr('fill-opacity', 1)
        .attr('stroke-opacity', 1);
    d3.selectAll('.reference')
        .attr('stroke', "#202020")
        .attr('opacity', d => probToOpacity(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob));
    d3.selectAll('.link')
        .attr("stroke-opacity", 0.15)
        .attr("opacity", 1)
    
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

    // let topic_width = $("#topic-map-graph").width();
    let topic_width = mainPanalWidth * 0.18;
    let topic_height = topic_width - $("#topic-map-banner").height();
    const topic_margin1 = 35;
    const topic_margin2 = 20;

    d3.select("#topic-map-svg").remove();

    // set the ranges of rangeSlider
    var minNum = d3.min(paper_field, d => d.num);
    var maxNum = d3.max(paper_field, d => d.num);
    
    rangeSlider.noUiSlider.updateOptions({
        range: {
            'min': minNum,
            'max': maxNum+1 // 'range' 'min' and 'max' cannot be equal.
        }
    });
    // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
    rangeSlider.noUiSlider.set([minNum, maxNum+1]);

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
        .attr("fill", d => hsvToColor(d.color))
        .attr("stroke", `rgba(0, 0, 0, 0.2)`)
        .attr("stroke-width", 0.5)
        // .attr("filter", "url(#f1)")
        .attr('fill-opacity', 0.6)
        .attr("id", d => 'circle' + d.id)
        .attr("class", "topic-map");

    topics
    .on('mouseover', function(d) {highlight_field(d, this)})
    .on('mouseout', reset_field);
    
    if (paper_field.length == 0) {
        $("#topic-slider").hide();
    }

}

function probToOpacity(prob, a=0, b=0.8) {
    // 将透明度从[0.3, 0.8]映射到 [a, b] 范围
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    return a + (b - a) * opacity;
}

function probToWidth(prob, a=0.5, b=5) {
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    let ret = a + opacity * (b - a);
    return visType == 4? ret * 0.5 : ret;
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
    for (let i = 0; i < field_leaves.length; i++) {
        topic2catagory[i] = field_leaves[i][8];
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

function create_evolution_slider(graph) {
    // 定义最小年份和最大年份
    let minYear = graph.nodes.map(node => node.year).reduce((a, b) => Math.min(a, b));
    let maxYear = graph.nodes.map(node => node.year).reduce((a, b) => Math.max(a, b));

    let sliderContainer = d3.select("#mainsvg").append("div")
        .style("width", "60%")
        .style("height", (mainPanalHeight * 0.03) + "px")
        .style("display", "absolute")
        .style("align-items", "center") // 垂直居中
        .attr("id", "sliderContainer");
    // 创建滑块
    sliderContainer.append("input")
        .attr("type", "range")
        .attr("id", "yearSlider")
        .attr("min", minYear)
        .attr("max", maxYear)
        .attr("step", "1")
        .attr("value", maxYear)
        .style("width", "85%"); // 调整宽度以留出空间给播放按钮和刻度标签

    // 创建播放按钮
    sliderContainer.append("button")
        .attr("id", "playButton")
        .text("play")
        .style("margin-left", "10px"); // 添加一些左边距

    // 创建刻度标签
    sliderContainer.append("div")
        .attr("id", "sliderLabel")
        .text(minYear)
        .style("display", "inline-block")
        .style("margin-left", "10px"); // 添加一些左边距

    // 播放逻辑
    let playInterval;
    document.getElementById('playButton').addEventListener('click', function() {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            this.textContent = 'play';
        } else {
            let currentYear = minYear;
            this.textContent = 'pause';
            playInterval = setInterval(() => {
                if (currentYear > maxYear) {
                    clearInterval(playInterval);
                    playInterval = null;
                    document.getElementById('playButton').textContent = 'play';
                    return;
                }
                updateSlider(currentYear);
                currentYear++;
            }, 300);
        }
    });

    // 更新滑块和刻度标签的函数
    function updateSlider(year) {
        document.getElementById('yearSlider').value = year;
        document.getElementById('sliderLabel').innerText = year;
        updateChart(graph, year); // 确保您已经定义了 updateChart 函数
    }

    // 初始化滑块的事件监听器
    document.getElementById('yearSlider').addEventListener('input', function() {
        updateSlider(this.value);
    });
}

function force_layout(evolution=false) {
    // var chartDom = document.getElementById('main');
    d3.select("#mainsvg").selectAll("*").remove();

    forceChart = echarts.init(document.getElementById('mainsvg'), null, {
        renderer: 'canvas',
        useDirtyRect: false
    });

    let graph = get_graph();
    console.log('graph', graph)

    if (evolution) create_evolution_slider(graph); 

    let option = {
        title: {
        text: 'Self Extension Network',
        top: 'bottom',
        left: 'right'
        },
        tooltip: {},
        legend: [
        {
            // selectedMode: 'single',
            data: graph.categories.map(function (a) {
                return { name: a.name };
            })
        }
        ],
        color: graph.categories.map(a=> a.color),
        series: [
        {
            name: 'Self Extension Network',
            type: 'graph',
            layout: 'force',
            data: graph.nodes.map(node => {
                // 设置每个节点的颜色为其类别的颜色
                return {
                    ...node,
                    itemStyle: {
                        color: graph.categories[node.category].color
                    }
                };
            }),
            links: graph.links,
            categories: graph.categories,
            draggable: true,
            roam: true,
            label: {
                position: 'right'
            },
            force: {
                repulsion: 100
            },
            // 修改边的样式使其成为有向图
            edgeSymbol: ['circle', 'arrow'],
            edgeSymbolSize: [0, 6],
            lineStyle: {
                curveness: 0.1
            },

            // 设置节点和边的点击事件
            emphasis: {
                focus: 'adjaceny',
                lineStyle: {
                    width: 6
                }
            }
        }
        ]
    };
    // 设置点击事件监听器
    forceChart.on('click', function (params) {
        console.log('click forceChart')
        if (params.dataType === 'node') {
            // console.log('click node', params.data.id)
            highlight_node(params.data.id, true, true);
        } else if (params.dataType === 'edge') {
            highlight_edge(params.data.source + '->' + params.data.target);
        } 
    });

    forceChart.setOption(option);
    draw_tag_cloud();
}

// 自定义函数，高亮显示特定topic的节点和边
function highlight_topic_forceChart(topic) {
    if (forceChart == undefined) return;
    let graph = get_graph();
    // 更新节点的样式
    let updatedNodes = graph.nodes.map(node => {
        return {
            ...node,
            itemStyle: {
                ...node.itemStyle,
                opacity: topic==-1 ? 1: (paperID2topic[node.id] === topic ? 1 : virtualOpacity),
            }
        };
    });
    // 更新边的样式
    let updatedLinks = graph.links.map(link => {
        let highlight = paperID2topic[link.source] === topic || paperID2topic[link.target] === topic;
        return {
            ...link,
            lineStyle: {
                ...link.lineStyle,
                opacity: topic==-1? 1: (highlight ? 1 : virtualOpacity),
                color: highlight & topic!=-1 ? 'red' : 'lightgrey' // 或者保留原来的颜色
            }
        };
    });

    // 应用更新到 ECharts 实例
    forceChart.setOption({
        series: [{
            data: updatedNodes,
            links: updatedLinks
        }]
    });
}


function highlight_edge(id) {
    let id_arr = id.split('->');
    var source = id_arr[0], target = id_arr[1];
    highlighted = [id];

    // 改变边的起点和终点颜色
    g.selectAll(".paper").data(nodes)
        .attr("fill-opacity", d => {
            if (d.id != source && d.id != target) return virtualOpacity;
        })
        .attr('stroke-opacity', d => {
            if (d.id != source && d.id != target) return virtualOpacity;
        })

    d3.selectAll('.reference').data(edges)
        .attr('stroke', d => highlighted.includes(d.id)? 'red': "#202020")
        .attr('opacity', d => highlighted.includes(d.id)? 1: virtualOpacity)
        .attr('stroke-width', d => {if (d.id == id) return 10;})

    let year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (source == nodes[i].id || target == nodes[i].id) {
            year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
        }
    }
    g.selectAll(".year-topic")
        .attr("fill-opacity", d => {
            if (year_topics.indexOf(d.id) == -1) return virtualOpacity;
        });
    
    $("#paper-list, #selector, #node-info, #node-info-blank, #up-line, #down-line").hide();
    $("#edge-info").show();
    
    //更新edge-info中的内容
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
        update_fields();
        update_nodes();
        g.selectAll('.paper').data(nodes)
            .attr('fill', d => hsvToColor(d.color));
        visual_topics();
        
        draw_tag_cloud();
    }
    else {
        let fillColor = getFillColorFunc();
        d3.selectAll(".paper").attr('fill', fillColor);
        d3.selectAll('.year-topic').attr('fill', fillColor);
        d3.selectAll('.topic-map').attr('fill', fillColor);
        d3.selectAll('.tag-rect').attr('fill', fillColor);
    }
}

function updateFieldLevel() {
    updateFillColor();
}

function updateVisType() {
    visType = $("#vis-type").val();
    if (visType == 0) {
        graph = originalGraph;
        init_graph();
    }
    else if (visType == 1) {
        force_layout();
    } else if (visType == 2) {
        force_layout(true);
    } else if (visType == 3) {
        loadAndRender();
    } else if (visType == 4) {
        // ajaxRequest(true);
        
        document.getElementById('toggle-switch').onchange = function() {
            enable_y_focus = this.checked;
            graph = hyperbolicDistortion(originalGraph);
            console.log('toogle graph', graph)
            init_graph();
        };

        graph = hyperbolicDistortion(originalGraph);
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
        
            graph = hyperbolicDistortion(originalGraph);
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

                graph = hyperbolicDistortion(originalGraph);
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
    } else if (visType == 6) {

    }

}


function processData(nodes, edges) {
    let processedNodes = {};
    let processedEdges = {};

    // Process nodes data
    nodes.forEach(node => {
        getTopicList(node).forEach(topic => {
            let key = `${node.year}_${topic}`;
            if (!processedNodes[key]) {
                processedNodes[key] = []
            }
            processedNodes[key].push(node);
        });
    });

    // Process edges data
    edges.forEach(edge => {
        // Assuming source and target in edges are node IDs
        let sourceNode = nodes.find(node => node.id === edge.source);
        let targetNode = nodes.find(node => node.id === edge.target);
        let sourceTopicList = getTopicList(sourceNode);
        let targetTopicList = getTopicList(targetNode);
        // 去除相同元素，不能相继filter
        let sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        sourceTopicList.forEach(srcTopic => {
            targetTopicList.forEach(tgtTopic => {
                let key = null;
                if (srcTopic == selectedTopic) {
                    key = `_${targetNode.year}_${tgtTopic}`;
                }
                else if (tgtTopic == selectedTopic) {
                    key = `${sourceNode.year}_${srcTopic}_`;
                }

                if (key) {
                    if (!processedEdges[key]) {
                        processedEdges[key] = []
                    }
                    processedEdges[key].push(edge);
                }
            })
        })
    });
    return { processedNodes, processedEdges };
}


function groupDataByYearAndTopic(processedNodes, yearGrid, topNRatio) {
    let groupedNodes = {};
    let topicCounts = {};

    // Calculate topic counts
    processedNodes.forEach(item => {
        topicCounts[item.topic] = (topicCounts[item.topic] || 0) + item.count;
    });

    // Determine top N topics
    let sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
    let totalNodes = Object.values(topicCounts).reduce((a, b) => a + b, 0);
    let topTopics = [];
    let cumulativeCount = 0;

    for (let [topic, count] of sortedTopics) {
        topTopics.push(topic);
        cumulativeCount += count;
        if ((cumulativeCount / totalNodes) >= topNRatio) break;
    }

    console.log(topTopics, cumulativeCount / totalNodes)

    // Group nodes by year and topic
    processedNodes.forEach(node => {
        let t = String(node.topic);
        let yearGroup = Math.floor(node.year / yearGrid) * yearGrid;
        let topicGroup = topTopics.includes(t) ? t : 'others';

        let key = `${yearGroup}_${topicGroup}`;
        if (!groupedNodes[key]) {
            groupedNodes[key] = { yearGroup, topicGroup, count: 0, nodes: [] };
        }
        groupedNodes[key].count += node.count;
        groupedNodes[key].nodes.push(...node.nodes);
    });

    console.log("groupedNodes", groupedNodes);

    groupedNodes = Object.values(groupedNodes)
    let groupedEdges = [];

    // Create a mapping for easier lookup of grouped node information
    let nodeGroupMap = {};
    groupedNodes.forEach(group => {
        group.nodes.forEach(node => {
            nodeGroupMap[node.id] = { yearGroup: group.yearGroup, topicGroup: group.topicGroup };
        });
    });

    // Group edges based on the year-topic grouping of their source and target
    edges.forEach(edge => {
        let sourceGroup = nodeGroupMap[edge.source];
        let targetGroup = nodeGroupMap[edge.target];

        if (sourceGroup && targetGroup) {
            let key = `${sourceGroup.yearGroup}_${sourceGroup.topicGroup}_${targetGroup.yearGroup}_${targetGroup.topicGroup}`;
            if (!groupedEdges[key]) {
                groupedEdges[key] = {
                    source: { year: sourceGroup.yearGroup, topic: sourceGroup.topicGroup },
                    target: { year: targetGroup.yearGroup, topic: targetGroup.topicGroup },
                    count: 0,
                    prob: 0,
                };
            }
            groupedEdges[key].count += 1; // Assuming each edge contributes a count of 1
            groupedEdges[key].prob += edge.extends_prob
        }
    });
    groupedEdges = Object.values(groupedEdges);
    let groupedTopics = topTopics;
    groupedTopics.push('others');
    return {groupedNodes, groupedEdges, groupedTopics};
}


// Function to update data based on slider input
function updateYearGrid(value) {
    let yearGrid = parseInt(value, 10);
    temporalThematicFlow(yearGrid, 0.6);
}


function temporalThematicFlow(yearGrid=2, topNRatio=0.6) {
    d3.select("#mainsvg").selectAll("*").remove();
    graph = originalGraph;
    [params, years, nodes, edges, polygon] = graph;

    // Step1: Data Processing for Temporal-Topic Matrix Construction
    let { processedNodes, processedEdges } = processData(nodes, edges);
    console.log("processed", processedNodes, processedEdges);

    // Step 2: Combining Years and Topics on Demand
    let {groupedNodes, groupedEdges, groupedTopics} = groupDataByYearAndTopic(processedNodes, yearGrid, topNRatio);
    console.log("grouped", groupedNodes, groupedEdges, groupedTopics);

    // Extract groupedTopics and yearGrids from groupedNodes
    let yearGrids = groupedNodes.map(group => group.yearGroup);
    yearGrids = [...new Set(yearGrids)].sort((a, b) => a - b);
    console.log('domain', yearGrids)

    // Step 3: Pie Chart Node Visualization
    // Assuming 'groupedNodes' is already defined and loaded
    // Select the div with id 'mainsvg' and append an SVG element to it
    let margin = { top: 100, right: 20, bottom: 30, left: 100 };
    let svgWidth = d3.select("#mainsvg").node().getBoundingClientRect().width;
    let svgHeight = d3.select("#mainsvg").node().getBoundingClientRect().height;
    let innerWidth = svgWidth - margin.left - margin.right;
    let innerHeight = svgHeight - margin.top - margin.bottom;
    
    let svg = d3.select("#mainsvg").append("svg")
        .attr("width", svgWidth)  // 使用整个 SVG 宽度
        .attr("height", svgHeight)  // 使用整个 SVG 高度
        .append("g")  // 添加一个用于绘制图表的组元素
        .attr("transform", `translate(${margin.left}, ${margin.top})`);
    
    // 假设 'groupedTopics' 是您分组主题的数组
    // 'yearGrids' 是年份网格的数组
    let xScale = d3.scaleBand().domain(groupedTopics).range([0, innerWidth]);
    let yScale = d3.scaleBand().domain(yearGrids).range([0, innerHeight]);
    
    // 添加左边的坐标轴
    svg.append("g")
        .call(d3.axisLeft(yScale))
        .attr("transform", `translate(-30, -${yScale.bandwidth() / 2})`);
    
    // 添加顶部的坐标轴
    svg.append("g")
        .call(d3.axisTop(xScale))
        .attr("transform", `translate(-${xScale.bandwidth() / 2}, -30)`);  // 将顶部坐标轴向上移动以与 SVG 顶部对齐
    

    var pie = d3.pie().value(1); // Modify as per your data structure

    // Create pie charts for each grouped node
    groupedNodes.forEach(group => {
        let pieData = pie(group.nodes);

        console.log(group, pieData)

        // Create a group for each pie chart
        let g = svg.append("g")
                .attr("transform", `translate(${xScale(group.topicGroup)}, ${yScale(group.yearGroup)})`);

        var arc = d3.arc()
                .innerRadius(0) // for a pie chart, inner radius is 0
                .outerRadius(Math.sqrt(group.nodes.length)*5);

        g.selectAll(".arc")
            .data(pieData)
            .enter()
            .append("path")
            .attr("d", arc)
            .attr("class", d => "arc arc_" + d.data.topic)
            .attr("fill", d => {
                let c = hsvToColor(d.data.color, sat=d.data.citationCount < 50? 0.4: 
                        (d.data.citationCount < 100? 0.7: 1));
                return c 
            })
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer')
                .attr('stroke', 'black');
                tip.show(d.data);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default')
                .attr('stroke', 'none');
                tip.hide(d.data);
            })
            .on("click", function(d) {
                console.log(d.data.id);
                highlight_node(d.data.id, true, true);
            });
    });

    // Optional: Add labels or other elements as needed
    // Step 4: Visualization of Edges
    
    // Transform groupedNodes to node_data
    // var node_data = {
    // 	"0": {"x":922.24444, "y":347.29444},
    // 	"1": {"x":814.42222, "y":409.16111},
    // 	"2": {"x":738, "y":427.33333000000005},
    // 	"3": {"x":784.5, "y":381.33333},
    // 	"4": {"x":1066.09167, "y":350.40278},
    // 	"5": {"x":925.4861099999999, "y":313.275}
    // }
    var node_data = {};
    groupedNodes.forEach(group => {
        let key = `${group.yearGroup}_${group.topicGroup}`;
        node_data[key] = {x: xScale(group.topicGroup), y: yScale(group.yearGroup)};
    });

    // Transform groupedEdges to edge_data
    // var edge_data = [{"source":"0", "target":"1"}, {"source":"4", "target":"2"}, {"source":"0", "target":"3"}, {"source":"0","target":"4"}, {"source":"2", "target":"5"}, {"source":"3", "target":"2"}, {"source":"3", "target":"4"}]
    var edge_data = groupedEdges.map(edge => {
        let sourceKey = `${edge.source.year}_${edge.source.topic}`;
        let targetKey = `${edge.target.year}_${edge.target.topic}`;
        return {source: sourceKey, target: targetKey};
    });

    var fbundling = d3.ForceEdgeBundling()
				.nodes(node_data)
				.edges(edge_data);
	var results   = fbundling();
    console.log('results', results)

    var d3line = d3.line().x(d=>d.x).y(d=>d.y).curve(d3.curveLinear);
                    
    results.forEach((data, ix) => {	
    // for each of the arrays in the results 
    // draw a line between the subdivions points for that edge
        let edge = groupedEdges[ix];
        // let opacity = edge.prob / edge.count / 2;
        let opacity = 0.15;
        
        let c = topic2color[String(edge.source.topic)];
        console.log('edge', edge, edge.source.topic, c)
        svg.append("path")
            .attr("d", d3line(data))
            .style("stroke", c !== undefined? hsvToHex(c[0], 0.7, c[2]): "#999")
            .attr("class", "link link_" + edge.source.topic)
            .style("fill", "none")
            .style('stroke-opacity',opacity) //use opacity as blending
            .style("stroke-width", Math.sqrt(edge.count) * 2)
            .on("mouseover", function(d) {
                d3.select(this).attr('cursor', 'pointer')
                .style('stroke-opacity',1)
                // tip.show(d);
            })
            .on("mouseout", function(d) {
                d3.select(this).attr('cursor', 'default')
                .style('stroke-opacity',opacity)
                // tip.hide(d);
            })
            .on("click", function(d) {
                console.log(edge);
            });
    });

    // var link = svg.selectAll(".link")
    //     .data(groupedEdges)
    //     .enter().append("line")
    //     .attr("class", "link")
    //     .attr("x1", d => xScale(d.source.topic))
    //     .attr("y1", d => yScale(d.source.year))
    //     .attr("x2", d => xScale(d.target.topic))
    //     .attr("y2", d => yScale(d.target.year))
    //     .style("stroke", "#999")
    //     .style("stroke-opacity", 0.6)
    //     .style("stroke-width", function(d) { return Math.sqrt(d.count); })
    //     .on("mouseover", function(d) {
    //         d3.select(this).attr('cursor', 'pointer')
    //         .attr('stroke', 'black');
    //         // tip.show(d);
    //     })
    //     .on("mouseout", function(d) {
    //         d3.select(this).attr('cursor', 'default')
    //         .attr('stroke', '#999');
    //         // tip.hide(d);
    //     })
    //     .on("click", function(d) {
    //         console.log(d);
    //     });
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
    const tanh = x => Math.tanh(x);
    const sech2 = x => 1 / (Math.cosh(x) ** 2);

    console.log('hyperbolicDistortion', focus, enable_y_focus, y_focus, coverage)

    // Extracting graph dimensions and translation
    const properties = parseGraphProperties(graph[0]);
    console.log('properties', properties)
    const graphWidth = properties.width;
    const graphHeight = properties.height;
    const translateX = properties.translateX;
    const translateY = properties.translateY;


    function inverse(r) { 
        let ret = Math.acosh(0.5 * r * r + 1);
        return r <0? -ret : ret;
    }

    function transformCoordinate(x, y) {
        // Apply hyperbolic transformation to x-coordinate
        let xNorm = (x - focus * graphWidth) / graphWidth;
        let transformedX = (tanh(inverse(xNorm) * coverage) + 1) / 2 * windowWidth;

        if (enable_y_focus) {
            let yNorm = (y - y_focus * graphHeight) / graphHeight;
            let transformedY = (tanh(inverse(yNorm) * coverage) + 1) / 2 * windowHeight;
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

