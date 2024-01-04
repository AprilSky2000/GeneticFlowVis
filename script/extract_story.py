import pandas as pd
import json
import numpy as np

path = '../csv/visualization'
authorID = '668764113'

# Load datasets
links_df = pd.read_csv(f'{path}/links/{authorID}.csv', dtype={'parentID': str, 'childrenID': str})
papers_df = pd.read_csv(f'{path}/papers/{authorID}.csv', dtype={'paperID': str})
topics_df = pd.read_csv(f'{path}/field_leaves.csv')

topic2name = dict(zip(topics_df['Topic'], topics_df['Name']))

###############################################################################
# 创建paperID到year的映射
paper_year_map = papers_df.set_index('paperID')['year'].to_dict()

# 检查和修正引用
modified_links = []
for index, row in links_df.iterrows():
    parent_year = paper_year_map.get(row['parentID'])
    child_year = paper_year_map.get(row['childrenID'])
    
    # 检查年份并根据需要修正引用方向
    if parent_year and child_year:
        if parent_year > child_year:
            # 反转引用方向
            links_df.at[index, 'parentID'], links_df.at[index, 'childrenID'] = row['childrenID'], row['parentID']
            modified_links.append(f"swap link {row['childrenID']}, {row['parentID']}")
        elif parent_year == child_year and int(row['parentID']) > int(row['childrenID']):
            # 删除引用
            links_df.drop(index, inplace=True)
            modified_links.append(f"delete link {row['parentID']}, {row['childrenID']}")

# 打印修改记录
for modification in modified_links:
    print(modification)

# 检查是否为DAG
is_dag = True
visited = set()
def check_cycle(node, visited, rec_stack):
    global is_dag
    if not is_dag:
        return
    
    visited.add(node)
    rec_stack.add(node)

    children = links_df[links_df['parentID'] == node]['childrenID']
    for child in children:
        if child not in visited:
            check_cycle(child, visited, rec_stack)
        elif child in rec_stack:
            is_dag = False
            return
    
    rec_stack.remove(node)

for paper_id in papers_df['paperID']:
    if paper_id not in visited:
        check_cycle(paper_id, visited, set())

if is_dag:
    print("The graph is now a DAG.")
else:
    print("The graph is not a DAG.")


###############################################################################3
# Get top cited papers
def get_top_cited_papers(papers_df, citation_threshold=50, top_n=5):
    filtered_papers = papers_df[papers_df['citationCount'] > citation_threshold]
    return filtered_papers.sort_values(by='citationCount', ascending=False).head(top_n)

# Recursive function to count descendants with caching
def count_descendants(paper_id, links_df, cache_descendants):
    if paper_id in cache_descendants:
        return cache_descendants[paper_id]

    children = links_df[links_df['parentID'] == paper_id]['childrenID'].tolist()
    count = len(children)
    for child in children:
        count += count_descendants(child, links_df, cache_descendants)

    cache_descendants[paper_id] = count
    return count

# Recursive function to count ancestors with caching
def count_ancestors(paper_id, links_df, cache_ancestors):
    if paper_id in cache_ancestors:
        return cache_ancestors[paper_id]

    parents = links_df[links_df['childrenID'] == paper_id]['parentID'].tolist()
    count = len(parents)
    for parent in parents:
        count += count_ancestors(parent, links_df, cache_ancestors)

    cache_ancestors[paper_id] = count
    return count

# Find significant papers with many descendants and ancestors
def find_significant_papers(links_df, leaf_threshold=10, top_n=3):
    cache_descendants = {}
    cache_ancestors = {}
    significant_hubs = {}  # Papers with many descendants
    significant_origins = {}  # Papers with many ancestors

    for paper_id in links_df['parentID'].unique():
        significant_hubs[paper_id] = count_descendants(paper_id, links_df, cache_descendants)

    for paper_id in links_df['childrenID'].unique():
        significant_origins[paper_id] = count_ancestors(paper_id, links_df, cache_ancestors)

    # Filter and sort papers
    top_hubs = sorted(significant_hubs.items(), key=lambda x: x[1], reverse=True)[:top_n]
    top_origins = sorted(significant_origins.items(), key=lambda x: x[1], reverse=True)[:top_n]

    return [hub[0] for hub in top_hubs], [origin[0] for origin in top_origins]

# Extract information
top_cited_papers = get_top_cited_papers(papers_df)
significant_hubs, significant_origins = find_significant_papers(links_df)


# 确保年份为整数
papers_df['year'] = papers_df['year'].astype(int)
# 将主题ID与名称匹配
topic_name_map = topics_df.set_index('Topic')['Name'].to_dict()
# 按年份和主题计算论文数量
topic_year_counts = papers_df.groupby(['year', 'topic']).size().unstack(fill_value=0)
# 获取每个主题的总论文数
total_counts = topic_year_counts.sum()
# 选择总论文数超过5篇的前5个热门主题
top_topics = total_counts[total_counts > 5].nlargest(5).index
# 构建主题随时间变化的字典
top_topic_stream = {}
for topic in top_topics:
    topic_name = topic_name_map.get(topic, 'Unknown Topic')
    top_topic_stream[topic_name] = {k: v for k, v in topic_year_counts[topic].to_dict().items() if v}

concerningPapers = top_cited_papers['paperID'].tolist() + significant_hubs + significant_origins
records = papers_df[papers_df['paperID'].isin(concerningPapers)].to_dict(orient="records")

def valid(v):
    if isinstance(v, (int, float)):
        return not np.isnan(v)
    return bool(v)

def clean_record(record):
    record['topic'] = topic2name[record['topic']]
    return {k: v for k, v in record.items() if valid(v) and not k.startswith('Unnamed')}

paperID2record = {record['paperID']: clean_record(record) for record in records}
# Structured summary
structured_summary = {
    "topCitedPapers": top_cited_papers['paperID'].tolist(),
    "significantHubs": significant_hubs,
    "significantOrigins": significant_origins,
    "topResearchTopics": top_topic_stream,
    "concerningPapers": paperID2record
}

# Print the structured summary (or save it to a file)
print(structured_summary)

class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for np types """

    def default(self, obj):
        if isinstance(obj, (np.int_, np.intc, np.intp, np.int8,
                            np.int16, np.int32, np.int64, np.uint8,
                            np.uint16, np.uint32, np.uint64)):
            return int(obj)
        elif isinstance(obj, (np.float_, np.float16, np.float32,
                              np.float64)):
            return float(obj)
        elif isinstance(obj, (np.ndarray,)):
            return obj.tolist()
        elif isinstance(obj, (np.bool_,)):
            return bool(obj)
        return json.JSONEncoder.default(self, obj)


with open(f'{authorID}.json', 'w') as f:
    json.dump(structured_summary, f, indent=4, cls=NumpyEncoder)
