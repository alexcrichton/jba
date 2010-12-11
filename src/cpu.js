JBA.CPU = function(nes) {
  this.reset();
};

JBA.CPU.prototype = {
  instructionCycles: new Array(0x100),
  instructionCyclesCB: new Array(0x100),

  reset: function() {
    this.resetRegs();
    this.resetMem();
  },

  fillInstructionCycles: function() {
    for (var i = 0; i < 0x100; i++)
      this.instructionCycles[i] = 4;

    this.instructionCycles[0x01] = 12;
    this.instructionCycles[0x02] = 8;
    this.instructionCycles[0x03] = 8;
    this.instructionCycles[0x06] = 8;
    this.instructionCycles[0x08] = 20;
    this.instructionCycles[0x09] = 8;
    this.instructionCycles[0x0A] = 8;
    this.instructionCycles[0x0B] = 8;
    this.instructionCycles[0x0E] = 8;

    this.instructionCycles[0x11] = 12;
    this.instructionCycles[0x12] = 8;
    this.instructionCycles[0x13] = 8;
    this.instructionCycles[0x16] = 8;
    this.instructionCycles[0x18] = 8;
    this.instructionCycles[0x19] = 8;
    this.instructionCycles[0x1A] = 8;
    this.instructionCycles[0x1B] = 8;
    this.instructionCycles[0x1E] = 8;

    this.instructionCycles[0x20] = 8;
    this.instructionCycles[0x21] = 12;
    this.instructionCycles[0x22] = 8;
    this.instructionCycles[0x23] = 8;
    this.instructionCycles[0x26] = 8;
    this.instructionCycles[0x28] = 8;
    this.instructionCycles[0x29] = 8;
    this.instructionCycles[0x2A] = 8;
    this.instructionCycles[0x2B] = 8;
    this.instructionCycles[0x2E] = 8;

    this.instructionCycles[0x30] = 8;
    this.instructionCycles[0x31] = 12;
    this.instructionCycles[0x32] = 8;
    this.instructionCycles[0x33] = 8;
    this.instructionCycles[0x34] = 12;
    this.instructionCycles[0x35] = 12;
    this.instructionCycles[0x36] = 12;
    this.instructionCycles[0x38] = 8;
    this.instructionCycles[0x39] = 8;
    this.instructionCycles[0x3A] = 8;
    this.instructionCycles[0x3B] = 8;
    this.instructionCycles[0x3E] = 8;

    this.instructionCycles[0x46] = 8;
    this.instructionCycles[0x4E] = 8;

    this.instructionCycles[0x56] = 8;
    this.instructionCycles[0x5E] = 8;

    this.instructionCycles[0x66] = 8;

    this.instructionCycles[0x70] = 8;
    this.instructionCycles[0x71] = 8;
    this.instructionCycles[0x72] = 8;
    this.instructionCycles[0x73] = 8;
    this.instructionCycles[0x74] = 8;
    this.instructionCycles[0x77] = 8;
    this.instructionCycles[0x7E] = 8;

    this.instructionCycles[0x86] = 8;
    this.instructionCycles[0x8E] = 8;

    this.instructionCycles[0x96] = 8;
    this.instructionCycles[0x9E] = 8;

    this.instructionCycles[0xA6] = 8;
    this.instructionCycles[0xAE] = 8;

    this.instructionCycles[0xB6] = 8;
    this.instructionCycles[0xDE] = 8;

    this.instructionCycles[0xC0] = 8;
    this.instructionCycles[0xC1] = 12;
    this.instructionCycles[0xC2] = 12;
    this.instructionCycles[0xC3] = 12;
    this.instructionCycles[0xC4] = 12;
    this.instructionCycles[0xC5] = 16;
    this.instructionCycles[0xC6] = 8;
    this.instructionCycles[0xC7] = 32;
    this.instructionCycles[0xC8] = 8;
    this.instructionCycles[0xC9] = 8;
    this.instructionCycles[0xCA] = 12;
    this.instructionCycles[0xCC] = 12;
    this.instructionCycles[0xCD] = 12;
    this.instructionCycles[0xCE] = 8;
    this.instructionCycles[0xCF] = 32;

    this.instructionCycles[0xD0] = 8;
    this.instructionCycles[0xD1] = 12;
    this.instructionCycles[0xD2] = 12;
    this.instructionCycles[0xD4] = 12;
    this.instructionCycles[0xD5] = 16;
    this.instructionCycles[0xD6] = 8;
    this.instructionCycles[0xD7] = 32;
    this.instructionCycles[0xD8] = 8;
    this.instructionCycles[0xD9] = 8;
    this.instructionCycles[0xDA] = 12;
    this.instructionCycles[0xDC] = 12;
    this.instructionCycles[0xDF] = 32;

    this.instructionCycles[0xE0] = 12;
    this.instructionCycles[0xE1] = 12;
    this.instructionCycles[0xE2] = 8;
    this.instructionCycles[0xE5] = 16;
    this.instructionCycles[0xE6] = 8;
    this.instructionCycles[0xE7] = 32;
    this.instructionCycles[0xE8] = 16;
    this.instructionCycles[0xEA] = 16;
    this.instructionCycles[0xEE] = 8;
    this.instructionCycles[0xEF] = 32;

    this.instructionCycles[0xF0] = 12;
    this.instructionCycles[0xF1] = 12;
    this.instructionCycles[0xF2] = 8;
    this.instructionCycles[0xF5] = 16;
    this.instructionCycles[0xF6] = 8;
    this.instructionCycles[0xF7] = 32;
    this.instructionCycles[0xF8] = 12;
    this.instructionCycles[0xF9] = 8;
    this.instructionCycles[0xFA] = 16;
    this.instructionCycles[0xFE] = 8;
    this.instructionCycles[0xFF] = 32;
  },

  fillInstructionCyclesCB: function() {
    for (var i = 0; i < 0x100; i++)
      this.instructionCyclesCB[i] = 8;

    this.instructionCyclesCB[0x06] = 16;
    this.instructionCyclesCB[0x0E] = 16;
    this.instructionCyclesCB[0x16] = 16;
    this.instructionCyclesCB[0x1E] = 16;
    this.instructionCyclesCB[0x26] = 16;
    this.instructionCyclesCB[0x2E] = 16;
    this.instructionCyclesCB[0x36] = 16;
    this.instructionCyclesCB[0x3E] = 16;
    this.instructionCyclesCB[0x46] = 12; //16?
    this.instructionCyclesCB[0x4E] = 12; //16?
    this.instructionCyclesCB[0x56] = 12; //16?
    this.instructionCyclesCB[0x5E] = 12; //16?
    this.instructionCyclesCB[0x66] = 12; //16?
    this.instructionCyclesCB[0x6E] = 12; //16?
    this.instructionCyclesCB[0x76] = 12; //16?
    this.instructionCyclesCB[0x7E] = 12; //16?
    this.instructionCyclesCB[0x86] = 16;
    this.instructionCyclesCB[0x8E] = 16;
    this.instructionCyclesCB[0x96] = 16;
    this.instructionCyclesCB[0x9E] = 16;
    this.instructionCyclesCB[0xA6] = 16;
    this.instructionCyclesCB[0xAE] = 16;
    this.instructionCyclesCB[0xB6] = 16;
    this.instructionCyclesCB[0xBE] = 16;
    this.instructionCyclesCB[0xC6] = 16;
    this.instructionCyclesCB[0xCE] = 16;
    this.instructionCyclesCB[0xD6] = 16;
    this.instructionCyclesCB[0xDE] = 16;
    this.instructionCyclesCB[0xE6] = 16;
    this.instructionCyclesCB[0xEE] = 16;
    this.instructionCyclesCB[0xF6] = 16;
    this.instructionCyclesCB[0xFE] = 16;

  }
};
