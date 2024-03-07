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
from django.views.decorators.clickjacking import xframe_options_exempt

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
field2topicDist = {}

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
    links_df = pd.read_csv(f'csv/{field}/links/{authorID}.csv', dtype={'childrenID': str, 'parentID': str})
    links_df['extendsProb'] = links_df['extendsProb'].replace('\\N', '0').astype(float)
    links_df = links_df.where(links_df.notnull(), None)
    for index, row in links_df.iterrows():
        edges.append({
            'source': row['childrenID'],
            'target': row['parentID'],
            'extends_prob': to_number(row['extendsProb']),
            'citation_context': row['citationContext']
        })

    papers_df = pd.read_csv(f'csv/{field}/papers/{authorID}.csv', dtype={'paperID': str,
                'year': int, 'referenceCount': int, 'citationCount': int, 'isKeyPaper': float})
    papers_df['survey'] = papers_df['title'].str.contains(r'survey|surveys', case=False, regex=True)
    
    if field in field2topicDist:
        paperID2topicDist = field2topicDist[field]
        papers_df['topicDist'] = papers_df['paperID'].apply(lambda x: paperID2topicDist.get(x, {}))
        papers_df['topic'] = papers_df['topicDist'].apply(lambda x: max(x.items(), key=operator.itemgetter(1))[0] if x else 0)
    elif field in field2topics:
        paperID2topic = field2topics[field]
        papers_df['topic'] = papers_df['paperID'].apply(lambda x: paperID2topic.get(x, 0))
    elif 'topic' not in papers_df.columns:
        papers_df['topic'] = 0
    
    papers_df['topic'] = papers_df['topic'].astype(int)
    # papers_df.fillna('', inplace=True)
    papers_df = papers_df.where(papers_df.notnull(), None)
    # drop unnamed columns
    papers_df = papers_df.loc[:, ~papers_df.columns.str.contains('^Unnamed')]
    papers_df = papers_df.rename(columns={
        'authorsName': 'authors',
        'paperID': 'id',
        'title': 'name',
    })
    
    # papers_df = papers_df[['paperID', 'year', 'referenceCount', 'citationCount', 'survey', 'isKeyPaper', 'topic']]
    
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
    if 'original' in df.columns:
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
        # 这里防止报错删掉：turing/top_field_authors.csv中两行： 2058634616 3081858028

    # keys = list(topAuthors.keys())
    # print('load complete', df, keys, authorID2fellow)
    return render(request, 'degree.html', {
        'field': field,
        'versionID': versionID,
        'authorsData': mark_safe(json.dumps(df.values.tolist())),  # 直接传递 Python 对象
        # 'topAuthors': mark_safe(json.dumps(topAuthors)),
        'topN': topN
    })

@xframe_options_exempt
def hypertree_view(request):
    return render(request, 'hypertree.html')

def topicflow(request):
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
    return render(request, 'topicflow.html', {
        'field': field,
        'versionID': versionID,
        'authorsData': mark_safe(json.dumps(df.values.tolist())),  # 直接传递 Python 对象
        # 'topAuthors': mark_safe(json.dumps(topAuthors)),
        'topN': topN,
        'fields': get_fields(field),
    })

def simplify(field):
    df = pd.read_csv(f'csv/{field}/paperIDDistribution.csv', dtype={'paperID': str})
    df.set_index('paperID', inplace=True)
    df.columns = df.columns.str.replace('topic_', '')

    # 将0.0替换为NaN
    df[df < 0.01] = 0
    df.replace(0.0, np.nan, inplace=True)

    # 保留小数点后5位
    df.iloc[:, 1:] = df.iloc[:, 1:].applymap(lambda x: round(x, 3) if not pd.isnull(x) else np.nan)

    # 转换为字典，并过滤非空值，如果非空值超过10个，则只保留最高的10个
    def row_to_filtered_dict(row):
        # 过滤非空值
        filtered_row = {key: value for key, value in row.items() if pd.notna(value)}
        # 如果非空值超过10个，只保留最高的10个值
        if len(filtered_row) > 10:  # 包括paperID
            # 根据值排序并取最高的10个，+1因为还包括paperID
            top_10_keys = sorted(filtered_row, key=filtered_row.get, reverse=True)[:10]
            return {key: filtered_row[key] for key in top_10_keys if key != 'paperID'}
        else:
            return {key: value for key, value in filtered_row.items() if key != 'paperID'}

    # 应用转换
    df_dict = df.apply(row_to_filtered_dict, axis=1).to_dict()
    # 如果需要将JSON结果写入文件，可以使用以下代码：
    with open(f'csv/{field}/paperIDDistribution.json', 'w') as f:
        # f.write(json_result)
        json.dump(df_dict, f, indent=4)


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
    load_author(fieldType, authorID)

    if os.path.exists(f'csv/{fieldType}/paperID2topic.json') and fieldType not in field2topics:
        with open(f'csv/{fieldType}/paperID2topic.json', 'r') as f:
            field2topics[fieldType] = json.load(f)
    
    if os.path.exists(f'csv/{fieldType}/paperIDDistribution.json') and fieldType not in field2topicDist:
        with open(f'csv/{fieldType}/paperIDDistribution.json', 'r') as f:
            field2topicDist[fieldType] = json.load(f)

    if os.path.exists(f'csv/{fieldType}/paperIDDistribution.csv') and fieldType not in field2topicDist:
        simplify(fieldType)
        with open(f'csv/{fieldType}/paperIDDistribution.json', 'r') as f:
            field2topicDist[fieldType] = json.load(f)
    
    return render(request, "index.html",
                  {'authorID': authorID, 'name': author["name"], 'paperCount': author["paperCount"], 
                   'citationCount': author["citationCount"], 'hIndex': author["hIndex"], 'fields': fields, 'fieldType': fieldType})


def clean(request):
    import shutil
    fieldType = request.GET.get("field")
    path = f"static/json/{fieldType}"
    try:
        shutil.rmtree(path)
        return HttpResponse("Successfully deleted " + path)
    except Exception as e:
        return HttpResponse("Failed to delete " + path + " because: " + e.__str__())

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