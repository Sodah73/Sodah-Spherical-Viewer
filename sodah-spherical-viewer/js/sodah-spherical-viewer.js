/*
 * Sodah Spherical Viewer V1.16.02.09
 *
 * uses the Three.js library r71 including canvasrender for IE11
 * http://threejs.org/
 *
 * Copyright (C) SODAH | JOERG KRUEGER
 * http://www.sodah.de
 * 
 * COMPRESSOR: http://closure-compiler.appspot.com/home
 */

 //issues:
 // - loader muss mittig sein

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['three'], factory);
    }
    else {
        root.SodahSphericalViewer = factory(root.THREE);
    }
}(this, function(THREE) {
"use strict";

/**
 * Viewer class
 * @param options (Object) Viewer settings
 */
function SodahSphericalViewer(options) {
  if (!(this instanceof SodahSphericalViewer)) {
    return new SodahSphericalViewer(options);
  }

  if (options === undefined || options.panorama === undefined || options.container === undefined) {
    throw new SSVError('no value given for panorama or container');
  }

  this.config = SSVUtils.deepmerge(SodahSphericalViewer.DEFAULTS, options);

  // normalize config
  this.config.min_fov = SSVUtils.stayBetween(this.config.min_fov, 1, 179);
  this.config.max_fov = SSVUtils.stayBetween(this.config.max_fov, 1, 179);
  this.config.tilt_up_max = SSVUtils.stayBetween(this.config.tilt_up_max, -SodahSphericalViewer.HalfPI, SodahSphericalViewer.HalfPI);
  this.config.tilt_down_max = SSVUtils.stayBetween(this.config.tilt_down_max, -SodahSphericalViewer.HalfPI, SodahSphericalViewer.HalfPI);
  if (this.config.default_fov === null) {
    this.config.default_fov = this.config.max_fov;
  }
  else {
    this.config.default_fov = SSVUtils.stayBetween(this.config.default_fov, this.config.min_fov, this.config.max_fov);
  }
  if (this.config.anim_lat === null) {
    this.config.anim_lat = this.config.default_lat;
  }
  this.config.anim_lat = SSVUtils.stayBetween(this.config.anim_lat, -SodahSphericalViewer.HalfPI, SodahSphericalViewer.HalfPI);
  
  if (this.config.tilt_up_max < this.config.tilt_down_max) {
    throw new SSVError('tilt_up_max cannot be lower than tilt_down_max');
  }

  // references to components
  this.container = (typeof this.config.container == 'string') ? document.getElementById(this.config.container) : this.config.container;
  this.loader = null;
  this.navbar = null;
  this.hud = null;
  this.panel = null;
  this.canvas_container = null;
  this.renderer = null;
  this.scene = null;
  this.camera = null;
  this.raycaster = null;
  this.actions = {};

  // local properties
  this.prop = {
    fps: 60,
    latitude: 0,
    longitude: 0,
    anim_speed: 0,
    zoom_lvl: 0,
    moving: false,
    zooming: false,
    start_mouse_x: 0,
    start_mouse_y: 0,
    mouse_x: 0,
    mouse_y: 0,
    pinch_dist: 0,
    direction: null,
    autorotate_timeout: null,
    animation_timeout: null,
    start_timeout: null,
    target: {
    	x: 0,
    	y: 0
    },
    mouse: {
      	x: 0,
      	y: 0
    },
    size: {
		width: 0,
		height: 0,
		ratio: 0,
		image_width: 0,
		image_height: 0
    }
  };

  // compute zoom level
  this.prop.zoom_lvl = Math.round((this.config.default_fov - this.config.min_fov) / (this.config.max_fov - this.config.min_fov) * 100);
  this.prop.zoom_lvl-= 2 * (this.prop.zoom_lvl - 50);

  // init
  this.setAnimSpeed(this.config.anim_speed);

  if (this.config.size !== null) {
    this.container.style.width = this.config.size.width;
    this.container.style.height = this.config.size.height;
  }

  if (this.config.autoload) {
    this.load();
  }
}

SodahSphericalViewer.PI = Math.PI;
SodahSphericalViewer.TwoPI = Math.PI * 2.0;
SodahSphericalViewer.HalfPI = Math.PI / 2.0;

SodahSphericalViewer.MOVE_THRESHOLD = 4;

SodahSphericalViewer.ICONS = {};

/**
 * SodahSphericalViewer defaults
 */
SodahSphericalViewer.DEFAULTS = {
  panorama: null,
  container: null,
  autoload: true,
  usexmpdata: false,
  min_fov: 30,
  max_fov: 90,
  default_fov: null,
  default_long: 0,
  default_lat: 0,
  tilt_up_max: SodahSphericalViewer.HalfPI,
  tilt_down_max: -SodahSphericalViewer.HalfPI,
  long_offset: Math.PI / 1440.0,
  lat_offset: Math.PI / 720.0,
  time_anim: 2000,
  anim_speed: '2rpm',
  anim_lat: null,
  navbar: false,
  lang: {
    autorotate: 'Automatic rotation',
    zoom: 'Zoom',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',
    fullscreen: 'Fullscreen'
  },
  mousewheel: true,
  mousemove: true,
  loading_img: null,
  loading_txt: 'Loading...',
  size: null,
  theme: 'light'
};

/**
 * Starts to load the panorama
 * @return (void)
 */
SodahSphericalViewer.prototype.load = function() {
  this.container.classList.add('ssv-container', 'loading');

  // Is canvas supported?
  if (!SSVUtils.isCanvasSupported()) {
    this.container.textContent = 'Canvas is not supported, update your browser!';
    return;
  }

  // Loader
  this.loader = new SSVLoader(this);

  // Canvas container
  this.canvas_container = document.createElement('div');
  this.canvas_container.className = 'ssv-canvas-container';
  this.container.appendChild(this.canvas_container);

  // load image
  if (this.config.usexmpdata) {
    this._loadXMP();
  }
  else {
    this._loadTexture(false, false);
  }
};

/**
 * Loads the XMP data with AJAX
 * @return (void)
 */
SodahSphericalViewer.prototype._loadXMP = function() {
  if (!window.XMLHttpRequest) {
    this.container.textContent = 'XHR is not supported, update your browser!';
    return;
  }

  var xhr = new XMLHttpRequest();
  var self = this;
  var progress = 0;

  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 202 || xhr.status === 0) {
        self.loader.setProgress(100);

        var binary = xhr.responseText;
        var a = binary.indexOf('<x:xmpmeta'), b = binary.indexOf('</x:xmpmeta>');
        var data = binary.substring(a, b);

        // No data retrieved
        if (a === -1 || b === -1 || data.indexOf('GPano:') === -1) {
          self._loadTexture(false, true);
          return;
        }

        var pano_data = {
          full_width: parseInt(SSVUtils.getAttribute(data, 'FullPanoWidthPixels')),
          full_height: parseInt(SSVUtils.getAttribute(data, 'FullPanoHeightPixels')),
          cropped_width: parseInt(SSVUtils.getAttribute(data, 'CroppedAreaImageWidthPixels')),
          cropped_height: parseInt(SSVUtils.getAttribute(data, 'CroppedAreaImageHeightPixels')),
          cropped_x: parseInt(SSVUtils.getAttribute(data, 'CroppedAreaLeftPixels')),
          cropped_y: parseInt(SSVUtils.getAttribute(data, 'CroppedAreaTopPixels')),
        };

        self._loadTexture(pano_data, true);
      }
      else {
        self.container.textContent = 'Cannot load image';
      }
    }
    else if (xhr.readyState === 3) {
      self.loader.setProgress(progress + 10);
    }
  };

  xhr.onprogress = function(e) {
    if (e.lengthComputable) {
      var new_progress = parseInt(e.loaded / e.total * 100);
      if (new_progress > progress) {
        progress = new_progress;
        self.loader.setProgress(progress);
      }
    }
  };

  xhr.onerror = function() {
    self.container.textContent = 'Cannot load image';
  };

  xhr.open('GET', this.config.panorama, true);
  xhr.send(null);
};

