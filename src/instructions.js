JBA.Instructions = function(registers, memory) {
  this.reg = registers;
  this.mem = memory;
};

JBA.Instructions.prototype = {
  nop: function() {
    this.reg.program_counter += 1;
  },

  ld_r1_r2: function(r1, r2) {
    var length = 1;

    if (r1 == JBA.Reg.c_HL) {
      if (r2 == JBA.Reg.$) {
        this.mem.write(this.reg.get(JBA.Reg.HL), this._inmValue8Bits());
        length = 2;
      } else {
        this.mem.write(this.reg.get(JBA.Reg.HL), this.reg.get(r2));
      }
    } else {
      if (r2 == JBA.Reg.c_HL) {
        this.reg.set(r1, this.mem.read(this.reg.get(JBA.Reg.HL)));
      } else {
        this.reg.set(r1, this.reg.get(r2));
      }
    }

    this.reg.program_counter += length;
  },

  ld_A_n: function(r) {
    var address, value, length = 1;

    switch(r) {
      case JBA.Reg.$:
        value = this._inmValue8Bits();
        length = 2;
        break;
      case JBA.Reg.c_$$:
        value = this.mem.read(this._inmValue16Bits());
        length = 3;
        break;
      case JBA.Reg.c_BC:
        value = this.mem.read(this.reg.get(JBA.Reg.BC));
        break;
      case JBA.Reg.c_DE:
        value = this.mem.read(this.reg.get(JBA.Reg.DE));
        break;
      case JBA.Reg.c_HL:
        value = this.mem.read(this.reg.get(JBA.Reg.HL));
        break;
      default:
        value = this.reg.get(r);
    }

    this.reg.set(JBA.Reg.A, value);
    this.reg.program_counter += length;
  },

  ld_n_A: function(r) {
    var length = 1, to_write = this.reg.get(JBA.Reg.A);

    switch (r) {
      case JBA.Reg.c_$$:
        this.mem.write(this._inmValue16Bits(), to_write);
        length = 3;
        break;
      case JBA.Reg.c_BC:
        this.mem.write(this.reg.get(JBA.Reg.BC), to_write);
        break;
      case JBA.Reg.c_DE:
        this.mem.write(this.reg.get(JBA.Reg.DE), to_write);
        break;
      case JBA.Reg.c_HL:
        this.mem.write(this.reg.get(JBA.Reg.HL), to_write);
        break;
      default:
        this.reg.set(r, to_write);
    }

    this.reg.program_counter += length;
  },

  jp_nn: function() {
    this.reg.program_counter = this._inmValue16Bits();
  },

  ldh_A_n: function() {
    this.reg.set(JBA.Reg.A, this.mem.read(0xff00 | this._inmValue8Bits()));
    this.reg.program_counter += 2;
  },

  ldh_c$_A: function() {
    this.mem.write(0xff00 | this._inmValue8Bits(), this.reg.get(JBA.Reg.A));
    this.reg.program_counter += 2;
  },

  ccf: function() {
    this.reg.set_flag(JBA.Reg.f_N, 0);
    this.reg.set_flag(JBA.Reg.f_H, 0);
    this.reg.set_flag(JBA.Reg.f_C, 1 - reg.get_flag(JBA.Reg.f_C));

    this.reg.program_counter += 1;
  },

  cp_n: function(r) {
    var value, length = 1, a_val = this.reg.get(JBA.Reg.A);

    switch (r) {
      case JBA.Reg.$:
        value = this._inmValue8Bits();
        length = 2;
        break;
      case JBA.Reg.c_HL:
        value = this.mem.read(this.reg.get(JBA.Reg.HL));
        break;
      default:
        value = this.reg.get(r);
    }

    this.reg.set_flag(JBA.Reg.f_Z, a_val == value ? 1 : 0);
    this.reg.set_flag(JBA.Reg.f_N, 1);
    this.reg.set_flag(JBA.Reg.f_H, (a_val & 0xf) < (value & 0xf) ? 1 : 0);
    this.reg.set_flag(JBA.Reg.f_C, a_val < value ? 1 : 0);

    this.reg.program_counter += length;
  },

  cpl: function() {
    this.reg.set(JBA.Reg.A, ~this.reg.get(JBA.Reg.A) & 0xff);

    this.reg.set_flag(JBA.Reg.f_N, 1);
    this.reg.set_flag(JBA.Reg.f_H, 1);

    this.reg.program_counter += 1;
  },

  ld_n_nn: function(r) {
    if (r != JBA.Reg.BC &&
        r != JBA.Reg.DE &&
        r != JBA.Reg.HL &&
        r != JBA.Reg.SP) {
      throw "ld_n_nn called on invalid register: " + r + "!";
    }

    this.reg.set(r, this._inmValue16Bits());
    this.reg.program_counter += 3;
  },

  ld_nn_SP: function() {
    var dest = this._inmValue16Bits(), sp = this.reg.stack_pointer;

    this.mem.write(dest, sp & 0xff);
    this.mem.write(dest + 1, (sp >> 8) & 0xff);

    this.reg.program_counter += 3;
  },

  jr: function() {
    this.reg.program_counter += 2 + this._inmValue8Bits();
  },

  jr_CC_n: function(flag, value) {
    if (this.reg.get_flag(flag) == value) {
      this.jr();
    } else {
      this.reg.program_counter += 2;
    }
  },

  call_nn: function() {
    var sp = this.reg.stack_pointer, pc = this.reg.program_counter + 3;

    this.mem.write(sp - 1, (pc & 0xff00) >> 8);
    this.mem.write(sp - 2, pc & 0xff);

    this.reg.stack_pointer = sp - 2;
    this.reg.program_counter = this._inmValue16Bits();
  },

  call_cc_nn: function(flag, value) {
    if (this.reg.get_flag(flag) == value) {
      this.call_nn();
    } else {
      this.reg.program_counter += 3;
    }
  },

  ldi_A_cHL: function() {
    var hl = this.reg.get(JBA.Reg.HL);

    this.reg.set(JBA.Reg.A, this.mem.read(hl));
    this.reg.set(JBA.Reg.HL, hl + 1);

    this.reg.program_counter += 1;
  },

  ldi_cHL_A: function() {
    var hl = this.reg.get(JBA.Reg.HL);
    this.mem.write(hl, this.reg.get(JBA.Reg.A));
    this.reg.set(JBA.Reg.HL, hl + 1);

    this.reg.program_counter += 1;
  },

  ldd_A_cHL: function() {
    var hl = this.reg.get(JBA.Reg.HL);

    this.reg.set(JBA.Reg.A, this.mem.read(hl));
    this.reg.set(JBA.Reg.HL, hl - 1);

    this.reg.program_counter += 1;
  },

  ldd_cHL_A: function() {
    var hl = this.reg.get(JBA.Reg.HL);
    this.mem.write(hl, this.reg.get(JBA.Reg.A));
    this.reg.set(JBA.Reg.HL, hl - 1);

    this.reg.program_counter += 1;
  },

  ld_SP_HL: function() {
    this.reg.stack_pointer = this.reg.get(JBA.Reg.HL);

    this.reg.program_counter += 1;
  },

  _inmValue8Bits: function() {
    return this.mem.read(this.reg.program_counter + 1);
  },

  _inmValue16Bits: function() {
    return (this.mem.read(this.reg.program_counter + 2) << 8) |
      this.mem.read(this.reg.program_counter + 1);
  }
};
