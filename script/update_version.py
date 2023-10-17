import pandas as pd
from datetime import datetime

path = "../csv/version.csv"
df = pd.read_csv(path, sep=',', header=0)
data = [['v1.0', datetime(2023, 9, 17), "GeneticFlow System has been officially released."],
        ['v1.1', datetime(2023, 10, 15), "It was found that due to the incompleteness of MAG's \"visualization\" category, about 22% visualization papers is missing in our system. A new version was released to fix this issue."]]
df = pd.DataFrame(data, columns=["versionID", "date", "updateContent"])
df.to_csv(path, sep=',', index=False)
