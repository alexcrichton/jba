JBA.Registers = function(jba) {
  this.registers = new Array(8);
  this.program_counter = 0;
  this.stack_pointer = 0;

  this.ime = false;
  this.halt = false;
  this.stop = false;

  this.reset();
};

JBA.Registers.prototype = {
  values: {
    // Byte registers
    A: 0x00,
    B: 0x01,
    C: 0x02,
    D: 0x03,
    E: 0x04,
    F: 0x05,
    H: 0x06,
    L: 0x07,

    // Double registers
    AF: 0x10,
    BC: 0x11,
    DE: 0x12,
    HL: 0x13,

    f_Z: 0x20, // zero flag
    f_N: 0x21, // ?
    f_H: 0x22, // ?
    f_C: 0x23, // carry ?

    PC:   0x30, // program counter
    SP:   0x31, // stack pointer
    $:    0x32, // ?
    c_$$: 0x33, // ?

    c_BC: 0x40, // ?
    c_DE: 0x41, // ?
    c_HL: 0x42  // ?
  },

  // Actual locations in the register arrays
  A: 0,
  F: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  H: 6,
  L: 7,

  reset: function() {
    this.registers[F] = 0x01;
    this.registers[A] = 0xB0;
    this.registers[C] = 0x00;
    this.registers[B] = 0x13;
    this.registers[E] = 0x00;
    this.registers[D] = 0xD8;
    this.registers[L] = 0x01;
    this.registers[H] = 0x4D;

    this.program_counter = 0x0100;
    this.stack_pointer   = 0xFFFE;

    this.halt = false;
    this.stop = false;
    this.ime  = false;
  },

  set_register: function(reg, value) {
    switch (reg) {
      case values.A: this.registers[A] = value; break;
      case values.B: this.registers[B] = value; break;
      case values.C: this.registers[C] = value; break;
      case values.D: this.registers[D] = value; break;
      case values.E: this.registers[E] = value; break;
      case values.F: this.registers[F] = value; break;
      case values.H: this.registers[H] = value; break;
      case values.L: this.registers[L] = value; break;
      case values.AF:
        this.registers[F] = value >> 8;
        this.registers[A] = value & 0xff;
        break;
      case values.BC:
        this.registers[C] = value >> 8;
        this.registers[B] = value & 0xff;
        break;
      case values.DE:
        this.registers[E] = value >> 8;
        this.registers[D] = value & 0xff;
        break;
      case values.HL:
        this.registers[L] = value >> 8;
        this.registers[H] = value & 0xff;
        break;
      case values.PC: this.program_counter = value; break;
      case values.SP: this.stack_pointer = value; break;
    }

    throw "Wrong register: " + reg + "!";
  },

  get_register: function(reg) {
    switch (reg) {
      case values.A: return this.registers[A];
      case values.B: return this.registers[B];
      case values.C: return this.registers[C];
      case values.D: return this.registers[D];
      case values.E: return this.registers[E];
      case values.F: return this.registers[F];
      case values.H: return this.registers[H];
      case values.L: return this.registers[L];
      case values.AF: return (this.registers[F] << 8) & this.registers[A];
      case values.BC: return (this.registers[C] << 8) & this.registers[B];
      case values.DE: return (this.registers[E] << 8) & this.registers[D];
      case values.HL: return (this.registers[L] << 8) & this.registers[H];
      case values.PC: return this.program_counter;
      case values.SP: return this.stack_pointer;
    }

    throw "Wrong register: " + reg + "!";
  },

  set_flag: function(flag, value) {
    switch (flag) {
      case values.f_Z:
        this.registers[F] = (this.registers[F] & 0x7f) | (value << 7); return;
      case values.f_N:
        this.registers[F] = (this.registers[F] & 0xbf) | (value << 6); return;
      case values.f_H:
        this.registers[F] = (this.registers[F] & 0xdf) | (value << 5); return;
      case values.f_C:
        this.registers[F] = (this.registers[F] & 0xef) | (value << 4); return;
    }

    throw "Wrong flag: " + flag + "!";
  },

  get_flag: function(flag) {
    switch (flag) {
      case values.f_Z: return  (this.registers[F] >> 7);
      case values.f_N: return ((this.registers[F] & 0x40) >> 6);
      case values.f_H: return ((this.registers[F] & 0x20) >> 5);
      case values.f_C: return ((this.registers[F] & 0x10) >> 4);
    }

    throw "Wrong flag: " + flag + "!";
  }
};
