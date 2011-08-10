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
    // See http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings
    // for the timing for this constant
    var cycles_left = 70224, t;
    do {
      t = this.cpu.exec();
      cycles_left -= t;
      this.gpu.step(t);
    } while (cycles_left > 0);

    this.fps++;
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
   * Load a rom from a server. This assumes that jQuery is available.
   *
   * @param {string} url the url at which the rom is located.
   * @param {function()} callback invoked if the rom was successfully loaded.
   */
  load_rom: function(url, callback) {
    var options = {
      url: url,
      /* Force the browser to interpret this as binary data instead of unicode
         which produces incorrect charCodeAt() return values */
      beforeSend: function(xhr) {
        xhr.overrideMimeType('text/plain; charset=x-user-defined');
      },
      context: this,
      success: function(data) {
        this.memory.load_cartridge(data);

        if (callback) {
          callback();
        }
      }
    };

    // Needed to preserve the symbols for the closure compiler
    options['beforeSend'] = options.beforeSend;
    options['success'] = options.success;

    $.ajax(options);
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
    this.cpu.serialize(io);
    this.gpu.serialize(io);
    this.memory.serialize(io);
    this.timer.serialize(io);
    return io.data;
  },

  load_snapshot: function(snapshot) {
    var io = new JBA.StringIO(snapshot);
    this.cpu.deserialize(io);
    this.gpu.deserialize(io);
    this.memory.deserialize(io);
    this.timer.deserialize(io);
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

window['JBA'] = JBA;
JBA.prototype['load_rom']      = JBA.prototype.load_rom;
JBA.prototype['set_canvas']    = JBA.prototype.set_canvas;
JBA.prototype['bind_keys']     = JBA.prototype.bind_keys;
JBA.prototype['run']           = JBA.prototype.run;
JBA.prototype['stop']          = JBA.prototype.stop;
JBA.prototype['frames_count']  = JBA.prototype.frames_count;
JBA.prototype['snapshot']      = JBA.prototype.snapshot;
JBA.prototype['load_snapshot'] = JBA.prototype.load_snapshot;