/**
 * Loads the sphere texture
 * @param pano_data (mixed) An object containing the panorama XMP data (false if it there is not)
 * @param in_cache (boolean) If the image has already been loaded and should be in cache
 * @return (void)
 */
SodahSphericalViewer.prototype._loadTexture = function(pano_data, in_cache) {
  var loader = new THREE.ImageLoader();
  var self = this;
  var progress = in_cache ? 100 : 0;

  // CORS when the panorama is not given as a base64 string
  if (!this.config.panorama.match(/^data:image\/[a-z]+;base64/)) {
    loader.setCrossOrigin('anonymous');
  }

  var onload = function(img) {
    self.loader.setProgress(100);

    // Default XMP data
    if (!pano_data) {
      pano_data = {
        full_width: img.width,
        full_height: img.height,
        cropped_width: img.width,
        cropped_height: img.height,
        cropped_x: 0,
        cropped_y: 0,
      };
    }

    // Size limit for mobile compatibility
    var max_width = 4096;
    if (SSVUtils.isWebGLSupported()) {
      max_width = SSVUtils.getMaxTextureWidth();
    }

    var new_width = Math.min(pano_data.full_width, max_width);
    var r = new_width / pano_data.full_width;

    pano_data.full_width *= r;
    pano_data.full_height *= r;
    pano_data.cropped_width *= r;
    pano_data.cropped_height *= r;
    pano_data.cropped_x *= r;
    pano_data.cropped_y *= r;

    img.width = pano_data.cropped_width;
    img.height = pano_data.cropped_height;

    // Create buffer
    var buffer = document.createElement('canvas');
    buffer.width = pano_data.full_width;
    buffer.height = pano_data.full_height;

    var ctx = buffer.getContext('2d');
    ctx.drawImage(img, pano_data.cropped_x, pano_data.cropped_y, pano_data.cropped_width, pano_data.cropped_height);
    
    self.prop.size.image_width = pano_data.cropped_width;
    self.prop.size.image_height = pano_data.cropped_height;

    self._createScene(buffer);
  };

  var onprogress = function(e) {
    if (e.lengthComputable) {
      var new_progress = parseInt(e.loaded / e.total * 100);
      if (new_progress > progress) {
        progress = new_progress;
        self.loader.setProgress(progress);
      }
    }
  };

  var onerror = function() {
    self.container.textContent = 'Cannot load image';
  };
  //http://threejs.org/docs/#Reference/Loaders/ImageLoader
  loader.load(this.config.panorama, onload, onprogress, onerror);


};

/**
 * Creates the 3D scene and GUI compoents
 * @param img (Canvas) The sphere texture
 * @return (void)
 */
SodahSphericalViewer.prototype._createScene = function(img) {
  this._onResize();
  
  this.raycaster = new THREE.Raycaster();

  // Renderer depends on whether WebGL is supported or not
  this.renderer = SSVUtils.isWebGLSupported() ? new THREE.WebGLRenderer() : new THREE.CanvasRenderer();
  this.renderer.setSize(this.prop.size.width, this.prop.size.height);

  this.camera = new THREE.PerspectiveCamera(this.config.default_fov, this.prop.size.ratio, 1, 300);
  this.camera.position.set(0, 0, 0);

  this.scene = new THREE.Scene();
  this.scene.add(this.camera);

  var texture = new THREE.Texture(img);

  texture.needsUpdate = true;

  texture.minFilter = THREE.LinearFilter;

  // default texture origin is at 1/4 (phiStart=0) of the panorama, I set it at 1/2 (phiStart=PI/2)
  var geometry = new THREE.SphereGeometry(200, 32, 32, -SodahSphericalViewer.HalfPI);
  var material = new THREE.MeshBasicMaterial({map: texture, overdraw: true});

  //material.side = THREE.DoubleSide;
  var mesh = new THREE.Mesh(geometry, material);
  mesh.scale.x = -1;

  this.scene.add(mesh);
  this.canvas_container.appendChild(this.renderer.domElement);

  // Remove loader
  this.container.removeChild(this.loader.container);
  this.loader = null;
  this.container.classList.remove('loading');

  // Navigation bar
  if (this.config.navbar) {
    this.container.classList.add('has-navbar');
    this.navbar = new SSVNavBar(this);
    this.container.appendChild(this.navbar.container);
  }
  
  // HUD
  this.hud = new SSVHUD(this);
  this.container.appendChild(this.hud.container);
  

  // Queue animation
  if (this.config.time_anim !== false) {
    this.prop.start_timeout = setTimeout(this.startAutorotate.bind(this), this.config.time_anim);
  }

  this._bindEvents();
  this.trigger('ready');
  this.render();
  this.startAnimate();
};

