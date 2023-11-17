import pandas as pd
import os
import sys

if len(sys.argv) != 2:
    print("python .py fieldType")
    sys.exit()

fieldType = sys.argv[1]
directory = f"../csv/{fieldType}/papers/"

files = os.listdir(directory)
for file in files:
    df = pd.read_csv(os.path.join(directory, file), sep=',')
    df.to_csv(os.path.join(directory, file), sep=',')