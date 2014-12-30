var renditions = document.querySelector('.renditions');
var seenFiles = {};

function renderFiles(files) {
  renditions.style.width = files.length * 307;

  files.forEach(function(file) {
    if (!!~file.filename.indexOf('.png') || seenFiles[file.filename]) return;
    var contain = document.createElement('div');
    contain.classList.add('rendition');
    contain.appendChild(renderWave(file));
    contain.appendChild(renderPlayer(file));
    renditions.appendChild(contain);
  });
}

function renderWave(file) {
  var img = document.createElement('img');
  img.src = file.url.replace('.wav', '.png');

  return img;
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