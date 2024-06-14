let showUnreferenced = false;  // 默认不显示无引用关系的论文
let showYearMatrix = false;    // 默认不显示年份矩阵

function drawMatrix() {
    var topicNodesMap = new Map();
    nodes.forEach(node => {
        const topicKey = node.topic;
        if (!topicNodesMap.has(topicKey)) {
            topicNodesMap.set(topicKey, []);
        }
        topicNodesMap.get(topicKey).push(node);
    });
    topicNodesMap.forEach((value, _) => {
        value.sort((a, b) => {
            if (a.year != b.year) return a.year - b.year;
            else return b.citationCount - a.citationCount;
        });
    });

    topicNodesList = Array.from(topicNodesMap).sort((a, b) => b[1].length - a[1].length);

    sortNodes = topicNodesList.reduce((accumulator, current) => {
        return accumulator.concat(current[1]);
    }, []);

    var adjacencyMatrix = Array(sortNodes.length).fill().map(() =>
            Array(sortNodes.length).fill().map(() => ({
                // "color": [0, 0, 0],         // 初始化为白色
                "source":"", "target":"",
                "sourceCitation": -1, "targetCitation": -1,
            })));

    const findIndexById = (id) => sortNodes.findIndex(node => node.id == id);

    edges.forEach(edge => {
        const source = findIndexById(edge.source);
        const target = findIndexById(edge.target);
        if (source != -1 && target != -1) {
            // adjacencyMatrix[source][target].color =
            //         sortNodes[source].topic == sortNodes[target].topic ? sortNodes[source].color : [0, 0, 0.5];
            adjacencyMatrix[source][target].source = `${sortNodes[source].name}(${sortNodes[source].year})(${sortNodes[source].citationCount})`;
            adjacencyMatrix[source][target].target = `${sortNodes[target].name}(${sortNodes[target].year})(${sortNodes[target].citationCount})`;
            adjacencyMatrix[source][target].sourceCitation = sortNodes[source].citationCount || 0;
            adjacencyMatrix[source][target].targetCitation = sortNodes[target].citationCount || 0;
        }
    });

    // 绘制矩阵
    d3.select('#maingroup').remove();
    d3.select('#mainsvg').append("g")
            // .attr('transform', d3.event.transform)
            .attr("id", "maingroup");
    zoom = d3.zoom()
            .scaleExtent([0.05, 10])
            .on("zoom", _ => d3.select("#maingroup").attr("transform", d3.event.transform));
    d3.select("#mainsvg").call(zoom);
    const size = 50;
    // const maxCitation = Math.max(...sortNodes.map(node => node.citationCount || 0));
    const maxCitation = 1000;
    const barMaxWidth = 500;  // 柱状图的最大宽度，可根据需要调整

    d3.select('#maingroup').selectAll('.topicMatrix')
        .data(adjacencyMatrix.flat())
        .enter()
        .append('rect')
        .attr('x', (_, i) => (i % nodes.length) * size)
        .attr('y', (_, i) => Math.floor(i / nodes.length) * size)
        .attr('width', size)
        .attr('height', size)
        .attr('fill', d => {
            if (d.sourceCitation == -1 && d.targetCitation == -1) return "white";
            else if (d.sourceCitation >= 100 && d.targetCitation >= 100) return "red";
            else if (d.sourceCitation >= 100 && d.targetCitation < 100) return "orange";
            else if (d.sourceCitation < 100 && d.targetCitation >= 100) return "blue";
            else if (d.sourceCitation < 100 && d.targetCitation < 100) return d3.rgb(169,169,169);
        })
        .attr('stroke', d3.hsv(0, 0, 1))
        .attr('stroke-width', 0)
        .attr('class', 'topicMatrix');
    const tipMatrix = d3.tip()
        .attr("class", "d3-tip-matrix")
        .html(d => {
            if (d.source == '' && d.target == '') return "";
            return `<div>${d.source}</div><div>&#8595;</div><div>${d.target}</div>`;
        });

    d3.select('#mainsvg').call(tipMatrix);
    d3.selectAll(".topicMatrix")
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tipMatrix.show(d, this);
    })
    .on('mouseout', function (d) {
        tipMatrix.hide(d, this);
    });

    d3.select('#maingroup').selectAll('.unknown')
        .data(sortNodes)
        .enter()
        .append('rect')
        .attr('x', node => - (((node.citationCount > maxCitation ? maxCitation : node.citationCount) || 0) / maxCitation * barMaxWidth))
        .attr('y', (_, i) => i * size)
        .attr('width', node => (((node.citationCount > maxCitation ? maxCitation : node.citationCount) || 0) / maxCitation * barMaxWidth))
        .attr('height', size)
        .attr('fill', d3.rgb(169,169,169))
        .attr('class', 'matrixBar');
    d3.select('#maingroup').selectAll('.unknown')
        .data(sortNodes)
        .enter()
        .append('rect')
        .attr('x', (_, i) => i * size)
        .attr('y', node => - (((node.citationCount > maxCitation ? maxCitation : node.citationCount) || 0) / maxCitation * barMaxWidth))
        .attr('width', size)
        .attr('height', node => ((node.citationCount > maxCitation ? maxCitation : node.citationCount) || 0) / maxCitation * barMaxWidth)
        .attr('fill', d3.rgb(169,169,169))
        .attr('class', 'matrixBar');

    const tipMatrixBar = d3.tip()
        .attr("class", "d3-tip-matrix")
        .html(d => {
            return `<div>${d.name}(${d.citationCount})</div>`;
        });
    d3.select('#mainsvg').call(tipMatrixBar);
    d3.selectAll(".matrixBar")
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tipMatrixBar.show(d, this);
    })
    .on('mouseout', function (d) {
        tipMatrixBar.hide(d, this);
    });

    // Draw submatrix borders
    var start = 0;
    topicNodesList.forEach(([topicId, topicNodeSet], index) => {
        const len = topicNodeSet.length;
        d3.select('#maingroup').append('rect')
            .attr('x', start * size)
            .attr('y', start * size)
            .attr('width', len * size)
            .attr('height', len * size)
            .attr('fill', 'none')
            .attr('stroke', hsvToColor(topicNodeSet[0].color))
            .attr('stroke-width', 10);
        start += len;
    });
}

