/**
 * @constructor
 * @param {JBA.Memory} memory the memory which this input will set the interrupt
 *                     request flag for.
 */
JBA.Input = function(memory) {
  this.memory = memory;
};

// See http://nocash.emubase.de/pandocs.htm#joypadinput for codes
JBA.Input.SEL = {
  BUTTON: 0x20,
  DIRECTION: 0x10
};

/**
 * This is a mapping of javascript key codes to the mask which will be AND'ed
 * into the correct value. These values are asserted low, so the relevant bit
 * is cleared. Here's what each bit position is:
 *
 *    Bit 3 - P13 Input Down  or Start    (0=Pressed) 0111 = 0x7
 *    Bit 2 - P12 Input Up    or Select   (0=Pressed) 1011 = 0xb
 *    Bit 1 - P11 Input Left  or Button B (0=Pressed) 1101 = 0xd
 *    Bit 0 - P10 Input Right or Button A (0=Pressed) 1110 = 0xe
 */
JBA.Input.Map = {
  buttons: {
    90: 0xe, // 'z' => button A
    88: 0xd, // 'x' => button B
    13: 0x7, // enter key => start
    188: 0xb // comma => select
  },

  directions: {
    37: 0xd, // left arrow => input left
    38: 0xb, // up arrow => input up
    39: 0xe, // right arrow => input right
    40: 0x7 // down arrow => input down
  }
};

JBA.Input.prototype = {
  /** @type {JBA.Input.SEL} */
  col: 0,
  /** @type {JBA.Memory} */
  memory: null,

  /* These values are asserted LOW, so initialize them to all unasserted */
  buttons: 0xf,
  directions: 0xf,

  rb: function(addr) {
    switch (this.col) {
      case JBA.Input.SEL.BUTTON:    return this.buttons;
      case JBA.Input.SEL.DIRECTION: return this.directions;
      default: return 0xf;
    }
  },

  wb: function(addr, value) {
    /* The selected column is also negatively asserted, so invert the value
       written in to get a positively asserted selection */
    this.col = ~value & 0x30;
  },

  keydown: function(code) {
    var mask = JBA.Input.Map.directions[code];
    if (mask) {
      this.directions &= mask;
      this.memory._if |= 0x10; /* Joypad interrupt bit */
    }

    mask = JBA.Input.Map.buttons[code];
    if (mask) {
      this.buttons &= mask;
      this.memory._if |= 0x10;
    }
  },

  keyup: function(code) {
    var mask = JBA.Input.Map.directions[code];
    if (mask) {
      this.directions |= (~mask) & 0xf;
    }

    mask = JBA.Input.Map.buttons[code];
    if (mask) {
      this.buttons |= (~mask) & 0xf;
    }
  }
};
