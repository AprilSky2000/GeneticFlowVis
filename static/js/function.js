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

function update_sider (name) {
    const screenHeight = $(window).height();
    $("#topic-info").css("height", screenHeight / 3);
    // $("#papers-list").css("height", screenHeight / 3);

    const nodesNum = nodes.length;
    const edgesNum = edges.length - years.length + 1;
    $('#node-num').text(nodesNum);
    $('#edge-num').text(edgesNum);

    $("#timeline").empty();
    for (let i = 0; i < nodes.length; i++) {
        const paperName = String(nodes[i].name);
        var paperFirstAuthor = String(nodes[i].firstName);
        if (paperFirstAuthor == "") 
            paperFirstAuthor = name;
        var content = "<div style=\"float: left;\"><i style=\"width: 10px; height: 10px; border-radius: 50%; background-color: #00a78e; display: inline-block;\"></i></div>" + "<div style=\"margin-left: 7%;\"><b style=\"color: #777; font-size: 14px;\">" + paperName + "</b></div>" + "<p style=\"margin-top: 1%; margin-bottom: 1%; margin-left: 7%; color: #777777;\">" + paperFirstAuthor + "</p>";
        $("#timeline").append(content);
    }
    $("#papers-list").show();
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

function draw_tag_cloud(data) {
    let svgWidth = $("#graph").width();
    let svgHeight = $("#graph").height() * 0.25;
    console.log('svgWidth: ', svgWidth);
    console.log('svgHeight: ', svgHeight);

    const svg = d3.select("#graph").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("id", "tagcloud");

    const sortedData = data.sort((a, b) => b.num - a.num);
    const maxNum = sortedData[0].num;

    const wordCloud = svg.append("g")
        .attr("transform", "translate(10, 10)");

    const lineHeight = 60;
    const maxFontSize = 50;
    const emptySpace = 10;

    const wordPosition = [];
    let currentLine = [];
    let currentLineWidth = 0;
    let currentLineHeight = 0;

    sortedData.forEach(d => {
        let ratio = Math.sqrt(d.num / maxNum);
        let size = ratio * maxFontSize;
        let height = ratio * lineHeight;
        let opacity = ratio * 0.6 + 0.2;
        let shortName = d.name.split(" ").slice(0, 2).join(' ');
        // let width = size * shortName.length * 0.5;
        let width = textSize(shortName, size).width;
        
        if (currentLineWidth + width > svgWidth) {
            currentLineHeight += currentLine[0].height + emptySpace;
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
            color: hsvToRgb(d.color[0], d.color[1], d.color[2]),
            opacity: opacity,
            x: currentLineWidth,
            y: currentLineHeight
        });
        currentLineWidth += width + emptySpace;
    });

    wordPosition.push(currentLine);

    console.log('wordPosition: ', wordPosition);

    const words = wordCloud.selectAll("g")
        .data(wordPosition)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0, ${d[0].y})`);

    const topic_tip = d3.tip()
        .attr("class", "overall-topic-tip")
        .html(d => d.name);
    svg.call(topic_tip);

    words.selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => d.x)
        .attr("y", d => 0)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", d => emptySpace * d.ratio)
        .attr("ry", d => emptySpace * d.ratio)
        .attr("fill", d => `rgba(9, 62, 86, ${d.opacity})`)
        .on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            topic_tip.show(d);
            console.log('fieldColor: ', d.color, d.id);
            highlight_field(d.id, d.color);
        })
        .on('mouseout', function (d) {
            topic_tip.hide(d);
            reset_field();
        });

    words.selectAll("text")
        .data(d => d)
        .enter()
        .append("text")
        .text(d => d.shortName)
        .attr("x", d => d.x + d.width * 0.04)
        .attr("y", d => d.height / 2)
        .attr("dy", "0.35em")
        .attr("id", d => d.id)
        .attr("font-size", d => d.size + "px")
        .attr("fill", d => `rgb(${d.color[0]}, ${d.color[1]}, ${d.color[2]})`)
        .on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            topic_tip.show(d);
            console.log('fieldColor: ', d.color, d.id);
            highlight_field(d.id, d.color);
        })
        .on('mouseout', function (d) {
            topic_tip.hide(d);
            reset_field();
        });

    
}

function init_graph (viewBox, transform) {

    // let left_sider_height = $("#self-info").height();
    // $("#graph").height(left_sider_height * 1.2);

    const svg = d3.select("#graph").append("svg")
        .attr("width", $("#graph").width())
        .attr("height", $("#graph").height() * 0.75)
        .attr("viewBox", viewBox)
        .attr("id", "mainsvg");

    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => g.attr("transform", d3.event.transform));

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(function(d) { return d.name });

    svg.call(zoom);
    svg.call(tip);

    g = svg.append('g')
    .attr('transform', transform)
    .attr('id', 'maingroup')
    .attr('class', 'all_g');

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
}

function update_fields() {

    var overall_field = [];
    let fieldLevelVal = $("#field-level").val();
    let fields = fieldLevelVal == 1 ? field_roots : field_leaves;
    for (let i = 0; i < nodes.length; i++) {
        let topic = parseInt(nodes[i].topic);
        topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
        for (var j = 0; j < overall_field.length; j++) {
            if (topic == overall_field[j].id) {
                overall_field[j].num += 1;
                break;
            }
        }
        if (j == overall_field.length) {
            let dic = {};
            dic.id = topic;
            dic.num = 1;
            dic.name = fields[topic][2];
            dic.color = [parseFloat(fields[topic][5]), parseFloat(fields[topic][6]), parseInt(fields[topic][7])];
            dic.cx = parseFloat(fields[topic][3]);
            dic.cy = parseFloat(fields[topic][4]);
            overall_field.push(dic);
        }
    }
    overall_field.sort(op('num'));

    // 处理左侧柱状图
    g.selectAll('.year-topic').remove();

    for (let i = 0; i < years.length; i++) {
        var year_field = [];
        for (let j = 0; j < overall_field.length; j++) {
            let dic = {};
            dic.id = overall_field[j].id;
            dic.name = overall_field[j].name.split(':')[0];
            dic.num = 0;
            dic.color = overall_field[j].color;
            year_field.push(dic);
        }
        for (let j = 0; j < nodes.length; j++) {
            if (nodes[j].year == years[i].id) {
                let topic = parseInt(nodes[j].topic);
                topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
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
            year_field[j].id = String(years[i].id) + String(year_field[j].id);
        }
        
        g.selectAll('circle').data(year_field).enter().append('rect')
            .attr('x', d => d.x - d.num * 40 - 29)
            .attr('y', d => d.y - 25)
            .attr('width', d => d.num * 40)
            .attr('height', 50)
            .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
            .attr('class', 'year-topic');
    }

    g.selectAll('.year-topic')
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tip.show(d);
    })
    .on('mouseout', function (d) {
        d3.selectAll('.year-topic').attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
        tip.hide(d);
    });

    return overall_field;
}

function highlight_field(fieldId, fieldColor) {
    g.selectAll(".year-topic")
        .attr("fill", d => {
            if (fieldId != d.id.slice(4))
                return d3.rgb(200, 200, 200);
            else
                return d3.rgb(parseInt(fieldColor[0]), parseInt(fieldColor[1]), parseInt(fieldColor[2]));
        });

    var papersId = [];
    let fieldLevelVal = $("#field-level").val();
    for (let i = 0; i < nodes.length; i++) {
        let topic = parseInt(nodes[i].topic);
        topic = fieldLevelVal == 1 ? parseInt(field_leaves[topic][8]) : topic;
        if (topic == fieldId) {
            papersId.push(nodes[i].id);
        }
    }
    g.selectAll(".paper").data(nodes)
        .attr('fill', d => {
            if (papersId.indexOf(d.id) == -1)
                return d3.rgb(250, 250, 250);
            else
                return d3.rgb(parseInt(fieldColor[0]), parseInt(fieldColor[1]), parseInt(fieldColor[2]));
        })
        .attr('stroke', d3.rgb(200, 200, 200));

    g.selectAll('.reference').data(edges)
        .attr('stroke', d => {
            if (papersId.indexOf(d.source) != -1 || papersId.indexOf(d.target) != -1)
                return 'black';
            else
                return d3.rgb(200, 200, 200);
        });
    d3.selectAll(".year")
        .attr("fill", d3.rgb(250, 250, 250))
        .attr('stroke', d3.rgb(200, 200, 200));

    $("#mainsvg").attr("style", "background-color: #FAFAFA;");
}

function reset_field() {
    d3.selectAll('.rect1, .year-topic').attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
    g.selectAll(".paper").data(nodes)
        .attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr('stroke', d => {
            let outlineColorVal = $("#outline-color").val();
            if (outlineColorVal == 0)
                return 'black';
            else if (outlineColorVal == 1) {
                if (d.isKeyPaper == 1)
                    return 'red';
                else if (d.isKeyPaper >= 0.5)
                    return 'pink';
                else
                    return 'black';
            }
            else if (outlineColorVal == 2) {
                if (d.citationCount < 10)
                    return 'black';
                else if (d.citationCount < 50)
                    return 'pink';
                else
                    return 'red';
            }
        });
    g.selectAll(".reference").attr('stroke', 'black');
    d3.selectAll(".year").attr("fill", "white").attr("stroke", "black");
    $("#mainsvg").attr("style", "background-color: white;");
}

function visual_topics(overall_field) {
    $("#overall-slider").val(0.5);
    $("#paper-slider").val(0.5);
    $("#hidden-slider").show();

    let fieldLevelVal = $("#field-level").val();
    let fields = fieldLevelVal == 1 ? field_roots : field_leaves;

    let topic_width = $("#topic-graph").width() * 0.7;
    let topic_height = $("#topic-info").height() - $("#topic-graph-extra").height();
    const topic_margin1 = 35;
    const topic_margin2 = 15;

    var xScale = d3.scaleLinear()
        .domain([d3.min(fields, field => field[3]), d3.max(fields, field => field[3])])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(fields, field => field[4]), d3.max(fields, field => field[4])])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    d3.selectAll("#overall-topic-svg").remove();

    const overall_topic_svg = d3.select("#overall-topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "overall-topic-svg");
    
    const overall_topic_g = d3.select("#overall-topic-svg").append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);

    // const d3line = d3.line().x(d => d.x).y(d => d.y);
    // var lineData1 = [{'x': -topic_margin1, 'y': topic_height / 2 - topic_margin2}, {'x': topic_width - topic_margin1, 'y': topic_height / 2 - topic_margin2}];
    // var lineData2 = [{'x': topic_width / 2 - topic_margin1, 'y': -topic_margin2}, {'x': topic_width / 2 - topic_margin1, 'y': topic_height - topic_margin2}];
    // overall_topic_g.append("path").attr("stroke", "grey").attr('stroke-width', 1).attr("fill", "none").attr("d", d3line(lineData1));
    // overall_topic_g.append("path").attr("stroke", "grey").attr('stroke-width', 1).attr("fill", "none").attr("d", d3line(lineData2));
    
    const overall_topics = overall_topic_g.selectAll(".overall-topic").data(fields).enter().append("circle")
        .attr("cx", d => xScale(d[3]))
        .attr("cy", d => yScale(d[4]))
        .attr("r", d => Math.sqrt(d[1]) / 8)
        .attr("fill", d => d3.hsv(d[5], d[6] * 0.5 + 0.5, d[7]))
        .attr("id", d => d[0])
        .attr("class", "overall-topic");

    const overall_topic_tip = d3.tip()
        .attr("class", "overall-topic-tip")
        .html(d => d[2]);
    overall_topic_svg.call(overall_topic_tip);

    overall_topics
    .on('mouseover', function (d) {
        let fieldColor = d3.select(this).attr("fill");
        fieldColor = fieldColor.slice(4, -1).split(', ');
        d3.select(this).attr('cursor', 'pointer');
        overall_topic_tip.show(d);

        let fieldId = d3.select(this).attr("id");
        console.log('fieldColor: ', fieldColor, fieldId);
        highlight_field(fieldId, fieldColor);
    })
    .on('mouseout', function (d) {
        overall_topic_tip.hide(d);
        reset_field();
    });


    d3.selectAll("#paper-topic-svg").remove();

    var xScale = d3.scaleLinear()
        .domain([d3.min(overall_field, d => d.cx), d3.max(overall_field, d => d.cx)])
        .range([0, topic_width - 2 * topic_margin1]);

    var yScale = d3.scaleLinear()
        .domain([d3.min(overall_field, d => d.cy), d3.max(overall_field, d => d.cy)])
        .range([topic_height * 0.85 - 2 * topic_margin2, 0]);

    const paper_topic_svg = d3.select("#paper-topic-distribution").append("svg")
        .attr("width", topic_width)
        .attr("height", topic_height * 0.85)
        .attr("id", "paper-topic-svg");
    
    const paper_topic_g = paper_topic_svg.append('g')
        .attr("transform", `translate(${topic_margin1}, ${topic_margin2})`);
    
    const paper_topics = paper_topic_g.selectAll(".paper-topic").data(overall_field).enter().append("circle")
        .attr("cx", d => xScale(d.cx))
        .attr("cy", d => yScale(d.cy))
        .attr("r", d => Math.sqrt(d.num) * 2)
        .attr("fill", d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr("id", d => d.id)
        .attr("class", "paper-topic");

    const paper_topic_tip = d3.tip()
        .attr("class", "paper-topic-tip")
        .html(d => d.name);
    paper_topic_svg.call(paper_topic_tip);

    paper_topics
    .on('mouseover', function (d) {
        let fieldColor = d3.select(this).attr("fill");
        fieldColor = fieldColor.slice(4, -1).split(', ');
        d3.select(this).attr('cursor', 'pointer');
        paper_topic_tip.show(d);

        let fieldId = d3.select(this).attr("id");
        highlight_field(fieldId, fieldColor);
    })
    .on('mouseout', function (d) {
        paper_topic_tip.hide(d);
        reset_field();
    });

    // paper_topic_svg.append("rect")
    //     .attr("x", topic_margin1)
    //     .attr("y", topic_height - topic_margin2)
    //     .attr("width", topic_width - 2 * topic_margin1)
    //     .attr("height", 3)
    //     .attr("fill", "#ccc");
    // const slider = paper_topic_svg.append("circle")
    //     .attr("cx", topic_margin1)
    //     .attr("cy", topic_height - topic_margin2 + 1.5)     //需要为上面的rect的height的一半
    //     .attr("r", 4)
    //     .attr("fill", "#000");
    // $("#paper-slider").slider();

    topic_list_width = $("#topic-graph").width() * 0.3;
    var topic_list_background = [];
    for (let i = 0; i < 10; i++) {
        let dic = {};
        dic.x = 0;
        dic.y = -1 + i * 20;
        topic_list_background.push(dic);
    }

    d3.selectAll("#overall-topic-list-svg").remove();

    d3.select("#overall-topic-list").append("svg")
        .attr("width", topic_list_width)
        .attr("height", topic_height)
        .attr("id", "overall-topic-list-svg");
    
    const overall_topic_list_g = d3.select("#overall-topic-list-svg").append('g');
    
    var topic_list_overall = [];
    var init_y = 15;
    for (let i = 0; i < fields.length; i++) {
        let dic = {};
        let text_arr = fields[i][2].split(' ');
        if (text_arr.length == 1) {
            dic.text = text_arr[0];
        }
        else {
            dic.text = text_arr[0] + ' ' + text_arr[1];
        }
        dic.x = 10;
        dic.y = init_y + i * 20;
        dic.color = [fields[i][5], fields[i][6], fields[i][7]];
        topic_list_overall.push(dic);
    }

    overall_topic_list_g.selectAll("rect").data(topic_list_background).enter().append("rect")
        .attr("x", 0)
        .attr("y", d => d.y)
        .attr("width", topic_list_width)
        .attr("height", 20)
        .attr("fill", d => {
            if (((d.y + 1) / 20) % 2 == 1) {
                return d3.rgb(230, 230, 230);
                return "#f8f8f8";
            }
            else {
                return "#f8f8f8";
            }
        });

    overall_topic_list_g.selectAll("text").data(topic_list_overall).enter().append("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .text(d => d.text)
        .attr("fill", d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr("textLength", d => {
            if (d.text.length >= 15) return topic_list_width * 0.85;
            else    return topic_list_width * 0.9 * d.text.length / 15;
        })
        .attr('text-anchor', 'left')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 14);

    d3.selectAll("#paper-topic-list-svg").remove();

    d3.select("#paper-topic-list").append("svg")
        .attr("width", topic_list_width)
        .attr("height", topic_height)
        .attr("id", "paper-topic-list-svg");
    
    const paper_topic_list_g = d3.select("#paper-topic-list-svg").append('g');
    
    var topic_list_paper = [];
    var init_y = 15;
    for (let i = 0; i < overall_field.length; i++) {
        let dic = {};
        let text_arr = overall_field[i].name.split(' ');
        if (text_arr.length == 1) {
            dic.text = text_arr[0];
        }
        else {
            dic.text = text_arr[0] + ' ' + text_arr[1];
        }
        dic.x = 10;
        dic.y = init_y + i * 20;
        dic.color = overall_field[i].color;
        topic_list_paper.push(dic);
    }

    paper_topic_list_g.selectAll("rect").data(topic_list_background).enter().append("rect")
        .attr("x", 0)
        .attr("y", d => d.y)
        .attr("width", topic_list_width)
        .attr("height", 20)
        .attr("fill", d => {
            if (((d.y + 1) / 20) % 2 == 1) {
                return d3.rgb(230, 230, 230);
            }
            else {
                return "#f8f8f8";
            }
        });
    
    paper_topic_list_g.selectAll("text").data(topic_list_paper).enter().append("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .text(d => d.text)
        .attr("fill", d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr("textLength", d => {
            if (d.text.length >= 15) return topic_list_width * 0.85;
            else    return topic_list_width * 0.9 * d.text.length / 15;
        })
        .attr('text-anchor', 'left')
        .attr('font-family', 'Times New Roman,serif')
        .attr('font-size', 14);
    
    if (topic_list_paper.length == 0) {
        $("#hidden-slider").hide();
    }

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

    const lines = g.selectAll('.reference').data(edges).enter().append('path')
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-width', 3)
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

        $("#papers-list").hide();
        $("#edge-info").hide();
        $("#up-line").hide();
        $("#down-line").hide();
        $("#topic-info").hide();
        $("#selector").show();
        $("#node-info").show();

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
    .on('mouseover', function () {
        d3.select(this)
            .attr("stroke", "red")
            .attr("stroke-width", 5)
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
        
        $("#papers-list").hide();
        $("#selector").hide();
        $("#node-info").hide();
        $("#up-line").hide();
        $("#down-line").hide();
        $("#topic-info").hide();
        $("#edge-info").show();
        let left_sider_height = $("#self-info").height();
        $("#citation-context").height(left_sider_height / 2.5);
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
    })
    .on('mouseout', function () {
        d3.select(this)
            .attr("stroke", d => {
                if (d.flag == 1)    return d3.rgb(200, 200, 200);
                else if (d.flag == 2)   return "red";
                else    return "black";
            })
            .attr("stroke-width", 3)
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
                .attr('stroke', 'black')
                .attr('stroke-dasharray', null);
            for (let i = 0; i < nodes.length; i++) {
                nodes[i].flag = 0;
            }
            for (let i = 0; i < edges.length; i++) {
                edges[i]['flag'] = 0;
            }
            $("#papers-list").show();
            $("#selector").hide();
            $("#node-info").hide();
            $("#up-line").hide();
            $("#down-line").hide();
            $("#topic-info").show();
            $("#edge-info").hide();
        }
    });
}

var outline_color_change = function () {
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
        })
    }
}

var outline_thickness_change = function () {
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
        })
    }
}

var fill_color_change = function () {
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

var field_level_change = function () {
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