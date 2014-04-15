var DEFAULT_BRIGHTNESS = 100; // %.
var DEFAULT_DURATION = 0.2; // s.

function onKeyDown(event) {
  var isNumeric = (event.keyCode > 47 && event.keyCode < 58);
  var isDirectionKey = (event.keyCode > 36 && event.keyCode < 41);
  var isBackspaceKey = (event.keyCode == 8);
  var isTabKey = (event.keyCode == 9);
  var isUniqueDotKey = (event.keyCode == 190) &&
                       (event.target.textContent.indexOf('.') == -1);
  if (!isNumeric && !isDirectionKey && !isBackspaceKey && !isTabKey &&
      !isUniqueDotKey)
    event.preventDefault();
}

function onBlur(event) {
  event.target.innerText = event.target.innerText || 0;
}

function onColorPickerChange(event) {
  var newColor = event.target.value;
  event.target.style['color'] = newColor;
  var indicator = event.target.parentNode.querySelector('.indicator');
  indicator.classList.add('led-on');
  indicator.tabIndex = 0;
}

function onIndicatorClick(event) {
  var indicator = event.target;
  if (!indicator.classList.toggle('led-on')) {
    var colorPicker = indicator.parentNode.querySelector('[type="color"]');
    colorPicker.value = '#ffffff';
    colorPicker.style.color = '#666';    
    indicator.tabIndex = -1;
  } else {
    indicator.tabIndex = 0;
  }
}

function onRemoveButtonClick(event) {
  var button = event.target;
  button.disabled = true;
  var toRemoveElement = event.target.parentNode;
  toRemoveElement.classList.add('hidden');
  setTimeout(function() {
    button.disabled = false; // Reenable when animation is over;
    toRemoveElement.parentNode.removeChild(toRemoveElement);
    var lightbars = document.querySelectorAll('.lightbar');
    if (lightbars.length === 0)
      init();    
  }, 200);
}

function onAddButtonClick(event) {
  var adjacentElement = event.target.parentNode;
  insertLightbarElement(adjacentElement);
}

function insertLightbarElement(adjacentElement) {
  var lightbarController = document.createElement('div');
  lightbarController.classList.add('lightbar-controller', 'hidden');
  
  var duration = document.createElement('div');
  duration.classList.add('duration');
  duration.title = 'Duration in Seconds'
  duration.innerText = DEFAULT_DURATION;
  duration.contentEditable = true;
  duration.addEventListener('keydown', onKeyDown);
  duration.addEventListener('blur', onBlur);
  lightbarController.appendChild(duration);
  
  var brightness = document.createElement('div');
  brightness.classList.add('brightness');
  brightness.title = 'Brightness in Percent'
  brightness.innerText = DEFAULT_BRIGHTNESS;
  brightness.contentEditable = true;
  brightness.addEventListener('keydown', onKeyDown);
  brightness.addEventListener('blur', onBlur);
  lightbarController.appendChild(brightness);
  
  var removeButton = document.createElement('button');
  removeButton.classList.add('remove-light-bar', 'action-button');
  removeButton.title = 'Remove this sequence';
  removeButton.addEventListener('click', onRemoveButtonClick);
  lightbarController.appendChild(removeButton);

  var lightbar = document.createElement('div');
  lightbar.classList.add('lightbar');
  function addLed(parent) {
    var led = document.createElement('div');
    led.classList.add('led');
    
    var colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = '#ffffff';
    colorPicker.title = 'Set color LED';
    colorPicker.addEventListener('change', onColorPickerChange);
    led.appendChild(colorPicker);
    
    var indicator = document.createElement('button');
    indicator.classList.add('indicator');
    indicator.tabIndex = -1;
    indicator.title = 'Turn off LED';
    indicator.addEventListener('click', onIndicatorClick);
    led.appendChild(indicator);
    
    parent.appendChild(led);
  };
  for (var i = 0; i < 4; i++)
    addLed(lightbar);
  lightbarController.appendChild(lightbar);
  
  var addButton = document.createElement('button');
  addButton.classList.add('add-light-bar', 'action-button');
  addButton.title = 'Add a new sequence from here';
  addButton.addEventListener('click', onAddButtonClick);
  lightbarController.appendChild(addButton);
  
  adjacentElement.insertAdjacentElement('afterEnd', lightbarController);
  setTimeout(function() {
    lightbarController.classList.remove('hidden');
  }, 0); // Force lightbarController to be displayed first.
}

