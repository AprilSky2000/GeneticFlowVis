window.onload = checkScreenSize;
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
let selectedField = null;



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
        
        paper_field = update_fields();
        // filter paper filed with num between min and max
        paper_field = paper_field.filter(item => item.num >= min && item.num <= max);
        draw_tag_cloud();
        // visual_topics();
    });

    nodeSlider.noUiSlider.on("change", function () {
        $("#node-value").text("≥" + nodeSlider.noUiSlider.get() + " prob.");
        ajaxRequest();
    });
    edgeSlider.noUiSlider.on("change", function () {
        $("#edge-value").text("≥" + edgeSlider.noUiSlider.get() + " prob.");
        ajaxRequest();
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
    paper_field = update_fields();

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

    var nodesNum = nodes.length,
        edgesNum = edges.length - years.length + 1;
    if (years.length == 0)  edgesNum = 0;
    $('#node-num').text(nodesNum);
    $('#edge-num').text(edgesNum);

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

function draw_tag_cloud() {
    d3.select("#tagcloud").selectAll("*").remove();
    let svg = d3.select("#tagcloud").append("svg")
        .attr("width", "100%")
        .attr("height", "100%");

<<<<<<< HEAD
    let topicThreshold = parseInt(paperCount / 20) > 5 ? 5 : parseInt(paperCount / 20);
    var paper_field_filter = [];
    for (let i = 0; i < paper_field.length; i++) {
        if (paper_field[i].num >= topicThreshold) paper_field_filter.push(paper_field[i]);
    }
    const sortedData = paper_field_filter.sort((a, b) => b.num - a.num);

=======
    const sortedData = paper_field.sort((a, b) => b.num - a.num);
>>>>>>> ffd059f (add all)
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
        .on('click', draw_subfield)

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
    
    if (visType!=4) {
        zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => g.attr("transform", d3.event.transform + transform));
        svg.call(zoom);
    }
    
    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    tip1 = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);

    g = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');

    g.selectAll('circle').data(nodes).enter().append('ellipse')
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy)
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

    g.selectAll('polygon').data(polygon).enter().append('polygon')
        .attr('fill', 'black')
        .attr('stroke', 'black')
        .attr('points', d => d);

    g.selectAll('circle').data(years).enter().append('ellipse')
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy)
        .attr('rx', d => d.rx)
        .attr('ry', d => d.rx)
        .attr('fill', 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('id', d => d.id)
        .attr('class', 'year');

    // g.selectAll('.text1').data(nodes).enter().append('text')
    //     .attr('x', d => d.cx)
    //     .attr('y', d => d.cy)
    //     .attr('text-anchor', 'middle')
    //     .attr('font-family', 'Times New Roman,serif')
    //     .attr('font-size', 28)
    //     .attr('class', 'text1')
    //     .attr("pointer-events", "none")
    //     .each(function(d) {
    //         let text = d.text === undefined? d.text1 + '\n' + d.text2 : String(d.citationCount)
            
    //         var lines = text.split('\n');
    //         for (var i = 0; i < lines.length; i++) {
    //             d3.select(this).append('tspan')
    //                 .attr('x', d.cx)
    //                 .attr('dy', 10)  // Adjust dy for subsequent lines
    //                 .text(lines[i]);
    //         }
    //     });
    g.selectAll('.text3').data(years).enter().append('text')
        .attr('x', d => d.cx)
        .attr('y', d => d.cy + 8.7)
        .text(d => d.text)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 28)
        .attr('class', 'text3');

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
}

function update_nodes() {
    let fieldLevelVal = $("#field-level").val();
    label2color = field_roots.map(d => (d[0], [parseFloat(d[5]), parseInt(d[6]), parseInt(d[7])]));
    topic2color = field_leaves.map(d => (d[0], [parseFloat(d[5]), parseInt(d[6]), parseInt(d[7])]));

    for (let i = 0; i < nodes.length; i++) {
        // fields为当前是顶层field还是底层field，topic为当前论文在1层/2层情况下对应的topicID
        let topic = parseInt(nodes[i].topic);
        let fields = field_leaves;
        let label = parseInt(field_leaves[topic][8]);
        if (fieldLevelVal == 1) {
            topic = parseInt(field_leaves[topic][8]);
            fields = field_roots;
        }

        console.log('topic', fields[topic], fields.length, topic, nodes[i])
        if (fields[topic] == undefined) {
            console.log('topic > fields.length !!!')
        }

        // 根据当前为1层/2层给节点赋上不同的颜色
        nodes[i].color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
        paperID2topic[nodes[i].id] = topic;

        // 如果当前节点被点击，需要修改paper信息中的展示的topic-word
        // if (nodes[i].status == 1) {
        //     $("#paper-field").text(fields[topic][2].split('_').join(', '));
        // }
    }
    // sort nodes by citationCount
    nodes.sort((a, b) =>  b.citationCount - a.citationCount);
}

