function downloadSvg(svgList, fileName) {
    var totalWidth = 0;
    svgList.forEach(svg => {
        totalWidth += svg.width.baseVal.value;
    });
    var averageWidth = totalWidth / svgList.length;
    var maxWidth = Math.max(...svgList.map(svg => svg.width.baseVal.value));

    var imagesLoaded = 0;
    var canvasList = [];

    var ratio = 1;
    svgList.forEach((svg, index) => {
        const localCnt = index; // 为每个索引创建一个局部变量
        const svgString = new XMLSerializer().serializeToString(svg);
        var source = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;

        var image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

        image.onload = function() {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = maxWidth;

            var scale = maxWidth / svg.width.baseVal.value;
            canvas.height = svg.height.baseVal.value * scale;
            if (localCnt >= 1) ratio = ratio * 0.5;
            console.log(ratio);

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (svg.width.baseVal.value < averageWidth) {
                // 放大并居中
                ctx.drawImage(image, 0, 0, svg.width.baseVal.value * scale, canvas.height);
            } else {
                // 直接居中
                ctx.drawImage(image, (maxWidth - svg.width.baseVal.value * scale) / 2, 0, svg.width.baseVal.value * scale, canvas.height);
            }

            canvasList.push(canvas);
            imagesLoaded++;

            if (imagesLoaded === svgList.length) {
                combineCanvases(canvasList, fileName);
            }
        };
    });
}

function combineCanvases(canvasList, fileName) {
    var totalHeight = canvasList.reduce((sum, canvas) => sum + canvas.height, 0);
    var maxWidth = Math.max(...canvasList.map(canvas => canvas.width));

    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = maxWidth;
    finalCanvas.height = totalHeight;
    var ctx = finalCanvas.getContext('2d');

    var currentY = 0;
    canvasList.forEach(canvas => {
        ctx.drawImage(canvas, 0, currentY, canvas.width, canvas.height);
        currentY += canvas.height;
    });

    var imgSrc = finalCanvas.toDataURL("image/png");

    downloadFile(fileName, dataURLtoBlob(imgSrc));
}

function downloadFile(fileName, blob) {
    var a = document.createElement('a');
    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}


function getZoomSvg(svgIdName, groupIdName) {
    var svg = d3.select(svgIdName).node();
    //得到svg的真实大小
    var box = svg.getBBox(),
        x = box.x,
        y = box.y,
        width = box.width,
        height = box.height;
    if(groupIdName) {
        //查找group
        var group = d3.select(groupIdName).node();
        if(!group) {
            alert('svg中group不存在');
            return false;
        }
        /* 这里是处理svg缩放的 */
        var transformObj = group.getAttribute('transform');
        if(transformObj) {
            /* 下面捕获由d3.event自动引起的svg移动 */
            var translateObj = transformObj.match(/translate\((\d+\.?\d*) (\d+\.?\d*)\)/),
                scaleObj = transformObj.match(/scale\((\d+(\.\d+)?)(?:\s+|\s*,\s*)(\d+(\.\d+)?)\)/);
            if(translateObj && scaleObj) {               // 匹配到平移和缩放
                var translateX = translateObj[1],
                    translateY = translateObj[2],
                    scale = scaleObj[1];
                x = (box.x - translateX) / scale;
                y = (box.y - translateY) / scale;
                width = box.width / scale;
                height = box.height / scale;
            }
            /* 下面捕获初始时手动设置的translate */
            var translateManual = transformObj.match(/translate\(([^,]+),\s*([^\)]+)\)/);
            if (translateManual) {                      // 如果svg的移动不单靠d3.event捕获的，初始时也有一个手动translate，需要将它捕获并减掉
                x = x - parseFloat(translateManual[1]);
                y = y - parseFloat(translateManual[2]);
            }
        }
    }
    //克隆svg
    var cloneSvg = svg.cloneNode(true);
    //重新设置svg的width,height,viewbox
    cloneSvg.setAttribute('width', width);
    cloneSvg.setAttribute('height', height);
    cloneSvg.setAttribute('viewBox', [x, y, width, height]);
    if(group) {
        var cloneGroup = cloneSvg.getElementById(groupIdName.replace(/\#/g, ''));
        /*------清楚缩放元素的缩放--------*/
        cloneGroup.setAttribute('transform', 'translate(0,0) scale(1)');
    }
    return cloneSvg;
}