function copyToClipboard(text) {
  var buffer = document.createElement('textarea');
  document.body.appendChild(buffer);
  buffer.style.position = 'absolute'; // Hack: http://crbug.com/334062
  buffer.value = text;
  buffer.select();
  document.execCommand('copy');
  buffer.remove();
}

function getShellCommand(startsWithShell) {
  var shellCommands = [];
  shellCommands.push('(\ncd /sys/devices/virtual/chromeos/cros_ec/lightbar');
  shellCommands.push('echo stop > sequence');
  shellCommands.push('echo "4 00 00 00" > led_rgb'); // Turn off all the leds first.
  
  var lightbars = document.querySelectorAll('.lightbar');
  for (var i = 0; i < lightbars.length; i++) {
    var lightbar = lightbars[i];
    
    var brightness = lightbar.parentNode.querySelector('.brightness');
    var brightnessPercent = Math.round(parseInt(brightness.textContent) * 255 / 100);
    shellCommands.push('echo ' + Math.min(brightnessPercent, 255) + ' > brightness');
    
    var command = 'echo "';
    var leds = lightbar.querySelectorAll('[type="color"]');
    for (var j = 0; j < leds.length; j++) {
      command += j + ' ';
      var indicator = leds[j].parentNode.querySelector('.indicator');
      if (indicator.classList.contains('led-on')) {
        command += parseInt(leds[j].value.substr(1, 2), 16) + ' ';
        command += parseInt(leds[j].value.substr(3, 2), 16) + ' ';
        command += parseInt(leds[j].value.substr(5, 2), 16) + ' ';
      } else {
        command += '00 00 00 '; // Turn off the LED.
      }
    }
    command += '" >> led_rgb';
    shellCommands.push(command);
     
    var duration = lightbar.parentNode.querySelector('.duration');
    var sleepingTime = (parseFloat(duration.textContent)).toFixed(2);
    shellCommands.push('sleep ' + sleepingTime);
  }
  
  shellCommands.push('echo "4 00 00 00" > led_rgb'); // Turn off all the leds eventually.
  shellCommands.push('sleep 1'); // And wait a little bit more.
  shellCommands.push('echo run  > sequence\n)'); // Returns initial state.
  
  if (startsWithShell)
    return 'shell\n' + shellCommands.join('; ') + '\n';
  else
    return shellCommands.join('\n');
};

function save() {
  var startsWithShell = false;
  var text = getShellCommand(startsWithShell);
  
  // Prompt user where to save the image.
  var options = {type: 'saveFile', suggestedName: 'lightbar'};
  chrome.fileSystem.chooseEntry(options, function(fileEntry) {
    if (!fileEntry)
      return;
    var blob = new Blob([text], {type: 'text/x-shellscript'});
    
    // Write to disk.
    fileEntry.createWriter(function(fileWriter) {
      fileWriter.onwriteend = function() {
        if (fileWriter.length === 0)
          fileWriter.write(blob);
        else
          fileWriter.onwriteeend = null;
      }
      // Truncating it first.
      fileWriter.truncate(0);
    });
  }); 
};

function toggleDialog(text) {
  var overlay = document.querySelector('.overlay-container');
  overlay.classList.toggle('hidden');
}

function copy() {
  var startsWithShell = true;
  copyToClipboard(getShellCommand(startsWithShell));
  toggleDialog();
}

function init() {
  // On startup, add one lightbar to start.
  var wrapper = document.querySelector('#lightbar-wrapper');
  wrapper.innerHTML = '<div class="spacer"></div>';
  var adjacentElement = document.querySelector('.spacer');
  insertLightbarElement(adjacentElement);  
}

document.addEventListener('keydown', function(event) {
  var isControlPressed = event.ctrlKey || event.metaKey;
  if (isControlPressed) {
    switch (event.keyCode) {
      case 78: // Ctrl + N
        event.preventDefault();
        event.stopPropagation();
        init();
        break;
      case 83: // Ctrl + S
        event.preventDefault();
        event.stopPropagation();
        save();
        break;
      case 67: // Ctrl + C
        copy();
        event.preventDefault();
        event.stopPropagation();
        break;
    }
  }
})

document.querySelector('.close').addEventListener('click', toggleDialog);
document.querySelector('#copy-to-clipboard').addEventListener('click', copy);
document.querySelector('#new').addEventListener('click', init);
document.querySelector('#save').addEventListener('click', save);

init();
