(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/meandave/Code/4minutesand33seconds/public/lib/audioContext.js":[function(require,module,exports){
module.exports = function () {
  var context;

  if (typeof AudioContext !== "undefined") {
    context = new AudioContext();
  } else if (typeof webkitAudioContext !== "undefined") {
    context = new webkitAudioContext();
  } else {
    throw new Error('AudioContext not supported. :(');
  }

  return context;
};

},{}],"/home/meandave/Code/4minutesand33seconds/public/lib/drawWAV.js":[function(require,module,exports){
// source at https://github.com/cwilso/Audio-Buffer-Draw
function drawBuffer( width, height, context, buffer ) {
    var data = buffer.getChannelData( 0 );
    var step = Math.ceil( data.length / width );
    var amp = height / 2;
    context.strokeStyle = "#000000";
    for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (var j=0; j<step; j++) {
            var datum = data[(i*step)+j];
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
        context.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
    }
}

module.exports = drawBuffer;
},{}],"/home/meandave/Code/4minutesand33seconds/public/lib/fft.js":[function(require,module,exports){
/**
 * pulled from @jsantell
 *
 * https://github.com/jsantell/dsp-with-web-audio-presentation/blob/gh-pages/examples/FFT.js
 *
 */

var MAX_UINT8 = 255;

module.exports = FFT;

function FFT (ctx, options) {
  var module = this;
  this.canvas = options.canvas;
  this.onBeat = options.onBeat;
  this.offBeat = options.offBeat;
  this.type = options.type || 'frequency';
  this.spacing = options.spacing || 1;
  this.width = options.width || 1;
  this.count = options.count || 512;
  this.input = this.output = ctx.createAnalyser();
  this.proc = ctx.createScriptProcessor(256, 1, 1);
  this.data = new Uint8Array(this.input.frequencyBinCount);
  this.ctx = this.canvas.getContext('2d');

  this.decay = options.decay || 0.002;
  this.threshold = options.threshold || 0.5;
  this.range = options.range || [0, this.data.length-1];
  this.wait = options.wait || 512;

  this.h = this.canvas.height;
  this.w = this.canvas.width;

  this.input.connect(this.proc);
  this.proc.onaudioprocess = process.bind(null, module);
  this.ctx.lineWidth = module.width;
}

FFT.prototype.connect = function (node) {
  this.output.connect(node);
  this.proc.connect(node);
}

function process (module) {

  var ctx = module.ctx;
  var data = module.data;
  ctx.clearRect(0, 0, module.w, module.h);
  ctx.fillStyle = module.fillStyle || '#000000';
  ctx.strokeStyle = module.strokeStyle || '#000000';

  if (module.type === 'frequency') {
    module.input.getByteFrequencyData(data);
    // Abort if no data coming through, quick hack, needs fixed
    if (module.data[3] < 5) return;

    for (var i= 0, l = data.length; i < l && i < module.count; i++) {
      ctx.fillRect(
        i * (module.spacing + module.width),
        module.h,
        module.width,
        -(module.h / MAX_UINT8) * data[i]
      );
    }
  }
  else if (module.type === 'time') {
    module.input.getByteTimeDomainData(data);
    ctx.beginPath();
    ctx.moveTo(0, module.h / 2);
    for (var i= 0, l = data.length; i < l && i < module.count; i++) {
      ctx.lineTo(
        i * (module.spacing + module.width),
        (module.h / MAX_UINT8) * data[i]
      );
    }
    ctx.stroke();
    ctx.closePath();
  }
}

},{}],"/home/meandave/Code/4minutesand33seconds/public/lib/renditions.js":[function(require,module,exports){
var renditions = document.querySelector('.renditions');
var seenFiles = {};

function renderFiles(files) {
  files.forEach(function(file) {
    if (seenFiles[file.filename]) return;
    var au = renderPlayer(file);
    renditions.appendChild(au);
  });
}

function renderPlayer(file) {
  var au = document.createElement('audio');
  au.controls = true;
  au.src = file.url;

  seenFiles[file.filename] = true;
  return au;
}

function getFiles () {
  var xhr = new XMLHttpRequest();

  xhr.open('GET', '/files');
  xhr.onloadend = function(ev) {
    renderFiles(JSON.parse(ev.target.response));
  }
  xhr.send();
}

module.exports = getFiles;
},{}],"/home/meandave/Code/4minutesand33seconds/public/main.js":[function(require,module,exports){
/* global Recorder */
var audioContext = require('./lib/audioContext')();
var drawBuffer = require('./lib/drawWAV');
var FFT = require('./lib/fft');

var waveEl = document.getElementById('wave');
var stopButton = document.querySelector('.stop');
var startButton = document.querySelector('.start');
var uploadButton = document.querySelector('.upload');
var progressBar = document.querySelector('progress');
var player = document.querySelector('section.player');
var minutesEl = document.querySelector('.timer .minute');
var secondsEl = document.querySelector('.timer .second');

var timeouts = {}, recorder, globalBlob, remainingSeconds;
var FOUR_MINUTES_AND_THIRTY_THREE_SECONDS = 10000;
// var FOUR_MINUTES_AND_THIRTY_THREE_SECONDS = 273000;

var wavegfx = waveEl.getContext('2d');

var fft = new FFT(audioContext, {
  canvas: document.getElementById('fft'),
  strokeStyle: '#08FF6B',
  fillStyle: '#333'
});

var getFiles = require('./lib/renditions');
getFiles();

function prettyTime(milliseconds) {
  secondsEl.innerHTML = parseInt((milliseconds / 1000) % 60, 10);
  minutesEl.innerHTML = Math.floor((milliseconds / (1000 * 60)) % 60);
}

function startMedia(stream) {
  var input = audioContext.createMediaStreamSource(stream);

  recorder = new Recorder(input);
  if (recorder) {
    audioContext = recorder.context;
  }

  input.connect(fft.input);
  fft.connect(audioContext.destination);
}

function mySetTimeout(func, timeout) {
  var n;
  timeouts[n = setTimeout(func, timeout)] = {
    start: new Date().getTime(),
    end: new Date().getTime() + timeout,
    t: timeout
  };
  return n;
}

function drawWAV() {
  recorder.getBuffer(function(bufs) {
    if (!bufs[0].length) return;
    var newBuffer = audioContext.createBuffer( 2, bufs[0].length, audioContext.sampleRate );
    newBuffer.getChannelData(0).set(bufs[0]);
    newBuffer.getChannelData(1).set(bufs[1]);

    drawBuffer(waveEl.width, waveEl.height, wavegfx, newBuffer);
  });
}

function createDownloadLink() {
  recorder.exportWAV(function (blob){
    // sometimes the array buffer is returned here :(
    if (blob.length) return;
    globalBlob = blob;
    uploadButton.style.display = 'block';

    var url = URL.createObjectURL(blob);
    var div = document.createElement('div');
    var au = document.createElement('audio');
    var hf = document.createElement('a');

    au.controls = true;
    au.src = url;
    hf.href = url;
    hf.download = '4minutesand33seconds.wav';
    hf.innerHTML = hf.download;
    div.appendChild(au);
    player.appendChild(div);
    player.appendChild(hf);

    drawWAV();
    recorder.clear();
  });
}

function stopRecording(ev) {
  recorder.stop();
  stopButton.disabled = true;
  startButton.disabled = false;
  createDownloadLink();
}

function startRecording(ev) {
  recorder.record();
  startButton.disabled = true;
  stopButton.disabled = false;
  var remainingTime;
  var interval;

  remainingSeconds = mySetTimeout(function(){
    clearInterval(interval);
    stopRecording();
  }, FOUR_MINUTES_AND_THIRTY_THREE_SECONDS);

  interval = setInterval(function() {
    remainingTime = timeouts[remainingSeconds].end - new Date().getTime();
    prettyTime(remainingTime);
  }, 200);
}

function uploadAudio(blob) {
  var xhr = new XMLHttpRequest(),
  fd = new FormData();
  var filename = '4minutesand33seconds-' + new Date() + '.mp3';

  fd.append( 'file', blob, filename);
  xhr.open('POST', '/upload');
  xhr.upload.onprogress = function(ev) {
    progressBar.setAttribute('value', ev.loaded);
    progressBar.setAttribute('max', ev.total);
  };
  xhr.send( fd );
}

function addListeners() {
  startButton.addEventListener('click', startRecording);
  stopButton.addEventListener('click', stopRecording);

  uploadButton.addEventListener('click', function(ev) {
    if (globalBlob) {
      uploadAudio(globalBlob);
    } else {
      window.alert('you must record something first');
    }
  }, false);
}

window.onload = function init() {
  try {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    window.URL = window.URL || window.webkitURL;

  } catch (e) {
    window.alert("No Web audio support in this browser");
  }

  navigator.getUserMedia({audio: true}, startMedia, function (e) {
    console.log(e);
  });

  addListeners();
};

},{"./lib/audioContext":"/home/meandave/Code/4minutesand33seconds/public/lib/audioContext.js","./lib/drawWAV":"/home/meandave/Code/4minutesand33seconds/public/lib/drawWAV.js","./lib/fft":"/home/meandave/Code/4minutesand33seconds/public/lib/fft.js","./lib/renditions":"/home/meandave/Code/4minutesand33seconds/public/lib/renditions.js"}]},{},["/home/meandave/Code/4minutesand33seconds/public/main.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL21lYW5kYXZlL0NvZGUvNG1pbnV0ZXNhbmQzM3NlY29uZHMvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsIi9ob21lL21lYW5kYXZlL0NvZGUvNG1pbnV0ZXNhbmQzM3NlY29uZHMvcHVibGljL2xpYi9hdWRpb0NvbnRleHQuanMiLCIvaG9tZS9tZWFuZGF2ZS9Db2RlLzRtaW51dGVzYW5kMzNzZWNvbmRzL3B1YmxpYy9saWIvZHJhd1dBVi5qcyIsIi9ob21lL21lYW5kYXZlL0NvZGUvNG1pbnV0ZXNhbmQzM3NlY29uZHMvcHVibGljL2xpYi9mZnQuanMiLCIvaG9tZS9tZWFuZGF2ZS9Db2RlLzRtaW51dGVzYW5kMzNzZWNvbmRzL3B1YmxpYy9saWIvcmVuZGl0aW9ucy5qcyIsIi9ob21lL21lYW5kYXZlL0NvZGUvNG1pbnV0ZXNhbmQzM3NlY29uZHMvcHVibGljL21haW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjb250ZXh0O1xuXG4gIGlmICh0eXBlb2YgQXVkaW9Db250ZXh0ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygd2Via2l0QXVkaW9Db250ZXh0ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgY29udGV4dCA9IG5ldyB3ZWJraXRBdWRpb0NvbnRleHQoKTtcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0F1ZGlvQ29udGV4dCBub3Qgc3VwcG9ydGVkLiA6KCcpO1xuICB9XG5cbiAgcmV0dXJuIGNvbnRleHQ7XG59O1xuIiwiLy8gc291cmNlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9jd2lsc28vQXVkaW8tQnVmZmVyLURyYXdcbmZ1bmN0aW9uIGRyYXdCdWZmZXIoIHdpZHRoLCBoZWlnaHQsIGNvbnRleHQsIGJ1ZmZlciApIHtcbiAgICB2YXIgZGF0YSA9IGJ1ZmZlci5nZXRDaGFubmVsRGF0YSggMCApO1xuICAgIHZhciBzdGVwID0gTWF0aC5jZWlsKCBkYXRhLmxlbmd0aCAvIHdpZHRoICk7XG4gICAgdmFyIGFtcCA9IGhlaWdodCAvIDI7XG4gICAgY29udGV4dC5zdHJva2VTdHlsZSA9IFwiIzAwMDAwMFwiO1xuICAgIGZvcih2YXIgaT0wOyBpIDwgd2lkdGg7IGkrKyl7XG4gICAgICAgIHZhciBtaW4gPSAxLjA7XG4gICAgICAgIHZhciBtYXggPSAtMS4wO1xuICAgICAgICBmb3IgKHZhciBqPTA7IGo8c3RlcDsgaisrKSB7XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSBkYXRhWyhpKnN0ZXApK2pdO1xuICAgICAgICAgICAgaWYgKGRhdHVtIDwgbWluKVxuICAgICAgICAgICAgICAgIG1pbiA9IGRhdHVtO1xuICAgICAgICAgICAgaWYgKGRhdHVtID4gbWF4KVxuICAgICAgICAgICAgICAgIG1heCA9IGRhdHVtO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRleHQuZmlsbFJlY3QoaSwoMSttaW4pKmFtcCwxLE1hdGgubWF4KDEsKG1heC1taW4pKmFtcCkpO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkcmF3QnVmZmVyOyIsIi8qKlxuICogcHVsbGVkIGZyb20gQGpzYW50ZWxsXG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL2pzYW50ZWxsL2RzcC13aXRoLXdlYi1hdWRpby1wcmVzZW50YXRpb24vYmxvYi9naC1wYWdlcy9leGFtcGxlcy9GRlQuanNcbiAqXG4gKi9cblxudmFyIE1BWF9VSU5UOCA9IDI1NTtcblxubW9kdWxlLmV4cG9ydHMgPSBGRlQ7XG5cbmZ1bmN0aW9uIEZGVCAoY3R4LCBvcHRpb25zKSB7XG4gIHZhciBtb2R1bGUgPSB0aGlzO1xuICB0aGlzLmNhbnZhcyA9IG9wdGlvbnMuY2FudmFzO1xuICB0aGlzLm9uQmVhdCA9IG9wdGlvbnMub25CZWF0O1xuICB0aGlzLm9mZkJlYXQgPSBvcHRpb25zLm9mZkJlYXQ7XG4gIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZSB8fCAnZnJlcXVlbmN5JztcbiAgdGhpcy5zcGFjaW5nID0gb3B0aW9ucy5zcGFjaW5nIHx8IDE7XG4gIHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoIHx8IDE7XG4gIHRoaXMuY291bnQgPSBvcHRpb25zLmNvdW50IHx8IDUxMjtcbiAgdGhpcy5pbnB1dCA9IHRoaXMub3V0cHV0ID0gY3R4LmNyZWF0ZUFuYWx5c2VyKCk7XG4gIHRoaXMucHJvYyA9IGN0eC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoMjU2LCAxLCAxKTtcbiAgdGhpcy5kYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5pbnB1dC5mcmVxdWVuY3lCaW5Db3VudCk7XG4gIHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICB0aGlzLmRlY2F5ID0gb3B0aW9ucy5kZWNheSB8fCAwLjAwMjtcbiAgdGhpcy50aHJlc2hvbGQgPSBvcHRpb25zLnRocmVzaG9sZCB8fCAwLjU7XG4gIHRoaXMucmFuZ2UgPSBvcHRpb25zLnJhbmdlIHx8IFswLCB0aGlzLmRhdGEubGVuZ3RoLTFdO1xuICB0aGlzLndhaXQgPSBvcHRpb25zLndhaXQgfHwgNTEyO1xuXG4gIHRoaXMuaCA9IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgdGhpcy53ID0gdGhpcy5jYW52YXMud2lkdGg7XG5cbiAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMucHJvYyk7XG4gIHRoaXMucHJvYy5vbmF1ZGlvcHJvY2VzcyA9IHByb2Nlc3MuYmluZChudWxsLCBtb2R1bGUpO1xuICB0aGlzLmN0eC5saW5lV2lkdGggPSBtb2R1bGUud2lkdGg7XG59XG5cbkZGVC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uIChub2RlKSB7XG4gIHRoaXMub3V0cHV0LmNvbm5lY3Qobm9kZSk7XG4gIHRoaXMucHJvYy5jb25uZWN0KG5vZGUpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzIChtb2R1bGUpIHtcblxuICB2YXIgY3R4ID0gbW9kdWxlLmN0eDtcbiAgdmFyIGRhdGEgPSBtb2R1bGUuZGF0YTtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCBtb2R1bGUudywgbW9kdWxlLmgpO1xuICBjdHguZmlsbFN0eWxlID0gbW9kdWxlLmZpbGxTdHlsZSB8fCAnIzAwMDAwMCc7XG4gIGN0eC5zdHJva2VTdHlsZSA9IG1vZHVsZS5zdHJva2VTdHlsZSB8fCAnIzAwMDAwMCc7XG5cbiAgaWYgKG1vZHVsZS50eXBlID09PSAnZnJlcXVlbmN5Jykge1xuICAgIG1vZHVsZS5pbnB1dC5nZXRCeXRlRnJlcXVlbmN5RGF0YShkYXRhKTtcbiAgICAvLyBBYm9ydCBpZiBubyBkYXRhIGNvbWluZyB0aHJvdWdoLCBxdWljayBoYWNrLCBuZWVkcyBmaXhlZFxuICAgIGlmIChtb2R1bGUuZGF0YVszXSA8IDUpIHJldHVybjtcblxuICAgIGZvciAodmFyIGk9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGwgJiYgaSA8IG1vZHVsZS5jb3VudDsgaSsrKSB7XG4gICAgICBjdHguZmlsbFJlY3QoXG4gICAgICAgIGkgKiAobW9kdWxlLnNwYWNpbmcgKyBtb2R1bGUud2lkdGgpLFxuICAgICAgICBtb2R1bGUuaCxcbiAgICAgICAgbW9kdWxlLndpZHRoLFxuICAgICAgICAtKG1vZHVsZS5oIC8gTUFYX1VJTlQ4KSAqIGRhdGFbaV1cbiAgICAgICk7XG4gICAgfVxuICB9XG4gIGVsc2UgaWYgKG1vZHVsZS50eXBlID09PSAndGltZScpIHtcbiAgICBtb2R1bGUuaW5wdXQuZ2V0Qnl0ZVRpbWVEb21haW5EYXRhKGRhdGEpO1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHgubW92ZVRvKDAsIG1vZHVsZS5oIC8gMik7XG4gICAgZm9yICh2YXIgaT0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbCAmJiBpIDwgbW9kdWxlLmNvdW50OyBpKyspIHtcbiAgICAgIGN0eC5saW5lVG8oXG4gICAgICAgIGkgKiAobW9kdWxlLnNwYWNpbmcgKyBtb2R1bGUud2lkdGgpLFxuICAgICAgICAobW9kdWxlLmggLyBNQVhfVUlOVDgpICogZGF0YVtpXVxuICAgICAgKTtcbiAgICB9XG4gICAgY3R4LnN0cm9rZSgpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxufVxuIiwidmFyIHJlbmRpdGlvbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcucmVuZGl0aW9ucycpO1xudmFyIHNlZW5GaWxlcyA9IHt9O1xuXG5mdW5jdGlvbiByZW5kZXJGaWxlcyhmaWxlcykge1xuICBmaWxlcy5mb3JFYWNoKGZ1bmN0aW9uKGZpbGUpIHtcbiAgICBpZiAoc2VlbkZpbGVzW2ZpbGUuZmlsZW5hbWVdKSByZXR1cm47XG4gICAgdmFyIGF1ID0gcmVuZGVyUGxheWVyKGZpbGUpO1xuICAgIHJlbmRpdGlvbnMuYXBwZW5kQ2hpbGQoYXUpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyUGxheWVyKGZpbGUpIHtcbiAgdmFyIGF1ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgYXUuY29udHJvbHMgPSB0cnVlO1xuICBhdS5zcmMgPSBmaWxlLnVybDtcblxuICBzZWVuRmlsZXNbZmlsZS5maWxlbmFtZV0gPSB0cnVlO1xuICByZXR1cm4gYXU7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVzICgpIHtcbiAgdmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gIHhoci5vcGVuKCdHRVQnLCAnL2ZpbGVzJyk7XG4gIHhoci5vbmxvYWRlbmQgPSBmdW5jdGlvbihldikge1xuICAgIHJlbmRlckZpbGVzKEpTT04ucGFyc2UoZXYudGFyZ2V0LnJlc3BvbnNlKSk7XG4gIH1cbiAgeGhyLnNlbmQoKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRGaWxlczsiLCIvKiBnbG9iYWwgUmVjb3JkZXIgKi9cbnZhciBhdWRpb0NvbnRleHQgPSByZXF1aXJlKCcuL2xpYi9hdWRpb0NvbnRleHQnKSgpO1xudmFyIGRyYXdCdWZmZXIgPSByZXF1aXJlKCcuL2xpYi9kcmF3V0FWJyk7XG52YXIgRkZUID0gcmVxdWlyZSgnLi9saWIvZmZ0Jyk7XG5cbnZhciB3YXZlRWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnd2F2ZScpO1xudmFyIHN0b3BCdXR0b24gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc3RvcCcpO1xudmFyIHN0YXJ0QnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnN0YXJ0Jyk7XG52YXIgdXBsb2FkQnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnVwbG9hZCcpO1xudmFyIHByb2dyZXNzQmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcigncHJvZ3Jlc3MnKTtcbnZhciBwbGF5ZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdzZWN0aW9uLnBsYXllcicpO1xudmFyIG1pbnV0ZXNFbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy50aW1lciAubWludXRlJyk7XG52YXIgc2Vjb25kc0VsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnRpbWVyIC5zZWNvbmQnKTtcblxudmFyIHRpbWVvdXRzID0ge30sIHJlY29yZGVyLCBnbG9iYWxCbG9iLCByZW1haW5pbmdTZWNvbmRzO1xudmFyIEZPVVJfTUlOVVRFU19BTkRfVEhJUlRZX1RIUkVFX1NFQ09ORFMgPSAxMDAwMDtcbi8vIHZhciBGT1VSX01JTlVURVNfQU5EX1RISVJUWV9USFJFRV9TRUNPTkRTID0gMjczMDAwO1xuXG52YXIgd2F2ZWdmeCA9IHdhdmVFbC5nZXRDb250ZXh0KCcyZCcpO1xuXG52YXIgZmZ0ID0gbmV3IEZGVChhdWRpb0NvbnRleHQsIHtcbiAgY2FudmFzOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmZ0JyksXG4gIHN0cm9rZVN0eWxlOiAnIzA4RkY2QicsXG4gIGZpbGxTdHlsZTogJyMzMzMnXG59KTtcblxudmFyIGdldEZpbGVzID0gcmVxdWlyZSgnLi9saWIvcmVuZGl0aW9ucycpO1xuZ2V0RmlsZXMoKTtcblxuZnVuY3Rpb24gcHJldHR5VGltZShtaWxsaXNlY29uZHMpIHtcbiAgc2Vjb25kc0VsLmlubmVySFRNTCA9IHBhcnNlSW50KChtaWxsaXNlY29uZHMgLyAxMDAwKSAlIDYwLCAxMCk7XG4gIG1pbnV0ZXNFbC5pbm5lckhUTUwgPSBNYXRoLmZsb29yKChtaWxsaXNlY29uZHMgLyAoMTAwMCAqIDYwKSkgJSA2MCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0TWVkaWEoc3RyZWFtKSB7XG4gIHZhciBpbnB1dCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVNZWRpYVN0cmVhbVNvdXJjZShzdHJlYW0pO1xuXG4gIHJlY29yZGVyID0gbmV3IFJlY29yZGVyKGlucHV0KTtcbiAgaWYgKHJlY29yZGVyKSB7XG4gICAgYXVkaW9Db250ZXh0ID0gcmVjb3JkZXIuY29udGV4dDtcbiAgfVxuXG4gIGlucHV0LmNvbm5lY3QoZmZ0LmlucHV0KTtcbiAgZmZ0LmNvbm5lY3QoYXVkaW9Db250ZXh0LmRlc3RpbmF0aW9uKTtcbn1cblxuZnVuY3Rpb24gbXlTZXRUaW1lb3V0KGZ1bmMsIHRpbWVvdXQpIHtcbiAgdmFyIG47XG4gIHRpbWVvdXRzW24gPSBzZXRUaW1lb3V0KGZ1bmMsIHRpbWVvdXQpXSA9IHtcbiAgICBzdGFydDogbmV3IERhdGUoKS5nZXRUaW1lKCksXG4gICAgZW5kOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRpbWVvdXQsXG4gICAgdDogdGltZW91dFxuICB9O1xuICByZXR1cm4gbjtcbn1cblxuZnVuY3Rpb24gZHJhd1dBVigpIHtcbiAgcmVjb3JkZXIuZ2V0QnVmZmVyKGZ1bmN0aW9uKGJ1ZnMpIHtcbiAgICBpZiAoIWJ1ZnNbMF0ubGVuZ3RoKSByZXR1cm47XG4gICAgdmFyIG5ld0J1ZmZlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXIoIDIsIGJ1ZnNbMF0ubGVuZ3RoLCBhdWRpb0NvbnRleHQuc2FtcGxlUmF0ZSApO1xuICAgIG5ld0J1ZmZlci5nZXRDaGFubmVsRGF0YSgwKS5zZXQoYnVmc1swXSk7XG4gICAgbmV3QnVmZmVyLmdldENoYW5uZWxEYXRhKDEpLnNldChidWZzWzFdKTtcblxuICAgIGRyYXdCdWZmZXIod2F2ZUVsLndpZHRoLCB3YXZlRWwuaGVpZ2h0LCB3YXZlZ2Z4LCBuZXdCdWZmZXIpO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRG93bmxvYWRMaW5rKCkge1xuICByZWNvcmRlci5leHBvcnRXQVYoZnVuY3Rpb24gKGJsb2Ipe1xuICAgIC8vIHNvbWV0aW1lcyB0aGUgYXJyYXkgYnVmZmVyIGlzIHJldHVybmVkIGhlcmUgOihcbiAgICBpZiAoYmxvYi5sZW5ndGgpIHJldHVybjtcbiAgICBnbG9iYWxCbG9iID0gYmxvYjtcbiAgICB1cGxvYWRCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cbiAgICB2YXIgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcbiAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdmFyIGF1ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYXVkaW8nKTtcbiAgICB2YXIgaGYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG5cbiAgICBhdS5jb250cm9scyA9IHRydWU7XG4gICAgYXUuc3JjID0gdXJsO1xuICAgIGhmLmhyZWYgPSB1cmw7XG4gICAgaGYuZG93bmxvYWQgPSAnNG1pbnV0ZXNhbmQzM3NlY29uZHMud2F2JztcbiAgICBoZi5pbm5lckhUTUwgPSBoZi5kb3dubG9hZDtcbiAgICBkaXYuYXBwZW5kQ2hpbGQoYXUpO1xuICAgIHBsYXllci5hcHBlbmRDaGlsZChkaXYpO1xuICAgIHBsYXllci5hcHBlbmRDaGlsZChoZik7XG5cbiAgICBkcmF3V0FWKCk7XG4gICAgcmVjb3JkZXIuY2xlYXIoKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHN0b3BSZWNvcmRpbmcoZXYpIHtcbiAgcmVjb3JkZXIuc3RvcCgpO1xuICBzdG9wQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcbiAgc3RhcnRCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgY3JlYXRlRG93bmxvYWRMaW5rKCk7XG59XG5cbmZ1bmN0aW9uIHN0YXJ0UmVjb3JkaW5nKGV2KSB7XG4gIHJlY29yZGVyLnJlY29yZCgpO1xuICBzdGFydEJ1dHRvbi5kaXNhYmxlZCA9IHRydWU7XG4gIHN0b3BCdXR0b24uZGlzYWJsZWQgPSBmYWxzZTtcbiAgdmFyIHJlbWFpbmluZ1RpbWU7XG4gIHZhciBpbnRlcnZhbDtcblxuICByZW1haW5pbmdTZWNvbmRzID0gbXlTZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgY2xlYXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgc3RvcFJlY29yZGluZygpO1xuICB9LCBGT1VSX01JTlVURVNfQU5EX1RISVJUWV9USFJFRV9TRUNPTkRTKTtcblxuICBpbnRlcnZhbCA9IHNldEludGVydmFsKGZ1bmN0aW9uKCkge1xuICAgIHJlbWFpbmluZ1RpbWUgPSB0aW1lb3V0c1tyZW1haW5pbmdTZWNvbmRzXS5lbmQgLSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICBwcmV0dHlUaW1lKHJlbWFpbmluZ1RpbWUpO1xuICB9LCAyMDApO1xufVxuXG5mdW5jdGlvbiB1cGxvYWRBdWRpbyhibG9iKSB7XG4gIHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKSxcbiAgZmQgPSBuZXcgRm9ybURhdGEoKTtcbiAgdmFyIGZpbGVuYW1lID0gJzRtaW51dGVzYW5kMzNzZWNvbmRzLScgKyBuZXcgRGF0ZSgpICsgJy5tcDMnO1xuXG4gIGZkLmFwcGVuZCggJ2ZpbGUnLCBibG9iLCBmaWxlbmFtZSk7XG4gIHhoci5vcGVuKCdQT1NUJywgJy91cGxvYWQnKTtcbiAgeGhyLnVwbG9hZC5vbnByb2dyZXNzID0gZnVuY3Rpb24oZXYpIHtcbiAgICBwcm9ncmVzc0Jhci5zZXRBdHRyaWJ1dGUoJ3ZhbHVlJywgZXYubG9hZGVkKTtcbiAgICBwcm9ncmVzc0Jhci5zZXRBdHRyaWJ1dGUoJ21heCcsIGV2LnRvdGFsKTtcbiAgfTtcbiAgeGhyLnNlbmQoIGZkICk7XG59XG5cbmZ1bmN0aW9uIGFkZExpc3RlbmVycygpIHtcbiAgc3RhcnRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzdGFydFJlY29yZGluZyk7XG4gIHN0b3BCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzdG9wUmVjb3JkaW5nKTtcblxuICB1cGxvYWRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbihldikge1xuICAgIGlmIChnbG9iYWxCbG9iKSB7XG4gICAgICB1cGxvYWRBdWRpbyhnbG9iYWxCbG9iKTtcbiAgICB9IGVsc2Uge1xuICAgICAgd2luZG93LmFsZXJ0KCd5b3UgbXVzdCByZWNvcmQgc29tZXRoaW5nIGZpcnN0Jyk7XG4gICAgfVxuICB9LCBmYWxzZSk7XG59XG5cbndpbmRvdy5vbmxvYWQgPSBmdW5jdGlvbiBpbml0KCkge1xuICB0cnkge1xuICAgIG5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhIHx8IG5hdmlnYXRvci53ZWJraXRHZXRVc2VyTWVkaWE7XG4gICAgd2luZG93LlVSTCA9IHdpbmRvdy5VUkwgfHwgd2luZG93LndlYmtpdFVSTDtcblxuICB9IGNhdGNoIChlKSB7XG4gICAgd2luZG93LmFsZXJ0KFwiTm8gV2ViIGF1ZGlvIHN1cHBvcnQgaW4gdGhpcyBicm93c2VyXCIpO1xuICB9XG5cbiAgbmF2aWdhdG9yLmdldFVzZXJNZWRpYSh7YXVkaW86IHRydWV9LCBzdGFydE1lZGlhLCBmdW5jdGlvbiAoZSkge1xuICAgIGNvbnNvbGUubG9nKGUpO1xuICB9KTtcblxuICBhZGRMaXN0ZW5lcnMoKTtcbn07XG4iXX0=
