class Graph {
    constructor() {
        this.adjList = new Map();
        this.nodeProperties = new Map();
    }

    addNode(node, properties = {}) {
        if (!this.adjList.has(node)) {
            this.adjList.set(node, []);
            this.nodeProperties.set(node, properties);
        }
    }

    addEdge(v1, v2) {
        if (!this.adjList.has(v1)) {
            this.addNode(v1);
        }
        if (!this.adjList.has(v2)) {
            this.addNode(v2);
        }
        this.adjList.get(v1).push(v2);
        this.adjList.get(v2).push(v1); // 如果是无向图，则添加此行
    }

    dfs(start) {
        const visited = new Set();
        const stack = [start];

        while (stack.length) {
            const node = stack.pop();
            if (!visited.has(node)) {
                visited.add(node);
                const neighbors = this.adjList.get(node);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor);
                    }
                }
            }
        }

        return visited;
    }

    findConnectedComponents() {
        const visited = new Set();
        const components = [];

        for (const [node] of this.adjList.entries()) {
            if (!visited.has(node)) {
                const component = this.dfs(node);
                components.push([...component]);
                component.forEach(v => visited.add(v));
            }
        }

        return components;
    }

    findLastNodeInComponent(component) {
        let maxYear = -Infinity;
        let lastNode = null;

        // 遍历连通分量中的每个节点
        component.forEach(nodeId => {
            const nodeData = this.nodeProperties.get(nodeId);
            // 检查年份，找到最大的年份
            if (nodeData.year && nodeData.year > maxYear) {
                maxYear = nodeData.year;
                lastNode = nodeId;
            }
        });

        // 确认找到的最后一个节点是否以 'l' 或 'r' 开头
        if (lastNode && !['l', 'r'].includes(lastNode[0])) {
            return lastNode;
        }

        return null;  // 如果节点以 'l' 或 'r' 开头或未找到合适的节点，返回 null
    }
}

/* 使用示例
const graph = new Graph();
graph.addNode('node1', { year: 2021 });
graph.addNode('node2', { year: 2022 });
graph.addNode('node3', { year: 2023 });
graph.addNode('l4', { year: 2024 });
graph.addNode('r5', { year: 2025 });

graph.addEdge('node1', 'node2');
graph.addEdge('node2', 'node3');
graph.addEdge('node3', 'l4');
graph.addEdge('l4', 'r5');

const components = graph.findConnectedComponents();
components.forEach(component => {
    const lastNode = graph.findLastNodeInComponent(component);
    if (lastNode) {
        console.log(`Last Node in Component: ${lastNode} with properties`, graph.nodeProperties.get(lastNode));
    } else {
        console.log("No suitable last node found in this component.");
    }
});

*/