from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
import graphviz
import csv
import json
import os
import math
import pandas as pd
import numpy as np
import operator
import base64
from bs4 import BeautifulSoup
import re

def search(request):
    return render(request, 'search.html', {'error': ''})

def create_node(dot, papers, nodeWidth):
    # 取出论文的所有年份
    initYear = 2021
    publicationTime = []
    if len(papers) != 0:
        for paper in papers:
            year = int(paper[2])
            if year < initYear:
                initYear = year
        publicationTime = [i for i in range(initYear, 2022)]

    # 根据已有年份对论文重新分类，每个年份的论文构成一个子图，分成subgraph()
    papers = sorted(papers, key=lambda x:int(x[2]))
    for year in publicationTime:
        with dot.subgraph() as s:
            s.attr(rank='same')
            s.node(name=str(year), style='filled', fillcolor='white')
            for paper in papers:
                if int(paper[2]) == year:
                    # label: 第一作者首字+发表年份+论文标题首字
                    authors = paper[7].split(', ')
                    s1 = authors[0].split(' ')
                    s2 = paper[1].split(' ')
                    if s1 == ['']:
                        label = str(year) + s2[0]
                    else:
                        label = s1[-1] + str(year) + s2[0]
                    if nodeWidth != 0 and nodeWidth < len(label):
                        label = label[0:nodeWidth] + '...'

                    # label下为该论文引用量
                    if int(paper[4]) == -1:
                        paper_name = label + '\n' + '?'
                    else:
                        paper_name = label + '\n' + str(paper[4])
                    s.node(name=str(paper[0]), label=paper_name)
    # 将表示年份的点先连接
    for i in range(0, len(publicationTime)):
        if i:
            dot.edge(str(publicationTime[i - 1]), str(publicationTime[i]), arrowsize='0')

def create_edge(dot, papers, links):
    for link in links:
        citingpaperID, citedpaperID = link[0], link[1]
        x, y = len(papers), len(papers)
        for i in range(0, len(papers)):
            if citingpaperID == papers[i][0]:
                x = i
            if citedpaperID == papers[i][0]:
                y = i
        if x < len(papers) and y < len(papers):
            dot.edge(str(papers[y][0]), str(papers[x][0]))

def create_partial_graph(dot, papers, links, nodeWidth):
    # 当节点没有边与其相连时，删去
    for link in links:
        citingpaperID, citedpaperID = link[0], link[1]
        x, y = len(papers), len(papers)
        for i in range(0, len(papers)):
            if citingpaperID == papers[i][0]:
                x = i
            if citedpaperID == papers[i][0]:
                y = i
        if x < len(papers) and y < len(papers):
            papers[x][-1] += 1
            papers[y][-1] += 1

    papers_backup = [paper for paper in papers if paper[-1] > 0]

    create_node(dot, papers_backup, nodeWidth)

    create_edge(dot, papers_backup, links)

def get_node(nodes, papers):
    nodeData = []
    yearData = []
    for node in nodes:
        dic = {}       # 每个节点建立一个字典
        dic['id'] = node.find('title').string  # 节点的id
        ellipse = node.find('ellipse')
        text = node.find_all('text')
        for paper in papers:
            if str(paper[0]) == dic['id']:
                dic['name'] = paper[1]
                dic['year'] = int(paper[2])
                # dic['firstName'] = paper[8]
                dic['authors'] = paper[7]
                dic['venu'] = paper[6]

                if paper[7] == '':
                    label = str(paper[2]) + paper[1].split(' ')[0]
                else:
                    firstName = paper[7].split(', ')[0]
                    label = firstName.split(' ')[-1] + str(paper[2]) + paper[1].split(' ')[0]
                dic['label'] = label

                dic['isKeyPaper'] = float(paper[5])
                dic['citationCount'] = int(paper[4])
                
                dic['abstract'] = paper[8]
                dic['topic'] = int(paper[9])
                break
        dic['cx'] = float(ellipse['cx'])
        dic['cy'] = float(ellipse['cy'])
        dic['rx'] = float(ellipse['rx'])
        dic['ry'] = float(ellipse['ry'])
        if len(dic['id']) == 4:
            dic['text'] = text[0].string
            yearData.append(dic)
        else:
            dic['text1'] = text[0].string
            dic['text2'] = text[1].string
            nodeData.append(dic)
    return nodeData, yearData

