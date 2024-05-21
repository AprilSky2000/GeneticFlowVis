    // visType == 7

    function renderSide() {
        // Use constrain force layout to arrange nodes
        create_svg();
    
        // d3cola = cola.adaptor(d3)
        //     .linkDistance(80)
        //     .avoidOverlaps(true)
        //     .handleDisconnected(true)
        //     .size([svgWidth, svgHeight]);
    
        var d3cola = cola.d3adaptor(d3)
            .size([svgWidth, svgHeight]);
    
        // 计算每个条带的高度
        var years = global_nodes.map(n => n.year);
        var minYear = Math.min(...years);
        var maxYear = Math.max(...years);
        var yearSpan = maxYear - minYear + 1;
        var bandHeight = svgHeight / yearSpan;
    
        let yearSlider = document.getElementById('yearSlider');
        yearSlider.noUiSlider.updateOptions({
            range: {
                'min': minYear,
                'max': maxYear+1 // 'range' 'min' and 'max' cannot be equal.
            }
        });
        // *IMPORTANT*: 更新滑块的值，确保滑块的值也更新，你需要同时设置 set 选项
        yearSlider.noUiSlider.set([minYear, maxYear+1]);
    
        // 分配节点到对应的条带
        allnodes = JSON.parse(JSON.stringify(nodes));
        allnodes.forEach(function(node) {
            var yearIndex = node.year - minYear; // 计算年份索引
            // 对x取一个 0 到 svgWidth 的值随机数
            node.x = svgWidth / 2; 
            // node.x = Math.random() * svgWidth;
            // 计算节点的y位置，确保在对应的条带内部
            node.y = bandHeight * yearIndex + (bandHeight / 2);
        });
        let centerNodes = allnodes.map(d => d.id);
    
    
        var yearNodes = [];
        for (let year = minYear; year <= maxYear + 1; year++) {
            yearNodes.push({
                id: 'year' + year, // 给年份节点一个唯一ID
                year: year,
                fixed: true, // 固定节点位置，不让布局算法移动它
                x: svgWidth / 2,
                y: (year - minYear) * bandHeight,
                fixedWeight: 1e6
            });
        }
        allnodes = allnodes.concat(yearNodes); // 将年份节点添加到节点列表中
    
        // 设置边
        edgeMap = edges.map(function(e) {
            return {
                // source: nodeMap[e.source], 
                // target: nodeMap[e.target]
                source: allnodes.findIndex(n => n.id == e.source), 
                target: allnodes.findIndex(n => n.id == e.target),
                value: e.extends_prob,
                name: e.source + '->' + e.target
            };
        });
        let sumOfRow = (matrix, ix) => matrix[ix].reduce((acc, cur) => acc + cur, 0);
        let sumOfColumn = (matrix, ix) => matrix.map(row => row[ix]).reduce((acc, cur) => acc + cur, 0);
        if (selectedTopic !== null) {
            let selectedTopic_ix = arrangement.findIndex(d=> d==selectedTopic);
            let selectedTopic_in = sumOfColumn(adjacentMatrix, selectedTopic_ix);
            let selectedTopic_out = sumOfRow(adjacentMatrix, selectedTopic_ix);
            let selectedTopic_width = selectedTopic_in + selectedTopic_out;
            allnodes.push({
                id: 'topic' + selectedTopic + 'l',
                fixed: true,
                x: svgWidth / 2 - selectedTopic_width / 2,
                y: svgHeight / 2,
                fixedWeight: 1e6
            })
            allnodes.push({
                id: 'topic' + selectedTopic + 'r',
                fixed: true,
                x: svgWidth / 2 + selectedTopic_width / 2,
                y: svgHeight / 2,
                fixedWeight: 1e6
            })
        }
    
        let constraints = [];
        // 创建对于每个年份条带的约束
        allnodes.forEach((node, ix) => {
            if (centerNodes.includes(node.id)) { // 确保这是一个实际数据节点
                constraints.push({
                    axis: 'y',
                    type: 'separation',
                    left: allnodes.findIndex(n => n.id === 'year' + node.year), // 当前年份的代表节点
                    right: ix,
                    gap: 1,
                    equality: false
                });
                constraints.push({
                    axis: 'y',
                    type: 'separation',
                    left: ix, // 当前年份的代表节点
                    right: allnodes.findIndex(n => n.id === 'year' + (node.year + 1)),
                    gap: 1,
                    equality: false
                });
                if (selectedTopic !== null) {
                    constraints.push({
                        axis: 'x',
                        type: 'separation',
                        left: allnodes.findIndex(n => n.id === 'topic' + selectedTopic + 'l'),
                        right: ix,
                        gap: 1,
                        equality: false
                    });
                    constraints.push({
                        axis: 'x',
                        type: 'separation',
                        left: ix,
                        right: allnodes.findIndex(n => n.id === 'topic' + selectedTopic + 'r'),
                        gap: 1,
                        equality: false
                    });
                }
            }
        });
        
        if (selectedTopic !== null) {
            let selectedTopic_ix = arrangement.findIndex(d=> d==selectedTopic);
            let selectedTopic_in = sumOfColumn(adjacentMatrix, selectedTopic_ix);
            let selectedTopic_out = sumOfRow(adjacentMatrix, selectedTopic_ix);
            let selectedTopic_width = selectedTopic_in + selectedTopic_out;
    
            // 添加主题，对当前影响最大的5个，和当前影响最大的5个
            let column = adjacentMatrix.map(row => row[selectedTopic_ix])
            // 选出column最大5个对应的index，从大到小
            top5_in = column.map((d, i) => [d, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(d => d[1]);
    
            let left_x = svgWidth / 2 - selectedTopic_width / 2;
            top5_in.forEach((topic_ix, i) => {
                let width = sumOfRow(adjacentMatrix, topic_ix);
                let topic = arrangement[topic_ix];
                console.log('top5_in: topic_ix', topic_ix, 'topic_id', topic, 'width', width, 'flow', adjacentMatrix[topic_ix][selectedTopic_ix])
                left_x -= width / 2;
                
                allnodes.push({
                    id: 'topic' + topic,
                    fixed: true,
                    x: left_x,
                    y: svgHeight / 2,
                    fixedWeight: 1e6
                })
                TTMEdges[topic][selectedTopic].forEach(edge => {
                    node = global_nodes.find(n => n.id == edge.source);
                    if (allnodes.findIndex(n => n.id == node.id) == -1) {
                        let n = JSON.parse(JSON.stringify(node));
                        // let ix = allnodes.length;
                        n.x = left_x;
                        n.y = svgHeight / 2;
                        allnodes.push(n);
    
                        constraints.push({
                            axis: 'y',
                            type: 'separation',
                            left: allnodes.findIndex(n => n.id === 'year' + node.year), 
                            right: allnodes.findIndex(n => n.id === node.id),
                            gap: 1,
                            equality: false
                        });
                        constraints.push({
                            axis: 'y',
                            type: 'separation',
                            left: allnodes.findIndex(n => n.id === node.id),
                            right: allnodes.findIndex(n => n.id === 'year' + (node.year + 1)),
                            gap: 1,
                            equality: false
                        });
                    }
    
                    edgeMap.push({
                        source: allnodes.findIndex(n => n.id == edge.source),
                        target: allnodes.findIndex(n => n.id == edge.target),
                        value: edge.extends_prob,
                        name: edge.source + '->' + edge.target
                    });
                })
    
                let offsets = []
                for (i = allnodes.findIndex(n => n.id === 'topic' + topic); i < allnodes.length; i++) {
                    offsets.push({
                        "node": i,
                        "offset": 0
                    })
                }
    
                constraints.push({
                    "type": "alignment",
                    "axis": "x",
                    "offsets": offsets
                })
    
                // left_x -= width / 2;
            })
    
            // 右侧图
            let row = adjacentMatrix[selectedTopic_ix]
            // 选出column最大5个对应的index，从大到小
            top5_out = row.map((d, i) => [d, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map(d => d[1]);
    
            let right_x = svgWidth / 2 + selectedTopic_width / 2;
            top5_out.forEach((topic_ix, i) => {
                let width = sumOfColumn(adjacentMatrix, topic_ix);
                let topic = arrangement[topic_ix];
                console.log('top5_out: topic_ix', topic_ix, 'topic_id', topic, 'width', width, 'flow', adjacentMatrix[selectedTopic_ix][topic_ix])
                right_x += width / 2;
                
                allnodes.push({
                    id: 'topic' + topic + 'r',
                    fixed: true,
                    x: right_x,
                    y: svgHeight / 2,
                    fixedWeight: 1e6
                })
                TTMEdges[selectedTopic][topic].forEach(edge => {
                    node = global_nodes.find(n => n.id == edge.target);
                    if (allnodes.findIndex(n => n.id == node.id + 'r') == -1) {
                        let nr = JSON.parse(JSON.stringify(node));
                        // let ix = allnodes.length;
                        nr.id = nr.id + 'r';
                        nr.x = right_x;
                        nr.y = svgHeight / 2;
                        allnodes.push(nr);
    
                        constraints.push({
                            axis: 'y',
                            type: 'separation',
                            left: allnodes.findIndex(n => n.id === 'year' + node.year), 
                            right: allnodes.findIndex(n => n.id === nr.id),
                            gap: 1,
                            equality: false
                        });
                        constraints.push({
                            axis: 'y',
                            type: 'separation',
                            left: allnodes.findIndex(n => n.id === nr.id),
                            right: allnodes.findIndex(n => n.id === 'year' + (node.year + 1)),
                            gap: 1,
                            equality: false
                        });
                    }
    
                    edgeMap.push({
                        source: allnodes.findIndex(n => n.id == edge.source),
                        target: allnodes.findIndex(n => n.id == edge.target + 'r'),
                        value: edge.extends_prob,
                        name: edge.source + '->' + edge.target
                    });
                })
    
                let offsets = []
                for (i = allnodes.findIndex(n => n.id === 'topic' + topic + 'r'); i < allnodes.length; i++) {
                    offsets.push({
                        "node": i,
                        "offset": 0
                    })
                }
    
                constraints.push({
                    "type": "alignment",
                    "axis": "x",
                    "offsets": offsets
                })
            })
        }
        
    
        console.log('allnodes', allnodes, 'edgeMap', edgeMap, 'constraints', constraints);
    
        // 应用cola布局，包括约束
        d3cola
        .nodes(allnodes)
        .links(edgeMap)
        .constraints(constraints)
        .jaccardLinkLengths(40, 0.7)
        .handleDisconnected(true)
        .avoidOverlaps(true)
        .start(10,15,20);
        
        // 绘制边
        maxOpacity = 0.5;
        d3link = g.selectAll(".link")
            .data(edgeMap)
            .enter().append("line")
            .attr("class", "link")
            .style("opacity", 0.5)// d => probToOpacity(d.extends_prob))
            .style("stroke", d=> topic2color(d.source.topic))
            .style("stroke-width",  d => probToWidth(d.extends_prob) / 20)
            .attr('id', d => d.name)
            .attr('class', 'reference')
            .on('mouseover', function (d) {
                d3.select(this)
                    .style("stroke", "red")
                    .style("opacity", 1)
                    .attr('cursor', 'pointer');
                tip.show(d);
            })
            .on('mouseout', function (d) {
                tip.hide(d);
                d3.select(this)
                    .style("stroke", d=> topic2color(d.source.topic))
                    .style("opacity", 0.5)
            });
    
        guideline = svg.selectAll(".guideline")
            .data(constraints.filter(function (c) { return c.type === 'alignment' }))
            .enter().append("line")
            .attr("class", "guideline")
            .attr("stroke-dasharray", "5,5");
    
        // 绘制节点
        d3node = g.selectAll(".node")
            .data(allnodes)
            .enter().append("circle")
            .attr("class", "node")
            .attr('id', d => d.id)
            .attr('class', 'paper')
            .attr("r", d => centerNodes.includes(d.id)? 3:1)
            .style("fill", function(d) { return topic2color(d.topic); })
            .style("stroke", d => updateOutlineColor(d.isKeyPaper, d.citationCount))
            .style('stroke-width', d => updateOutlineThickness(d.isKeyPaper, d.citationCount) / 10)
            .on('mouseover', function (d) {
                d3.select(this).attr('cursor', 'pointer');
                tip.show(d);
            })
            .on('mouseout', function (d) {
                tip.hide(d);
            })
            .call(d3cola.drag);
    
        // 更新节点和边的位置
        d3cola.on("tick", function() {
            d3link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
    
            guideline
                .attr("x1", function (d) { return getAlignmentBounds(allnodes, d).x; })
                .attr("y1", function (d) {
                    return d.bounds.y;
                })
                .attr("x2", function (d) { return d.bounds.X; })
                .attr("y2", function (d) {
                    return d.bounds.Y;
                });
    
            d3node.attr("cx", function(d) { return d.x; })
                .attr("cy", function(d) { return d.y; });
    
            // 输出当前的节点和边的位置
            // console.log('Tick Update: ', new Date().toISOString());
            // allnodes.forEach((node, index) => {
            //     console.log(`Node ${index} (${node.id}): x=${node.x}, y=${node.y}`);
            // });
            // edgeMap.forEach((edge, index) => {
            //     console.log(`Edge ${index}: source=(${edge.source.x}, ${edge.source.y}), target=(${edge.target.x}, ${edge.target.y})`);
            // });
        });
    }
    
    
    function getAlignmentBounds(vs, c) {
        var os = c.offsets;
        if (c.axis === 'x') {
            var x = vs[os[0].node].x;
            c.bounds = new cola.Rectangle(x, x,
                Math.min.apply(Math, os.map(function (o) { return vs[o.node].bounds.y - 20; })),
                Math.max.apply(Math, os.map(function (o) { return vs[o.node].bounds.Y + 20; })));
        } else {
            var y = vs[os[0].node].y;
            c.bounds = new cola.Rectangle(
                Math.min.apply(Math, os.map(function (o) { return vs[o.node].bounds.x - 20; })),
                Math.max.apply(Math, os.map(function (o) { return vs[o.node].bounds.X + 20; })),
                y, y);
        }
        return c.bounds;
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
            highlight_node(params.data.id);
        } else if (params.dataType === 'edge') {
            highlight_edge(params.data.source + '->' + params.data.target);
        } 
    });

    forceChart.setOption(option);
    draw_tagcloud();
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



function processData(nodes, edges) {
    let processedNodes = {};
    let processedEdges = {};

    // Process nodes data
    nodes.forEach(node => {
        // getTopicList(node).forEach(topic => {
            let topic = node.topic;
            let year = Math.floor(node.year / yearGrid) * yearGrid;
            let key = `${year}_${topic}`;
            if (!processedNodes[key]) {
                processedNodes[key] = []
            }
            processedNodes[key].push(node);
        // });
    });

    console.log(JSON.stringify(Object.keys(processedNodes)))

    // Process edges data
    edges.forEach(edge => {
        // Assuming source and target in edges are node IDs
        let sourceNode = nodes.find(node => node.id === edge.source);
        let targetNode = nodes.find(node => node.id === edge.target);
        // let sourceTopicList = getTopicList(sourceNode);
        // let targetTopicList = getTopicList(targetNode);
        // // 去除相同元素，不能相继filter
        // let sourceTopicListCopy = [...sourceTopicList];
        // sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        // targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        // sourceTopicList.forEach(srcTopic => {
        //     targetTopicList.forEach(tgtTopic => {

                let srcTopic = sourceNode.topic;
                let tgtTopic = targetNode.topic;
                let srcYear = Math.floor(sourceNode.year / yearGrid) * yearGrid;
                let tgtYear = Math.floor(targetNode.year / yearGrid) * yearGrid;

                if (Object.keys(processedNodes).includes(`${srcYear}_${srcTopic}`)) console.log('src not find', `${srcYear}_${srcTopic}`)
                if (Object.keys(processedNodes).includes(`${tgtYear}_${tgtTopic}`)) console.log('tgt not find', `${tgtYear}_${tgtTopic}`)
                if (selectedTopic !== null) {
                    if (srcTopic !== selectedTopic && tgtTopic !== selectedTopic) return;
                    let key = srcTopic == selectedTopic? `-${tgtYear}_${tgtTopic}`: `${srcYear}_${srcTopic}-`;
                    
                    if (!processedEdges[key]) {
                        processedEdges[key] = []
                    }
                    processedEdges[key].push(edge);
                    
                } else {
                    
                    let key = `${srcYear}_${srcTopic}-${tgtYear}_${tgtTopic}`;
                    if (!processedEdges[key]) {
                        processedEdges[key] = []
                    }
                    processedEdges[key].push(edge);
                }
                
        //     })
        // })
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


function temporalThematicFlow() {
    // Step1: Data Processing for Temporal-Topic Matrix Construction
    // let { processedNodes, processedEdges } = processData(global_nodes, global_edges);
    // console.log('processedNodes', processedNodes, 'processedEdges', processedEdges);

    let topicGrids = [], yearGrids = [];
    Object.keys(processedNodes).forEach(key => {
        let [year, topic] = key.split('_');
        if (!topicGrids.includes(topic)) topicGrids.push(topic);
        if (!yearGrids.includes(year)) yearGrids.push(year);
    });
    yearGrids.sort((a, b) => a - b);

    // Step 3: Pie Chart Node Visualization
    // Assuming 'groupedNodes' is already defined and loaded
    // Select the div with id 'mainsvg' and append an SVG element to it
    
    let margin = { top: 100, right: 20, bottom: 20, left: 100 };
    let innerWidth = svgWidth - margin.left - margin.right;
    let innerHeight = svgHeight - margin.top - margin.bottom;
    let viewBox = `0 0 ${svgWidth} ${svgHeight}`;
    let transform = `translate(${margin.left}, ${margin.top})`;
    create_svg(viewBox, transform);
    

    // 假设 'groupedTopics' 是您分组主题的数组
    // 'yearGrids' 是年份网格的数组
    let xScale = d3.scaleBand().domain(arrangement).range([0, innerWidth]);
    let yScale = d3.scaleBand().domain(yearGrids).range([0, innerHeight]);
    
    // 添加左边的坐标轴
    g.append("g")
        .call(d3.axisLeft(yScale))
        .attr("transform", `translate(-30, -${yScale.bandwidth() / 2})`);
    
    // 添加顶部的坐标轴
    g.append("g")
        .call(d3.axisTop(xScale))
        .attr("transform", `translate(-${xScale.bandwidth() / 2}, -30)`);  // 将顶部坐标轴向上移动以与 SVG 顶部对齐
    

    var pie = d3.pie().value(1); // Modify as per your data structure
    var node_data = {};
    // Create pie charts for each grouped node
    for (let [k, v] of Object.entries(processedNodes)) {
        let [year, topic] = k.split('_');
        let pieData = pie(v);
        node_data[k] = {x: xScale(topic), y: yScale(year)};

        // console.log(group, pieData)

        // Create a group for each pie chart
        let gg = g.append("g")
                .attr("transform", `translate(${xScale(topic)}, ${yScale(year)})`);

        var arc = d3.arc()
                .innerRadius(0) // for a pie chart, inner radius is 0
                .outerRadius(Math.sqrt(v.length)*5);

        gg.selectAll(".arc")
            .data(pieData)
            .enter()
            .append("path")
            .attr("d", arc)
            .attr("class", d => "arc arc_" + topic)
            .style("fill", topic2color(topic))
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

    // Transform groupedEdges to edge_data
    // var edge_data = [{"source":"0", "target":"1"}, {"source":"4", "target":"2"}, {"source":"0", "target":"3"}, {"source":"0","target":"4"}, {"source":"2", "target":"5"}, {"source":"3", "target":"2"}, {"source":"3", "target":"4"}]
    var edge_data = []

    for (let [k, v] of Object.entries(processedEdges)) {
        let [source, target] = k.split('-');
        edge_data.push({
            source: source, 
            target: target,
            t1: source.split('_')[1],
            t2: target.split('_')[1],
            edge: v
        });
    }

    console.log('node_data', node_data, 'edge_data', edge_data)

    var fbundling = d3.ForceEdgeBundling()
				.nodes(node_data)
				.edges(edge_data);
	var results   = fbundling();
    console.log('results', results)

    var d3line = d3.line().x(d=>d.x).y(d=>d.y).curve(d3.curveLinear);
    results.forEach((data, ix) => {	
    // for each of the arrays in the results 
    // draw a line between the subdivions points for that edge
        let edge = edge_data[ix];
        // let opacity = edge.prob / edge.count / 2;
        let opacity = 0.5;
        
        let c = topic2color(edge.t1, 0.7);
        // console.log('edge', edge, edge.source.topic, c)
        g.append("path")
            .attr("d", d3line(data)) 
            .style("stroke", c)
            .attr("class", `link link_${edge.t1} link_${edge.t2} link_${edge.source} link_${edge.target}`)
            .style("fill", "none")
            .style('stroke-opacity',opacity) //use opacity as blending
            .style("stroke-width", Math.sqrt(edge.edge.count) * 2)
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
    //         .style("stroke", 'black');
    //         // tip.show(d);
    //     })
    //     .on("mouseout", function(d) {
    //         d3.select(this).attr('cursor', 'default')
    //         .style("stroke", '#999');
    //         // tip.hide(d);
    //     })
    //     .on("click", function(d) {
    //         console.log(d);
    //     });
}
