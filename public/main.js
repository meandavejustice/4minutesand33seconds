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
