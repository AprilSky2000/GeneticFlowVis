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
from collections import defaultdict
from django.utils.safestring import mark_safe
from django.core import serializers

version_df = pd.read_csv("csv/version.csv", sep=',')
versionID = version_df.iloc[-1]['versionID']
field2authors = {}

authorID2fellow = defaultdict(str)
fellow_df = pd.read_csv("csv/award_authors.csv", sep=',', dtype={'MAGID': str})
for index, row in fellow_df.iterrows():
    authorID = row['MAGID']
    if authorID and authorID != 'NULL':
        authorID2fellow[authorID] += str(row['type']) + ':' + str(row['year']) + ','

def reference(request):
    return render(request, 'reference.html')

def front(request):
    return render(request, 'front.html', {'error': '', 'versionID': versionID})

def search(request):
    field = request.GET.get("field")
    return render(request, 'search.html', {'error': '', 'fieldType': field, 'versionID': versionID})

def changelog(request):
    df_list = version_df.to_dict(orient='records')
    return render(request, 'changelog.html', {'changelogList': df_list})

def to_number(x):
    try:
        return float(x)
    except:
        return 0.0


def load_author(field, authorID):
    filename = f'static/json/{field}/authors/{authorID}.json'
    if os.path.exists(filename):
        return
    nodes = {}
    edges = []
    # print(authorID, authorID2fellow.get(authorID, ''))
    links_df = pd.read_csv(f'csv/{field}/links/{authorID}.csv')
    for index, row in links_df.iterrows():
        edges.append({
            'source': row['childrenID'],
            'target': row['parentID'],
            'prob': to_number(row['extendsProb'])
        })

    papers_df = pd.read_csv(f'csv/{field}/papers/{authorID}.csv')
    papers_df['paperID'] = papers_df['paperID'].astype(str)
    papers_df['survey'] = papers_df['title'].str.contains(r'survey|surveys', case=False, regex=True)
    papers_df = papers_df[['paperID', 'year', 'survey', 'isKeyPaper', 'topic']]
    
    dic = {
        'nodes': papers_df.to_dict(orient='records'),
        'edges': edges
    }

    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, 'w') as f:
        json.dump(dic, f, indent=4, sort_keys=True, ensure_ascii=False)


def read_top_authors(field):
    df = pd.read_csv(f'csv/{field}/top_field_authors.csv', sep=',')
    try:
        fellow = df[['fellow']]
    except:
        fellow = None
    try:
        df = df[['authorID','name','PaperCount_field','CitationCount_field','hIndex_field','CorePaperCount_field','CoreCitationCount_field','CorehIndex_field']]
    except:
        df = df[['authorID','name','PaperCount','CitationCount','hIndex','CorePaperCount','CoreCitationCount','CorehIndex']]
    df.columns = ['authorID','name','paperCount','citationCount','hIndex','corePaperCount','coreCitationCount','corehIndex']
    for col in ['paperCount','citationCount','hIndex','corePaperCount','coreCitationCount','corehIndex']:
        df[col] = df[col].astype(int)
    df['authorID'] = df['authorID'].astype(str)
    if fellow is not None:
        df = pd.concat([df, fellow], axis=1)
    
    return df


def degree(request):
    field = request.GET.get("field")
    topN = int(request.GET.get("topN", 200))

    df = read_top_authors(field)
    df = df[['authorID', 'name', 'paperCount', 'hIndex']]
    df = df.sort_values(by='hIndex', ascending=False)
    fellow = df['fellow'].head(topN) if 'fellow' in df.columns else None
    df = df.head(topN)

    # authors = field2authors.setdefault(field, {})
    for index, row in df.iterrows():
        authorID = row['authorID']
        load_author(field, authorID)
        # if authorID not in authors:
        #     authors[authorID] = load_author(field, authorID)

    if fellow is None:
        df['fellow'] = df['authorID'].apply(lambda x: authorID2fellow.get(x, ''))
    else:
        df['fellow'] = fellow.fillna('', inplace=False)
    # keys = list(topAuthors.keys())
    # print('load complete', df, keys, authorID2fellow)
    return render(request, 'degree.html', {
        'field': field,
        'versionID': versionID,
        'authorsData': mark_safe(json.dumps(df.values.tolist())),  # 直接传递 Python 对象
        # 'topAuthors': mark_safe(json.dumps(topAuthors)),
        'topN': topN
    })


