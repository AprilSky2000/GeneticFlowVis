function downloadSvg(svg, fileName) {
    //svg字符串化 => img.src属性
    const svgString = new XMLSerializer().serializeToString(svg);
    var source = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;

    var image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

    image.onload = function() {
        //创建canvas对象，设置宽高
        var canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;
        var context = canvas.getContext('2d');
        //设置canvas对象背景
        context.rect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.fill();
        //img信息写入canvas，canvas => dataUrl => blob
        context.drawImage(image, 0, 0);
        var imgSrc = canvas.toDataURL("image/jpg", 1);

        downloadFile(fileName, dataURLtoBlob(imgSrc));
    };
}

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],//MIME类型部分
        bstr = atob(arr[1]),//Base64编码的数据内容
        n = bstr.length,
        u8arr = new Uint8Array(n);
    while(n--) {
        u8arr[n] = bstr.charCodeAt(n);//将解码后的二进制数据转换为Uint8Array数组
    }
    return new Blob(
        [u8arr],
        {type: mime}
    );
}

function downloadFile(fileName, blob) { //创建文件内容
    var aLink = document.createElement('a');
    var mouseEvent = document.createEvent("MouseEvents");
    mouseEvent.initEvent("click", false, false);
    aLink.download = fileName; //下载文件名
    aLink.href = URL.createObjectURL(blob); //根据二进制文件生成对象
    aLink.dispatchEvent(mouseEvent); //触发点击
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
        /*------这里是处理svg缩放的--------*/
        var transformObj = group.getAttribute('transform');
        if(transformObj) {
            var translateObj = transformObj.match(/translate\(([^,]*),([^,)]*)\)/),
                scaleObj = transformObj.match(/scale\(([\d.]+)\)/);
            if(translateObj && scaleObj) { //匹配到缩放
                var translateX = translateObj[1],
                    translateY = translateObj[2],
                    scale = scaleObj[1];
                x = (box.x - translateX) / scale;
                y = (box.y - translateY) / scale;
                width = box.width / scale;
                height = box.height / scale;
            }
            var translateManual = transformObj.match(/translate\(([^,]*) ([^,)]*)\)/);
            if (translateManual) {//如果svg的移动不单靠d3.event捕获的，初始时也有一个手动translate，需要将它捕获并减掉
                x = x - translateManual[1];
                y = y - translateManual[2];
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