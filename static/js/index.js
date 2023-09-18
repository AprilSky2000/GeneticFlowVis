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

    const nodesNum = nodes.length;
    const edgesNum = edges.length - years.length + 1;
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
    </div>`);
    // console.log('nodes', nodes);
    for (let i = 0; i < nodes.length; i++) {
        console.log(nodes[i].name);
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
        var color = hsvToHex(nodes[i].color[0], nodes[i].color[1], nodes[i].color[2]);
        var content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></i>
        </div>
        <div style="margin-left: 7%; display: flex; justify-content: space-between;">
            <b style="margin-left: 0%;">${paperName}</b>
            <b style="margin-right: 5%; margin-left: 5%;">${nodes[i].citationCount}</b>
        </div>
        <p style="margin-top: 1%; margin-bottom: 1%; margin-left: 7%; color: #333;">
            ${paperAuthors.slice(0, -2)}
        </p>
        <p style="margin-top: 1%; margin-bottom: 2%; margin-left: 7%; color: #808080;">${paperVenu} ${paperYear}</p>`;
        $("#timeline").append(content);
    }
    $("#paper-list").show();
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

    // console.log("#" + red + green + blue);

    return "#" + red + green + blue;
}

function textSize(text, size) {
    let container = d3.select('body').append('svg');
    container.append('text')
  
      .style("font-size", size + "px")      // todo: these need to be passed to the function or a css style
      .style("font-family", "sans-serif")
      .text(text);
  
    let sel = container.selectAll('text').node()
    let width = sel.getComputedTextLength()
    let height = sel.getExtentOfChar(0).height
    container.remove()
    return {width, height}
}

