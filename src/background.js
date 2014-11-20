chrome.app.runtime.onLaunched.addListener(function() {
  var options = {
    id: 'lightbar-window',
    innerBounds: {
      width: 800,
      height: 600,
      minWidth: 800,
      minHeight: 600,
    }
  }
  chrome.app.window.create('index.html', options, function() {});
});
