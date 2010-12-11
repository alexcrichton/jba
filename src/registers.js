JBA.Registers = function(jba) {
  this.registers = new Array(8);
  this.program_counter = 0;
  this.stack_pointer = 0;

  this.ime = false;
  this.halt = false;
  this.stop = false;

  this.reset();
};

// Quick aliases for constants
JBA.Reg = {
  // Byte registers, also actual locations in the array
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
};

JBA.Registers.prototype = {

  reset: function() {
    this.registers[JBA.Reg.A] = 0x01;
    this.registers[JBA.Reg.F] = 0xB0;
    this.registers[JBA.Reg.B] = 0x00;
    this.registers[JBA.Reg.C] = 0x13;
    this.registers[JBA.Reg.D] = 0x00;
    this.registers[JBA.Reg.E] = 0xD8;
    this.registers[JBA.Reg.H] = 0x01;
    this.registers[JBA.Reg.L] = 0x4D;

    this.program_counter = 0x0100;
    this.stack_pointer   = 0xFFFE;

    this.halt = false;
    this.stop = false;
    this.ime  = false;
  },

  set: function(reg, value) {
    switch (reg) {
      case JBA.Reg.A: this.registers[JBA.Reg.A] = value; break;
      case JBA.Reg.B: this.registers[JBA.Reg.B] = value; break;
      case JBA.Reg.C: this.registers[JBA.Reg.C] = value; break;
      case JBA.Reg.D: this.registers[JBA.Reg.D] = value; break;
      case JBA.Reg.E: this.registers[JBA.Reg.E] = value; break;
      case JBA.Reg.F: this.registers[JBA.Reg.F] = value; break;
      case JBA.Reg.H: this.registers[JBA.Reg.H] = value; break;
      case JBA.Reg.L: this.registers[JBA.Reg.L] = value; break;
      case JBA.Reg.AF:
        this.registers[JBA.Reg.A] = value >> 8;
        this.registers[JBA.Reg.F] = value & 0xff;
        break;
      case JBA.Reg.BC:
        this.registers[JBA.Reg.B] = value >> 8;
        this.registers[JBA.Reg.C] = value & 0xff;
        break;
      case JBA.Reg.DE:
        this.registers[JBA.Reg.D] = value >> 8;
        this.registers[JBA.Reg.E] = value & 0xff;
        break;
      case JBA.Reg.HL:
        this.registers[JBA.Reg.H] = value >> 8;
        this.registers[JBA.Reg.L] = value & 0xff;
        break;
      case JBA.Reg.PC: this.program_counter = value; break;
      case JBA.Reg.SP: this.stack_pointer = value; break;
      default: throw "Wrong register in set_register: " + reg + "!";
    }
  },

  get: function(reg) {
    switch (reg) {
      case JBA.Reg.A: return this.registers[JBA.Reg.A];
      case JBA.Reg.B: return this.registers[JBA.Reg.B];
      case JBA.Reg.C: return this.registers[JBA.Reg.C];
      case JBA.Reg.D: return this.registers[JBA.Reg.D];
      case JBA.Reg.E: return this.registers[JBA.Reg.E];
      case JBA.Reg.F: return this.registers[JBA.Reg.F];
      case JBA.Reg.H: return this.registers[JBA.Reg.H];
      case JBA.Reg.L: return this.registers[JBA.Reg.L];
      case JBA.Reg.AF:
        return (this.registers[JBA.Reg.A] << 8) | this.registers[JBA.Reg.F];
      case JBA.Reg.BC:
        return (this.registers[JBA.Reg.B] << 8) | this.registers[JBA.Reg.C];
      case JBA.Reg.DE:
        return (this.registers[JBA.Reg.D] << 8) | this.registers[JBA.Reg.E];
      case JBA.Reg.HL:
        return (this.registers[JBA.Reg.H] << 8) | this.registers[JBA.Reg.L];
      case JBA.Reg.PC: return this.program_counter;
      case JBA.Reg.SP: return this.stack_pointer;
    }

    throw "Wrong register in get_register: " + reg + "!";
  },

  set_flag: function(flag, value) {
    switch (flag) {
      case JBA.Reg.f_Z:
        this.registers[JBA.Reg.F] =
          (this.registers[JBA.Reg.F] & 0x7f) | (value << 7);
        return;
      case JBA.Reg.f_N:
        this.registers[JBA.Reg.F] =
          (this.registers[JBA.Reg.F] & 0xbf) | (value << 6);
        return;
      case JBA.Reg.f_H:
        this.registers[JBA.Reg.F] =
          (this.registers[JBA.Reg.F] & 0xdf) | (value << 5);
        return;
      case JBA.Reg.f_C:
        this.registers[JBA.Reg.F] =
          (this.registers[JBA.Reg.F] & 0xef) | (value << 4);
        return;
    }

    throw "Wrong flag in set_flag: " + flag + "!";
  },

  get_flag: function(flag) {
    switch (flag) {
      case JBA.Reg.f_Z: return  (this.registers[JBA.Reg.F] >> 7);
      case JBA.Reg.f_N: return ((this.registers[JBA.Reg.F] & 0x40) >> 6);
      case JBA.Reg.f_H: return ((this.registers[JBA.Reg.F] & 0x20) >> 5);
      case JBA.Reg.f_C: return ((this.registers[JBA.Reg.F] & 0x10) >> 4);
    }

    throw "Wrong flag in get_flag: " + flag + "!";
  }
};