function calculateWordPosition(sortedData, maxFontSize) {
    let svgWidth = $(".middle-column").width();
    let svgHeight = $(".middle-column").height() * 0.25;
    let lineHeight = maxFontSize * 1.2;
    let emptySpace = maxFontSize * 0.1;
    let wordPosition = [];
    let currentLine = [];
    let currentLineWidth = 0;
    let currentLineHeight = 0;
    let minFontSize = 10;

    for (const d of sortedData) {
        let ratio = Math.cbrt(d.num / sortedData[0].num);
        if (ratio * maxFontSize < minFontSize) {
            ratio = minFontSize / maxFontSize;
        }
        let size = ratio * maxFontSize;
        let height = ratio * lineHeight;
        let opacity = ratio * 0.8 + 0.1;
        let shortName = d.name.split(" ").slice(0, 2).join(' ');
        // let width = size * shortName.length * 0.5;
        let width = textSize(shortName, size).width * 1.06;

        if (currentLineWidth + width > svgWidth) {
            currentLineHeight += currentLine[0].height + emptySpace;
            if (currentLineHeight + height > svgHeight) {
                // console.log(currentLineHeight, height, svgHeight)
                return null;
            }
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

    wordPosition.push(currentLine);
    return wordPosition;
}

function draw_tag_cloud(data) {
    let svgWidth = $(".middle-column").width();
    let svgHeight = $(".middle-column").height() * 0.25;
    // console.log('svgWidth: ', svgWidth);
    // console.log('svgHeight: ', svgHeight);

    const svg = d3.select(".middle-column").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("id", "tagcloud");

    const sortedData = data.sort((a, b) => b.num - a.num);

    const wordCloud = svg.append("g");
        // .attr("transform", "translate(10, 10)");

    let maxFontSize = 50;
    
    while ((wordPosition=calculateWordPosition(sortedData, maxFontSize)) === null) {
        maxFontSize *= 0.9;
        // console.log("height overflow! change maxFontSize to ", maxFontSize);
    }

    // console.log('wordPosition: ', wordPosition, maxFontSize);

    const words = wordCloud.selectAll("g")
        .data(wordPosition)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0, ${d[0].y})`);

    // let tooltip = d3.select(".middle-column")
    // .append("text")
    // .attr("class", "tooltip")
    // .attr("id", "tag-tooltip")
    // .attr("text-anchor", "middle")
    // .style("font-size", "20px")
    // .style("font-weight", "bold")
    // .style("fill", "black")
    // .style("visibility", "visible")
    // .style("opacity", 0)
    // .style("position", "absolute")
    // .style("margin-left", "20%")
    // .attr("x", svgWidth / 2)
    //         .attr("y", -svgHeight)
    //         .attr("transform", `translate(${svgWidth / 2}, -${svgHeight})`); // 上移一些距离

    // console.log('tooltip: ', tooltip);

    words.selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => d.x)
        .attr("y", d => 0)
        .attr("id", d => `rect_${d.id}`)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", d => maxFontSize * 0.1 * d.ratio)
        .attr("ry", d => maxFontSize * 0.1 * d.ratio)
        .attr("fill", d => `rgb(${d.rgb[0]}, ${d.rgb[1]}, ${d.rgb[2]})`) //rgba(15, 161, 216, ${d.opacity})
        .on('mouseover', function(d) {highlight_field(d, this)})
        .on('mouseout', reset_field);

    words.selectAll("text")
        .data(d => d)
        .enter()
        .append("text")
        .text(d => d.shortName)
        .attr("x", d => d.x + d.width * 0.06)
        .attr("y", d => d.height / 2)
        .attr("dy", "0.35em")
        .attr("id", d => `text_${d.id}`)
        .attr("font-size", d => d.size + "px")
        .attr("fill", d => `rgb(0,0,0)`) 
        .on('mouseover', function(d) {highlight_field(d, this)})
        .on('mouseout', reset_field);
}

function init_graph (viewBox, transform) {
    const svg = d3.select(".middle-column").append("svg")
        .attr("width", $(".middle-column").width())
        .attr("height", $(".middle-column").height() * 0.75)
        .attr("viewBox", viewBox)
        .attr("id", "mainsvg");
    
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => g.attr("transform", d3.event.transform + transform));

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);

    svg.call(zoom);
    svg.call(tip);

    g = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');

}

function update_nodes() {
    let fieldLevelVal = $("#field-level").val();
    for (let i = 0; i < nodes.length; i++) {
        let topic = parseInt(nodes[i].topic);
        let fields = field_leaves;
        if (fieldLevelVal == 1) {
            topic = parseInt(field_leaves[topic][8]);
            fields = field_roots;
        }
        nodes[i].color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
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
            self_field.push(dic);
        }
    }
    self_field.sort(op('num'));

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
            year_field[j].yearid = String(years[i].id) + String(year_field[j].id);
        }
        
        g.selectAll('circle').data(year_field).enter().append('rect')
            .attr('x', d => d.x - d.num * 40 - 29)
            .attr('y', d => d.y - 25)
            .attr('width', d => d.num * 40)
            .attr('height', 50)
            .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
            .attr('class', 'year-topic')
            .attr('id', d => d.id);
    }

    g.selectAll('.year-topic')
    .on('mouseover', function(d) {highlight_field(d, this)})
    .on('mouseout', reset_field);

    return self_field;
}

function highlight_field(d, that) {
    // 选择具有特定ID的元素
    // d3.select("#circle" + field_id).select(".topic-map-tip")
    //     .style("display", "block");
    
    let duration = 300;
    let field_id = d.id;
    let field_color = hsvToRgb(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    // console.log('highlight field', d, field_color);
    // topic_map_tip.show(d);
    tip.show(d);

    // =========================tagcloud=========================
    // d3.select(`#rect_${d.id}`).attr('fill', `rgba(15, 161, 216, 1)`);
    // show tooltip
    // d3.select(`#tag-tooltip`).text(d.name)
    //     .style("opacity", 1);
    // d3.select(`.overall-topic-tip`).show(d);

    // console.log('show tooltip', d, tooltip);
    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'bold')
        .attr("x", d => d.x + d.width * 0.02);
    d3.select(that).attr('cursor', 'pointer');

    // =========================topic map=========================
    d3.selectAll(".topic-map")
        .transition()
        .duration(duration)
        .attr("fill-opacity", 0.2);
    d3.select("#circle" + field_id)
        .transition()
        .duration(duration)
        .attr("fill-opacity", 1);

    g.selectAll(".year-topic")
        .attr("fill", d => {
            if (field_id != d.id)  // 每个year-topic的柱子绑定的数据中id=year+topicID，year的长度为4，所以topic的id就可以切片得出
                return d3.rgb(200, 200, 200);
            else
                return d3.rgb(parseInt(field_color[0]), parseInt(field_color[1]), parseInt(field_color[2]));
        });

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
        .attr('fill', d => {
            if (color_papers.indexOf(d.id) == -1)
                return d3.rgb(250, 250, 250);
            else
                return d3.rgb(parseInt(field_color[0]), parseInt(field_color[1]), parseInt(field_color[2]));
        })
        .attr('stroke', d3.rgb(200, 200, 200));

    g.selectAll('.reference').data(edges)
        .attr('stroke', d => {
            if (color_papers.indexOf(d.source) != -1 || color_papers.indexOf(d.target) != -1)
                return  probToColor(d.extends_prob);
            else
                return d3.rgb(200, 200, 200);
        });
    d3.selectAll(".year")
        .attr("fill", d3.rgb(250, 250, 250))
        .attr('stroke', d3.rgb(200, 200, 200));

    $("#mainsvg").attr("style", "background-color: #FAFAFA;");
}

