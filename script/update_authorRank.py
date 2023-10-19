import pandas as pd
import os

fieldType = "database"
directory = f"../csv/{fieldType}"
df = pd.read_csv(os.path.join(directory, "top_field_authors.csv"), sep=',')
df["authorRank_tmp"] = df["PaperCount_field"].rank(method='first', ascending=False).astype(int)
df.insert(6, "authorRank", df["authorRank_tmp"])
df.drop(columns=["authorRank_tmp"], inplace=True)
df.to_csv("top_field_authors.csv", sep=',', index=False)