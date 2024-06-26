let tagCloudRatio = 0.25;
window.onload = checkScreenSize;

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

        paper_field = updateField();
        // filter paper filed with num between min and max
        paper_field = paper_field.filter(item => item.num >= min && item.num <= max);
        d3.select("#tagcloud").remove();
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

    $("#matrix").click(function() {
        drawMatrix();
        topicIndex = 0;
        shiftSubMatrix();
    });
    $("#save").click(function () {
        var mainsvg = getZoomSvg('#mainsvg', '#maingroup');
        var tagcloud = getZoomSvg('#tagcloud', null);
        var fileName = `${name} (${fieldType}) GF profile.jpg`;
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
        if (isFullScreen == 1) {
            ajaxRequest();
        } else {
            reset_graph();
        }
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
    guidence()
}

function toggleFullscreen() {
    let svgHeight = mainPanalHeight * (1 - tagCloudRatio);
    let svgWidth = $(".middle-column").width();
    let ratio = svgHeight / svgWidth;

    var paramData = {};
    var formData = $("#update-info").serialize();
    formData = formData.split("&");
    for (let i = 1; i < formData.length; i++) {
        const temp = formData[i].split('=');
        paramData[temp[0]] = temp[1];
    }
    paramData.authorID = authorID;
    paramData.field = fieldType;
    paramData.isKeyPaper = nodeSlider.noUiSlider.get();
    paramData.extendsProb = edgeSlider.noUiSlider.get();
    paramData.ratio = ratio;

    if (isFullScreen == 0) {
        $.ajax({
            headers: {"X-CSRFToken": getCookie("csrftoken")},
            type: "POST",
            dataType: "json",
            url: "/update/",
            data: paramData,
            success: function (data) {
                $("#mainsvg, #tagcloud").remove();
                $("#abstract, #citation-context, #timeline").empty();
                $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
                d3.tip().destroy();
                years = data["year"];
                nodes = data["node"];
                edges = data["edge"];
                polygon = data["polygon"];
                const params = data["graph"];
                viewBox = params[0];
                transform = params[1];
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i]['status'] = 0;
                }
                onFullscreenChange();
                reset_graph();
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.error("AJAX request failed:", textStatus, errorThrown);
                console.log("Response:", jqXHR.responseText);
            }
        });
        isFullScreen = 1;
    }
    else {
        ajaxRequest();
    }
}

function onFullscreenChange() {
    // 在这里执行其他操作
    checkScreenSize();

    d3.select("#mainsvg").remove();
    d3.select("#tagcloud").remove();
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

    init_graph(viewBox, transform);
    update_nodes();
    paper_field = updateField();

    if (nodes.length > 0) {
        draw_tag_cloud();
        visual_topics();
    }
    visual_graph(polygon, viewBox, transform);

    // let maxHeight = $("#mainsvg").height() + $("#tagcloud").height();
    // $(".middle-column").css('height', maxHeight);
    updateSider(name);
    // $("paper-list").css('height', maxHeight);

    d3.selectAll('.paper').data(nodes)
        .attr('stroke', d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .attr('stroke-width', d => updateOutlineThickness(d.isKeyPaper, d.citationCount));
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
    imageStatus = imageData.length == 0 ? 0 : 2;
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
    let svgWidth = $(".middle-column").width();
    let svgHeight = mainPanalHeight * tagCloudRatio;

    const svg = d3.select(".middle-column").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("id", "tagcloud");

    let topicThreshold = parseInt(nodes.length / 20) > 5 ? 5 : parseInt(nodes.length / 20);
    var paper_field_filter = [];
    for (let i = 0; i < paper_field.length; i++) {
        if (paper_field[i].num >= topicThreshold) paper_field_filter.push(paper_field[i]);
    }
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
        .on('mouseover', function(d) {highlightTopic(d, this)})
        .on('mouseout', reset_field);

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
    // .on('mouseover', function(d) {highlightTopic(d, this)})
        // .on('mouseout', reset_field);
}

function init_graph (viewBox, transform) {
    $("#imageToShow").height(mainPanalHeight * (1-tagCloudRatio));

    const svg = d3.select(".middle-column").append("svg")
        .attr("width", $(".middle-column").width())
        .attr("height", mainPanalHeight * (1-tagCloudRatio))
        .attr("viewBox", viewBox)
        .attr("id", "mainsvg");

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);

    svg.call(tip);

    g = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');

}

