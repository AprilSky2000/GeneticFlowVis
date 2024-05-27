# 读取config，更新每项中 papers, authors信息

import json
import os

config = json.load(open('config.json', 'r'))

# 读取papers信息
fields = ['fellows'] # config.keys()

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

    # papers_count 是 path/papers 中所有 csv 的 paperID列集合的大小，注意不是简单相加，用set去重
    paperIDs = set()
    for file in os.listdir(path + 'papers'):
        if file.endswith('.csv'):
            paperIDs.update(open(path + 'papers/' + file, 'r').readlines()[1:])
    papers_count = len(paperIDs)

    cfg['papers'] = papers_count
    cfg['authors'] = authors_count

json.dump(config, open('config.json', 'w'), indent=4)
