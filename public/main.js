/* global Recorder */
var getUserMedia = require('getusermedia');
var Vex = require('vexflow');
var canvas2blob = require('canvas2blob');
var audioContext = require('./lib/audioContext')();
var drawBuffer = require('./lib/drawWAV');
var FFT = require('./lib/fft');
var getFiles = require('./lib/renditions');

var renditionsEl = document.querySelector('.renditions');
var freqContain = document.querySelector('.freq');
var stopButton = document.querySelector('.stop');
var startButton = document.querySelector('.start');
var uploadButton = document.querySelector('.upload');
var progressBar = document.querySelector('progress');
var player = document.querySelector('section.player');
var minutesEl = document.querySelector('.timer .minute');
var secondsEl = document.querySelector('.timer .second');

var waveEl = document.getElementById('wave');

var sheetContain = document.getElementById('sheet');
var sheetCanvasEl = sheetContain.querySelector('canvas');

var renderer = new Vex.Flow.Renderer(sheetCanvasEl, Vex.Flow.Renderer.Backends.CANVAS);

var timeouts = {}, recorder, globalAudioBlob, globalImgBlob, remainingSeconds;
// int for testing
// var FOUR_MINUTES_AND_THIRTY_THREE_SECONDS = 10000;
var FOUR_MINUTES_AND_THIRTY_THREE_SECONDS = 273000;

var wavegfx = waveEl.getContext('2d');

var ctx = renderer.getContext();
var stave = new Vex.Flow.Stave(10, 0, 5000);
stave.addClef("treble").addTimeSignature("4/4").setContext(ctx).draw();

var fft = new FFT(audioContext, {
  canvas: document.getElementById('fft'),
  strokeStyle: '#08FF6B',
  fillStyle: '#333'
});

setInterval(getFiles, 5000);

function prettyTime(milliseconds) {
  secondsEl.innerHTML = parseInt((milliseconds / 1000) % 60, 10);
  minutesEl.innerHTML = Math.floor((milliseconds / (1000 * 60)) % 60);
}

function startMedia(stream) {
  var input = audioContext.createMediaStreamSource(stream);

  if (recorder) {
    audioContext = recorder.context;
  }

  input.connect(fft.input);
  // throw away gain node
  var gainNode = audioContext.createGain();
  gainNode.gain.value = 0;
  fft.connect(gainNode);
  gainNode.connect(audioContext.destination);
  freqContain.style.display = 'block';
  recorder = new Recorder(input);
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
  waveEl.style.display = 'block';

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
    globalAudioBlob = blob;
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
  getUserMedia({audio:true}, function (err, stream) {
    startMedia(stream);
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
  });
}

function upload(blob, filename) {
  var xhr = new XMLHttpRequest(),
  fd = new FormData();

  fd.append( 'file', blob, filename);
  xhr.open('PUT', '/upload');
  progressBar.style.display = 'block';
  xhr.upload.onprogress = function(ev) {
    progressBar.setAttribute('value', ev.loaded);
    progressBar.setAttribute('max', ev.total);
    if (ev.loaded === ev.total) {
      progressBar.setAttribute('value', 0);
      progressBar.style.display = 'none';
    }
  };
  xhr.send( fd );
}

startButton.addEventListener('click', startRecording);
stopButton.addEventListener('click', stopRecording);
uploadButton.addEventListener('click', function(ev) {
  if (globalAudioBlob) {
    var prefix = new Date().toISOString();
    upload(globalAudioBlob, prefix + '.wav');
    upload(canvas2blob(waveEl), prefix + '.png');
  } else {
    window.alert('you must record something first');
  }
}, false);