function update_nodes() {
    let fieldLevelVal = $("#field-level").val();
    for (let i = 0; i < nodes.length; i++) {
        // fields为当前是顶层field还是底层field，topic为当前论文在1层/2层情况下对应的topicID
        let topic = parseInt(nodes[i]['topic']);
        let fields = field_leaves;
        if (fieldLevelVal == 1) {
            topic = parseInt(field_leaves[topic][8]);
            fields = field_roots;
        }

        if (fields[topic] == undefined) {
            console.log('topic > fields.length !!!')
        }

        // 根据当前为1层/2层给节点赋上不同的颜色
        nodes[i].color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];

        // 如果当前节点被点击，需要修改paper信息中的展示的topic-word
        if (nodes[i].status == 1) {
            $("#paper-field").text(fields[topic][2].split('_').join(', '));
        }
    }
    // sort nodes by citationCount
    nodes.sort((a, b) =>  b.citationCount - a.citationCount);
}

function updateField() {
    let fieldDepthVal = $("#field-level").val();
    let fields = fieldDepthVal == 1 ? field_roots : field_leaves; //该领域所有的field信息

    var topicMap = new Map(); // 使用Map来存储学者的field信息

    // 统计每个field的出现次数
    for (let i = 0; i < nodes.length; i++) {
        let topicId = parseInt(nodes[i]['topic']);
        topicId = fieldDepthVal == 1 ? parseInt(field_leaves[topicId][8]) : topicId;

        if (topicMap.has(topicId)) {
            let topicVal = topicMap.get(topicId);
            topicVal.num += 1;
        } else {
            let dic = {
                "id": topicId,
                "num": 1,
                "name": fields[topicId][2],
                "color": [parseFloat(fields[topicId][5]), parseFloat(fields[topicId][6]), parseInt(fields[topicId][7])],
                "cx": parseFloat(fields[topicId][3]),
                "cy": parseFloat(fields[topicId][4]),
            };
            topicMap.set(topicId, dic);
        }
    }

    // 将Map转换为数组并排序
    let sortedTopicList = Array.from(topicMap.values()).sort((a, b) => b.num - a.num);

    topicBar = [];
    for (let i = 0; i < years.length; i++) {
        for (let j = 0; j < sortedTopicList.length; j++) {
            let dic = {
                "id": `${years[i].id}${sortedTopicList[j].id}`,
                "name": sortedTopicList[j].name,
                "num"  : 0,
                "color": sortedTopicList[j].color,
            }
            topicBar.push(dic);
        }
    }
    for (let i = 0; i < topicBar.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
            let topicId = parseInt(nodes[j]['topic']);
            topicId = fieldDepthVal == 1 ? parseInt(field_leaves[topicId][8]) : topicId;
            if (topicBar[i].id == `${nodes[j].year}${topicId}`) topicBar[i].num += 1;
        }
    }
    barTranslate = 0;
    for (let i = 0; i < years.length; i++) {
        var x = years[i].cx, y = years[i].cy;
        var barLength = 0;
        for (let j = 0; j < sortedTopicList.length; j++) {
            let idx = i * sortedTopicList.length + j;
            topicBar[idx].x = x;
            topicBar[idx].y = y;
            x -= topicBar[idx].num * 40;
            barLength += topicBar[idx].num * 40;
        }
        if (barLength > barTranslate) barTranslate = barLength;
    }

    return sortedTopicList;
}