function reset_field(d) {
    // =========================tagcloud=========================
    // reset rect color
    // d3.select(`#rect_${d.id}`).attr('fill', `rgba(15, 161, 216, ${d.opacity})`);
    // remove tooltip
    // d3.select(`#tag-tooltip`).style("opacity", 0);
    // d3.select(`.overall-topic-tip`).hide(d);
    
    // reset word
    d3.select(`#text_${d.id}`)
        .attr('font-weight', 'normal')
        .attr("x", d => d.x + d.width * 0.06);
    
    // =========================topic map=========================
    // topic_map_tip.hide(d);
    tip.hide(d);
    // d3.selectAll(".topic-map-tip").style("display", "none");

    d3.selectAll(".topic-map")
        .transition()
        .duration(200)
        .attr("fill-opacity", 0.6);

    // 恢复左侧年份主题柱状图
    d3.selectAll('.rect1, .year-topic')
        .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
    //恢复节点填充色和边缘色
    g.selectAll(".paper").data(nodes)
        .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
    outline_color_change();
    //恢复边的颜色
    g.selectAll(".reference")
        .attr('stroke', d => probToColor(d.extends_prob))
        .attr('stroke-width', d => probToWidth(d.extends_prob));
    //恢复年份节点的填充色和边缘色
    d3.selectAll(".year")
        .attr("fill", "white")
        .attr("stroke", "black");
    $("#mainsvg").attr("style", "background-color: white;");
    d3.selectAll('.year-topic').attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
}

