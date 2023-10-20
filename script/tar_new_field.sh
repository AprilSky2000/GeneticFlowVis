#!/bin/bash

cd ~/tmp
if [ $# -eq 0 ]; then
    echo "format: bash tar_new_field.sh fieldType1 fieldType2"
else
    for fieldType in "$@"; do
        tar -zxvf ${fieldType}.tar.gz
        mv ${fieldType} ~/pyCode/GFVis/csv/
        rm ${fieldType}.tar.gz
    done
fi
cd -