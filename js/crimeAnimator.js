var CrimeAnimator = function (data, heatmap, map) {
  this.map = map;
  this.data = data;
  this.heatmap = heatmap;
  this.dataLength = data.length - 1;

  //create marker array to track displayed markers and the info window that displays when they are clicked
  this.markers = [];
  this.showMarkers = true;
  this.markerInfoWindow = new google.maps.InfoWindow();

  //figure out the date range
  this.dateRange = { start: data[0][3], end: data[data.length - 1][3] };
  this.dayRange = Math.ceil(
    (this.dateRange.end - this.dateRange.start) / DAY_IN_MILLI
  );

  this.isPaused = false;

  //calculate the number of days that elapse for each animation frame
  this.animationTimeMultiplier = 500000 * (this.dayRange / 365);

  //calculate how long crimes should be displayed for based on our range
  this.visibleLifespan = Math.ceil(this.dayRange / 10);
  if (this.visibleLifespan < 10) this.visibleLifespan = 10;
  else if (this.visibleLifespan > 30) this.visibleLifespan = 30;
  this.visibleLifespan = this.visibleLifespan * DAY_IN_MILLI;

  this.lowIndex = 0; //holds the data index of the oldest crime we are displaying
  this.highIndex = 0; //holds the data index of the newest crime we are displaying

  this.filters = [];

  this.setupProgressBar();

  var self = this;
  var $animationControlButton = $("#animation-control-button");
  $animationControlButton.click(this.togglePause.bind(this));

  //handle the filter click events
  $("#options input:not(#options-markers)").on(
    "change",
    this.changeFilters.bind(this)
  );
  $("#options-markers").on("change", this.toggleCrimeMarkers.bind(this));

  //hookup spacebar pauser/resume
  $(window).keypress(this.togglePause.bind(this));

  this.$animationControl = $animationControlButton.children("div");

  //if the animation is paused then redraw the current frame on drag end
  google.maps.event.addListener(map, "dragend", function () {
    if (self.isPaused) self.drawFrame(self.currentDate);
  });

  google.maps.event.addListener(map, "zoom_changed", function () {
    var radiusMultiplier,
      zoom = map.getZoom();
    if (zoom > 10) radiusMultiplier = 2.6;
    else if (zoom < 9) radiusMultiplier = 1;
    else radiusMultiplier = 1.5;

    heatmap.heatmap.set("radius", zoom * radiusMultiplier);

    if (self.isPaused) self.drawFrame(self.currentDate);
  });
};

CrimeAnimator.prototype.setupProgressBar = function setupProgressBar() {
  //setup progress bar slider events
  this.$progressBar = $("#progress-bar-container");
  var $progressBarPointer = $("#progress-bar-pointer");
  var $document = $(document);

  this.progressBarStartPosition = Math.ceil($document.width() * 0.05);
  this.progressBarEndPosition =
    $document.width() - this.progressBarStartPosition;

  this.$progressBar.css("width", this.progressBarStartPosition + "px");

  this.totalTimeRange = this.dateRange.end - this.dateRange.start;

  this.totalPixelRange =
    this.progressBarEndPosition - this.progressBarStartPosition;

  var self = this;
  var stopPointerDrag = function (e) {
    self.updateCurrentDateToProgressPosition(e.pageX);

    //draw the heatmap frame for our current position
    self.lowIndex = 0;
    self.highIndex = 0;
    self.drawFrame(self.currentDate);

    self.removeCrimeMarkers();
    if (self.showMarkers) self.addCrimeMarkers();

    $document.off("mousemove ontouchmove");
    e.preventDefault();
  };

  //keep track of the top of the progres bar so that we can stop dragging when the mouse leaves the top
  var pointerOffsetTop = $progressBarPointer.offset().top;
  $(window).resize(function () {
    pointerOffsetTop = $progressBarPointer.offset().top;
  });

  //setup dragability of progress bar pointer
  $progressBarPointer.on("mousedown ontouchstart", function (e) {
    self.pause.apply(self);

    $document.on("mousemove ontouchmove", function (e) {
      if (e.pageY < pointerOffsetTop) {
        stopPointerDrag(e);
        return;
      }

      //impose start/end limits on progres bar
      var x = e.pageX;
      if (x > self.progressBarEndPosition) x = self.progressBarEndPosition;
      else if (x < self.progressBarStartPosition)
        x = self.progressBarStartPosition;

      self.$progressBar.css("width", x + "px");

      //update progress bar text
      self.updateCurrentDateToProgressPosition(x);
      self.updateProgressBarText();

      self.removeCrimeMarkers();

      self.drawFrame(self.currentDate);

      e.preventDefault();
    });

    e.preventDefault();
  });

  //stop dragging
  $progressBarPointer.on("mouseup ontouchend", stopPointerDrag);

  this.$progressBarPointer = $progressBarPointer;
};

var monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
CrimeAnimator.prototype.updateProgressBar = function updateProgressBar() {
  var x =
    this.progressBarStartPosition +
    ((this.currentDate - this.dateRange.start) / this.totalTimeRange) *
      this.totalPixelRange;
  if (x > this.progressBarEndPosition) x = this.progressBarEndPosition;

  this.$progressBar.css("width", x + "px");

  this.updateProgressBarText();
};

CrimeAnimator.prototype.updateCurrentDateToProgressPosition =
  function updateCurrentDateToProgressPosition(progressPosition) {
    //calc the current position of pointer and translate that into an animation position date
    var progressBarPercentComplete =
      (progressPosition - this.progressBarStartPosition) / this.totalPixelRange;
    this.currentDate =
      this.dateRange.start +
      (this.dateRange.end - this.dateRange.start) * progressBarPercentComplete;
  };

CrimeAnimator.prototype.updateProgressBarText =
  function updateProgressBarText() {
    var now = new Date(this.currentDate);
    this.$progressBarPointer.html(
      monthNames[now.getMonth()] +
        "<br>" +
        now.getDate() +
        "<span class=date-prefix>" +
        getNumberPostfix(now.getDate()) +
        "</span><br>" +
        "<span class=year>- " +
        now.getFullYear() +
        " -</span><br>"
    );
  };

var numberEndings = ["", "st", "nd", "rd", "th"];
function getNumberPostfix(number) {
  return numberEndings[
    number >= numberEndings.length ? numberEndings.length - 1 : number
  ];
}

CrimeAnimator.prototype.applyFilters = function setData(filters) {
  this.filters = filters;
};

(CrimeAnimator.prototype.updateIndexPositions = function updateIndexPositions(
  visibleThreshold,
  nextDate
) {
  this.lowIndex = this.getNewIndexPosition(this.lowIndex, visibleThreshold, 0);

  if (this.highIndex < this.lowIndex) this.highIndex = this.lowIndex;

  this.highIndex = this.getNewIndexPosition(
    this.highIndex,
    nextDate,
    this.lowIndex
  );
}),
  /**
    adjust index position to match the comparitor date and the current data
  */
  (CrimeAnimator.prototype.getNewIndexPosition = function getNewIndexPosition(
    index,
    comparitorDate,
    indexMinimum
  ) {
    //expand the index till it reaches the compairitor date
    while (index < this.dataLength) {
      if (this.data[index][3] >= comparitorDate) break;

      index += 1;
    }

    //contract the index till it reaches the compairitor date
    while (index > indexMinimum) {
      if (this.data[index][3] < comparitorDate) break;

      index -= 1;
    }

    return index;
  });

(CrimeAnimator.prototype.drawFrame = function drawFrame(nextDate) {
  var visibleThreshold = this.currentDate - this.visibleLifespan;
  this.updateIndexPositions(visibleThreshold, nextDate);

  //if no removals to make then just add the crime points that are between the currentDate and the next Date and aren't filtered
  var currentData = this.getCurrentHeatmapData(visibleThreshold);
  this.heatmap.setDataSet(currentData);
}),
  (CrimeAnimator.prototype.animate = function animate() {
    var now = new Date().getTime();

    if (!this.isPaused) {
      var nextDate =
        this.currentDate +
        (now - this.lastDrawTime) * this.animationTimeMultiplier;

      this.drawFrame(nextDate);

      //increment currentDate to next date
      this.currentDate = nextDate;

      //update our current progress to match the current date
      this.updateProgressBar();
    }

    this.lastDrawTime = now;

    if (this.highIndex < this.dataLength)
      window.requestAnimationFrame(this.animate.bind(this));
    else {
      //we are done
      this.isAnimating = false;
      this.pause();
    }
  });

