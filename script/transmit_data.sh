#!/bin/bash

if [ $# -eq 0 ]; then
    echo "format: bash transmit_data.sh fieldType1 fieldType2"
else
    cd ../csv
    for fieldType in "$@"; do
        tar -zcvf ${fieldType}.tar.gz ${fieldType}
        scp ${fieldType}.tar.gz xfl@82.156.152.182:/home/xfl/tmp
        rm ${fieldType}.tar.gz
    done
fi