function highlightTopic(d, that, isYearTopic=false) {
    if (imageStatus == 1)  return;

    let duration = 200;
    let topicId = d.id;

    tip.show(d);

    // =========================tagcloud=========================
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    d3.select(`#rect_${d.id}`)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");

    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'bold');
        // .attr("x", d => d.x + d.width * 0.02);
    d3.select(that).attr('cursor', 'pointer');

    // =========================topic map=========================
    // 有了duration之后，如果鼠标滑动较快，则没法恢复
    d3.selectAll(".topic-map")
        .attr("fill-opacity", 0.2)
        .attr("stroke", "none");
    d3.select("#circle" + topicId)
        // .transition()
        // .duration(duration)
        .attr("fill-opacity", 1)
        .attr("stroke", "black");

    g.selectAll(".topic-bar")
        .attr('fill-opacity', d => {if (topicId != d.id) return virtualOpacity;})
        .attr('stroke', function(d) {
            if ((isYearTopic == true && topicId == d.id) || (isYearTopic == false && topicId == d.id.slice(4))) {
                return this.getAttribute('stroke');
            } else {
                return d3.rgb(200, 200, 200);
            }
        });

    var colorNodeList = [];  // 记录颜色不需要变化的paperID
    let field_level_val = $("#field-level").val();
    for (let i = 0; i < nodes.length; i++) {
        let nodeYear = nodes[i]['year'];
        let nodeTopic = parseInt(nodes[i]['topic']);
        nodeTopic = field_level_val == 1 ? parseInt(field_leaves[nodeTopic][8]) : nodeTopic;
        if (isYearTopic == true && d.id == `${nodeYear}${nodeTopic}`) {
            colorNodeList.push(nodes[i]['id']);
        } else if (isYearTopic == false && d.id == nodeTopic) {
            colorNodeList.push(nodes[i]['id']);
        }
    }
    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', d => {if (colorNodeList.indexOf(d.id) == -1) return virtualOpacity;})
        .attr('stroke', function(d) {
            // 在箭头函数中使用 this 时，this 不会指向当前的 DOM 元素，而是指向定义该箭头函数的上下文。
            if (colorNodeList.indexOf(d.id) == -1) {
                return d3.rgb(200, 200, 200);
            } else {
                return this.getAttribute('stroke');
            }
        });

    g.selectAll('.reference').data(edges)
        .attr('stroke', d => {
            if (colorNodeList.indexOf(d.source) != -1 || colorNodeList.indexOf(d.target) != -1)
                return  probToColor(d.extends_prob);
            else
                return d3.rgb(200, 200, 200);
        });
    d3.selectAll(".year")
        .attr("fill", d3.rgb(250, 250, 250))
        .attr('stroke', d3.rgb(200, 200, 200));

    $("#mainsvg").attr("style", "background-color: #FAFAFA;");
}

function hsvToColor(color) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], 0.4, color[2]) //  color[1]
}

function reset_field(d) {
    if (imageStatus == 1)  return;
    // =========================tagcloud=========================
    // reset rect color
    d3.select(`#rect_${d.id}`)
        .attr("fill-opacity", 0.6)
        .attr("stroke", "none");
    // remove tooltip
    // d3.select(`#tag-tooltip`).style("opacity", 0);
    // d3.select(`.overall-topic-tip`).hide(d);

    // reset word
    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'normal');

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
    d3.selectAll('.rect1, .topic-bar')
        .attr('fill-opacity', 1);
    //恢复节点填充色和边缘色
    g.selectAll(".paper").data(nodes)
        .attr('fill-opacity', 1)
        .attr('stroke', d => updateOutlineColor(d.isKeyPaper, d.citationCount));
    //恢复边的颜色
    g.selectAll(".reference")
        .attr('stroke', d => probToColor(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob));
    //恢复年份节点的填充色和边缘色
    d3.selectAll(".year")
        .attr("fill-opacity", virtualOpacity)
        .attr("stroke", "black");
    $("#mainsvg").attr("style", "background-color: white;");
    d3.selectAll('.topic-bar').attr('fill-opacity', 1);
}

function highlight_node(id, highlight_neighbor = false) {   // 输入：当前node的 id
    if (imageStatus == 1)  return;

    // 将被点击节点的状态设为1，未被点击的设为2
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id == id)  nodes[i].status = 1;
        else    nodes[i].status = 2;
    }

    // 找到当前节点的所有邻接点
    var adjacent_ids = [];
    if (highlight_neighbor) {
        for (let i = 0; i < edges.length; i++) {
            if (id == edges[i].source) {
                adjacent_ids.push(edges[i].target);
            }
            else if (id == edges[i].target) {
                adjacent_ids.push(edges[i].source);
            }
        }
    }

    // 改变当前节点颜色和相邻节点
    g.selectAll(".paper").data(nodes)
        .attr("fill-opacity", d => {
            if (d.id != id && adjacent_ids.indexOf(d.id) == -1)
                return virtualOpacity;
        })
        .attr('stroke', d => {
            if (d.id == id || adjacent_ids.indexOf(d.id) != -1)
                return updateOutlineColor(d.isKeyPaper, d.citationCount);
        })
        .attr('stroke-width', d => {
            if (d.id == id || adjacent_ids.indexOf(d.id) != -1)
                return updateOutlineThickness(d.isKeyPaper, d.citationCount);
        });

    // 改变当前节点与其相邻节点间线的颜色为红色
    d3.selectAll('.reference')
        .attr('stroke', d => {
            if (d.target == id || d.source == id)   return 'red';
            else    return d3.rgb(200, 200, 200);
        });
    for (let i = 0; i < edges.length; i++) {
        if (edges[i].source != id && edges[i].target != id) {
            edges[i].status = 1;
        }
        else {
            edges[i].status = 2;
        }
    }
    // 将当前节点及其邻接点所对应year的topic显示出来
    adjacent_ids.push(id);
    let year_topics = [];
    for (let i = 0; i < nodes.length; i++) {
        if (adjacent_ids.indexOf(nodes[i].id) != -1) {
            year_topics.push(String(nodes[i].year) + String(nodes[i]['topic']));
        }
    }
    g.selectAll(".topic-bar")
        .attr("fill-opacity", d => {
            if (year_topics.indexOf(d.yearTopicId) == -1) return virtualOpacity;
            return 1;
        });
}

