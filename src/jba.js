/**
 * @constructor
 */
var JBA = function() {
  this.cpu    = new JBA.CPU();
  this.memory = new JBA.Memory();
  this.gpu    = new JBA.GPU();
  this.timer  = new JBA.Timer();

  this.cpu.memory   = this.memory;
  this.gpu.mem      = this.memory;
  this.memory.gpu   = this.gpu;
  this.memory.timer = this.timer;
  this.timer.memory = this.memory;
  this.memory.powerOn();
};

JBA.prototype = {
  /** @type {JBA.CPU} */
  cpu: null,
  /** @type {JBA.Memory} */
  memory: null,
  /** @type {JBA.GPU} */
  gpu: null,
  /** @type {JBA.Timer} */
  timer: null,

  fps: 0,

  reset: function() {
    this.cpu.reset();
    this.memory.reset();
    this.gpu.reset();
    this.timer.reset();
    this.gpu.white_canvas();
    this.memory.powerOn();
  },

  exec: function() {
    var t = this.cpu.exec();
    this.gpu.step(t);
    return t;
  },

  frame: function() {
    var cpu = this.cpu, gpu = this.gpu;
    // See http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
    // for the timing for this constant
    try {
      var cycles_left = 70224, t = 0;
      do {
        t = cpu.exec();
        gpu.step(t);
        cycles_left -= t;
      } while (cycles_left > 0);

      this.fps++;
    } catch (e) {
      this.stop();
      throw e;
    }
  },

  run: function(interval) {
    if (typeof interval == 'undefined') {
      interval = 16;
    }
    /* I'd like to use this.frame.bind(this) instead of this t=this hack, but
       apparently the bind function doesn't exist in safari */
    var t = this;
    this._interval = setInterval(function() { t.frame(); }, interval);
  },

  stop: function() {
    clearInterval(this._interval);
  },

  /**
   * Load a rom from a binary string.
   *
   * @param {string} rom the rom as a binary string
   */
  load_rom: function(rom) {
    this.memory.load_cartridge(rom);
  },

  /**
   * Set the element which will supply input events to this GB instance. This
   * function assumes that jQuery is available.
   *
   * @param {Element} element the element to receive key events from.
   */
  bind_keys: function(element) {
    /* See frame() for why there's this hack */
    var input = this.memory.input;
    $(element).keydown(function(e) { return input.keydown(e.keyCode); });
    $(element).keyup(function(e) { return input.keyup(e.keyCode); });
  },

  /**
   * Set the canvas element to paint the screen to
   *
   * @param {Element} canvas the canvas element to use for this GB
   */
  set_canvas: function(canvas) {
    this.gpu.set_canvas(canvas);
  },

  /**
   * Get the number of frames rendered for this GB.
   *
   * @return {number} the number of frames that have been rendered since the
   *                  last invocation of this function.
   */
  frames_count: function() {
    var cnt = this.fps;
    this.fps = 0;
    return cnt;
  },

  /**
   * Marshal this JBA instance into a string which can be loaded with a call to
   * load_snapshot()
   *
   * @return {string} a string representing the state of this gameboy
   */
  snapshot: function() {
    var io = new JBA.StringIO();
    this.memory.serialize(io);
    this.gpu.serialize(io);
    this.cpu.serialize(io);
    this.timer.serialize(io);
    return io.data;
  },

  /**
   * Load a snapshot previously returned by snapshot() back into memory. The
   * snapshot's original cartridge should already be loaded.
   *
   * @param {string} snapshot the previous binary snapshot image
   */
  load_snapshot: function(snapshot) {
    var io = new JBA.StringIO(snapshot);
    this.memory.deserialize(io);
    this.gpu.deserialize(io);
    this.cpu.deserialize(io);
    this.timer.deserialize(io);
    if (!io.eof()) {
      throw "Invalid snapshot!";
    }
  },

  /**
   * Returns the current image of ram for the loaded cartridge. This is meant to
   * be the "battery-saved" data persisted between cartridge loads.
   *
   * @return {string} the ram image in binary forms
   */
  ram_image: function() {
    if (!this.memory.battery) {
      return "";
    }
    var io = new JBA.StringIO(),
       ram = this.memory.ram,
         l = this.memory.ram_size();
    for (var i = 0; i < l; i++) io.wb(ram[i]);
    return io.data;
  },

  /**
   * Loads an image of ram back into ram. This image should have been previously
   * returned by ram_image()
   *
   * @param {string} image the binary ram image to load
   */
  load_ram_image: function(image) {
    if (!this.memory.battery) {
      return "";
    }
    var io = new JBA.StringIO(image),
       ram = this.memory.ram,
         l = this.memory.ram_size();
    for (var i = 0; i < l; i++) ram[i] = io.rb();
    if (!io.eof()) {
      throw "Bad ram image";
    }
  }
};

/**
 * A serializable object which can be convered to/from a string of bytes
 * @interface
 */
function Serializable() {};
/**
 * @param {JBA.StringIO} io the IO object to write to
 */
Serializable.prototype.serialize = function(io) {};
/**
 * @param {JBA.StringIO} io the IO object to read from
 */
Serializable.prototype.deserialize = function(io) {};

window['JBA']                  = JBA;
JBA.prototype['load_rom']      = JBA.prototype.load_rom;
JBA.prototype['set_canvas']    = JBA.prototype.set_canvas;
JBA.prototype['bind_keys']     = JBA.prototype.bind_keys;
JBA.prototype['run']           = JBA.prototype.run;
JBA.prototype['stop']          = JBA.prototype.stop;
JBA.prototype['frames_count']  = JBA.prototype.frames_count;
JBA.prototype['snapshot']      = JBA.prototype.snapshot;
JBA.prototype['load_snapshot'] = JBA.prototype.load_snapshot;