function addYearLabels(matrixGroup, nodes, cellSize, gap) {
    const labelOffset = Math.min(cellSize * 0.1, gap * 0.1); // 标签与矩阵的距离，设置为单元格大小的一半
    const fontSize = Math.min(cellSize * 0.3, gap * 0.1);    // 字体大小设置为单元格大小的30%

    // 添加列标签（年份）
    matrixGroup.selectAll('.unknown')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.year)  // 假设节点对象中有一个年份属性
        .attr('x', (_, i) => i * cellSize + cellSize / 2)  // 居中对齐
        .attr('y', -labelOffset)  // 在矩阵上方留出一些空间
        .attr('text-anchor', 'middle')  // 文本居中对齐
        .attr('font-size', `${fontSize}px`)  // 设置字体大小
        .attr('class', 'yearLabel');

    // 添加行标签（年份）
    matrixGroup.selectAll('.unknown')
        .data(nodes)
        .enter()
        .append('text')
        .text(d => d.year)
        .attr('x', -labelOffset)  // 在矩阵左侧留出更多空间
        .attr('y', (_, i) => i * cellSize + cellSize / 2 + fontSize / 3)  // 调整位置以居中对齐
        .attr('text-anchor', 'end')  // 文本右对齐
        .attr('font-size', `${fontSize}px`)  // 设置字体大小
        .attr('class', 'yearLabel');
}

// function drawInterYearInteractions(matrixGroup, topicNodes, cellSize) {
//     const yearIndexRanges = {};
//     topicNodes.forEach((node, index) => {
//         if (!yearIndexRanges[node.year]) {
//             yearIndexRanges[node.year] = { start: index, end: index };
//         } else {
//             yearIndexRanges[node.year].end = index;
//         }
//     });

