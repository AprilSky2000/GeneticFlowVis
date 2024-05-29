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
import logging

logger = logging.getLogger('log')

version_df = pd.read_csv("csv/version.csv", sep=',')
versionID = version_df.iloc[-1]['versionID']

authorID2fellow = defaultdict(str)
fellow_df = pd.read_csv("csv/award_authors.csv", sep=',', dtype={'MAGID': str})
for index, row in fellow_df.iterrows():
    authorID = row['MAGID']
    if authorID and authorID != 'NULL':
        authorID2fellow[authorID] += str(row['type']) + ':' + str(row['year']) + ','
# print('authorID2fellow', authorID2fellow)

field2top_authors = {}
field2topics = {}

def reference(request):
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s]", client_ip)
    return render(request, 'reference.html')

def front(request):
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s]", client_ip)
    return render(request, 'front.html', {'error': '', 'versionID': versionID})

def search(request):
    client_ip = get_client_ip(request)
    field = request.GET.get("field")
    logger.info("Request Parameters: [clientIP:%s] [field:%s]", client_ip, field)
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
    edges = []
    links_df = pd.read_csv(f'csv/{field}/links/{authorID}.csv')
    for index, row in links_df.iterrows():
        edges.append({
            'source': row['childrenID'],
            'target': row['parentID'],
            'prob': to_number(row['extendsProb'])
        })

    papers_df = pd.read_csv(f'csv/{field}/papers/{authorID}.csv', dtype={'paperID': str})
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
    if field in field2top_authors:
        return field2top_authors[field]

    df = pd.read_csv(f'csv/{field}/top_field_authors.csv', sep=',', dtype={'authorID': str})
    if field not in ['acl']:
        df['fellow'] = df['authorID'].apply(lambda x: authorID2fellow.get(x, ''))
    else:
        def getYear(s):
            if len(s) == 0:
                return 0
            pattern = r"\b1:(\d+),"
            group = re.search(pattern, s)
            return int(group.group(1)) if group else 0
        df['fellow'].fillna('', inplace=True)
    if 'original' in df.columns and field in ['turing', 'fellowTuring', 'ACMfellow']:
        df['name'] = df['original']

    if 'PaperCount' in df.columns and 'PaperCount_field' in df.columns:
        df = df.drop(columns=['PaperCount'])
    if 'CitationCount' in df.columns and 'CitationCount_field' in df.columns:
        df = df.drop(columns=['CitationCount'])
    df = df.rename(columns={
        'PaperCount_field': 'PaperCount',
        'CitationCount_field': 'CitationCount',
        'hIndex_field': 'hIndex',
        'CorePaperCount_field': 'CorePaperCount',
        'CoreCitationCount_field': 'CoreCitationCount',
        'CorehIndex_field': 'CorehIndex'
    })
    df = df[['authorID','name','PaperCount','CitationCount','hIndex','CorePaperCount','CoreCitationCount','CorehIndex', 'fellow']]
    # df.columns = ['authorID','name','paperCount','citationCount','hIndex','corePaperCount','coreCitationCount','corehIndex', 'fellow']
    df = df.rename(columns={
        'PaperCount': 'paperCount',
        'CitationCount': 'citationCount',
        'hIndex': 'hIndex',
        'CorePaperCount': 'corePaperCount',
        'CoreCitationCount': 'coreCitationCount',
        'CorehIndex': 'corehIndex'
    })

    for col in ['paperCount','citationCount','hIndex','corePaperCount','coreCitationCount','corehIndex']:
        df[col] = df[col].astype(int)

    field2top_authors[field] = df
    return df


def degree(request):
    field = request.GET.get("field")
    topN = int(request.GET.get("topN", 200))

    df = read_top_authors(field)
    df = df[['authorID', 'name', 'paperCount', 'hIndex', 'fellow']]
    df = df.sort_values(by='hIndex', ascending=False)

    df = df.head(topN)
    for index, row in df.iterrows():
        authorID = row['authorID']
        load_author(field, authorID)

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
    papers = papers.values()
    if len(papers):
        min_year = min(item['year'] for item in papers)
        max_year = max(item['year'] for item in papers)
        publication_time = [i for i in range(min_year, max_year + 1)]
    else:
        publication_time = []

    # 根据已有年份对论文重新分类，每个年份的论文构成一个子图，分成subgraph()
    papers = sorted(papers, key=lambda x:int(x['year']))
    for year in publication_time:
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
    for i in range(0, len(publication_time)):
        if i:
            dot.edge(str(publication_time[i - 1]), str(publication_time[i]), arrowsize='0')