CrimeAnimator.prototype.start = function start() {
  //set the current date to the first day if we are at the end of the animation
  if (this.highIndex >= this.dataLength || !this.currentDate)
    this.currentDate = this.dateRange.start;

  //reset our indexes
  this.lowIndex = 0;
  this.highIndex = 0;

  this.lastDrawTime = new Date().getTime();

  this.isAnimating = true;

  //start the animation
  this.animate();
};

CrimeAnimator.prototype.pause = function pause() {
  this.$animationControl.removeClass("pause");
  this.$animationControl.addClass("play");

  this.isPaused = true;

  //draw markers
  if (this.showMarkers) this.addCrimeMarkers();
};

CrimeAnimator.prototype.resume = function resume() {
  this.removeCrimeMarkers();

  this.$animationControl.removeClass("play");
  this.$animationControl.addClass("pause");

  this.isPaused = false;

  //if we are at the end of the animation then restart it
  if (!this.isAnimating) this.start();
};

CrimeAnimator.prototype.togglePause = function togglePause() {
  if (this.isPaused) this.resume();
  else this.pause();
};

CrimeAnimator.prototype.changeFilters = function changeFilters(e) {
  var checkbox = e.target;

  var filterNumber = Number(checkbox.name);
  if (!checkbox.checked) {
    this.filters.push(filterNumber);
  } else {
    var index = this.filters.indexOf(filterNumber);
    if (index > -1) this.filters.splice(index, 1);
  }

  if (this.isPaused || !this.isAnimating) {
    this.drawFrame(this.currentDate);
    this.removeCrimeMarkers();
    if (this.showMarkers) this.addCrimeMarkers();
  }
};

CrimeAnimator.prototype.toggleCrimeMarkers = function toggleCrimeMarkers() {
  this.showMarkers = !this.showMarkers;

  if (!this.showMarkers) this.removeCrimeMarkers();
  else if (this.isPaused || !this.isAnimating) this.addCrimeMarkers();
};

var crimeTypes = [
  "Theft from Auto",
  "Auto Theft",
  "Break & Enter",
  "Assault",
  "Robbery",
];
var crimeColors = ["pink", "yellow", "red", "blue", "green"];
CrimeAnimator.prototype.addCrimeMarkers = function addCrimeMarkers() {
  var currentData = this.data.slice(this.lowIndex, this.highIndex + 1);
  var self = this;

  for (var i = currentData.length - 1; i >= 0; i--) {
    var crime = currentData[i];
    var crimeType = crime[2];

    if (this.filters.indexOf(crimeType) >= 0) continue;

    var marker = new google.maps.Marker({
      position: new google.maps.LatLng(crime[0], crime[1]),
      map: this.map,
      title: crimeTypes[crimeType],
      icon: {
        url:
          "http://maps.google.com/mapfiles/ms/icons/" +
          crimeColors[crimeType] +
          "-dot.png",
      },
    });

    this.markers.push(marker);

    //setup the markers onclick event to display the popup window
    /*function setupMarkerInfoWindow(marker, crime) {
        google.maps.event.addListener(marker, 'click', function() {
          self.markerInfoWindow.content = 'type: ' + crime[2] + '<br>date: ' + Date.parse(year + '/' + (crime[3]+1) + '/' + crime[4]);
          self.markerInfoWindow.open(self.map, marker);
        });
      }(marker, crime);*/
  }
};

CrimeAnimator.prototype.removeCrimeMarkers = function removeCrimeMarkers() {
  for (var i = this.markers.length - 1; i >= 0; i--) {
    this.markers.pop().setMap(null);
  }
};

CrimeAnimator.prototype.getCurrentHeatmapData = function getCurrentHeatmapData(
  visibleThreshold
) {
  var currentData = this.data.slice(this.lowIndex, this.highIndex + 1);

  var crime,
    type,
    count,
    timeFromHighIndex,
    heatmapData = [];
  var currentTimeRange = this.currentDate - visibleThreshold;

  for (var i = currentData.length - 1; i >= 0; i--) {
    crime = currentData[i];
    type = crime[2];

    if (this.filters.indexOf(type) >= 0) continue;

    timeFromHighIndex = this.currentDate - crime[3];
    var x = timeFromHighIndex / currentTimeRange;
    count = Math.abs(4 * (x - Math.pow(x, 2))); // exponential curve for fade in/out

    heatmapData.push({ lat: crime[0], lng: crime[1], count: count });
  }

  return { max: 3, data: heatmapData };
};
