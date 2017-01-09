
// hammer用于拖动
Hammer = window.Hammer;


Chart = window.Chart;
var helpers = Chart.helpers;


function zoomScale(scale, zoom, center, zoomOptions) {
	var range = scale.max - scale.min;
	var newDiff = range * (zoom - 1);

	var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	var percent = (scale.max - scale.min) / range;

    //调参结果这样效果差不多
	var minDelta = newDiff * percent;
	var maxDelta = newDiff * 0.5*percent;

    //修正ticks
	scale.options.ticks.min = scale.min + minDelta;
	scale.options.ticks.max = scale.max - maxDelta;
}

function doZoom(chartInstance, zoom, center) {
	var ca = chartInstance.chartArea;

	var zoomOptions = chartInstance.options.zoom;

	if (zoomOptions && zoomOptions.enabled) {
		
		//对每个坐标轴进行缩放
		helpers.each(chartInstance.scales, function(scale, id) {
			zoomScale(scale, zoom, center, zoomOptions);
		});

		chartInstance.update(0);
	}
}

function panScale(scale, delta) {
	var tickOpts = scale.options.ticks;
	var start = scale.start,
		end = scale.end;

    //改变ticks里min和max来实现平移
	tickOpts.min = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
	tickOpts.max = scale.getValueForPixel(scale.getPixelForValue(end) - delta);

}

function doPan(chartInstance, deltaX, deltaY) {
	var panOptions = chartInstance.options.pan;
	if (panOptions.enabled) {

		//依据delta平移
		helpers.each(chartInstance.scales, function(scale, id) {
            //如果是x轴
			if (scale.isHorizontal() && deltaX !== 0) {
				panScale(scale, deltaX);
			} else if (!scale.isHorizontal() && deltaY !== 0) {
				panScale(scale, deltaY);
			}
		});

        //更新chart实例实现图像上的更新
		chartInstance.update(0);
	}
}



// 缩放功能
var lwPlugin = {
	//开始时绑定事件
	beforeInit: function(chartInstance) {
		chartInstance.zoom = {};

		var node = chartInstance.zoom.node = chartInstance.chart.ctx.canvas;

		var options = chartInstance.options;
		var panThreshold = options.pan.threshold;

		//滚轮事件，用于缩放
		chartInstance.zoom._wheelHandler = function(event) {
			var rect = event.target.getBoundingClientRect();
			//浏览器页面的坐标减去元素左上坐标，获取相对中心
			var offsetX = event.clientX - rect.left;
			var offsetY = event.clientY - rect.top;

			var center = {
				x : offsetX,
				y : offsetY
			};
			//上滑滚轮放大 下滑缩小
			if (event.deltaY < 0) {
				doZoom(chartInstance, 1.25, center);
			} else {
				doZoom(chartInstance, 0.75, center);
			}
			//通知 Web 浏览器不要执行与事件关联的默认动作,不然滚动的时候窗口会一起滚
			event.preventDefault();
		};

		node.addEventListener('wheel', chartInstance.zoom._wheelHandler);


		//基于hammer实现拖动平移
		var mc = new Hammer.Manager(node);
		mc.add(new Hammer.Pinch());
		mc.add(new Hammer.Pan({
			threshold: panThreshold
		}));

		var currentDeltaX = null, currentDeltaY = null;
		var handlePan = function handlePan(e) {
			var deltaX = e.deltaX - currentDeltaX;
			var deltaY = e.deltaY - currentDeltaY;
			currentDeltaX = e.deltaX;
			currentDeltaY = e.deltaY;
			doPan(chartInstance, deltaX, deltaY);
		};

		mc.on('panstart', function(e) {
			currentDeltaX = 0;
			currentDeltaY = 0;
			handlePan(e);
		});
		mc.on('panmove', handlePan);
		mc.on('panend', function(e) {
			currentDeltaX = null;
			currentDeltaY = null;
		});
		chartInstance._mc = mc;

	},

	destroy: function(chartInstance) {
		//解绑事件和删除属性
		if (chartInstance.zoom) {
			var options = chartInstance.options;
			var node = chartInstance.zoom.node;

			node.removeEventListener('wheel', chartInstance.zoom._wheelHandler);

			delete chartInstance.zoom;

			var mc = chartInstance._mc;
			if (mc) {
				mc.remove('panstart');
				mc.remove('pan');
				mc.remove('panend');
			}
            delete chartInstance._mc;
		}
	}
};

module.exports = lwPlugin;
Chart.pluginService.register(lwPlugin);