function reset_node() {
    if (imageStatus == 1)  return;

    d3.selectAll('.topic-bar').attr('fill-opacity', 1);
    g.selectAll('.paper').data(nodes)
        .attr('fill-opacity', 1)
        .attr('stroke', d => updateOutlineColor(d.isKeyPaper, d.citationCount))
        .attr('stroke-width', d => updateOutlineThickness(d.isKeyPaper, d.citationCount));
    d3.selectAll('.reference')
        .attr('stroke', d => probToColor(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob));

    for (let i = 0; i < nodes.length; i++) {
        nodes[i].status = 0;
    }
    for (let i = 0; i < edges.length; i++) {
        edges[i].status = 0;
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
        .on('mouseover', function(d) {highlightTopic(d, this)})
        .on('mouseout', reset_field);

    if (paper_field.length == 0) {
        $("#topic-slider").hide();
    }

}

function probToColor(prob, a=0.1, b=1) {
    // 将透明度从[0.3, 0.8]映射到 [a, b] 范围
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    const mappedOpacity = a + (b - a) * opacity;
    const color = `rgba(32, 32, 32, ${mappedOpacity})`;

    return color;
}

function probToWidth(prob, a=0.6, b=6) {
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    return a + opacity * (b - a);
}

function visual_graph(polygon, viewBox, transform) {
    const scaleRegex = /scale\(([^)]+)\)/;
    const translateRegex = /translate\(([^)]+)\)/;

    const scaleMatches = transform.match(scaleRegex);
    const translateMatches = transform.match(translateRegex);

    const scaleParams = scaleMatches[1].split(' ').map(Number);
    const translateParams = translateMatches[1].split(' ').map(Number);

    const ellipse = g.selectAll('circle').data(nodes).enter().append('ellipse')
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy)
        .attr('rx', d => d.rx)
        .attr('ry', d => d.ry)
        .attr('fill', d => hsvToColor(d.color))
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('id', d => d.id)
        .attr('class', 'paper');

    // function dragged(d) {
    //     d3.select(this)
    //     .attr("cx", (d.x = d3.event.x))
    //     .attr("cy", (d.y = d3.event.y));
    // }
    // ellipse.call(d3.drag().on("drag", dragged));

    const lines = g.selectAll('.reference').data(edges).enter().append('path')
        .attr('fill', 'none')
        .attr('stroke', d => probToColor(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob))
        .attr('d', d => d.d)
        .attr('id', d => d.source + '->' + d.target)
        .attr('class', 'reference');

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

    g.selectAll('.text1').data(nodes).enter().append('text')
        .attr('x', d => d.cx)
        .attr('y', d => d.cy)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 20)
        .attr('class', 'text1')
        .attr("pointer-events", "none")
        .each(function(d) {
            let text = d.text === undefined? d.text1 + '\n' + d.text2 : d.text + '\n' + String(d.citationCount)

            var lines = text.split('\n');
            for (var i = 0; i < lines.length; i++) {
                d3.select(this).append('tspan')
                    .attr('x', d.cx)
                    .attr('dy', i === 0 ? 0 : 20)  // Adjust dy for subsequent lines
                    .text(lines[i]);
            }
        });
    g.selectAll('.text3').data(years).enter().append('text')
        .attr('x', d => d.cx)
        .attr('y', d => d.cy + 8.7)
        .text(d => d.text)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 28)
        .attr('class', 'text3');

    const gWidth = g.node().getBBox().width;
    g.selectAll('.topic-bar').remove();

    g.selectAll('.topic-bar').data(topicBar).enter().append('rect')
        .attr('x', d => d.x - d.num * 40 - 29)
        .attr('y', d => d.y - 25)
        .attr('width', d => d.num * 40)
        .attr('height', 50)
        .attr('fill', d => hsvToColor(d.color))
        .attr('class', 'topic-bar')
        .attr('id', d => d.id);

    g.selectAll('.topic-bar')
        .on('mouseover', function(d) {highlightTopic(d, this, true)})
        .on('mouseout', reset_field);

    let newScale = scaleParams[0] * ((gWidth - barTranslate) / gWidth);
    let newTransform = `rotate(0) translate(${translateParams[0]+barTranslate} ${translateParams[1]}) scale(${newScale} ${scaleParams[1]})`;
    g.attr("transform", newTransform);
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => g.attr("transform", d3.event.transform + newTransform));
    d3.select("#mainsvg").call(zoom);

    ellipse
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tip.show(d);
    })
    .on('click', function () {
        var id = d3.select(this).attr('id');    //当前节点id

        highlight_node(id, true);

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

                let topic = parseInt(nodes[i]['topic']);
                topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
                $('#paper-field').text(fields[topic][2].split('_').join(', '));
                $('#abstract').text(nodes[i].abstract);
            }
        }

        /*
         * 下面的代码均为构建引用和被引树
         */
        var vis = new Array(edges.length).fill(0);
        var citedTraversal = function (root) {
            var self_dict = {};
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id == root) {
                    var title = nodes[i].name;
                    break;
                }
            }
            self_dict["title"] = title;
            self_dict["children"] = [];
            var flag = 0;
            for (let i = 0; i < edges.length; i++) {
                if (root == edges[i]['target']) {
                    if (vis[i] == 1) {
                        continue;
                    }
                    vis[i] = 1;
                    flag = 1;
                    self_dict["children"].push(citedTraversal(edges[i]['source']));
                }
            }
            if (flag == 0) {
                delete self_dict["children"];
            }
            return self_dict;
        }
        vis = new Array(edges.length).fill(0);
        var citingTraversal = function (root) {
            var self_dict = {};
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].id == root) {
                    var title = nodes[i].name;
                    break;
                }
            }
            self_dict["title"] = title;
            self_dict["children"] = [];
            var flag = 0;
            for (let i = 0; i < edges.length; i++) {
                if (root == edges[i]['source']) {
                    if (vis[i] == 1) {
                        continue;
                    }
                    vis[i] = 1;
                    flag = 1;
                    self_dict["children"].push(citingTraversal(edges[i]['target']));
                }
            }
            if (flag == 0) {
                delete self_dict["children"];
            }
            return self_dict;
        }
        var cited_list = [citedTraversal(id)];
        var citing_list = [citingTraversal(id)];
        layui.use(['tree', 'util'], function(){
            var tree = layui.tree,
            data = cited_list
            tree.render({
                elem: '#cited-papers', //默认是点击节点可进行收缩
                data: data,
            });
        });
        layui.use(['tree', 'util'], function(){
            var tree = layui.tree,
            data = citing_list
            tree.render({
                elem: '#citing-papers',
                data: data,
            });
        });
    })
    .on('mouseout', function (d) {
        tip.hide(d);
    });

    lines
    .on('mouseover', function (d) {
        d3.select(this)
            .attr("stroke", "red")
            .attr("stroke-width", 10)
            .attr('cursor', 'pointer');
    })
    .on('click', function () {
        //得到source和target的id
        var id = d3.select(this).attr('id');
        let id_arr = id.split('->');
        var source = id_arr[0], target = id_arr[1];

        for (let i = 0; i < edges.length; i++) {
            if (edges[i].source == source && edges[i].target == target) {
                edges[i].status = 2;
            }
            else {
                edges[i].status = 1;
            }
        }

        // 改变边的起点和终点颜色
        g.selectAll(".paper").data(nodes)
            .attr("fill-opacity", d => {
                if (d.id != source && d.id != target) return virtualOpacity;
            })
            .attr('stroke', d => {
                if (d.id == source || d.id == target)
                    return updateOutlineColor(d.isKeyPaper, d.citationCount);
            })
            .attr('stroke-width', d => {
                if (d.id == source || d.id == target)
                    return updateOutlineThickness(d.isKeyPaper, d.citationCount);
            })

        d3.selectAll('.reference').data(edges)
            .attr('stroke', d => {
                if (d.status == 2)   return 'red';
                else    return d3.rgb(200, 200, 200);
            })
            .attr('stroke-width', d => {
                if (d.id == id) return 10;
                else    return 2;
            })

        let year_topics = [];
        for (let i = 0; i < nodes.length; i++) {
            if (source == nodes[i].id || target == nodes[i].id) {
                year_topics.push(String(nodes[i].year) + String(nodes[i]['topic']));
            }
        }
        g.selectAll(".topic-bar")
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
    })
    .on('mouseout', function () {
        d3.select(this)
            .attr("stroke", d => {
                if (d.status == 1)    return d3.rgb(200, 200, 200);
                else if (d.status == 2)   return "red";
                else    return probToColor(d.extends_prob);
            })
            // .attr("stroke-width", d => d.extends_prob <= 0.1 ? 0.4 : d.extends_prob * 5)
            .attr("stroke-width", d => probToWidth(d.extends_prob))

    });

    $(document).click(function(event) {
        if ($(event.target).is('#mainsvg')) {
            // const fillColorVal = $("#fill-color").val();
            // if (fillColorVal == 0) {
            // 点击的是空白处，隐藏元素
            reset_node();
            $("#selector, #node-info, #node-info-blank, #up-line, #down-line, #edge-info").hide();
            $("#paper-list").show();
        }
    });
}