function visual_topics(overall_field) {
    $("#topic-slider").val(0.5);
    $("#topic-slider").show();

    // let topic_width = $("#topic-map-graph").width();
    let topic_width = mainPanalWidth * 0.18;
    let topic_height = topic_width - $("#topic-map-banner").height();
    const topic_margin1 = 35;
    const topic_margin2 = 20;

    d3.selectAll("#topic-map-svg").remove();

    // console.log('overall field', overall_field);
    // set the ranges of rangeSlider

    let rangeSlider = document.getElementById("range-slider");
    rangeSlider.noUiSlider.updateOptions({
        range: {
            'min': d3.min(overall_field, d => d.num),
            'max': d3.max(overall_field, d => d.num)
        }
    });
    var maxNum = d3.max(overall_field, d => d.num);
    var topic_r = (4 / Math.sqrt(maxNum)).toFixed(2);
    if (topic_r > 2) {
        topic_r = 2;
    }
    $("#topic-label").text(topic_r);
    $("#topic-slider").val(topic_r);

    var xScale = d3.scaleLinear()
        .domain([d3.min(overall_field, d => d.cx), d3.max(overall_field, d => d.cx)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(overall_field, d => d.cy), d3.max(overall_field, d => d.cy)])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    const topic_map_svg = d3.select("#topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "topic-map-svg");
    
    const topic_map_g = topic_map_svg.append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);
    
    const topics = topic_map_g.selectAll(".topic-map").data(overall_field).enter().append("circle")
        .attr("cx", d => xScale(d.cx))
        .attr("cy", d => yScale(d.cy))
        .attr("r", d => Math.sqrt(d.num) * 10 * topic_r)
        .attr("fill", d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr("stroke", "black")
        .attr("stroke-width", 0.2)
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
    
    if (overall_field.length == 0) {
        $("#topic-slider").hide();
    }

}

function probToColor(prob, a=0.1, b=1) {
    // 确保透明度在 [a, b] 范围内
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    
    // 将透明度映射到 [a, b] 范围
    const mappedOpacity = a + (b - a) * opacity;
    
    // 构建 rgba 颜色字符串
    const color = `rgba(0, 0, 0, ${mappedOpacity})`;
    
    return color;
}

function probToWidth(prob, a=1, b=10) {
    if (prob <= 0.3) {
        return a;
    }
    else if (prob >= 0.8) {
        return b;
    }
    return a + 2 * (prob - 0.3) * (b - a);
}

function visual_graph(polygon) {
    const ellipse = g.selectAll('circle').data(nodes).enter().append('ellipse')
        .attr('cx', d => d.cx)
        .attr('cy', d => d.cy)
        .attr('rx', d => d.rx)
        .attr('ry', d => d.ry)
        .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
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

    // .attr('stroke-width', d => d.extends_prob <= 0.1 ? 0.4 : d.extends_prob * 5)

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
        .attr('y', d => d.cy - 3.8)
        .text(d => d.text1)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 14)
        .attr('class', 'text1');
    g.selectAll('.text2').data(nodes).enter().append('text')
        .attr('x', d => d.cx)
        .attr('y', d => d.cy + 11.2)
        .text(d => d.text2)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 14)
        .attr('class', 'text2');
    g.selectAll('.text3').data(years).enter().append('text')
        .attr('x', d => d.cx)
        .attr('y', d => d.cy + 8.7)
        .text(d => d.text)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 28)
        .attr('class', 'text3');

    ellipse
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tip.show(d);
    })
    .on('click', function () {
        var id = d3.select(this).attr('id');    //当前节点id

        // 找到当前节点的所有邻接点
        var adjacent_ids = [];
        for (let i = 0; i < edges.length; i++) {
            if (id == edges[i].source) {
                adjacent_ids.push(edges[i].target);
            }
            else if (id == edges[i].target) {
                adjacent_ids.push(edges[i].source);
            }
        }
        // 改变当前节点颜色和相邻节点
        let fillColorVal = $("#fill-color").val();
        let outlineColorVal = $("#outline-color").val();
        let outlineThicknessVal = $("#outline-thickness").val();
        g.selectAll(".paper").data(nodes)
            .attr("fill", d => {
                if (d.id != id && adjacent_ids.indexOf(d.id) == -1) {
                    return d3.rgb(250, 250, 250);
                }
                else {
                    if (fillColorVal == 0)  return "white";
                    else if (fillColorVal == 1) return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
                }
            })
            .attr('stroke', d => {
                if (d.id == id || adjacent_ids.indexOf(d.id) != -1) {
                    if (outlineColorVal == 0)   return "black";
                    else if (outlineColorVal == 1) {
                        if (d.isKeyPaper == 1)  return 'red';
                        else if (d.isKeyPaper >= 0.5)   return 'pink';
                        else    return 'black';
                    }
                    else if (outlineColorVal == 2) {
                        if (d.citationCount < 10)   return 'black';
                        else if (d.citationCount < 50)  return 'pink';
                        else    return 'red';
                    }
                }
            })
            .attr('stroke-width', d => {
                if (d.id == id || adjacent_ids.indexOf(d.id) != -1) {
                    if (outlineThicknessVal == 0)   return 1;
                    else if (outlineThicknessVal == 1) {
                        if (d.isKeyPaper == 1)  return 10;
                        else if (d.isKeyPaper >= 0.5)   return 5;
                        else    return 1;
                    }
                    else if (outlineThicknessVal == 2) {
                        if (d.citationCount <= 10)  return 1;
                        else if (d.citationCount <= 50) return (d.citationCount - 10) / 15 + 1;
                        else    return 10;
                    }
                }
            })
            .attr('stroke-dasharray', d => {
                if (d.id == id || adjacent_ids.indexOf(d.id) != -1) {
                    if (outlineThicknessVal == 0)   return null;
                    else if (outlineThicknessVal == 2) {
                        if (d.citationCount == -1)  return '5,2';
                        else    return null;
                    }
                }
            });
        // 改变当前节点与其相邻节点间线的颜色为红色
        d3.selectAll('.reference')
            .attr('stroke', d => {
                if (d.target == id || d.source == id)   return 'red';
                else    return d3.rgb(200, 200, 200);
            })
            .attr('stroke-dasharray', d => {
                if (d.target == id || d.source == id)   return null;
                else    return '5.2';
            });
        for (let i = 0; i < edges.length; i++) {
            if (edges[i].source != id && edges[i].target != id) {
                edges[i].flag = 1;
            }
            else {
                edges[i].flag = 2;
            }
        }
        // 将当前节点及其邻接点所对应year的topic显示出来
        adjacent_ids.push(d3.select(this).attr("id"))
        let year_topics = [];
        for (let i = 0; i < nodes.length; i++) {
            if (adjacent_ids.indexOf(nodes[i].id) != -1) {
                year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
            }
        }
        g.selectAll(".year-topic")
            .attr("fill", d => {
                if (year_topics.indexOf(d.id) == -1) {
                    return d3.rgb(200, 200, 200);
                }
                else {
                    return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
                }
            });

        $("#paper-list").hide();
        $("#edge-info").hide();
        $("#up-line").hide();
        $("#down-line").hide();
        $("#selector").show();
        $("#node-info").show();

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

                let topic = parseInt(nodes[i].topic);
                topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
                $('#paper-field').text(String(fields[topic][2]).split(' '));
                $('#abstract').text(nodes[i].abstract);
            }
        }

        //因为abstract为overflow类型，需要先确定高度才能出现滑轮
        //同时为了使右侧和中间保持相对对齐，所以需要用中间列的高度-abstract上面一些元素的高度和
        //同样的计算内容在line.click中也出现了
        let other_height = 0;
        $(".abstract-minus-height").each(function() {
            other_height += $(this).height();
        });
        let abstract_height = (($("#paper-list").height() / 1.1 - $("#selector").height()) - other_height) / 1.03;
        // console.log($("#paper-list").height());
        // console.log($("#selector").height(), other_height);
        // let abstract_height = ($("#mainsvg").height() + $("#tagcloud").height() - $("#selector").height() - other_height) * 0.9;
        // console.log('max height', abstract_height, 'other height', other_height);
        $("#abstract").css("height", abstract_height);

        // 下面的代码均为构建引用和被引树
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
            .attr("stroke-dasharray", null)
            .attr('cursor', 'pointer');
    })
    .on('click', function () {
        //得到source和target的id
        var id = d3.select(this).attr('id');
        let id_arr = id.split('->');
        var source = id_arr[0], target = id_arr[1];

        for (let i = 0; i < edges.length; i++) {
            if (edges[i].source == source && edges[i].target == target) {
                edges[i].flag = 2;
            }
            else {
                edges[i].flag = 1;
            }
        }

        // 改变边的起点和终点颜色
        let fillColorVal = $("#fill-color").val();
        let outlineColorVal = $("#outline-color").val();
        let outlineThicknessVal = $("#outline-thickness").val();
        g.selectAll(".paper").data(nodes)
            .attr("fill", d => {
                if (d.id != source && d.id != target) {
                    // return d3.rgb(250, 250, 250);
                    return d3.rgb(200, 200, 200);
                }
                else {
                    if (fillColorVal == 0)  return "white";
                    else if (fillColorVal == 1) return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
                }
            })
            .attr('stroke', d => {
                if (d.id == source || d.id == target) {
                    if (outlineColorVal == 0)   return "black";
                    else if (outlineColorVal == 1) {
                        if (d.isKeyPaper == 1)  return 'red';
                        else if (d.isKeyPaper >= 0.5)   return 'pink';
                        else    return 'black';
                    }
                    else if (outlineColorVal == 2) {
                        if (d.citationCount < 10)   return 'black';
                        else if (d.citationCount < 50)  return 'pink';
                        else    return 'red';
                    }
                }
            })
            .attr('stroke-width', d => {
                if (d.id == source || d.id == target) {
                    if (outlineThicknessVal == 0)   return 1;
                    else if (outlineThicknessVal == 1) {
                        if (d.isKeyPaper == 1)  return 10;
                        else if (d.isKeyPaper >= 0.5)   return 5;
                        else    return 1;
                    }
                    else if (outlineThicknessVal == 2) {
                        if (d.citationCount <= 10)  return 1;
                        else if (d.citationCount <= 50) return (d.citationCount - 10) / 15 + 1;
                        else    return 10;
                    }
                }
            })
            .attr('stroke-dasharray', d => {
                if (d.id != source && d.id != target) {
                    if (outlineThicknessVal == 0)   return null;
                    else if (outlineThicknessVal == 2) {
                        if (d.citationCount == -1)  return '5,2';
                        else    return null;
                    }
                }
            });

        d3.selectAll('.reference').data(edges)
            .attr('stroke', d => {
                if (d.flag == 2)   return 'red';
                else    return d3.rgb(200, 200, 200);
            })
            .attr('stroke-width', d => {
                if (d.id == id) return 10;
                else    return 2;
            })
            .attr('stroke-dasharray', d => {
                if (d.flag == 2)   return null;
                else    return '5.2';
            });

        let year_topics = [];
        for (let i = 0; i < nodes.length; i++) {
            if (source == nodes[i].id || target == nodes[i].id) {
                year_topics.push(String(nodes[i].year) + String(nodes[i].topic));
            }
        }
        g.selectAll(".year-topic")
            .attr("fill", d => {
                if (year_topics.indexOf(d.id) == -1) {
                    return d3.rgb(200, 200, 200);
                }
                else {
                    return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
                }
            });
        
        $("#paper-list").hide();
        $("#selector").hide();
        $("#node-info").hide();
        $("#up-line").hide();
        $("#down-line").hide();
        $("#edge-info").show();
        
        //更新edge-info中的内容
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id == source) {
                $('#source-paper').text(nodes[i].name);
            }
            if (nodes[i].id == target) {
                $('#target-paper').text(nodes[i].name);
            }
        }
        for (var i = 0; i < edges.length; i++) {
            if (edges[i].source == source && edges[i].target == target) {
                $('#citation-context').text(edges[i].citation_context);
                break;
            }
        }

        //因为citation-context为overflow类型，需要先确定高度才能出现滑轮
        //同时为了使右侧和中间保持相对对齐，所以需要用中间列的高度-citation-context上面一些元素的高度和
        //同样的计算内容在ellipse.click中也出现了
        let other_height = 0;
        $(".citation-context-minus-height").each(function() {
            other_height += $(this).height();
        });
        let citation_context_height = ($("#paper-list").height() / 1.1 - other_height) / 1.03;
        // let citation_context_height = ($("#mainsvg").height() + $("#tagcloud").height() - $("#selector").height() - other_height) * 0.9;
        $("#citation-context").css("height", citation_context_height);
    })
    .on('mouseout', function () {
        d3.select(this)
            .attr("stroke", d => {
                if (d.flag == 1)    return d3.rgb(200, 200, 200);
                else if (d.flag == 2)   return "red";
                else    return probToColor(d.extends_prob);
            })
            // .attr("stroke-width", d => d.extends_prob <= 0.1 ? 0.4 : d.extends_prob * 5)
            .attr("stroke-width", d => probToWidth(d.extends_prob))
            .attr("stroke-dasharray", d => {
                if (d.flag == 1)    return '5.2';
                else    return null;
            });
    });

    $(document).click(function(event) {
        if ($(event.target).is('#mainsvg')) {
            const fillColorVal = $("#fill-color").val();
            if (fillColorVal == 1) {
                // 点击的是空白处，隐藏元素
                g.selectAll('.paper').data(nodes)
                    .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
                d3.selectAll('.year-topic')
                    .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
            }
            outline_color_change();
            outline_thickness_change();
            d3.selectAll('.reference')
                .attr('stroke', d => probToColor(d.extends_prob))
                .attr('stroke-width', d => probToWidth(d.extends_prob))
                // .attr('stroke', 'black')
                .attr('stroke-dasharray', null);
            for (let i = 0; i < nodes.length; i++) {
                nodes[i].flag = 0;
            }
            for (let i = 0; i < edges.length; i++) {
                edges[i]['flag'] = 0;
            }
            $("#paper-list").show();
            $("#selector").hide();
            $("#node-info").hide();
            $("#up-line").hide();
            $("#down-line").hide();
            $("#edge-info").hide();
        }
    });
}

