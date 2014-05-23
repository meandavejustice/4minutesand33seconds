var player = document.querySelector('section.player');
var FOUR_MINUTES_AND_THIRTY_THREE_SECONDS = 273000;
var audioContext;
var timeouts = {};
var recorder;
var globalBlob;
var progressBar = document.querySelector('progress');
var remainingSeconds;
var minutesEl = document.querySelector('.timer .minute');
var secondsEl = document.querySelector('.timer .second');
var uploadButton = document.querySelector('.upload');

function prettyTime(milliseconds) {
//  console.log('millli', milliseconds);
  secondsEl.innerHTML = parseInt((milliseconds / 1000) % 60, 10);
  minutesEl.innerHTML = Math.floor((milliseconds / (1000 * 60)) % 60);
}

function startMedia(stream) {
  var input = audioContext.createMediaStreamSource(stream);
  input.connect(audioContext.destination);

  recorder = new Recorder(input);
}

function mySetTimeout(func, timeout) {
  timeouts[n = setTimeout(func, timeout)] = {
    start: new Date().getTime(),
    end: new Date().getTime() + timeout,
    t: timeout
  };
  return n;
}

function startRecording(button) {
  recorder && recorder.record();
  button.disabled = true;
  button.nextElementSibling.disabled = false;
  var remainingTime;
  var interval;
  
  remainingSeconds = mySetTimeout(function(){
    clearInterval(interval);
    stopRecording(button.nextElementSibling);
  }, FOUR_MINUTES_AND_THIRTY_THREE_SECONDS);

  interval = setInterval(function() {
    remainingTime = timeouts[remainingSeconds].end - new Date().getTime();
    prettyTime(remainingTime);
  }, 200);
}

function stopRecording(button) {
  recorder && recorder.stop();
  button.disabled = true;
  button.previousElementSibling.disabled = false;
  createDownloadLink();
  recorder.clear();
}

function uploadAudio( blob ) {
  var reader = new FileReader();
  
  reader.onload = function(event){
    var file = {};
    file.filename = globalBlob.name;
    file.data = event.target.result;
    var xhr = new XHRHttpRequest();
    xhr.open('POST', '/upload', true);
    xhr.onload = function(ev) {
      console.log('onload', ev);
    };
    xhr.upload.onprogress = function(ev) {
      if (ev.lengthComputable) {
        progressBar.value = (ev.loaded / ev.total) * 100;
        progressBar.textContent = progressBar.value;
      }
    };
  };

  reader.readAsDataURL(blob);
}

function createDownloadLink() {
  recorder && recorder.exportWAV(function (blob){
    globalBlob = blob;
    globalBlob.name = filenameInput.value;
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
  });
}

function addListeners() {
  uploadButton.addEventListener('click', function(ev) {
    if (globalBlob) {
      uploadAudio(globalBlob);
    } else {
      alert('you must record something first');
    }
  }, false);
}

window.onload = function init() {
  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
    window.URL = window.URL || window.webkitURL;

    audioContext = new AudioContext();
  } catch (e) {
    alert("No Web audio support in this browser");
  }

  navigator.getUserMedia({audio: true}, startMedia, function (e) {
    console.log(e);
  });

  addListeners();
};