/**
 * Add all needed event listeners
 * @return (void)
 */
SodahSphericalViewer.prototype._bindEvents = function() {
  window.addEventListener('resize', this._onResize.bind(this));
  document.addEventListener(SSVUtils.fullscreenEvent(), this._fullscreenToggled.bind(this));
  
  // all interation events are binded to the HUD only
  if (this.config.mousemove) {
    this.hud.container.style.cursor = 'move';
    this.hud.container.addEventListener('mousedown', this._onMouseDown.bind(this));
    this.hud.container.addEventListener('touchstart', this._onTouchStart.bind(this));
    this.hud.container.addEventListener('mouseup', this._onMouseUp.bind(this));
    this.hud.container.addEventListener('touchend', this._onTouchEnd.bind(this));
    this.hud.container.addEventListener('mousemove', this._onMouseMove.bind(this));
    this.hud.container.addEventListener('touchmove', this._onTouchMove.bind(this));
  }
  
  if (this.config.mousewheel) {
    this.hud.container.addEventListener(SSVUtils.mouseWheelEvent(), this._onMouseWheel.bind(this));
  }
};


/**
 * Animate
 * @return (void)
 */
SodahSphericalViewer.prototype.startAnimate = function() {  
  requestAnimationFrame( this.startAnimate.bind(this) );
  this.render();
};


/**
 * Renders an image
 * @return (void)
 */
SodahSphericalViewer.prototype.render = function() {
  this.prop.mouse.x += (this.prop.target.x - this.prop.mouse.x) * 0.04;
  this.prop.mouse.y += (this.prop.target.y - this.prop.mouse.y) *0.04;

  var t = this.prop.longitude - (this.prop.mouse.x - this.prop.mouse_x) * this.config.long_offset/(-10);
  var p = this.prop.latitude + (this.prop.mouse.y - this.prop.mouse_y) * this.config.lat_offset/(-10);
  
  this.prop.longitude = t - Math.floor(t / SodahSphericalViewer.TwoPI) * SodahSphericalViewer.TwoPI;
  this.prop.latitude = SSVUtils.stayBetween(p, this.config.tilt_down_max, this.config.tilt_up_max);

  this.prop.direction = new THREE.Vector3(
    -Math.cos(this.prop.latitude) * Math.sin(this.prop.longitude),
    Math.sin(this.prop.latitude),
    Math.cos(this.prop.latitude) * Math.cos(this.prop.longitude)
  );

  this.camera.lookAt(this.prop.direction);
  this.renderer.render(this.scene, this.camera);
  this.trigger('render');

  this.prop.mouse_x = this.prop.target.x;
  this.prop.mouse_y = this.prop.target.y;
};

/**
 * Internal method for automatic infinite rotation
 * @return (void)
 */
SodahSphericalViewer.prototype._autorotate = function() {
  // Rotates the sphere
  this.prop.target.x ++;
  this.prop.autorotate_timeout = setTimeout(this._autorotate.bind(this), 1000 / this.prop.fps);
};

/**
 * Starts the autorotate animation
 * @return (void)
 */
SodahSphericalViewer.prototype.startAutorotate = function() {
  this.autorotateBtn.button.innerHTML = SodahSphericalViewer.ICONS['pause.svg'];
  clearTimeout(this.prop.start_timeout);
  this.prop.start_timeout = null; 
  this._autorotate();
  this.trigger('autorotate', true);
};

/**
 * Stops the autorotate animation
 * @return (void)
 */
SodahSphericalViewer.prototype.stopAutorotate = function() {
  this.autorotateBtn.button.innerHTML = SodahSphericalViewer.ICONS['play.svg'];
  clearTimeout(this.prop.start_timeout);
  this.prop.start_timeout = null;

  clearTimeout(this.prop.autorotate_timeout);
  this.prop.autorotate_timeout = null;

  this.trigger('autorotate', false);
};

/**
 * Launches/stops the autorotate animation
 * @return (void)
 */
SodahSphericalViewer.prototype.toggleAutorotate = function() {
  if (this.prop.autorotate_timeout) {
    this.stopAutorotate();
  }
  else {
    this.startAutorotate();
  }
};

/**
 * Resizes the canvas when the window is resized
 * @return (void)
 */
SodahSphericalViewer.prototype._onResize = function() {
  if (this.container.clientWidth != this.prop.size.width || this.container.clientHeight != this.prop.size.height) {
    this.resize(this.container.clientWidth, this.container.clientHeight);
  }
};

/**
 * Resizes the canvas
 * @param width (integer) The new canvas width
 * @param height (integer) The new canvas height
 * @return (void)
 */
SodahSphericalViewer.prototype.resize = function (width, height) {
  this.prop.size.width = parseInt(width);
  this.prop.size.height = parseInt(height);
  this.prop.size.ratio = this.prop.size.width / this.prop.size.height;

  if (this.camera) {
    this.camera.aspect = this.prop.size.ratio;
    this.camera.updateProjectionMatrix();
  }

  if (this.renderer) {
    this.renderer.setSize(this.prop.size.width, this.prop.size.height);
    this.render();
  }

  this.trigger('size-updated', this.prop.size.width, this.prop.size.height);
};

