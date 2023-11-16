import pandas as pd
import os
import sys

if len(sys.argv) != 2:
    print("python .py fieldType")
    sys.exit()

fieldType = sys.argv[1]
directory = f"../csv/{fieldType}/links/"

files = os.listdir(directory)
for file in files:
    links = pd.read_csv(os.path.join(directory, file), sep=',')
    is_column_empty = links['citationContext'].isna().all()
    if is_column_empty and len(links) != 0:
        print(file)
        links["citationContext"] = "Missing"
        links.to_csv(file, sep=',', index=False)
        break