def get_edge(edges, influence):
    edgeData = []
    for edge in edges:
        edgePath = edge.find('path')
        temp = edge.find('title').string    # temp为起始点->终点
        for i in range(0, len(temp)):
            if temp[i] == '-' and temp[i + 1] == '>':
                source = temp[0: i]
                target = temp[i + 2:]
                break
        d = edgePath['d']

        dic = {}
        dic['source'] = source
        dic['target'] = target
        dic['d'] = d
        for link in influence:
            if str(target) == str(link[0]) and str(source) == str(link[1]):
                dic['extends_prob'] = link[2]
                dic['citation_context'] = link[3]
        edgeData.append(dic)
    return edgeData

def get_polygon(edges):
    polygon = []
    for edge in edges:
        edge_polygon = edge.find('polygon')
        d = edge_polygon['points']
        polygon.append(d)
    return polygon

def write_d3_data(field, detail, papers, influence):
    # cmd = "dot -Ksfdp -Ebundle=0.9 ./static/image/svg/" + detail + " -Tsvg -o ./templates/" + detail + ".html"
    # print(cmd)
    # os.system(cmd)
    # filename = './templates/' + detail + '.html'
    filename = "./static/image/svg/" + field + '/' + detail + ".svg"
    soup = BeautifulSoup(open(filename))
    nodes = soup.select('.node')
    edges = soup.select('.edge')

    nodeData, yearData = get_node(nodes, papers)    # 节点怎么画
    edgeData = get_edge(edges, influence)     # 边怎么画
    polygon = get_polygon(edges)    # 边的箭头

    svg = soup.find('svg')
    viewBox = svg['viewbox']
    g = soup.find('g')
    transform = g['transform']
    # viewBox属性, g的transform
    graph = [viewBox, transform]

    data = json.dumps([graph, yearData, nodeData, edgeData, polygon], indent=4, separators=(',', ': '))
    filename = './static/json/' + field + '/' + detail + '.json'
    # make the directory if it doesn't exist already
    if not os.path.exists(os.path.dirname(filename)):
        os.makedirs(os.path.dirname(filename))
    f = open(filename, 'w')
    f.write(data)
    f.close()

def index(request):
    field = request.GET.get("field")
    id = request.GET.get("id")
    authorRank = int(id)
    df = pd.read_csv("./csv/" + field + "/top_field_authors.csv", sep=',',
                     names=["authorID", "rank", "name", "PaperCount", "CitationCount", "PaperCount_field", "authorRank", "CitationCount_field", "hIndex_field", "FellowType"])
    df["authorRank"].astype(int)
    author = df[df["authorRank"] == authorRank]
    name = author["name"].iloc[0]
    paperCount = author["PaperCount_field"].iloc[0]
    citationCount = author["CitationCount_field"].iloc[0]
    hIndex = author["hIndex_field"].iloc[0]
    
    fields = get_fields(field)
    authorRank = str(authorRank)
    isKeyPaper, extendsProb, nodeWidth, removeSurvey = 0.5, 0.5, 10, 1
    detail = authorRank + '_0_0.5_0.5_10_1'
    filename = './static/json/' + field + '/' + detail + '.json'

    if os.path.exists(filename) == False:
        dot = graphviz.Digraph(filename=detail, format='svg')

        # file = name.replace(' ', '') + str(authorRank)
        # 读取相应papers文件
        papers = read_papers(field, authorRank, isKeyPaper, removeSurvey)
        # 读取相应influence文件
        links = read_links(field, authorRank, extendsProb)
        # 创建图
        create_partial_graph(dot, papers, links, nodeWidth)

        dot.render(directory="./static/image/svg/" + field, view=False)
        # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

        write_d3_data(field, detail, papers, links)

    return render(request, "index.html",
                  {'authorRank': authorRank, 'name': name, 'paperCount': paperCount, 'citationCount': citationCount, 'hIndex': hIndex, 'fields': fields, 'field': field})

