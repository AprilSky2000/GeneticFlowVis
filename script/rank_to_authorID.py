import pandas as pd
import shutil
import random
import os, re

fieldType = "acl"
directory = f"../csv/{fieldType}"
df_author = pd.read_csv(os.path.join(directory, "top_field_authors.csv"), sep=',',
                        names=["authorID", "rank", "name", "PaperCount", "CitationCount", "PaperCount_field", "authorRank", "CitationCount_field", "hIndex_field", "FellowType"])
df_author.drop(columns=["FellowType"], inplace=True)
files = os.listdir(directory)
for filename in files:
    if filename.startswith("papers_"):
        match = re.search(r'\d+', filename)
        number = int(match.group())
        authorID = df_author.loc[df_author["authorRank"] == number]["authorID"].values
        authorID = str(authorID[0])
        shutil.copy(os.path.join(directory, filename), f"{fieldType}/papers/{authorID}.csv")
        
    if filename.startswith("links_"):
        match = re.search(r'\d+', filename)
        number = int(match.group())
        authorID = df_author.loc[df_author["authorRank"] == number]["authorID"].values
        authorID = str(authorID[0])
        shutil.copy(os.path.join(directory, filename), f"{fieldType}/links/{authorID}.csv")

        df_link = pd.read_csv(f"{fieldType}/links/{authorID}.csv", sep=',', index_col=0)
        if df_link["citationContext"].isna().all() == True:
            print(filename)
            df_link["citationContext"] = df_link["extendsProb"]
            extendsProb = [random.uniform(0, 0.8) for _ in range(df_link.shape[0])]
            df_link["extendsProb"] = extendsProb
        df_link['citationContext'] = df_link['citationContext'].str.rstrip('\n')
        df_link.to_csv(f"{fieldType}/links/{authorID}.csv", sep=',', index=False)

    if filename.startswith("field_"):
        shutil.copy(os.path.join(directory, filename), f"{fieldType}/{filename}")
df_author.to_csv(f"{fieldType}/top_field_authors.csv", sep=',', index=False)