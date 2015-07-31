/**
 * eleVR Web Player: A web player for 360 video on the Oculus
 * Copyright (C) 2014 Andrea Hawksley and Andrew Lutomirski
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the Mozilla Public License; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */
/* global controls, projection, util, webGL, webVR */

"use strict";

var currentScreenOrientation = window.orientation || 0; // active default

var timing = {showTiming: false, // Switch to true to show frame times in the console
              frameTime: 0,
              prevFrameTime: 0,
              canvasResized: 0,
              textureLoaded: 0,
              textureTime: 0,
              start: 0,
              end: 0,
              framesSinceIssue: 0
              };

var called = {};

var videoObjectURL = null;
var videoOptions = {};

var videoControls = document.getElementById('video-controls');
var titleL = document.getElementById('title-l');
var titleR = document.getElementById('title-r');
var messageL = document.getElementById('message-l');
var messageR = document.getElementById('message-r');

window.addEventListener('resize', function() {
  console.log('resize');
  window.container.style.width = window.innerWidth + 'px';
  window.container.style.height = window.innerHeight + 'px';
});

function setupVideo() {
  console.log('setupVideo: CALL');

  if (called.setupVideo) {
    return;
  }

  console.log('setupVideo: RUN');

  window.container = document.getElementById('video-container');
  window.container.style.width = window.innerWidth + 'px';
  window.container.style.height = window.innerHeight + 'px';

  window.canvas = document.getElementById('glcanvas');
  window.video = document.getElementById('video');

  window.leftLoad = document.getElementById("left-load");
  window.rightLoad = document.getElementById("right-load");

  titleL.style.fontSize = window.outerHeight / 20 + 'px';
  titleR.style.fontSize = window.outerHeight / 20 + 'px';

  messageL.style.display = 'none';
  messageR.style.display = 'none';

  videoControls.style.display = 'none';

  called.setupVideo = true;
}

// TODO: Handle container resize!

function setupControls() {
  console.log('setupControls: CALL');

  if (called.setupControls) {
    return;
  }

  console.log('setupControls: RUN');

  videoControls.style.display = 'block';

  window.leftLoad = document.getElementById("left-load");
  window.rightLoad = document.getElementById("right-load");
  window.leftPlay = document.getElementById("left-play");
  window.rightPlay = document.getElementById("right-play");

  // Buttons
  window.playButton = document.getElementById("play-pause");
  window.playL = document.getElementById("play-l");
  window.playR = document.getElementById("play-r");
  window.muteButton = document.getElementById("mute");
  window.loopButton = document.getElementById("loop");
  window.fullScreenButton = document.getElementById("full-screen");

  // Sliders
  window.seekBar = document.getElementById("seek-bar");

  // Selectors
  window.videoSelect = document.getElementById("video-select");
  window.projectionSelect = document.getElementById("projection-select");

  messageL.style.display = 'block';
  messageR.style.display = 'block';
  messageL.style.fontSize = window.outerHeight / 30 + 'px';
  messageR.style.fontSize = window.outerHeight / 30 + 'px';

  // Keep a record of all the videos that are in the drop-down menu.
  if (window.videoSelect) {
    Array.prototype.slice.call(window.videoSelect.options).forEach(function(option) {
      videoOptions[option.value] = option;
    });
  }

  controls.create();

  called.setupControls = true;
}

function runEleVRPlayer() {
  console.log('runEleVRPlayer');

  if (called.runEleVRPlayer) {
    return;
  }

  setupVideo();

  webVR.initWebVR();

  webGL.initWebGL();

  if (webGL.gl) {
    webGL.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    webGL.gl.clearDepth(1.0);
    webGL.gl.disable(webGL.gl.DEPTH_TEST);

    util.setCanvasSize();

    // Keyboard Controls
    controls.enableKeyControls();

    window.shader = new webGL.Shader({
      fragmentShaderName: 'shader-fs',
      vertexShaderName: 'shader-vs',
      attributes: ['aVertexPosition'],
      uniforms: ['uSampler', 'eye', 'projection', 'proj_inv'],
    });

    webGL.initBuffers();
    webGL.initTextures();

    video.addEventListener("canplaythrough", controls.loaded);
    video.addEventListener("ended", controls.ended);
  }

  initFromSettings(window.location.hash || window.location.search);

  called.runEleVRPlayer = true;
}

function initFromSettings(newSettings) {
  if (!newSettings) {
    setupControls();
    return;
  }

  var settings = util.getTruthyURLSearchParams(newSettings, {
    autoplay: false,
    projection: 'mono',
    loop: true,
    controls: true,
    fullscreen: window.top !== window.self  // iframe should default to fullscreen.
  });

  // TODO: Consider making `autoplay` the default if `controls` are hidden.

  if (settings.controls) {
    setupControls();
  }

  if (settings.fullscreen) {
    controls.fullscreen();
  }

  if (!settings.projection) {
    // Hack because we coerce '0' to `false` in `util.getTruthyURLSearchParams`.
    settings.projection = '0';
  }

  settings.projection = util.getCustomProjection(settings.projection);

  if (projection !== settings.projection) {
    projection = settings.projection;

    if (projectionSelect) {
      projectionSelect.value = settings.projection;
    }
  }

  controls.setLooping(settings.loop);

  if (settings.video) {
    video.innerHTML = '';

    if (window.videoSelect) {
      var optionValue = settings.projection + settings.video;

      if (optionValue in videoOptions) {
        videoOptions[optionValue].selected = true;
      } else {
        var option = document.createElement('option');
        option.selected = true;
        option.textContent = settings.title || util.getVideoTitle(settings.video);

        // Note: The controls code expects the filename to be prefixed with '0' or '1'.
        option.value = optionValue;

        if (settings.autoplay) {
          option.dataset.autoplay = '';
        } else {
          delete option.dataset.autoplay;
        }

        videoOptions[optionValue] = option;

        window.videoSelect.appendChild(option);
      }
    }

    controls.loadVideo(settings.video);
  }

  if (settings.autoplay) {
    controls.play();
  } else {
    video.pause();
  }
}

window.addEventListener('hashchange', function() {
  initFromSettings(window.location.hash);
});

window.addEventListener('message', function(e) {
  if (e.data.mute) {
    controls.mute();
  }

  if (e.data.unmute) {
    controls.unmute();
  }

  if (typeof e.data === 'object') {
    window.location.hash = '#' + JSON.stringify(e.data);
  } else if (typeof e.data === 'string') {
    window.location.hash = '#' + e.data;
  } else {
    return;
  }
});