function updateOutlineColor(isKeyPaper, citationCount) {
    var outlineColor;
    let outlineColorVal = $("#outline-color").val();
    switch(outlineColorVal) {
        case '0':
            outlineColor = 'black';
            break;
        case '1':
            if (isKeyPaper == 1)  outlineColor = 'red';
            else if (isKeyPaper >= 0.5)   outlineColor = 'red';
            else    outlineColor = 'black';
            break;
        case '2':
            if (citationCount < 50)   outlineColor = 'black';
            // else if (citationCount < 100) outlineColor = 'pink';
            else    outlineColor = 'red';
            break;
    }
    return outlineColor;
}


function updateOutlineThickness(isKeyPaper, citationCount) {
    var outlineThickness;
    let outlineThicknessVal = $("#outline-thickness").val();
    switch(outlineThicknessVal) {
        case '0':
            outlineThickness = 1;
            break;
        case '1':
            if (isKeyPaper == 1)  outlineThickness = 10;
            else if (isKeyPaper >= 0.5)   outlineThickness = 5;
            else    outlineThickness = 1;
            break;
        case '2':
            if (citationCount >= 100)  outlineThickness = 10;
            else if (citationCount >= 50)   outlineThickness = 5;
            // else if (citationCount <= 50) outlineThickness = (citationCount - 10) * 9 / 40 + 1;
            else    outlineThickness = 3;
            break;
    }
    return outlineThickness;
}

