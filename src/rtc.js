/**
 * Real Time Clock (RTC) for GB
 *
 * @constructor
 */
JBA.RTC = function() {
  this.reset();
};

JBA.RTC.prototype = {
  s: 0, m: 0, h: 0, d: 0, t: 0, carry: 0,
  current: 0, regs: [], stop: 0,

  /** @private */
  _readylatch: 0,

  reset: function() {
    this.current = 0;
    this.stop = 0;
    this.regs = [];
    for (var i = 0; i < 8; i++) this.regs[i] = 0;
    this._readylatch = 0;

    this.t = this.s = this.m = this.h = this.d = this.carry = 0;
  },

  latch: function(value) {
    if (this._readylatch) {
      if (value == 1) {
        this.regs[0] = this.s;
        this.regs[1] = this.m;
        this.regs[2] = this.h;
        this.regs[3] = this.d & 0xff;
        this.regs[4] = (this.d >> 8) | (this.stop << 6) | (this.carry << 7);
        this.regs[5] = this.regs[6] = this.regs[7] = 0xff;
      }

      this._readylatch = 0;
    } else {
      this._readylatch = (value == 0 ? 1 : 0);
    }
  },

  wb: function(value) {
    switch (this.current & 0x7) {
      case 0: this.s = this.regs[0] = value % 60; break;
      case 1: this.m = this.regs[1] = value % 60; break;
      case 2: this.h = this.regs[2] = value % 24; break;
      case 3: this.regs[3] = value; this.d = (this.d & 0x100) | value; break;
      case 4:
        this.regs[4] = value;
        this.d       = (this.d & 0xff) | ((value & 1) << 8);
        this.stop    = (value >> 6) & 1;
        this.carry   = (value >> 7) & 1;
        break;
    }
  },

  step: function() {
    if (this.stop) return;
    // Why is the 't' here?
    if (++this.t >= 60) {
      if (++this.s >= 60) {
        if (++this.m >= 60) {
          if (++this.h >= 24) {
            if (++this.d >= 365) {
              this.d = 0;
              this.carry = 1;
            }
            this.h = 0;
          }
          this.m = 0;
        }
        this.s = 0;
      }
      this.t = 0;
    }
  }
};
