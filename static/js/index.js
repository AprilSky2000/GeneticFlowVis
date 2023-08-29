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
    $("#topic-info").css("height", screenHeight / 4);
    var left_height = $("#basic-info").height() + $("#graph-info").height() + $("#topic-info").height();
    $("#timeline").css("height", left_height);
    $("#cited-papers").css("height", left_height * 1.03);
    $("#citing-papers").css("height", left_height * 1.03);
    // $("abstract").css("height", screenHeight / 3.4);

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
        var content = "<div style=\"float: left;\"><i style=\"width: 10px; height: 10px; border-radius: 50%; background-color: #00a78e; display: inline-block;\"></i></div>" + "<div style=\"margin-left: 7%;\"><b style=\"margin-left: 0%;\">" + paperName + "</b></div>" + "<p style=\"margin-top: 1%; margin-bottom: 1%; margin-left: 7%; color: #808080;\">" + paperFirstAuthor + "</p>";
        $("#timeline").append(content);
    }
    $("#paper-list").show();
}

function init_graph (viewBox, transform) {
    // let left_sider_height = $(".left-column").height();
    // $(".middle-column").height(left_sider_height * 1.2);

    const svg = d3.select(".middle-column").append("svg")
        .attr("width", $(".middle-column").width())
        .attr("height", $(".middle-column").height())
        .attr("viewBox", viewBox)
        .attr("id", "mainsvg");

    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", _ => g.attr("transform", d3.event.transform + transform));

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(function(d) { return d.name });

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

function visual_topics(overall_field) {
    $("#topic-slider").val(0.5);
    $("#topic-slider").show();

    let fieldLevelVal = $("#field-level").val();
    let fields = fieldLevelVal == 1 ? field_roots : field_leaves;

    let topic_width = $("#topic-map-graph").width();
    let topic_height = $("#topic-info").height() - $("#topic-map-banner").height();
    const topic_margin1 = 35;
    const topic_margin2 = 15;

    d3.selectAll("#topic-map-svg").remove();

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
        .attr("r", d => Math.sqrt(d.num) * 5)
        .attr("fill", d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]))
        .attr("stroke", "black")
        .attr("stroke-width", 0.2)
        .attr("id", d => d.id)
        .attr("class", "topic-map");

    const topic_map_tip = d3.tip()
        .attr("class", "topic-map-tip")
        .html(d => d.name);
    topic_map_svg.call(topic_map_tip);

    topics
    .on('mouseover', function (d) {
        let fieldColor = d3.select(this).attr("fill");
        fieldColor = fieldColor.slice(4, -1).split(', ');
        d3.select(this).attr('cursor', 'pointer');
        topic_map_tip.show(d);

        let fieldId = d3.select(this).attr("id");
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
    })
    .on('mouseout', function (d) {
        d3.selectAll('.rect1, .year-topic').attr('fill', d => d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]));
        topic_map_tip.hide(d);
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
    });
    
    if (overall_field.length == 0) {
        $("#topic-slider").hide();
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

        $("#paper-list").hide();
        $("#edge-info").hide();
        $("#up-line").hide();
        $("#down-line").hide();
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

        //因为abstract为overflow类型，需要先确定高度才能出现滑轮
        //同时为了使右侧和中间保持相对对齐，所以需要用中间列的高度-abstract上面一些元素的高度和
        //同样的计算内容在line.click中也出现了
        let other_height = 0;
        $(".abstract-minus-height").each(function() {
            other_height += $(this).height();
        });
        let abstract_height = (($("#paper-list").height() * 1.05 - $("#selector").height()) / 1.1 - other_height) / 1.08;
        $("#abstract").css("height", abstract_height);

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
        let citation_context_height = (($("#paper-list").height() * 1.05 - $("#selector").height()) / 1.1 - other_height) / 1.06;
        $("#citation-context").css("height", citation_context_height);
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
            $("#paper-list").show();
            $("#selector").hide();
            $("#node-info").hide();
            $("#up-line").hide();
            $("#down-line").hide();
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