/**
 * The user wants to move
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onMouseDown = function(evt) {
  this._startMove(evt);
};

/**
 * The user wants to move (mobile version)
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onTouchStart = function(evt) {
  if (evt.touches.length === 1) {
    this._startMove(evt.touches[0]);
  }
  else if (evt.touches.length === 2) {
    this._startZoom(evt);
  }
};

/**
 * Initializes the movement
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._startMove = function(evt) {
  this.prop.mouse_x = this.prop.start_mouse_x = this.prop.target.x = this.prop.mouse.x =  parseInt(evt.clientX);
  this.prop.mouse_y = this.prop.start_mouse_y = this.prop.target.y = this.prop.mouse.y = parseInt(evt.clientY);
  this.prop.moving = true;
  this.prop.moved = false;
  this.prop.zooming = false;
  this.stopAutorotate();
};

/**
 * Initializes the zoom
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._startZoom = function(evt) {
  var t = [
    {x: parseInt(evt.touches[0].clientX), y: parseInt(evt.touches[0].clientY)},
    {x: parseInt(evt.touches[1].clientX), y: parseInt(evt.touches[1].clientY)}
  ];
  
  this.prop.pinch_dist = Math.sqrt(Math.pow(t[0].x-t[1].x, 2) + Math.pow(t[0].y-t[1].y, 2));
  this.prop.moving = false;
  this.prop.zooming = true;

  this.stopAutorotate();
};

/**
 * The user wants to stop moving
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onMouseUp = function(evt) {
  this._stopMove(evt);
};

/**
 * The user wants to stop moving (mobile version)
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onTouchEnd = function(evt) {
  this._stopMove(evt.changedTouches[0]);
};

/**
 * Stops the movement
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._stopMove = function(evt) {
  this.prop.moving = false;
  this.prop.zooming = false;
};


/**
 * The user moves the image
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onMouseMove = function(evt) {
  evt.preventDefault();
  this._move(evt);
};

/**
 * The user moves the image (mobile version)
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onTouchMove = function(evt) {
  if (evt.touches.length === 1) {
    evt.preventDefault();
    this._move(evt.touches[0]);
  }
  else if (evt.touches.length === 2) {
    evt.preventDefault();
    this._zoom(evt);
  }
};


/**
 * Movement
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._move = function(evt) {
  if (this.prop.moving) {
    this.prop.target.x = parseInt(evt.clientX);
	this.prop.target.y = parseInt(evt.clientY);
  }
};

/**
 * Zoom
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._zoom = function(evt) {
  if (this.prop.zooming) {
    var t = [
      {x: parseInt(evt.touches[0].clientX), y: parseInt(evt.touches[0].clientY)},
      {x: parseInt(evt.touches[1].clientX), y: parseInt(evt.touches[1].clientY)}
    ];
    
    var p = Math.sqrt(Math.pow(t[0].x-t[1].x, 2) + Math.pow(t[0].y-t[1].y, 2));
    var delta = 80 * (p - this.prop.pinch_dist) / this.prop.size.width;
  
    this.zoom(this.prop.zoom_lvl + delta);

    this.prop.pinch_dist = p;
  }
};

/**
 * The user wants to zoom
 * @param evt (Event) The event
 * @return (void)
 */
SodahSphericalViewer.prototype._onMouseWheel = function(evt) {
  evt.preventDefault();
  evt.stopPropagation();

  var delta = evt.deltaY!==undefined ? -evt.deltaY : (evt.wheelDelta!==undefined ? evt.wheelDelta : -evt.detail);

  if (delta !== 0) {
    var direction = parseInt(delta / Math.abs(delta));
    this.zoom(this.prop.zoom_lvl + direction);
  }
};

/**
 * Zoom
 * @paramlevel (integer) New zoom level
 * @return (void)
 */
SodahSphericalViewer.prototype.zoom = function(level) {
  this.prop.zoom_lvl = SSVUtils.stayBetween(parseInt(Math.round(level)), 0, 100);

  this.camera.fov = this.config.max_fov + (this.prop.zoom_lvl / 100) * (this.config.min_fov - this.config.max_fov);
  this.camera.updateProjectionMatrix();
  this.render();

  this.trigger('zoom-updated', this.prop.zoom_lvl);
};

/**
 * Zoom in
 * @return (void)
 */
SodahSphericalViewer.prototype.zoomIn = function() {
  if (this.prop.zoom_lvl < 100) {
    this.zoom(this.prop.zoom_lvl + 1);
  }
};

/**
 * Zoom out
 * @return (void)
 */
SodahSphericalViewer.prototype.zoomOut = function() {
  if (this.prop.zoom_lvl > 0) {
    this.zoom(this.prop.zoom_lvl - 1);
  }
};

/**
 * Fullscreen state has changed
 * @return (void)
 */
SodahSphericalViewer.prototype._fullscreenToggled = function() {
  this.trigger('fullscreen-updated', SSVUtils.isFullscreenEnabled());
};

/**
 * Enables/disables fullscreen
 * @return (void)
 */
SodahSphericalViewer.prototype.toggleFullscreen = function() {
  if (!SSVUtils.isFullscreenEnabled()) {
  	this.fullscreenBtn.button.innerHTML = SodahSphericalViewer.ICONS['fullscreen-end.svg'];
    SSVUtils.requestFullscreen(this.container);
  }
  else {
  	this.fullscreenBtn.button.innerHTML = SodahSphericalViewer.ICONS['fullscreen-start.svg'];
    SSVUtils.exitFullscreen();
  }
};

/**
 * Parse the animation speed
 * @param speed (string) The speed, in radians/degrees/revolutions per second/minute
 * @return (double) radians per second
 */
SodahSphericalViewer.prototype.parseAnimSpeed = function(speed) {
  speed = speed.toString().trim();

  // Speed extraction
  var speed_value = parseFloat(speed.replace(/^(-?[0-9]+(?:\.[0-9]*)?).*$/, '$1'));
  var speed_unit = speed.replace(/^-?[0-9]+(?:\.[0-9]*)?(.*)$/, '$1').trim();

  // "per minute" -> "per second"
  if (speed_unit.match(/(pm|per minute)$/)) {
    speed_value /= 60;
  }

  var rad_per_second = 0;

  // Which unit?
  switch (speed_unit) {
    // Degrees per minute / second
    case 'dpm':
    case 'degrees per minute':
    case 'dps':
    case 'degrees per second':
      rad_per_second = speed_value * Math.PI / 180;
      break;

    // Radians per minute / second
    case 'radians per minute':
    case 'radians per second':
      rad_per_second = speed_value;
      break;

    // Revolutions per minute / second
    case 'rpm':
    case 'revolutions per minute':
    case 'rps':
    case 'revolutions per second':
      rad_per_second = speed_value * SodahSphericalViewer.TwoPI;
      break;

    // Unknown unit
    default:
      throw new SSVError('unknown speed unit "' + speed_unit + '"');
  }
  
  return rad_per_second;
};