def create_edge(dot, papers, links):
    for link in links:
        citingpaperID, citedpaperID = link['childrenID'], link['parentID']
        if citedpaperID in papers and citingpaperID in papers:
            dot.edge(papers[citedpaperID]['paperID'], papers[citingpaperID]['paperID'])

def create_partial_graph(dot, papers, links, nodeWidth, mode):
    if mode == 0:
        create_node(dot, papers, nodeWidth)
        create_edge(dot, papers, links)
        return
    valid_nodes = set()
    # 当节点没有边与其相连时，删去
    for link in links:
        a = link['childrenID']
        b = link['parentID']
        if a in papers and b in papers:
            valid_nodes.add(a)
            valid_nodes.add(b)
    if mode == 2:
        for k, v in papers.items():
            if v['citationCount'] >= 50:
                valid_nodes.add(k)

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
    client_ip = get_client_ip(request)
    df = read_top_authors(fieldType)
    author = df[df["authorID"] == authorID]
    author = author.to_dict(orient='records')[0]
    logger.info("Request Parameters: [clientIP:%s] [field:%s] [authorID:%s] [scholar:%s]",
                client_ip, fieldType, authorID, author["name"])

    fields = get_fields(fieldType)
    mode, isKeyPaper, extendsProb, nodeWidth, removeSurvey = 2, 0.5, 0.5, 10, 1
    if fieldType == "acl":
        extendsProb = 0.4
    detail = f'{authorID}_{mode}_{str(isKeyPaper)}_{str(extendsProb)}_{nodeWidth}_{removeSurvey}'
    filename = f'static/json/{fieldType}/{detail}.json'

    if os.path.exists(f'csv/{fieldType}/paperID2topic.json') and fieldType not in field2topics:
        with open(f'csv/{fieldType}/paperID2topic.json', 'r') as f:
            field2topics[fieldType] = json.load(f)

    if os.path.exists(filename) == False or os.environ.get('TEST', False):
        dot = graphviz.Digraph(filename=detail, format='svg')

        # 读取相应papers文件
        papers = read_papers(fieldType, authorID, isKeyPaper, removeSurvey)
        # 读取相应influence文件
        links = read_links(fieldType, authorID, extendsProb)
        # 创建图
        create_partial_graph(dot, papers, links, nodeWidth, mode)

        dot.render(directory=f"static/image/svg/{fieldType}", view=False)
        # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

        write_d3_data(fieldType, detail, papers, links)

    return render(request, "index.html",
                  {'authorID': authorID, 'name': author["name"], 'paperCount': author["paperCount"],
                   'citationCount': author["citationCount"], 'hIndex': author["hIndex"], 'fields': fields, 'fieldType': fieldType})


def clean(request):
    import shutil
    fieldType = request.GET.get("field")
    path = f"static/json/{fieldType}"
    global field2top_authors
    global field2topics
    field2top_authors.clear()
    field2topics.clear()

    try:
        shutil.rmtree(path)
        return HttpResponse("Successfully deleted " + path)
    except Exception as e:
        return HttpResponse("Failed to delete " + path + " because: " + e.__str__())