def create_node(dot, papers, nodeWidth):
    # 取出论文的所有年份
    initYear = 2023
    publicationTime = []
    papers = papers.values()
    if len(papers) != 0:
        for paper in papers:
            year = int(paper['year'])
            if year < initYear:
                initYear = year
        publicationTime = [i for i in range(initYear, 2024)]

    # 根据已有年份对论文重新分类，每个年份的论文构成一个子图，分成subgraph()
    papers = sorted(papers, key=lambda x:int(x['year']))
    for year in publicationTime:
        with dot.subgraph() as s:
            s.attr(rank='same')
            s.node(name=str(year), style='filled', fillcolor='white')
            for paper in papers:
                if int(paper['year']) == year:
                    # label: 第一作者首字+发表年份+论文标题首字
                    authors = paper['authorsName'].split(', ')
                    s1 = authors[0].split(' ')
                    s2 = paper['title'].split(' ')
                    if s1 == ['']:
                        label = str(year) + s2[0]
                    else:
                        label = s1[-1] + str(year) + s2[0]
                    if nodeWidth != 0 and nodeWidth < len(label):
                        label = label[0:nodeWidth] + '...'

                    # label下为该论文引用量
                    if int(paper['citationCount']) == -1:
                        paper_name = label + '\n' + '?'
                    else:
                        paper_name = label + '\n' + str(paper['citationCount'])
                    s.node(name=paper['paperID'], label=paper_name)
    # 将表示年份的点先连接
    for i in range(0, len(publicationTime)):
        if i:
            dot.edge(str(publicationTime[i - 1]), str(publicationTime[i]), arrowsize='0')

def create_edge(dot, papers, links):
    for link in links:
        citingpaperID, citedpaperID = link['childrenID'], link['parentID']
        if citedpaperID in papers and citingpaperID in papers:
            dot.edge(papers[citedpaperID]['paperID'], papers[citingpaperID]['paperID'])

def create_partial_graph(dot, papers, links, nodeWidth):
    # 当节点没有边与其相连时，删去
    valid_nodes = set()
    for link in links:
        a = link['childrenID']
        b = link['parentID']
        if a in papers and b in papers:
            valid_nodes.add(a)
            valid_nodes.add(b)

    papers_backup = {k: v for k, v in papers.items() if k in valid_nodes}
    create_node(dot, papers_backup, nodeWidth)
    create_edge(dot, papers_backup, links)

def get_node(nodes, papers):
    nodeData = []
    yearData = []
    for node in nodes:
        id = node.find('title').string
        ellipse = node.find('ellipse')
        text = node.find_all('text')
        dic = {
            'id': id,
            'cx': float(ellipse['cx']),
            'cy': float(ellipse['cy']),
            'rx': float(ellipse['rx']),
            'ry': float(ellipse['ry']),
            'text': text[0].string
        }
        if id in papers:
            paper = papers[id]
            dic.update({
                'paperID': paper['paperID'],
                'name': paper['title'],
                'year': int(paper['year']),
                'authors': paper['authorsName'],
                'venu': paper['venu'],
                'label': (paper['authorsName'].split(', ')[0].split(' ')[-1] if len(paper['authorsName']) else '') +
                        str(paper['year']) + paper['title'].split(' ')[0],
                'isKeyPaper': paper['isKeyPaper'],
                'citationCount': paper['citationCount'],
                'abstract': paper['abstract'],
                'topic': int(paper['topic']),
            })
            nodeData.append(dic)
        else:
            yearData.append(dic)
    return nodeData, yearData