/**
 * Sets the animation speed
 * @param speed (string) The speed, in radians/degrees/revolutions per second/minute
 * @return (void)
 */
SodahSphericalViewer.prototype.setAnimSpeed = function(speed) {
  this.prop.anim_speed = this.parseAnimSpeed(speed);
};

/**
 * Adds an action
 * @param name (string) Action name
 * @param f (Function) The handler function
 * @return (void)
 */
SodahSphericalViewer.prototype.on = function(name, f) {
  if (!(name in this.actions)) {
    this.actions[name] = [];
  }

  this.actions[name].push(f);
};

/**
 * Triggers an action
 * @param name (string) Action name
 * @param args... (mixed) Arguments to send to the handler functions
 * @return (void)
 */
SodahSphericalViewer.prototype.trigger = function(name, args) {
  args = Array.prototype.slice.call(arguments, 1);
  if ((name in this.actions) && this.actions[name].length > 0) {
    for (var i = 0, l = this.actions[name].length; i < l; ++i) {
      this.actions[name][i].apply(this, args);
    }
  }
};

/**
 * Base sub component class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVComponent(ssv) {
  this.ssv = ssv;  
  
  // expose some methods to the viewer
  if (this.constructor.publicMethods) {
    this.constructor.publicMethods.forEach(function(method) {
      this.ssv[method] = this[method].bind(this);
    }, this);
  }
}

/**
 * Loader class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVLoader(ssv) {
  this.ssv = ssv;
  this.container = null;
  this.canvas = null;
  
  this.create();
}

/**
 * Creates the loader content
 */
SSVLoader.prototype.create = function() {
  this.container = document.createElement('div');
  this.container.className = 'ssv-loader';
  
  this.ssv.container.appendChild(this.container);

  this.canvas = document.createElement('canvas');
  this.canvas.className = 'loader-canvas';
  
  this.canvas.width = this.container.clientWidth;
  this.canvas.height = this.container.clientWidth;
  this.container.appendChild(this.canvas);

  this.tickness = (this.container.offsetWidth - this.container.clientWidth) / 2;

  var inner;
  if (this.ssv.config.loading_img) {
    inner = document.createElement('img');
    inner.className = 'loader-image';
    inner.src = this.ssv.config.loading_img;
  }
  else if (this.ssv.config.loading_txt) {
    inner = document.createElement('div');
    inner.className = 'loader-text';
    inner.innerHTML = this.ssv.config.loading_txt;
  }
  if (inner) {
    var a = Math.round(Math.sqrt(2 * Math.pow(this.canvas.width/2-this.tickness/2, 2)));
    inner.style.maxWidth = a + 'px';
    inner.style.maxHeight = a + 'px';
    this.container.appendChild(inner);
  }
};

/**
 * Sets the loader progression
 * @param value (int) from 0 to 100
 */
SSVLoader.prototype.setProgress = function(value) {
  var context = this.canvas.getContext('2d');

  context.clearRect(0, 0, this.canvas.width, this.canvas.height);

  context.lineWidth = this.tickness;
  context.strokeStyle = SSVUtils.getStyle(this.container, 'color');

  context.beginPath();
  context.arc(
    this.canvas.width/2, this.canvas.height/2,
    this.canvas.width/2 - this.tickness/2,
    -Math.PI/2, value/100 * 2*Math.PI - Math.PI/2
  );
  context.stroke();
};

/**
 * HUD class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVHUD(ssv) {
  SSVComponent.call(this, ssv);
  
  this.container = null;
  
  this.create();
}

SSVHUD.prototype = Object.create(SSVComponent.prototype);
SSVHUD.prototype.constructor = SSVHUD;

/**
 * Creates the elements
 * @return (void)
 */
SSVHUD.prototype.create = function() {
  this.container = document.createElement('div');
  this.container.className = 'ssv-hud';
};




/**
 * Navigation bar class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVNavBar(ssv) {
  SSVComponent.call(this, ssv);

  this.config = this.ssv.config.navbar;
  this.container = null;

  if (this.config === true) {
    this.config = SSVUtils.clone(SSVNavBar.DEFAULTS);
  }
  else if (typeof this.config == 'string') {
    var map = {};
    this.config.split(/[ ,:]/).forEach(function(button) {
      map[button] = true;
    });
    this.config = SSVUtils.deepmerge(SSVNavBar.DEFAULTS, map);
  }

  this.create();
}

SSVNavBar.prototype = Object.create(SSVComponent.prototype);
SSVNavBar.prototype.constructor = SSVNavBar;

SSVNavBar.DEFAULTS = {
  autorotate: true,
  zoom: true,
  fullscreen: true
};

/**
 * Creates the elements
 * @return (void)
 */
SSVNavBar.prototype.create = function() {

  // Container
  this.container = document.createElement('div');
  this.container.className = 'ssv-navbar ' + this.ssv.config.theme;

  // Autorotate button
  if (this.config.autorotate) {
    this.ssv.autorotateBtn = new SSVNavBarAutorotateButton(this.ssv);
    this.container.appendChild(this.ssv.autorotateBtn.button);
  }

  // Zoom buttons
  if (this.config.zoom) {
    var zoomBar = new SSVNavBarZoomButton(this.ssv);
    this.container.appendChild(zoomBar.button);
  }

  // Fullscreen button
  if (this.config.fullscreen) {
    this.ssv.fullscreenBtn = new SSVNavBarFullscreenButton(this.ssv);
    this.container.appendChild(this.ssv.fullscreenBtn.button);
  }

};


