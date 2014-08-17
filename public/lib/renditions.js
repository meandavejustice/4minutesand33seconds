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