def get_edge(edges, influence):
    edgeData = []
    for edge in edges:
        edgePath = edge.find('path')
        source, target = edge.find('title').string.split('->')  # temp为起始点->终点
        dic = {
            'source': source,
            'target': target,
            'd': edgePath['d']
            }
        for link in influence:
            if target == link['childrenID'] and source == link['parentID']:
                dic['extends_prob'] = link['extendsProb']
                dic['citation_context'] = link['citationContext']
        edgeData.append(dic)
    return edgeData

def get_polygon(edges):
    polygon = []
    for edge in edges:
        edge_polygon = edge.find('polygon')
        d = edge_polygon['points']
        polygon.append(d)
    return polygon

def write_d3_data(fieldType, detail, papers, influence):
    # cmd = "dot -Ksfdp -Ebundle=0.9 ./static/image/svg/" + detail + " -Tsvg -o ./templates/" + detail + ".html"
    # os.system(cmd)
    # filename = './templates/' + detail + '.html'
    filename = f'static/image/svg/{fieldType}/{detail}.svg'
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
    filename = f'static/json/{fieldType}/{detail}.json'
    # make the directory if it doesn't exist already
    if not os.path.exists(os.path.dirname(filename)):
        os.makedirs(os.path.dirname(filename))
    f = open(filename, 'w')
    f.write(data)
    f.close()

def index(request):
    fieldType = request.GET.get("field")
    authorID = request.GET.get("id")
    df = read_top_authors(fieldType)
    author = df[df["authorID"] == authorID]
    name = author["name"].iloc[0]
    paperCount = author["paperCount"].iloc[0]
    citationCount = author["citationCount"].iloc[0]
    hIndex = author["hIndex"].iloc[0]
    
    fields = get_fields(fieldType)
    mode, isKeyPaper, extendsProb, nodeWidth, removeSurvey = 1, 0.5, 0.5, 10, 1
    if fieldType == "acl":
        extendsProb = 0.4
    detail = f'{authorID}_{mode}_{str(isKeyPaper)}_{str(extendsProb)}_{nodeWidth}_{removeSurvey}'
    filename = f'static/json/{fieldType}/{detail}.json'

    if os.path.exists(filename) == False or os.environ.get('TEST', False):
        dot = graphviz.Digraph(filename=detail, format='svg')

        # 读取相应papers文件
        papers = read_papers(fieldType, authorID, isKeyPaper, removeSurvey)
        # 读取相应influence文件
        links = read_links(fieldType, authorID, extendsProb)
        # 创建图
        create_partial_graph(dot, papers, links, nodeWidth)

        dot.render(directory=f"static/image/svg/{fieldType}", view=False)
        # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

        write_d3_data(fieldType, detail, papers, links)

    return render(request, "index.html",
                  {'authorID': authorID, 'name': name, 'paperCount': paperCount, 
                   'citationCount': citationCount, 'hIndex': hIndex, 'fields': fields, 'fieldType': fieldType})


def clean(request):
    import shutil
    fieldType = request.GET.get("field")
    path = f"static/json/{fieldType}"
    try:
        shutil.rmtree(path)
        return HttpResponse("Successfully deleted " + path)
    except Exception as e:
        return HttpResponse("Failed to delete " + path + " because: " + e.__str__())

