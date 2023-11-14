import os
import pandas as pd
from tqdm import tqdm

database = 'visualization'
paperID2topic = {}

for file in tqdm(os.listdir(f'{database}/papers')):
    papers = pd.read_csv(f'{database}/papers/' + file)
    paperID2topic.update(dict(zip(papers['paperID'], papers['topic'])))

for file in tqdm(os.listdir(f'scigene_{database}_field/papers')):
    papers = pd.read_csv(f'scigene_{database}_field/papers/' + file)
    papers['topic'] = papers['paperID'].apply(lambda x: paperID2topic[x])
    papers.to_csv(f'scigene_{database}_field/papers/' + file, index=False)