/**
 * Navigation bar button class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVNavBarButton(ssv) {
  this.ssv = ssv;
  this.button = null;
}

/**
 * Creates the button
 * @return (void)
 */
SSVNavBarButton.prototype.create = function() {
  throw new SSVError('Not implemented');
};

/**
 * Changes the active state of the button
 * @param active (boolean) true if the button should be active, false otherwise
 * @return (void)
 */
SSVNavBarButton.prototype.toggleActive = function(active) {
  if (active) {
    this.button.classList.add('active');
  }
  else {
    this.button.classList.remove('active');
  }
};

/**
 * Navigation bar autorotate button class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVNavBarAutorotateButton(ssv) {
  SSVNavBarButton.call(this, ssv);
  
  this.create();
}

SSVNavBarAutorotateButton.prototype = Object.create(SSVNavBarButton.prototype);
SSVNavBarAutorotateButton.prototype.constructor = SSVNavBarAutorotateButton;

/**
 * Creates the button
 * @return (void)
 */

 //xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SSVNavBarAutorotateButton.prototype.create = function() {
  this.button = document.createElement('div');
  this.button.className = 'ssv-button autorotate-button '  + this.ssv.config.theme;
  this.button.title = this.ssv.config.lang.autorotate;

  this.button.innerHTML = SodahSphericalViewer.ICONS['pause.svg'];

  this.button.addEventListener('click', this.ssv.toggleAutorotate.bind(this.ssv));
  
  this.ssv.on('autorotate', this.toggleActive.bind(this));
};

/**
 * Navigation bar fullscreen button class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVNavBarFullscreenButton(ssv) {
  SSVNavBarButton.call(this, ssv);
  
  this.create();
}

SSVNavBarFullscreenButton.prototype = Object.create(SSVNavBarButton.prototype);
SSVNavBarFullscreenButton.prototype.constructor = SSVNavBarFullscreenButton;

/**
 * Creates the button
 * @return (void)
 */
SSVNavBarFullscreenButton.prototype.create = function() {
  this.button = document.createElement('div');
  this.button.className = 'ssv-button fullscreen-button ' + this.ssv.config.theme;
  this.button.title = this.ssv.config.lang.fullscreen;

  this.button.innerHTML = SodahSphericalViewer.ICONS['fullscreen-start.svg'];

  this.button.addEventListener('click', this.ssv.toggleFullscreen.bind(this.ssv));
  
  this.ssv.on('fullscreen-updated', this.toggleActive.bind(this));
};

/**
 * Navigation bar zoom button class
 * @param ssv (SodahSphericalViewer) A SodahSphericalViewer object
 */
function SSVNavBarZoomButton(ssv) {
  SSVNavBarButton.call(this, ssv);

  this.zoom_range = null;
  this.zoom_value = null;
  
  this.prop = {
    mousedown: false
  };

  this.create();
}

SSVNavBarZoomButton.prototype = Object.create(SSVNavBarButton.prototype);
SSVNavBarZoomButton.prototype.constructor = SSVNavBarZoomButton;

/**
 * Creates the button
 * @return (void)
 */
SSVNavBarZoomButton.prototype.create = function() {
  this.button = document.createElement('div');
  this.button.className = 'ssv-button zoom-button ' + this.ssv.config.theme;

  var zoom_minus = document.createElement('div');
  zoom_minus.className = 'minus';
  zoom_minus.title = this.ssv.config.lang.zoomOut;
  zoom_minus.innerHTML = SodahSphericalViewer.ICONS['zoom-out.svg'];
  this.button.appendChild(zoom_minus);

  var zoom_range_bg = document.createElement('div');
  zoom_range_bg.className = 'range';
  this.button.appendChild(zoom_range_bg);

  this.zoom_range = document.createElement('div');
  this.zoom_range.className = 'line ' + this.ssv.config.theme;
  this.zoom_range.title = this.ssv.config.lang.zoom;
  zoom_range_bg.appendChild(this.zoom_range);

  this.zoom_value = document.createElement('div');
  this.zoom_value.className = 'handle ' + this.ssv.config.theme;
  this.zoom_value.title = this.ssv.config.lang.zoom;
  this.zoom_range.appendChild(this.zoom_value);

  var zoom_plus = document.createElement('div');
  zoom_plus.className = 'plus';
  zoom_plus.title = this.ssv.config.lang.zoomIn;
  zoom_plus.innerHTML = SodahSphericalViewer.ICONS['zoom-in.svg'];
  this.button.appendChild(zoom_plus);

  this.zoom_range.addEventListener('mousedown', this._initZoomChangeWithMouse.bind(this));
  this.zoom_range.addEventListener('touchstart', this._initZoomChangeByTouch.bind(this));
  this.ssv.container.addEventListener('mousemove', this._changeZoomWithMouse.bind(this));
  this.ssv.container.addEventListener('touchmove', this._changeZoomByTouch.bind(this));
  this.ssv.container.addEventListener('mouseup', this._stopZoomChange.bind(this));
  this.ssv.container.addEventListener('touchend', this._stopZoomChange.bind(this));
  zoom_minus.addEventListener('click', this.ssv.zoomOut.bind(this.ssv));
  zoom_plus.addEventListener('click', this.ssv.zoomIn.bind(this.ssv));
  
  this.ssv.on('zoom-updated', this._moveZoomValue.bind(this));

  var self = this;
  setTimeout(function() {
    self._moveZoomValue(self.ssv.prop.zoom_lvl);
  }, 0);
};

/**
 * Moves the zoom cursor
 * @param level (integer) Zoom level (between 0 and 100)
 * @return (void)
 */
SSVNavBarZoomButton.prototype._moveZoomValue = function(level) {
  this.zoom_value.style.left = (level / 100 * this.zoom_range.offsetWidth - this.zoom_value.offsetWidth / 2) + 'px';
};

/**
 * The user wants to zoom
 * @param evt (Event) The event
 * @return (void)
 */