function outline_color_change() {
    let outlineColorVal = $("#outline-color").val();
    if (outlineColorVal == 0) {
        d3.selectAll(".paper").attr('stroke', 'black');
    }
    else if (outlineColorVal == 1) {
        d3.selectAll('.paper').data(nodes)
            .attr('stroke', d => {
                if (d.isKeyPaper == 1) {
                    return 'red';
                }
                else if (d.isKeyPaper >= 0.5) {
                    return 'pink';
                }
                else {
                    return 'black';
                }
            });
    }
    else if (outlineColorVal == 2) {
        d3.selectAll('.paper').data(nodes)
            .attr('stroke', d => {
                if (d.citationCount < 10) {
                    return 'black';
                }
                else if (d.citationCount < 50) {
                    return 'pink';
                }
                else {
                    return 'red';
                }
            });
    }
}

function outline_thickness_change() {
    let outlineThicknessVal = $("#outline-thickness").val();
    if (outlineThicknessVal == 0) {
        d3.selectAll(".paper")
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', null);
    }
    else if (outlineThicknessVal == 1) {
        d3.selectAll('.paper').data(nodes)
            .attr('stroke-width', d => {
                if (d.isKeyPaper == 1) {
                    return 10;
                }
                else if (d.isKeyPaper >= 0.5) {
                    return 5;
                }
                else {
                    return 1;
                }
            });
    }
    else if (outlineThicknessVal == 2) {
        d3.selectAll('.paper').data(nodes)
            .attr('stroke-dasharray', d => {
                if (d.citationCount == -1) {
                    return '5,2';
                }
                else {
                    return null;
                }
            })
            .attr('stroke-width', d => {
                if (d.citationCount <= 10) {
                    return 1;
                }
                else if (d.citationCount <= 50) {
                    return (d.citationCount - 10) / 15 + 1;
                }
                else {
                    return 10;
                }
            });
    }
}

function fill_color_change() {
    let fillColorVal = $("#fill-color").val();
    if (fillColorVal == 0) {
        d3.selectAll(".paper").attr('fill', 'white');
        d3.selectAll('.year-topic').remove();
    }
    else if (fillColorVal == 1) {
        update_nodes();
        g.selectAll('.paper').data(nodes)
            .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
        var fieldCount = update_fields();
        visual_topics(fieldCount);
    }
}

function field_level_change() {
    let fillColorVal = $("#fill-color").val();
    if (fillColorVal == 1) {
        update_nodes();
        g.selectAll('.paper').data(nodes)
            .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
        var paper_field = update_fields();
        visual_topics(paper_field);
    }
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
    // console.log(layers);
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
    // console.log(layers);
}