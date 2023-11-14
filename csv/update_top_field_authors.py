import pandas as pd
import os

database = 'acl'
results = []
for file in os.listdir(f'{database}/papers'):
    papers = pd.read_csv(f'{database}/papers/' + file)
    core_papers = papers[papers['isKeyPaper'] > 0.5]
    core_citations = core_papers['citationCount'].to_list()
    core_citations.sort(reverse=True)
    results.append({
        'authorID': file.split('.')[0],
        'CorePaperCount_field': len(core_papers),
        'CoreCitationCount_field': core_papers['citationCount'].sum(),
        'CorehIndex_field': sum(1 for i, citation in enumerate(core_citations) if citation > i)
    })

df = pd.DataFrame(results)
top_field_authors = pd.read_csv(f'{database}/top_field_authors.csv')
top_field_authors['authorID'] = top_field_authors['authorID'].astype(str)
top_field_authors = top_field_authors.merge(df, on='authorID')

top_field_authors.to_csv(f'{database}/top_field_authors.csv', index=False)