SSVNavBarZoomButton.prototype._initZoomChangeWithMouse = function(evt) {
  this.prop.mousedown = true;
  this._changeZoom(evt.clientX);
};

/**
 * The user wants to zoom (mobile version)
 * @param evt (Event) The event
 * @return (void)
 */
SSVNavBarZoomButton.prototype._initZoomChangeByTouch = function(evt) {
  this.prop.mousedown = true;
  this._changeZoom(evt.changedTouches[0].clientX);
};

/**
 * The user wants to stop zooming
 * @param evt (Event) The event
 * @return (void)
 */
SSVNavBarZoomButton.prototype._stopZoomChange = function(evt) {
  this.prop.mousedown = false;
};

/**
 * The user moves the zoom cursor
 * @param evt (Event) The event
 * @return (void)
 */
SSVNavBarZoomButton.prototype._changeZoomWithMouse = function(evt) {
  evt.preventDefault();
  this._changeZoom(evt.clientX);
};

/**
 * The user moves the zoom cursor (mobile version)
 * @param evt (Event) The event
 * @return (void)
 */
SSVNavBarZoomButton.prototype._changeZoomByTouch = function(evt) {
  evt.preventDefault();
  this._changeZoom(evt.changedTouches[0].clientX);
};

/**
 * Zoom change
 * @param x (integer) Horizontal coordinate
 * @return (void)
 */
SSVNavBarZoomButton.prototype._changeZoom = function(x) {
  if (this.prop.mousedown) {
    var user_input = parseInt(x) - this.zoom_range.getBoundingClientRect().left;
    var zoom_level = user_input / this.zoom_range.offsetWidth * 100;
    this.ssv.zoom(zoom_level);
  }
};

/**
 * Custom error used in the lib
 * http://stackoverflow.com/a/27724419/1207670
 * @param message (Mixed)
 */
function SSVError(message) {
  this.message = message;
  
  // Use V8's native method if available, otherwise fallback
  if ('captureStackTrace' in Error) {
    Error.captureStackTrace(this, SSVError);
  }
  else {
    this.stack = (new Error()).stack;
  }
}

SSVError.prototype = Object.create(Error.prototype);
SSVError.prototype.name = 'SSVError';
SSVError.prototype.constructor = SSVError;

/**
 * Static utilities for SSV
 */
var SSVUtils = {};

/**
 * Detects whether canvas is supported
 * @return (boolean) true if canvas is supported, false otherwise
 */
SSVUtils.isCanvasSupported = function() {
  var canvas = document.createElement('canvas');
  return !!(canvas.getContext && canvas.getContext('2d'));
};

/**
 * Detects whether WebGL is supported
 * @return (boolean) true if WebGL is supported, false otherwise
 */
SSVUtils.isWebGLSupported = function() {
  var canvas = document.createElement('canvas');
  return !!(window.WebGLRenderingContext && canvas.getContext('webgl'));
};

/**
 * Get max texture width in WebGL context
 * @return (int)
 */
SSVUtils.getMaxTextureWidth = function() {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('webgl');
  return ctx.getParameter(ctx.MAX_TEXTURE_SIZE);
};

/**
 * Search if an element has a particular, at any level including itself
 * @param el (HTMLElement)
 * @param parent (HTMLElement)
 * @return (Boolean)
 */
SSVUtils.hasParent = function(el, parent) {
  do {
    if (el === parent) {
      return true;
    }
  } while (!!(el = el.parentNode));

  return false;
};

/**
 * Get closest parent (can by itself)
 * @param el (HTMLElement)
 * @param selector (String)
 * @return (HTMLElement)
 */
SSVUtils.getClosest = function(el, selector) {
  var matches = el.matches || el.msMatchesSelector;
  
  do {
    if (matches.bind(el)(selector)) {
      return el;
    }
  } while (!!(el = el.parentElement));

  return null;
};

/**
 * Get the event name for mouse wheel
 * @return (string)
 */
SSVUtils.mouseWheelEvent = function() {
  return "onwheel" in document.createElement("div") ? "wheel" : // Modern browsers support "wheel"
    document.onmousewheel !== undefined ? "mousewheel" : // Webkit and IE support at least "mousewheel"
    "DOMMouseScroll"; // let's assume that remaining browsers are older Firefox
};

/**
 * Get the event name for fullscreen event
 * @return (string)
 */
SSVUtils.fullscreenEvent = function() {
  var map = {'exitFullscreen': 'fullscreenchange', 'webkitExitFullscreen': 'webkitfullscreenchange', 'mozCancelFullScreen': 'mozfullscreenchange', 'msExitFullscreen': 'msFullscreenEnabled'};
  for (var exit in map) if (exit in document) return map[exit];
  return 'fullscreenchange';
};

/**
 * Ensures that a number is in a given interval
 * @param x (number) The number to check
 * @param min (number) First endpoint
 * @param max (number) Second endpoint
 * @return (number) The checked number
 */
SSVUtils.stayBetween = function(x, min, max) {
  return Math.max(min, Math.min(max, x));
};

/**
 * Returns the value of a given attribute in the panorama metadata
 * @param data (string) The panorama metadata
 * @param attr (string) The wanted attribute
 * @return (string) The value of the attribute
 */
SSVUtils.getAttribute = function(data, attr) {
  var a = data.indexOf('GPano:' + attr) + attr.length + 8, b = data.indexOf('"', a);
  return data.substring(a, b);
};

/**
 * Detects whether fullscreen is enabled or not
 * @return (boolean) true if fullscreen is enabled, false otherwise
 */
