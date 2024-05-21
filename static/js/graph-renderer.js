class GraphRenderer {

constructor(globalNodes, globalEdges, selectedTopic) {

    this.selectedTopic = selectedTopic;
    this.nodes = JSON.parse(JSON.stringify(globalNodes));
    this.edges = JSON.parse(JSON.stringify(globalEdges));

    if (this.selectedTopic !== null) {
        this.nodes = this.nodes.filter(d => hasTopic(d, selectedTopic));
        if (nodes.length == 0) {
            console.log('No nodes found in the selected topic', selectedTopic);
            return;
        }

        this.nodeSet = new Set(this.nodes.map(node => node.id));
        this.edges = this.edges.filter(edge => this.nodeSet.has(edge.source) && this.nodeSet.has(edge.target));
        edgeStrs = this.edges.map(edge => edge.source + '->' + edge.target); 

        let G = new Graph();
        this.nodes.forEach(node => {
            G.addNode(node.id, node);
        });
        this.edges.forEach(edge => {
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
        this.contextEdges = {};
        globalNodes.forEach(edge => {
            if (!edgeStrs.includes(`${edge.source}->${edge.target}`)) {
                let sourceNode = globalNodes.find(node => node.id === edge.source);
                let targetNode = globalNodes.find(node => node.id === edge.target);

                if (hasTopic(sourceNode, selectedTopic)) {
                    let key = `${sourceNode.id}->r${targetNode.year}`;
                    if (!this.contextEdges[key]) this.contextEdges[key] = [];
                    this.contextEdges[key].push(edge);
                    G.addEdge(sourceNode.id, `r${targetNode.year}`);
                }
                if (hasTopic(targetNode, selectedTopic)) {
                    let key = `l${sourceNode.year}->${targetNode.id}`;
                    if (!this.contextEdges[key]) this.contextEdges[key] = [];
                    this.contextEdges[key].push(edge);
                    G.addEdge(`l${sourceNode.year}`, targetNode.id);
                }
            }
        });

        this.virtualEdges = [];
        let components = G.findConnectedComponents();
        components.forEach(component => {
            let node = G.findLastNodeInComponent(component);
            if (node) {
                let nodeYear = G.nodeProperties.get(node).year;
                this.virtualEdges.push(`${node}->r${nodeYear}`);
            }
        });
    }

    this.paperField = [];    //该学者该话题的field信息
    this.nodes.forEach(node => {
        let topic = parseInt(node.topic);
        let ix = this.paperField.findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在this.paperField中新建k-v
            this.paperField.push({
                id: topic,
                num: 1,
                name: fields[topic][2],
                color: topic2color(topic),
                x: parseFloat(fields[topic][3]),
                y: parseFloat(fields[topic][4]),
                label: parseInt(fields[topic][8])
            });
        } else {
            this.paperField[ix].num += 1;
        }
    })

    this.minYear = Math.min(...this.nodes.map(node => node.year));
    this.maxYear = Math.max(...this.nodes.map(node => node.year));
    this.processedNodes = {};
    this.processedEdges = {};

    globalNodes.forEach(node => {
        // getTopicList(node).forEach(topic => {
            let topic = node.topic;
            let year = Math.floor(node.year / yearGrid) * yearGrid;
            let key = `${year}_${topic}`;

            if (topic != selectedTopic) {
                if (!this.processedNodes[key])  this.processedNodes[key] = []
                this.processedNodes[key].push(node);
            }
        // });
    });

    // Process edges data
    globalNodes.forEach(edge => {
        // Assuming source and target in edges are node IDs
        let sourceNode = globalNodes.find(node => node.id === edge.source);
        let targetNode = globalNodes.find(node => node.id === edge.target);

        let srcTopic = sourceNode.topic;
        let tgtTopic = targetNode.topic;
        let srcYear = Math.floor(sourceNode.year / yearGrid) * yearGrid;
        let tgtYear = Math.floor(targetNode.year / yearGrid) * yearGrid;
        
        if (selectedTopic !== null) {
            if (srcTopic !== selectedTopic && tgtTopic !== selectedTopic) return;   // 外部边
            if (srcTopic == selectedTopic && tgtTopic == selectedTopic) return;     // 内部边

            let key = srcTopic == selectedTopic? `-${tgtYear}_${tgtTopic}`: `${srcYear}_${srcTopic}-`;
            
            if (!this.processedEdges[key]) this.processedEdges[key] = []
            this.processedEdges[key].push(edge);
            
        } else {
            
            let key = `${srcYear}_${srcTopic}-${tgtYear}_${tgtTopic}`;
            if (!this.processedEdges[key]) {
                this.processedEdges[key] = []
            }
            this.processedEdges[key].push(edge);
        }
    });


    this.svgElement = null;
    this.viewBox = null;
    this.transform = null;
    this.viewBoxWidth = null;
    this.viewBoxHeight = null;
    this.svgWidth = null;
    this.svgHeight = null;
    this.moveDistance_r = null;
    this.moveDistance_l = null;
    this.viz = null;
    this.zoom = null;
}



createDot(edgeBundling) {
    /*
    Generates a DOT graph representation.

    Inputs:
        nodes: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        edges: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the nodes.
        maxYear: The maximum year among the nodes.
    */
    let dot = `digraph G {\n${edgeBundling == 6? '': 
    `concentrate=true
concentrate_type=` + edgeBundling}\n`; // \nnode [shape=circle]
    let yearDic = {};

    for (let year = this.minYear; year <= this.maxYear; year++) {
        dot += `year${year} [label="${year}"]\n`;
        yearDic[year] = [`year${year}`]
    }
    this.nodes.forEach(node => {
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

    this.edges.forEach(edge => {
        dot += `${edge.source}->${edge.target}\n`;
    });

    dot += '}';
    console.log('createDot', dot);
    return dot;
}


parseSVG(svgElement) {
    this.id2attr = {};
    // 解析节点
    svgElement.querySelectorAll('g.node').forEach(node => {
        const title = node.querySelector('title').textContent;
        const shape = node.querySelector('ellipse, polygon'); // 支持椭圆或多边形
        const text = node.querySelector('text');
        
        this.id2attr[title] = {
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

        this.id2attr[title] = {
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
}


renderDot(visType, vizContext, viz, edgeBundling) {
    let dot = this.createDot(edgeBundling);
    if (visType == 8 && this.selectedTopic !== null) {
        // subgraph + context
        dot = processDotContext(dot);
        console.log('context dot', dot);
        this.svgElement = vizContext.renderSVGElement(dot);
        // result = removeNewlinesAndAdjust(vizContext.renderString(dot)).replaceAll(' -> ', '->');
    } else {
        this.svgElement = viz.renderSVGElement(dot);
        // result = removeNewlinesAndAdjust(viz.renderString(dot)).replaceAll(' -> ', '->');
    }

    this.parseSVG(this.svgElement);
    this.viewBox = this.svgElement.getAttribute('viewBox');
    this.transform = this.svgElement.getAttribute('transform');

    // 遍历 id2attr，生成最终的节点和边
    this.years = [];
    for (let id in this.id2attr) {
        if (id.startsWith('year') && !id.includes('->')) {
            this.years.push({ id: this.id2attr[id].label, ...this.id2attr[id] });
        }
    }

    this.nodes.forEach(node => {
        Object.assign(node, this.id2attr[node.id]);
    });
    this.edges.forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        Object.assign(edge, this.id2attr[edgeKey]);  // 合并边的属性
    });

    ///////////////////////////////////////////////////////////////////////////////////
    // init graph, 创建一个svg元素，不绑定到DOM
    this.svg = d3.create('svg')
        .attr('viewBox', this.viewBox)
        .attr('width', this.svgElement.getAttribute('width'))
        .attr('height', this.svgElement.getAttribute('height'));
    
    this.g = this.svg.append('g')
        .attr('transform', this.transform)
        .attr('id', 'maingroup');
        
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", function() {
        let currentTransform = d3.event.transform;
    
        // 应用当前的变换到主要元素组g
        g.attr("transform", currentTransform.toString() + " " + transform);
    })
    this.svg.call(zoom);
    this.initSVG(visType);
}

initSVG(visType) {
    if (visType == 8) draw_context_edges();

    this.g.selectAll('circle').data(this.nodes).enter().append('ellipse')
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
            this.highlight_node(d.id);
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

transformNodeName(name) {
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


processDotContext(dot, edgeBundling, alpha=10) {
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
    Object.keys(this.contextEdges).forEach(edge => {
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
    this.minYear = l;
    this.maxYear = r;

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
    this.combinedContextEdges = {};
    Object.entries(this.contextEdges).forEach(([edge, edgeList]) => {
        let weight = edgeList.length;
        let [src, dst] = edge.split('->');
        let newEdge = `${this.transformNodeName(src)}->${this.transformNodeName(dst)}`;
        this.combinedContextEdges[newEdge] = this.combinedContextEdges[newEdge] || 
            { topics:{}, name: newEdge, edges: [], weight: 0, penwidth: 0, port: newEdge[0] === 'l' ? 'tailport=e' : 'headport=w' };
            this.combinedContextEdges[newEdge].weight += weight;
            this.combinedContextEdges[newEdge].penwidth += weight;  // 假设 penwidth 是累积的
        for (let edge of edgeList) {
            this.combinedContextEdges[newEdge].edges.push(edge);
            let topic = newEdge[0] == 'l'? paperID2topic[edge.source]: paperID2topic[edge.target];
            this.combinedContextEdges[newEdge].topics[topic] = (this.combinedContextEdges[newEdge].topics[topic] || 0) + 1;
        }
    });

    // 生成上下文边字符串
    let contextEdgesStr = Object.entries(this.combinedContextEdges).map(([edge, data]) =>
        `${edge} [color="lightgray", ${data.port}, weight=${data.weight}, penwidth=${data.penwidth}]`
    ).join('\n');
    let virtualEdgesStr = virtualEdges ? virtualEdges.map(edge => `${edge} [style="invis"]`).join('\n') : '';
    
    // 生成最终输出 DOT 字符串 node [shape=circle]
    return `
digraph G {

crossing_type=1
${edgeBundling == 6? '': 
`concentrate=true
concentrate_type=` + edgeBundling}

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




}

export default GraphRenderer;