function update_fields() {
    var self_field = [];    //该学者个人的field信息
    let field_level_val = $("#field-level").val();
    let fields = field_level_val == 1 ? field_roots : field_leaves; //该领域所有的field信息
    for (let i = 0; i < nodes.length; i++) {
        // 判断该论文节点的topic是叶子层还是顶层
        let topic = parseInt(nodes[i].topic);
        topic = field_level_val == 1 ? parseInt(field_leaves[topic][8]) : topic;
        // 统计该学者的topic信息，如果已经统计(纳入了self_field)，num++
        for (var j = 0; j < self_field.length; j++) {
            if (topic == self_field[j].id) {
                self_field[j].num += 1;
                break;
            }
        }
        // 如果没有统计，在self_field中新建k-v
        if (j == self_field.length) {
            let dic = {};
            dic.id = topic;
            dic.num = 1;
            dic.name = fields[topic][2];
            dic.color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
            dic.cx = parseFloat(fields[topic][3]);
            dic.cy = parseFloat(fields[topic][4]);
            dic.label = parseInt(fields[topic][8]);
            self_field.push(dic);
        }
    }
    self_field.sort(op('num'));
    self_field.sort(op('label'));

    // 处理左侧柱状图
    g.selectAll('.year-topic').remove();
    // 因为需要统计各个年份的各个field的分布，是一个二维向量，要绘制柱状图只能在每年的时候将field柱状分布图画出来，所以没有放到visual_topic函数里
    for (let i = 0; i < years.length; i++) {
        var year_field = [];    //该学者每一年的field信息
        //初始化每一年的field信息：将self_field中的所有field移到当前年份，并置num=0
        for (let j = 0; j < self_field.length; j++) {
            let dic = {};
            dic.id = self_field[j].id;
            dic.name = self_field[j].name.split(':')[0];
            dic.num = 0;
            dic.color = self_field[j].color;
            year_field.push(dic);
        }
        //如果是该年发表的论文，将它的topic和该年的field匹配，匹配上的field数量++
        for (let j = 0; j < nodes.length; j++) {
            if (nodes[j].year == years[i].id) {
                let topic = parseInt(nodes[j].topic);
                topic = field_level_val == 1 ? parseInt(field_leaves[topic][8]) : topic;
                for (let k = 0; k < year_field.length; k++) {
                    if (topic == year_field[k].id) {
                        year_field[k].num += 1;
                        break;
                    }
                }
            }
        }
        var x = years[i].cx;
        var y = years[i].cy;
        for (let j = 0; j < year_field.length; j++) {
            year_field[j].name += ': ' + year_field[j].num;
            year_field[j].x = x;
            year_field[j].y = y;
            x -= year_field[j].num * 40;
            year_field[j].yearTopicId = String(years[i].id) + String(year_field[j].id);
        }

        g.selectAll('circle').data(year_field).enter().append('rect')
            .attr('x', d => d.x - d.num * 40 - 29)
            .attr('y', d => d.y - 25)
            .attr('width', d => d.num * 40)
            .attr('height', 50)
            .attr('fill', d => hsvToColor(d.color))
            .attr('class', 'year-topic')
            .attr('id', d => d.id)
            .attr('yearTopicId', d => d.yearTopicId);
    }

    g.selectAll('.year-topic')
        .on('mouseover', function(d) {highlight_field(d, this)})
        .on('mouseout', reset_field);

    return self_field;
}

function draw_subfield(d) {
    let field_id = d.id;
    tip.show(d);

    let curGraph = graph
}

