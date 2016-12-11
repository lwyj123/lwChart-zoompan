
// hammer用于拖动
Hammer = window.Hammer;


Chart = window.Chart;
var helpers = Chart.helpers;

// Take the zoom namespace of Chart
var zoomNS = {};

// 在namespace里面加入缩放和拖动功能
var zoomFunctions = zoomNS.zoomFunctions = {};
var panFunctions = zoomNS.panFunctions = {};

function directionEnabled(mode, dir) {
	if (mode === undefined) {
		return true;
	} else if (typeof mode === 'string') {
		return mode.indexOf(dir) !== -1;
	}

	return false;
}

function zoomNumericalScale(scale, zoom, center) {
	var range = scale.max - scale.min;
	var newDiff = range * (zoom - 1);

	var cursorPixel = scale.isHorizontal() ? center.x : center.y;
	var min_percent = (scale.getValueForPixel(cursorPixel) - scale.min) / range;
	var max_percent = 1 - min_percent;

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	scale.options.ticks.min = scale.min + minDelta;
	scale.options.ticks.max = scale.max - maxDelta;
}

function zoomScale(scale, zoom, center, zoomOptions) {
	var fn = zoomFunctions[scale.options.type];
	if (fn) {
		fn(scale, zoom, center, zoomOptions);
	}
}

function doZoom(chartInstance, zoom, center) {
	var ca = chartInstance.chartArea;

	var zoomOptions = chartInstance.options.zoom;

	if (zoomOptions && zoomOptions.enabled) {
		// Do the zoom here
		var zoomMode = chartInstance.options.zoom.mode;

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(zoomMode, 'x')) {
				zoomScale(scale, zoom, center, zoomOptions);
			} else if (!scale.isHorizontal() && directionEnabled(zoomMode, 'y')) {
				// Do Y zoom
				zoomScale(scale, zoom, center, zoomOptions);
			}
		});

		chartInstance.update(0);
	}
}

function panNumericalScale(scale, delta) {
	var tickOpts = scale.options.ticks;
	var start = scale.start,
		end = scale.end;

	if (tickOpts.reverse) {
		tickOpts.max = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
		tickOpts.min = scale.getValueForPixel(scale.getPixelForValue(end) - delta);
	} else {
		tickOpts.min = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
		tickOpts.max = scale.getValueForPixel(scale.getPixelForValue(end) - delta);
	}
}

function panScale(scale, delta, panOptions) {
	var fn = panFunctions[scale.options.type];
	if (fn) {
		fn(scale, delta, panOptions);
	}
}

function doPan(chartInstance, deltaX, deltaY) {
	var panOptions = chartInstance.options.pan;
	if (panOptions && panOptions.enabled) {
		var panMode = chartInstance.options.pan.mode;
		panOptions.speed = chartInstance.options.pan.speed;

		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(panMode, 'x') && deltaX !== 0) {
				panScale(scale, deltaX, panOptions);
			} else if (!scale.isHorizontal() && directionEnabled(panMode, 'y') && deltaY !== 0) {
				panScale(scale, deltaY, panOptions);
			}
		});

		chartInstance.update(0);
	}
}

function positionInChartArea(chartInstance, position) {
	return 	(position.x >= chartInstance.chartArea.left && position.x <= chartInstance.chartArea.right) &&
		(position.y >= chartInstance.chartArea.top && position.y <= chartInstance.chartArea.bottom);
}

function getYAxis(chartInstance) {
	var scales = chartInstance.scales;

	for (var scaleId in scales) {
		var scale = scales[scaleId];

		if (!scale.isHorizontal()) {
			return scale;
		}
	}
}

// Store these for later
zoomNS.zoomFunctions.category = zoomNumericalScale;
zoomNS.zoomFunctions.linear = zoomNumericalScale;
zoomNS.panFunctions.category = panNumericalScale;
zoomNS.panFunctions.linear = panNumericalScale;



// 缩放功能
var lwPlugin = {
	beforeInit: function(chartInstance) {
		chartInstance.zoom = {};

		var node = chartInstance.zoom.node = chartInstance.chart.ctx.canvas;

		var options = chartInstance.options;
		var panThreshold = options.pan.threshold;

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
				doZoom(chartInstance, 1.5, center);
			} else {
				doZoom(chartInstance, 0.75, center);
			}
			//通知 Web 浏览器不要执行与事件关联的默认动作,不然滚动的时候窗口会一起滚
			event.preventDefault();
		};

		node.addEventListener('wheel', chartInstance.zoom._wheelHandler);


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

	beforeDatasetsDraw: function(chartInstance) {
		var ctx = chartInstance.chart.ctx;
		var chartArea = chartInstance.chartArea;
		ctx.save();
		ctx.beginPath();

		if (chartInstance.zoom._dragZoomEnd) {
			var yAxis = getYAxis(chartInstance);
			var beginPoint = chartInstance.zoom._dragZoomStart;
			var endPoint = chartInstance.zoom._dragZoomEnd;
			var offsetX = beginPoint.target.getBoundingClientRect().left;
			var startX = Math.min(beginPoint.x, endPoint.x) - offsetX;
			var endX = Math.max(beginPoint.x, endPoint.x) - offsetX;
			var rectWidth = endX - startX;


			ctx.fillStyle = 'rgba(225,225,225,0.3)';
			ctx.lineWidth = 5;
			ctx.fillRect(startX, yAxis.top, rectWidth, yAxis.bottom - yAxis.top);
		}

		ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
		ctx.clip();
	},

	afterDatasetsDraw: function(chartInstance) {
		chartInstance.chart.ctx.restore();
	},

	destroy: function(chartInstance) {
		if (chartInstance.zoom) {
			var options = chartInstance.options;
			var node = chartInstance.zoom.node;

			if (options.zoom && options.zoom.drag) {
				node.removeEventListener('mousedown', chartInstance.zoom._mouseDownHandler);
				node.removeEventListener('mousemove', chartInstance.zoom._mouseMoveHandler);
				node.removeEventListener('mouseup', chartInstance.zoom._mouseUpHandler);
			} else {
				node.removeEventListener('wheel', chartInstance.zoom._wheelHandler);
			}

			delete chartInstance.zoom;

			var mc = chartInstance._mc;
			if (mc) {
				mc.remove('pinchstart');
				mc.remove('pinch');
				mc.remove('pinchend');
				mc.remove('panstart');
				mc.remove('pan');
				mc.remove('panend');
			}
		}
	}
};

module.exports = lwPlugin;
Chart.pluginService.register(lwPlugin);
