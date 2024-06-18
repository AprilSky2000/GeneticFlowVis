# 读取config，更新每项中 papers, authors信息

import json
import os
import pandas as pd

config = json.load(open('config.json', 'r'))

# 读取papers信息
fields = config.keys()

for field in fields:
    print(field)
    cfg = config[field]
    if field == 'default':
        continue
    path = f'../csv/{field}/'

    if not os.path.exists(path):
        continue
    # authors_count 是 path/top_field_authors.csv 非标题的行数
    authors_count = len(open(path + 'top_field_authors.csv', 'r').readlines()) - 1
    topic_count = len(open(path + 'field_leaves.csv', 'r').readlines()) - 1
    # papers_count 是 path/papers 中所有 csv 的 paperID列集合的大小，注意不是简单相加，用set去重
    paperIDs = set()
    for file in os.listdir(path + 'papers'):
        if file.endswith('.csv'):
            df = pd.read_csv(path + 'papers/' + file, dtype={'paperID': str})
            if len(df):
                try:
                    paperIDs.update(df['paperID'].to_list())
                except Exception as e:
                    print(field, file, e)
    
    linkIDs = set()
    for file in os.listdir(path + 'links'):
        if file.endswith('.csv'):
            df = pd.read_csv(path + 'links/' + file, dtype={'childrenID': str, 'parentID': str})
            if len(df):
                try:
                    df['pair'] = df['parentID'] + df['childrenID']
                    linkIDs.update(df['pair'].to_list())
                except Exception as e:
                    print(field, file, e)

    cfg['papers'] = len(paperIDs)
    cfg['authors'] = authors_count
    cfg['links'] = len(linkIDs)
    cfg['topic'] = topic_count

json.dump(config, open('config.json', 'w'), indent=4)