//     const years = Object.keys(yearIndexRanges).map(Number).sort((a, b) => a - b);
//     var colorList = d3.schemeCategory10.slice(0, years.length);
//     years.forEach((year, idx) => {
//         const currentRange = yearIndexRanges[year];
//         for (let nextIdx = years.length - 1; nextIdx >= idx; nextIdx--) {
//             const nextYear = years[nextIdx];
//             const nextRange = yearIndexRanges[nextYear];
//             matrixGroup.append('rect')
//                 .attr('x', nextRange.start * cellSize)
//                 .attr('y', currentRange.start * cellSize)
//                 .attr('width', (nextRange.end - nextRange.start + 1) * cellSize)
//                 .attr('height', (currentRange.end - currentRange.start + 1) * cellSize)
//                 .attr('fill', 'none')
//                 .attr('stroke', colorList[nextIdx - idx])
//                 .attr('stroke-width', 30)
//                 .attr('class', 'yearMatrix');
//         }
//     });
// }
function drawInterYearInteractions(matrixGroup, nodes, cellSize) {
    const yearIndexRanges = {};
    nodes.forEach((node, index) => {
        if (!yearIndexRanges[node.year]) {
            yearIndexRanges[node.year] = { start: index, end: index };
        } else {
            yearIndexRanges[node.year].end = index;
        }
    });

    const years = Object.keys(yearIndexRanges).map(Number).sort((a, b) => a - b);
    const colorScale = d3.scaleLinear()
        .domain([0, years.length - 1])
        .range(["#505050", "#D3D3D3"]);  // 从深灰到浅灰

    years.forEach((year, idx) => {
        const currentRange = yearIndexRanges[year];
        if (showYearMatrix) {
            // 绘制所有存在年份差的矩阵
            for (let nextIdx = years.length - 1; nextIdx >= idx; nextIdx--) {
                const nextYear = years[nextIdx];
                const nextRange = yearIndexRanges[nextYear];
                matrixGroup.append('rect')
                    .attr('x', nextRange.start * cellSize)
                    .attr('y', currentRange.start * cellSize)
                    .attr('width', (nextRange.end - nextRange.start + 1) * cellSize)
                    .attr('height', (currentRange.end - currentRange.start + 1) * cellSize)
                    .attr('fill', 'none')
                    .attr('stroke', colorScale(nextIdx - idx))
                    .attr('stroke-width', 50)
                    .attr('class', 'yearMatrix');
            }
        } else {
            // 仅绘制对角线上的正方形
            matrixGroup.append('rect')
                .attr('x', currentRange.start * cellSize)
                .attr('y', currentRange.start * cellSize)
                .attr('width', (currentRange.end - currentRange.start + 1) * cellSize)
                .attr('height', (currentRange.end - currentRange.start + 1) * cellSize)
                .attr('fill', 'none')
                .attr('stroke', '#505050')  // 使用浅灰色
                .attr('stroke-width', 50)
                .attr('class', 'yearMatrix');
        }
    });
}