function getFillColorFunc() {
    let defaultColor = "#b3ddff";
    let fillColorVal = $("#fill-color").val();
    let fillColor;
    switch(fillColorVal) {
        case '0':
            fillColor = d => hsvToColor(d.color);
            break;
        case '1':
            fillColor = defaultColor;
            break;
        case '2':
            fillColor = d => {
                if (d.isKeyPaper == 1) {
                    return "#40a6ff";
                }
                else if (d.isKeyPaper >= 0.5) {
                    return "#95cdff";
                }
                else {
                    return defaultColor;
                }
            };
            break;
        case '3':
            fillColor = d => {
                if (d.citationCount < 10) {
                    return defaultColor;
                }
                else if (d.citationCount < 50) {
                    return "#95cdff";
                }
                else {
                    return "#40a6ff";
                }
            };
            break;
    }
    return fillColor;
}

function updateFillColor() {
    let fillColorVal = $("#fill-color").val();
    if (fillColorVal == 0) {
        paper_field = updateField();
        update_nodes();
        g.selectAll('.paper').data(nodes)
            .attr('fill', d => hsvToColor(d.color));
        visual_topics();
        $("#tagcloud").remove();
        draw_tag_cloud();
    }
    else {
        let fillColor = getFillColorFunc();
        d3.selectAll(".paper").attr('fill', fillColor);
        d3.selectAll('.topic-bar').attr('fill', fillColor);
        d3.selectAll('.topic-map').attr('fill', fillColor);
        d3.selectAll('.tag-rect').attr('fill', fillColor);
    }
}

function updateFieldLevel() {
    updateFillColor();
}

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