function highlight_field(d, that) {
    if (image_status == 1)  return;
    // 选择具有特定ID的元素
    // d3.select("#circle" + field_id).select(".topic-map-tip")
    //     .style("display", "block");
    
    let duration = 200;
    let field_id = d.id;
    tip.show(d);
    highlight_topic_forceChart(field_id);

    // =========================tagcloud=========================
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    d3.select(`#rect_${d.id}`)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");
    // show tooltip
    // d3.select(`#tag-tooltip`).text(d.name)
    //     .style("opacity", 1);
    // d3.select(`.overall-topic-tip`).show(d);

    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'bold');
        // .attr("x", d => d.x + d.width * 0.02);
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

    // =========================topic map=========================
    // 有了duration之后，如果鼠标滑动较快，则没法恢复
    d3.selectAll(".topic-map")
        .attr("fill-opacity", 0.2)
        .attr("stroke", "none");
    d3.select("#circle" + field_id)
        // .transition()
        // .duration(duration)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");

    g.selectAll(".year-topic")
        .attr("fill-opacity", d => {if (field_id != d.id) return virtualOpacity;});

    var color_papers = [];  // 记录颜色不需要变化的paperID
    let field_level_val = $("#field-level").val();
    for (let i = 0; i < nodes.length; i++) {
        let topic = parseInt(nodes[i].topic);
        topic = field_level_val == 1 ? parseInt(field_leaves[topic][8]) : topic;
        if (topic == field_id) {
            color_papers.push(nodes[i].id);
        }
    }
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
    d3.selectAll(".year")
        .attr("fill", d3.rgb(250, 250, 250))
        .attr('stroke', d3.rgb(224, 224, 224));

    // $("#mainsvg").attr("style", "background-color: #FAFAFA;");
}

function hsvToColor(color, sat=0.4) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], sat, color[2]) //  color[1]
}

function reset_field(d) {
    if (image_status == 1)  return;
    // =========================tagcloud=========================
    // reset rect color
    highlight_topic_forceChart(-1);
    d3.select(`#rect_${d.id}`)
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    // remove tooltip
    // d3.select(`#tag-tooltip`).style("opacity", 0);
    // d3.select(`.overall-topic-tip`).hide(d);
    
    // reset word
    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'normal');

    // =========================arc=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", 1)
        .attr("stroke", "none");
    
    // =========================topic map=========================
    // topic_map_tip.hide(d);
    tip.hide(d);
    // d3.selectAll(".topic-map-tip").style("display", "none");

    d3.selectAll(".topic-map")
        // .transition()
        // .duration(200)
        .attr("fill-opacity", 0.6)
        .attr("stroke", `rgba(0,0,0,0.5)`);

    // 恢复左侧年份主题柱状图
    d3.selectAll('.rect1, .year-topic')
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
    //恢复年份节点的填充色和边缘色
    d3.selectAll(".year")
        .attr("fill-opacity", virtualOpacity)
        .attr("stroke", "black");
    // $("#mainsvg").attr("style", "background-color: white;");
    d3.selectAll('.year-topic').attr('fill-opacity', 1);
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
            'min': minNum - 1,
            'max': maxNum + 1
        }
    });
    // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
    rangeSlider.noUiSlider.set([minNum - 1, maxNum + 1]);

    var topic_r = (4 / Math.sqrt(maxNum)).toFixed(2);
    if (topic_r > 2) {
        topic_r = 2;
    }
    $("#topic-label").text(topic_r);
    $("#topic-slider").val(topic_r);

    var xScale = d3.scaleLinear()
        .domain([d3.min(paper_field, d => d.cx), d3.max(paper_field, d => d.cx)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(paper_field, d => d.cy), d3.max(paper_field, d => d.cy)])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    const topic_map_svg = d3.select("#topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "topic-map-svg");
        
    const topic_map_g = topic_map_svg.append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);
    
    const topics = topic_map_g.selectAll(".topic-map").data(paper_field).enter().append("circle")
        .attr("cx", d => xScale(d.cx))
        .attr("cy", d => yScale(d.cy))
        .attr("r", d => Math.sqrt(d.num) * 10 * topic_r)
        .attr("fill", d => hsvToColor(d.color))
        .attr("stroke", `rgba(0, 0, 0, 0.2)`)
        .attr("stroke-width", 0.5)
        // .attr("filter", "url(#f1)")
        .attr('fill-opacity', 0.6)
        .attr("id", d => 'circle' + d.id)
        .attr("class", "topic-map");

    topic_map_tip = d3.tip()
        .attr("class", "topic-map-tip")
        .html(d => d.name);
    topic_map_svg.call(topic_map_tip);

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
                focus: 'adjacency',
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
        paper_field = update_fields();
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
        ajaxRequest();
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
    let processedEdges = [];

    // Process nodes data
    nodes.forEach(node => {
        let key = `${node.year}_${node.topic}`;
        if (!processedNodes[key]) {
            processedNodes[key] = {
                year: node.year,
                topic: node.topic,
                count: 0,
                nodes: []
            };
        }
        processedNodes[key].count++;
        processedNodes[key].nodes.push(node);
    });

    // Convert processedNodes from an object to an array
    processedNodes = Object.values(processedNodes);

    // Process edges data
    edges.forEach(edge => {
        // Assuming source and target in edges are node IDs
        let sourceNode = nodes.find(node => node.id === edge.source);
        let targetNode = nodes.find(node => node.id === edge.target);

        if (sourceNode && targetNode) {
            processedEdges.push({
                source: { year: sourceNode.year, topic: sourceNode.topic },
                target: { year: targetNode.year, topic: targetNode.topic },
                count: edge.count || 1 // Default to 1 if count is not specified
            });
        }
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
        })
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