def update(request):
    logger.info("ajax request successfully received")
    fieldType    = request.POST.get("field")
    authorID     = request.POST.get("authorID")
    mode         = request.POST.get("mode")
    isKeyPaper   = request.POST.get("isKeyPaper")
    extendsProb  = request.POST.get("extendsProb")
    nodeWidth    = request.POST.get("nodeWidth")
    removeSurvey = request.POST.get("removeSurvey")
    ratio        = request.POST.get("ratio")
    detail       = f'{authorID}_{mode}_{str(float(isKeyPaper))}_{str(float(extendsProb))}_{nodeWidth}_{removeSurvey}'
    mode         = int(mode)
    isKeyPaper   = float(isKeyPaper)
    extendsProb  = float(extendsProb)
    nodeWidth    = int(nodeWidth)
    removeSurvey = int(removeSurvey)
    ratio        = float(ratio)
    print(mode, fieldType, authorID, isKeyPaper, removeSurvey, ratio)

    if ratio == 0:
        filename = f'static/json/{fieldType}/{detail}.json'
        if os.path.exists(filename) == False or os.environ.get('TEST', False):
            dot = graphviz.Digraph(filename=detail, format='svg')

            papers = read_papers(fieldType, authorID, isKeyPaper, removeSurvey)
            links = read_links(fieldType, authorID, extendsProb)

            create_partial_graph(dot, papers, links, nodeWidth, mode)
            dot.render(directory=f"static/image/svg/{fieldType}", view=False)
            # data = base64.b64encode(dot.pipe(format='png')).decode("utf-8")

            write_d3_data(fieldType, detail, papers, links)

        param = {'detail': detail, 'fieldType': fieldType}
        return JsonResponse(param, json_dumps_params={'ensure_ascii': False})
    else:
        detail += str(ratio)
        dot = graphviz.Digraph(filename=detail, format='svg')
        dot.attr(ratio=str(ratio))

        papers = read_papers(fieldType, authorID, isKeyPaper, removeSurvey)
        links = read_links(fieldType, authorID, extendsProb)

        create_partial_graph(dot, papers, links, nodeWidth, mode)
        dot.render(directory=f"static/image/svg/{fieldType}", view=False)

        filename = f'static/image/svg/{fieldType}/{detail}.svg'
        soup = BeautifulSoup(open(filename))
        nodes = soup.select('.node')
        edges = soup.select('.edge')
        nodeData, yearData = get_node(nodes, papers)    # 节点怎么画
        edgeData = get_edge(edges, links)     # 边怎么画
        polygon = get_polygon(edges)    # 边的箭头

        svg = soup.find('svg')
        viewBox = svg['viewbox']
        g = soup.find('g')
        transform = g['transform']
        # viewBox属性, g的transform
        graph = [viewBox, transform]
        return JsonResponse({"graph": graph, "year": yearData, "node": nodeData, "edge": edgeData, "polygon": polygon},
                            json_dumps_params={'ensure_ascii': False})

def showlist(request):
    fieldType = request.GET.get("field")
    name = request.GET.get("name", None)
    client_ip = get_client_ip(request)
    logger.info("Request Parameters: [clientIP:%s] [field:%s] [scholar:%s]", client_ip, fieldType, name)
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
        return render(request, "list.html", {'scholarList': scholarList, 'fieldType': fieldType})


def read_papers(fieldType, authorID, isKeyPaper, removeSurvey):
    path = f'csv/{fieldType}/papers/{authorID}.csv'

    df = pd.read_csv(path, sep=',', dtype={'paperID': str})
    df = df.fillna('')
    if fieldType in field2topics:
        paperID2topic = field2topics[fieldType]
        df['topic'] = df['paperID'].apply(lambda x: paperID2topic.get(x, 0))
    elif 'topic' not in df.columns:
        df['topic'] = 0

    for col in ['year', 'referenceCount', 'citationCount', 'topic']:
        df[col] = df[col].astype(int)
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
    df = pd.read_csv(path, sep=',', dtype={'childrenID': str, 'parentID': str})
    df['extendsProb'] = df["extendsProb"].replace('\\N', '0')
    df['extendsProb'] = df["extendsProb"].astype(float)
    df = df.where(df.notnull(), None)
    df = df[df["extendsProb"] >= extendsProb]
    # df = df[~df["childrenID"].isin(surveys)]
    # df = df[~df["parentID"].isin(surveys)]
    return df.to_dict(orient='records')


def get_fields(fieldType):
    path = f'csv/{fieldType}/'
    leaves_path = os.path.join(path, "field_leaves.csv")
    if os.path.exists(leaves_path) == False:
        return [[],[[0,7406,"default",0,0,113.7,0.4438242822393499,1,1]]]

    roots = pd.read_csv(os.path.join(path, "field_roots.csv"), sep=',').values.tolist()
    leaves = pd.read_csv(leaves_path, sep=',').values.tolist()
    return [roots, leaves]

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

def dataset(request):
    fieldType = request.GET.get("field")
    if fieldType == None:
        return render(request, 'dataset.html')
    else:
        import tarfile
        from tempfile import TemporaryFile
        dataset_path = f'csv/{fieldType}'
        with TemporaryFile() as tmp:
            with tarfile.open(fileobj=tmp, mode='w:gz') as tar:
                tar.add(dataset_path, arcname=os.path.basename(dataset_path))

            # 将文件指针移动到文件的开始
            tmp.seek(0)

            response = HttpResponse(tmp.read(), content_type='application/gzip')
            response['Content-Disposition'] = f'attachment; filename="{fieldType}.tar.gz"'
            return response