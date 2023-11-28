import pandas as pd
import os
from tqdm import tqdm


def update_isKeyPaper(field):
    _dir = f'../csv/{field}/papers/'
    for file in tqdm(os.listdir(_dir)):
        papers_output = pd.read_csv(_dir.replace('csv', 'output') + file)
        paperID2isKeyPaper = dict(zip(papers_output['paperID'], papers_output['isKeyPaper']))
        paperID2venu = dict(zip(papers_output['paperID'], papers_output['venu']))

        papers = pd.read_csv(_dir + file)
        papers['isKeyPaper'] = papers['paperID'].apply(lambda x: paperID2isKeyPaper[x])
        if field != 'acl':
            papers['venu'] = papers['paperID'].apply(lambda x: paperID2venu[x])
        papers.to_csv(_dir + file, index=False)
    

def update_top_field_authors(field):
    results = []
    _dir = f'../csv/{field}/papers/'
    for file in tqdm(os.listdir(_dir)):
        papers = pd.read_csv(_dir + file)
        core_papers = papers[papers['isKeyPaper'] >= 0.5]
        core_citations = core_papers['citationCount'].to_list()
        core_citations.sort(reverse=True)
        results.append({
            'authorID': file.split('.')[0],
            'CorePaperCount_field': len(core_papers),
            'CoreCitationCount_field': core_papers['citationCount'].sum(),
            'CorehIndex_field': sum(1 for i, citation in enumerate(core_citations) if citation > i)
        })

    df = pd.DataFrame(results)
    top_field_authors = pd.read_csv(f'../csv/{field}/top_field_authors.csv')
    top_field_authors['authorID'] = top_field_authors['authorID'].astype(str)
    top_field_authors = top_field_authors.drop(columns=['CorePaperCount_field', 'CoreCitationCount_field', 'CorehIndex_field'])
    top_field_authors = top_field_authors.merge(df, on='authorID')

    top_field_authors.to_csv(f'../csv/{field}/top_field_authors.csv', index=False)


for field in ['acl', 'database', 'VCG', 'visualization']:
    update_isKeyPaper(field)
    update_top_field_authors(field)