function shiftSubMatrix() {
    // 清除之前的子矩阵元素和标签
    d3.select('#maingroup').selectAll('.subMatrix').remove();
    d3.select('#topicLabel').remove();
    d3.select('#nextTopicButton').remove();
    d3.select('#nextTopicButtonText').remove();
    d3.select('#maingroup').select('#matrixGroup').remove();

    const localIndexById = id => topicNodes.findIndex(node => node.id == id);

    var topicNodes = topicNodesList[topicIndex % topicNodesList.length][1];
    let fieldDepthVal = $("#field-level").val();
    let fields = fieldDepthVal == 1 ? field_roots : field_leaves;

    // 检测并过滤无引用关系的论文
    let activeNodes = [];
    let activeNodeIndices = new Set();  // 用于存储有引用关系的索引

    edges.forEach(edge => {
        const localSource = localIndexById(edge.source);
        const localTarget = localIndexById(edge.target);
        if (localSource != -1 && localTarget != -1 && topicNodes[localSource].topic == topicNodesList[topicIndex % topicNodesList.length][0]) {
            activeNodeIndices.add(localSource);
            activeNodeIndices.add(localTarget);
        }
    });

    // 根据有效的索引过滤节点
    activeNodes = topicNodes.filter((_, index) => activeNodeIndices.has(index));

    // 根据showUnreferenced变量决定是否过滤无引用关系的论文
    if (!showUnreferenced) {
        topicNodes = activeNodes;
    }

    var topicName = fields[topicNodes[0].topic][2];
    var len = topicNodes.length;

    // 设置子矩阵的方格大小
    const mainMatrixSize = sortNodes.length * 50; // 主矩阵总宽度
    const gap = sortNodes.length * 10; // 主矩阵与子矩阵之间的间隙
    const matrixPadding = 200; // 预留空间给按钮和标签
    const subMatrixWidth = mainMatrixSize - matrixPadding; // 子矩阵的总宽度
    var subMatrixSize = subMatrixWidth / len; // 计算子矩阵每个方格的大小
    var matrixGroup = d3.select('#maingroup').append('g')
        .attr('transform', `translate(${mainMatrixSize + gap}, ${0})`)
        .attr('id', 'matrixGroup');

    // 调用添加年份标签的函数
    addYearLabels(matrixGroup, topicNodes, subMatrixSize, gap);

    var subMatrix = Array(len).fill().map(() => Array(len).fill().map(() => ({
        "color": [0, 0, 0], // 初始化为白色
        "source": "", "target": "",
        "sourceCitation": -1, "targetCitation": -1,
    })));

    edges.forEach(edge => {
        const localSource = localIndexById(edge.source);
        const localTarget = localIndexById(edge.target);
        if (localSource != -1 && localTarget != -1 && topicNodes[localSource].topic == topicNodesList[topicIndex % topicNodesList.length][0]) {
            subMatrix[localSource][localTarget].color = topicNodes[localSource].color;
            subMatrix[localSource][localTarget].source = `${topicNodes[localSource].name}(${sortNodes[localSource].year})(${topicNodes[localSource].citationCount})`;
            subMatrix[localSource][localTarget].target = `${topicNodes[localTarget].name}(${sortNodes[localTarget].year})(${topicNodes[localTarget].citationCount})`;
            subMatrix[localSource][localTarget].sourceCitation = topicNodes[localSource].citationCount || 0;
            subMatrix[localSource][localTarget].targetCitation = topicNodes[localTarget].citationCount || 0;
        }
    });

    // 绘制子矩阵
    matrixGroup.selectAll('.subMatrix')
        .data(subMatrix.flat())
        .enter()
        .append('rect')
        .attr('x', (_, i) => (i % len) * subMatrixSize)
        .attr('y', (_, i) => Math.floor(i / len) * subMatrixSize)
        .attr('width', subMatrixSize)
        .attr('height', subMatrixSize)
        .attr('fill', d => {
            if (d.sourceCitation == -1 && d.targetCitation == -1) return "white";
            else if (d.sourceCitation >= 100 && d.targetCitation >= 100) return "red";
            else if (d.sourceCitation >= 100 && d.targetCitation < 100) return "orange";
            else if (d.sourceCitation < 100 && d.targetCitation >= 100) return "blue";
            else if (d.sourceCitation < 100 && d.targetCitation < 100) return d3.rgb(169,169,169);
        })
        .attr('stroke', 'black')
        .attr('stroke-width', 5)
        .attr('class', 'subMatrix');

    // 绘制年份交互
    drawInterYearInteractions(matrixGroup, topicNodes, subMatrixSize);

    // 添加显示topic名称的标签，字体更大
    const labelFontSize = 100;
    d3.select('#maingroup')
        .append('text')
        .attr('id', 'topicLabel')
        .attr('x', mainMatrixSize * 1.5 - topicName.length * 0.25 * labelFontSize)
        .attr('y', len * subMatrixSize + labelFontSize)
        .attr('font-size', labelFontSize + 'px')
        .text(topicName);

    // 绘制Prev和Next按钮
    const buttonSize = sortNodes.length * 4; // 按钮大小
    const offsetY = subMatrixSize * topicNodes.length / 2; // 垂直居中
    // Prev Topic按钮
    matrixGroup.append('path')
        .attr('d', `M ${-buttonSize * 2} ${offsetY} l ${buttonSize} -${buttonSize / 2} l 0 ${buttonSize}`)
        .attr('fill', 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', 10)
        .attr('cursor', 'pointer')
        .on('click', () => {
            // 切换到上一个主题
            topicIndex = topicIndex - 1;
            if (topicIndex < 0) topicIndex = 0;
            shiftSubMatrix(topicIndex);
        });

    // Next Topic按钮
    matrixGroup.append('path')
        .attr('d', `M ${subMatrixWidth + buttonSize} ${offsetY - buttonSize / 2} l ${buttonSize} ${buttonSize / 2} l -${buttonSize} ${buttonSize / 2}`)
        .attr('fill', 'white')
        .attr('stroke', 'black')
        .attr('stroke-width', 10)
        .attr('cursor', 'pointer')
        .on('click', () => {
            // 切换到下一个主题
            topicIndex = topicIndex + 1;
            shiftSubMatrix(topicIndex);
        });

    // 使用提示工具显示信息
    const tipSubMatrix = d3.tip()
        .attr("class", "d3-tip-matrix")
        .html(d => {
            if (d.source == '' && d.target == '') return "";
            return `<div>${d.source}</div><div>&#8595;</div><div>${d.target}</div>`;
        });
    d3.select('#mainsvg').call(tipSubMatrix);
    d3.selectAll(".subMatrix")
    .on('mouseover', function (d) {
        d3.select(this).attr('cursor', 'pointer');
        tipSubMatrix.show(d, this);
    })
    .on('mouseout', function (d) {
        tipSubMatrix.hide(d, this);
    });

    addToggleButton();
    addYearMatrixToggleButton();
}

function addToggleButton() {
    const buttonSize = 300;  // 按钮大小
    const matrixGroup = d3.select('#matrixGroup');
    const mainMatrixSize = sortNodes.length * 50;

    matrixGroup.append('rect')
        .attr('x', mainMatrixSize)
        .attr('y', mainMatrixSize / 3)
        .attr('width', buttonSize * 2)
        .attr('height', buttonSize)
        .attr('fill', 'lightgray')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer')
        .on('click', function() {
            showUnreferenced = !showUnreferenced;  // 切换状态
            shiftSubMatrix();  // 重新渲染子矩阵
        });

    // 添加文本标签来指示按钮功能
    matrixGroup.append('text')
        .attr('x', mainMatrixSize)
        .attr('y', 30)
        .text(showUnreferenced ? 'Hide Unreferenced' : 'Show Unreferenced')
        .attr('cursor', 'pointer')
        .on('click', function() {
            showUnreferenced = !showUnreferenced;  // 切换状态
            shiftSubMatrix();  // 重新渲染子矩阵
        });
}

function addYearMatrixToggleButton() {
    const matrixGroup = d3.select('#matrixGroup');
    const buttonSize = 300;  // 按钮大小
    const mainMatrixSize = sortNodes.length * 50;

    matrixGroup.append('rect')
        .attr('x', mainMatrixSize)
        .attr('y', mainMatrixSize / 3 * 2)
        .attr('width', buttonSize * 2)
        .attr('height', buttonSize)
        .attr('fill', 'lightgray')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('cursor', 'pointer')
        .on('click', function() {
            showYearMatrix = !showYearMatrix;  // 切换显示状态
            shiftSubMatrix();  // 根据状态切换年份矩阵的显示
        });

    // 添加文本标签来指示按钮功能
    // matrixGroup.append('text')
    //     .attr('x', buttonX + buttonSize + 5)
    //     .attr('y', buttonY + buttonSize / 2 + 5)
    //     .text(showYearMatrix ? 'Hide Years' : 'Show Years')
    //     .attr('cursor', 'pointer')
    //     .on('click', function() {
    //         showYearMatrix = !showYearMatrix;  // 切换显示状态
    //         shiftSubMatrix();  // 根据状态切换年份矩阵的显示
    //     });
}