def update(request):
    fieldType = request.POST.get("field")
    authorID = request.POST.get("authorID")
    mode = request.POST.get("mode")
    isKeyPaper = request.POST.get("isKeyPaper")
    extendsProb = request.POST.get("extendsProb")
    nodeWidth = request.POST.get("nodeWidth")
    removeSurvey = request.POST.get("removeSurvey")
    detail = f'{authorID}_{mode}_{str(float(isKeyPaper))}_{str(float(extendsProb))}_{nodeWidth}_{removeSurvey}'
    mode = int(mode)
    isKeyPaper = float(isKeyPaper)
    extendsProb = float(extendsProb)
    nodeWidth = int(nodeWidth)
    removeSurvey = int(removeSurvey)

    filename = f'static/json/{fieldType}/{detail}.json'
    if os.path.exists(filename) == False or os.environ.get('TEST', False):
        dot = graphviz.Digraph(filename=detail, format='svg')

        papers = read_papers(fieldType, authorID, isKeyPaper, removeSurvey)
        links = read_links(fieldType, authorID, extendsProb)

        if mode == 1:
            create_partial_graph(dot, papers, links, nodeWidth)
        else:
            create_node(dot, papers, nodeWidth)
            create_edge(dot, papers, links)

        dot.render(directory=f"static/image/svg/{fieldType}", view=False)
        # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

        write_d3_data(fieldType, detail, papers, links)

    param = {'detail': detail, 'fieldType': fieldType}
    return JsonResponse(param, json_dumps_params={'ensure_ascii': False})

def showlist(request):
    fieldType = request.GET.get("field")
    name = request.GET.get("name", None)
    df = read_top_authors(fieldType)

    if name:
        filtered_df = df[df['name'].apply(lambda x: name.lower() in x.lower())]
        scholarList = filtered_df.to_dict(orient='records')
    else:
        scholarList = df.to_dict(orient='records')
    if len(scholarList) == 0:
        error = 'No author named ' + name               # 错误信息
        return render(request, 'search.html', {'error': error, 'fieldType': fieldType, 'versionID': versionID})
    else:
        return render(request, "list.html", {'scholarList': json.dumps(scholarList), 'fieldType': fieldType})


def read_papers(fieldType, authorID, isKeyPaper, removeSurvey):
    path = f'csv/{fieldType}/papers/{authorID}.csv'

    df = pd.read_csv(path, sep=',', index_col=0)
    df = df.fillna('')
    
    for col in ['year', 'referenceCount', 'citationCount', 'topic']:
        df[col] = df[col].astype(int)
    df['paperID'] = df['paperID'].astype(str).replace('.0', '')
    df["isKeyPaper"] = df["isKeyPaper"].astype(float)
    df = df[df["isKeyPaper"] >= isKeyPaper]
    if removeSurvey == 1:
        # surveys = df.loc[df['title'].str.contains('survey|Survey'), 'paperID'].tolist() # 抽取所有title中含有survey的paperID作为list
        df = df[~df['title'].str.contains(r'survey|surveys', case=False, regex=True)]
    lis = df.to_dict(orient='records')
    return {x['paperID']: x for x in lis}

def read_links(fieldType, authorID, extendsProb):
    path = f'csv/{fieldType}/links/{authorID}.csv'
    if os.path.exists(path) == False:
        return []
    df = pd.read_csv(path, sep=',')
    for col in ['childrenID', 'parentID']:
        df[col] = df[col].astype(str).replace('.0', '')
    df['extendsProb'] = df["extendsProb"].replace('\\N', '0')
    df['extendsProb'] = df["extendsProb"].astype(float)
    df = df.where(df.notnull(), None)
    df = df[df["extendsProb"] >= extendsProb]
    # df = df[~df["childrenID"].isin(surveys)]
    # df = df[~df["parentID"].isin(surveys)]
    return df.to_dict(orient='records')

def get_fields(fieldType):
    path = f'csv/{fieldType}/'
    df_roots = pd.read_csv(os.path.join(path, "field_roots.csv"), sep=',')
    roots = df_roots.values.tolist()
    df_leaves = pd.read_csv(os.path.join(path, "field_leaves.csv"), sep=',')
    leaves = df_leaves.values.tolist()
    return [roots, leaves]

def image(request):
    path = f'static/image/'
    image_path = os.path.join(path, "overview.png")
    with open(image_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    
    return JsonResponse({'image': encoded_string})