function ajaxRequest(hyperbolic=false) {
    var paramData = {};
    var formData = $("#update-info").serialize();
    formData = formData.split("&");
    for (let i = 1; i < formData.length; i++) {
        const temp = formData[i].split('=');
        paramData[temp[0]] = temp[1];
    }
    paramData.authorID = "{{ authorID }}"
    paramData.field = "{{ fieldType }}";
    paramData.isKeyPaper = nodeSlider.noUiSlider.get();
    paramData.extendsProb = edgeSlider.noUiSlider.get();
    paramData.year = $("#vis-type").val() == 3? 0: 1;

    $.ajax({
        headers: {"X-CSRFToken": getCookie("csrftoken")},
        type: "POST",
        dataType: "json",
        url: "/update/",
        data: paramData,
        success: function (param) {
            $("#abstract, #citation-context, #timeline").empty();
            $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
            d3.tip().destroy();
            var detail = param['detail'],
                fieldType = param['fieldType'];
            var filename = `/src/json/${fieldType}/${detail}.json`;
            d3.json(filename).then( data => {
                graph = data;
                years = data[1];
                nodes = data[2];
                edges = data[3];
                polygon = data[4];
                const params = data[0];
                viewBox = params[0];
                transform = params[1];
                
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i]['status'] = 0;
                }
                name = "{{name}}";
                onFullscreenChange();
            });
            reset_graph();
        },
        error: function (jqXHR, textStatus, errorThrown) {
            console.error("AJAX request failed:", textStatus, errorThrown);
            console.log("Response:", jqXHR.responseText);
        }
    });
}
$("#mode, #node-width, #remove-survey").on('change', ajaxRequest);

function sugiyama(years, nodes, edges) {
    var layers = new Array;
    years.forEach(year => {
        let l = new Array;
        nodes.forEach(node => {
            if (node.year == year.id) {
                l.push({id: node.id, x: node.cx, y: node.cy});
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
                    if (years[j].cy - years[j].ry < y_id && y_id < years[j].cy + years[j].ry) {
                        layers[j].push({id: "VN" + String(cnt), x: x_id, y: years[j].cy});
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
        let cxNorm = (x - focus * graphWidth) / graphWidth;
        let transformedX = (tanh(inverse(cxNorm) * coverage) + 1) / 2 * windowWidth;

        if (enable_y_focus) {
            let cyNorm = (y - y_focus * graphHeight) / graphHeight;
            let transformedY = (tanh(inverse(cyNorm) * coverage) + 1) / 2 * windowHeight;
            return [transformedX, transformedY];
        }

        let transformedY = y / graphHeight * windowHeight;
        return [transformedX, transformedY];
    }

    function transformNode(node) {
        let newNode = Object.assign({}, node);
        let ret = transformCoordinate(node.cx + translateX, node.cy + translateY);
        // console.log(ret)
        newNode.cx = ret[0];
        newNode.cy = ret[1];
        // Adjust the node's size - Assuming rx, ry are radii
        let cxNorm = (node.cx + translateX - focus * graphWidth) / graphWidth;
        newNode.rx *= 1.5 * sech2(cxNorm * coverage) * windowWidth / graphWidth;

        if (enable_y_focus) {
            let cyNorm = (node.cy + translateY - y_focus * graphHeight) / graphHeight;
            newNode.ry *= 1.5 * sech2(cyNorm * coverage) * windowHeight / graphHeight;
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