SSVUtils.isFullscreenEnabled = function() {
  return (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
};

/**
 * Enters fullscreen mode
 * @param elt (HTMLElement)
 */
SSVUtils.requestFullscreen = function(elt) {
  (elt.requestFullscreen || elt.mozRequestFullScreen || elt.webkitRequestFullscreen || elt.msRequestFullscreen).call(elt);
};

/**
 * Exits fullscreen mode
 * @param elt (HTMLElement)
 */
SSVUtils.exitFullscreen = function(elt) {
  (document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
};

/**
 * Gets an element style
 * @param elt (HTMLElement)
 * @param prop (string)
 * @return mixed
 */
SSVUtils.getStyle = function(elt, prop) {
  return window.getComputedStyle(elt, null)[prop];
};

/**
 * Translate CSS values like "top center" or "10% 50%" as top and left positions
 * @param value (String)
 * @return Object
 */
SSVUtils.parsePosition = function(value) {
  if (!value) {
    return {top: 0.5, left: 0.5};
  }
  
  var e = document.createElement('div');
  document.body.appendChild(e);
  e.style.backgroundPosition = value;
  var parsed = SSVUtils.getStyle(e, 'background-position').match(/^([0-9.]+)% ([0-9.]+)%$/);
  document.body.removeChild(e);
  
  return {
    left: parsed[1]/100,
    top: parsed[2]/100
  };
};

/**
 * Merge the enumerable attributes of two objects.
 * @copyright Nicholas Fisher <nfisher110@gmail.com>"
 * @license MIT
 * @param object
 * @param object
 * @return object
 */
SSVUtils.deepmerge = function(target, src) {
  var array = Array.isArray(src);
  var dst = array && [] || {};

  if (array) {
    target = target || [];
    dst = dst.concat(target);
    src.forEach(function(e, i) {
      if (typeof dst[i] === 'undefined') {
        dst[i] = e;
      } else if (typeof e === 'object') {
        dst[i] = SSVUtils.deepmerge(target[i], e);
      } else {
        if (target.indexOf(e) === -1) {
          dst.push(e);
        }
      }
    });
  } else {
    if (target && typeof target === 'object') {
      Object.keys(target).forEach(function (key) {
        dst[key] = target[key];
      });
    }
    Object.keys(src).forEach(function (key) {
      if (typeof src[key] !== 'object' || !src[key]) {
        dst[key] = src[key];
      }
      else {
        if (!target[key]) {
          dst[key] = src[key];
        } else {
          dst[key] = SSVUtils.deepmerge(target[key], src[key]);
        }
      }
    });
  }

  return dst;
};

/**
 * Clone an object
 * @param object
 * @return object
 */
SSVUtils.clone = function(src) {
  return SSVUtils.deepmerge({}, src);
};

SodahSphericalViewer.ICONS['zoom-in.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 19.407 19.407" enable-background="new 0 0 19.407 19.406" xml:space="preserve"><path d="M14.043,12.22c2.476-3.483,1.659-8.313-1.823-10.789C8.736-1.044,3.907-0.228,1.431,3.255  c-2.475,3.482-1.66,8.312,1.824,10.787c2.684,1.908,6.281,1.908,8.965,0l4.985,4.985c0.503,0.504,1.32,0.504,1.822,0  c0.505-0.503,0.505-1.319,0-1.822L14.043,12.22z M7.738,13.263c-3.053,0-5.527-2.475-5.527-5.525c0-3.053,2.475-5.527,5.527-5.527  c3.05,0,5.524,2.474,5.524,5.527C13.262,10.789,10.788,13.263,7.738,13.263z"/><polygon points="8.728,4.009 6.744,4.009 6.744,6.746 4.006,6.746 4.006,8.73 6.744,8.73 6.744,11.466 8.728,11.466 8.728,8.73   11.465,8.73 11.465,6.746 8.728,6.746 "/></svg>';

SodahSphericalViewer.ICONS['zoom-out.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 19.407 19.407" enable-background="new 0 0 19.407 19.406" xml:space="preserve"><path d="M14.043,12.22c2.476-3.483,1.659-8.313-1.823-10.789C8.736-1.044,3.907-0.228,1.431,3.255  c-2.475,3.482-1.66,8.312,1.824,10.787c2.684,1.908,6.281,1.908,8.965,0l4.985,4.985c0.503,0.504,1.32,0.504,1.822,0  c0.505-0.503,0.505-1.319,0-1.822L14.043,12.22z M7.738,13.263c-3.053,0-5.527-2.475-5.527-5.525c0-3.053,2.475-5.527,5.527-5.527  c3.05,0,5.524,2.474,5.524,5.527C13.262,10.789,10.788,13.263,7.738,13.263z"/><rect x="4.006" y="6.746" width="7.459" height="1.984"/></svg>';

SodahSphericalViewer.ICONS['fullscreen-start.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 800 600" enable-background="new 0 0 800 600" xml:space="preserve"><path d="M439 119l-74 73-45-45 73-74-73-73 192 0 0 192z m-247 393l-192 0 0-192 73 73 73-72 45 45-72 73z m0-365l-45 45-74-73-73 73 0-192 192 0-73 73z m320 365l-192 0 73-73-72-73 45-45 73 72 73-73z"/></svg>';

SodahSphericalViewer.ICONS['fullscreen-end.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 800 600" enable-background="new 0 0 800 600" xml:space="preserve"><path d="M393 73l74-73 45 45-73 74 73 73-192 0 0-192z m-393 247l192 0 0 192-73-73-73 72-45-45 72-73z m0-275l45-45 74 73 73-73 0 192-192 0 73-73z m320 275l192 0-73 73 72 73-45 45-73-72-73 73z"/></svg>';

SodahSphericalViewer.ICONS['pause.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 600 400" enable-background="new 0 0 600 400" xml:space="preserve"><path d="M192 384l-32 0c-18 0-32-14-32-32l0-224c0-18 14-32 32-32l32 0c18 0 32 14 32 32l0 224c0 18-14 32-32 32m160 0l-32 0c-18 0-32-14-32-32l0-224c0-18 14-32 32-32l32 0c18 0 32 14 32 32l0 224c0 18-14 32-32 32"/></svg>';

SodahSphericalViewer.ICONS['play.svg'] = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" x="0px" y="0px" viewBox="0 0 600 400" enable-background="new 0 0 600 400" xml:space="preserve"><path d="M352 276l-68 40c-15 8-40 23-55 32l-71 40c-15 8-30 1-30-16l0-224c0-18 15-25 30-16l70 40c15 8 40 23 55 32l69 40c15 8 15 23 0 32"/></svg>';

return SodahSphericalViewer;
}));