def update(request):
    authorRank = request.POST.get("authorRank")
    field = request.POST.get("field")
    mode = request.POST.get("mode")
    isKeyPaper = request.POST.get("isKeyPaper")
    extendsProb = request.POST.get("extendsProb")
    nodeWidth = request.POST.get("nodeWidth")
    removeSurvey = request.POST.get("removeSurvey")
    detail = str(authorRank) + '_' + mode + '_' + isKeyPaper + '_' + extendsProb + '_' + nodeWidth + '_' + removeSurvey
    mode = int(mode)
    isKeyPaper = float(isKeyPaper)
    extendsProb = float(extendsProb)
    nodeWidth = int(nodeWidth)
    removeSurvey = int(removeSurvey)

    filename = './static/json/' + field + '/' + detail + '.json'
    if os.path.exists(filename) == False:
        dot = graphviz.Digraph(filename=detail, format='svg')

        papers = read_papers(field, authorRank, isKeyPaper, removeSurvey)
        links = read_links(field, authorRank, extendsProb)

        if mode == 1:
            create_node(dot, papers, nodeWidth)
            create_edge(dot, papers, links)
        else:
            create_partial_graph(dot, papers, links, nodeWidth)

        dot.render(directory="./static/image/svg/" + field, view=False)
        # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

        write_d3_data(field, detail, papers, links)

    param = {}
    param['detail'] = detail
    param['field'] = field
    return JsonResponse(param, json_dumps_params={'ensure_ascii': False})

def showlist(request):
    field = request.GET.get("field")
    name = request.GET.get("name", None)
    df = pd.read_csv("./csv/" + field + "/top_field_authors.csv", sep=',', header=None)
    data = df.values.tolist()
    scholarList = [get_scholar(row, name) for row in data if get_scholar(row, name) != {}]
    if len(scholarList) == 0:
        error = 'No author named ' + name # 错误信息
        return render(request, 'search.html', {'error': error})
    else:
        return render(request, "list.html", {'scholarList': scholarList, 'field': field})

def get_scholar(row, name):
    scholar = {}
    if name == None or (name != None and name.lower() in str(row[2]).lower()):
        scholar['authorRank'] = int(row[6])
        scholar['name'] = str(row[2])
        scholar['citationCount'] = int(row[7])
        scholar['hIndex'] = int(row[8])
        scholar['paperCount'] = int(row[5])
    return scholar

def read_papers(field, authorRank, isKeyPaper, removeSurvey):
    df = pd.read_csv('./csv/' + field + '/papers_' + authorRank + '.csv', sep=',', index_col=0)
    df = df.fillna('')
    df["isKeyPaper"].astype(float)
    df = df[df["isKeyPaper"] >= isKeyPaper]
    df["isolated"] = 0
    if removeSurvey == 1:
        # surveys = df.loc[df['title'].str.contains('survey|Survey'), 'paperID'].tolist() # 抽取所有title中含有survey的paperID作为list
        df = df[~df['title'].str.contains(r'survey|surveys', case=False, regex=True)]
    papers = df.values.tolist()
    return papers

def read_links(field, authorRank, extendsProb):
    df = pd.read_csv('./csv/' + field + '/links_' + authorRank + '.csv', sep=',', index_col=0)
    df['extendsProb'] = df["extendsProb"].replace('\\N', '0')
    df['extendsProb'] = df["extendsProb"].astype(float)
    df = df.where(df.notnull(), None)
    df = df[df["extendsProb"] >= extendsProb]
    # df = df[~df["childrenID"].isin(surveys)]
    # df = df[~df["parentID"].isin(surveys)]
    links = df.values.tolist()
    return links

def get_fields(field):
    df_roots = pd.read_csv("./csv/" + field + "/field_roots.csv", sep=',')
    roots = df_roots.values.tolist()
    df_leaves = pd.read_csv("./csv/" + field + "/field_leaves.csv", sep=',')
    leaves = df_leaves.values.tolist()
    return [roots, leaves]
