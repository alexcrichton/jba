JBA.Memory = function() {
  this.memory = new Array(JBA.Memory.MAX_SIZE);
  this.rom    = null;
  this.pad    = null;

  this.reset();
};

JBA.Memory.MAX_SIZE = 65536;

JBA.Memory.prototype = {
  reset: function() {
    var mem = this.memory;
    for (var i = 0; i < mem.length; i++) mem[i] = 0x00;

    mem[JBA.TIMA] = 0x00;
    mem[JBA.TMA]  = 0x00;
    mem[JBA.TAC]  = 0x00;
    mem[JBA.NR10] = 0x80;
    mem[JBA.NR11] = 0xBF;
    mem[JBA.NR12] = 0xF3;
    mem[JBA.NR14] = 0xBF;
    mem[JBA.NR21] = 0x3F;
    mem[JBA.NR22] = 0x00;
    mem[JBA.NR24] = 0xBF;
    mem[JBA.NR31] = 0xFF;
    mem[JBA.NR32] = 0x9F;
    mem[JBA.NR33] = 0xBF;
    mem[JBA.NR41] = 0xFF;
    mem[JBA.NR42] = 0x00;
    mem[JBA.NR43] = 0x00;
    mem[JBA.NR30] = 0xBF;
    mem[JBA.NR50] = 0x77;
    mem[JBA.NR51] = 0xF3;
    mem[JBA.NR52] = 0xF1;
    mem[JBA.LCDC] = 0x91;
    mem[JBA.STAT] = 0x02;
    mem[JBA.SCY]  = 0x00;
    mem[JBA.SCX]  = 0x00;
    mem[JBA.LYC]  = 0x00;
    mem[JBA.BGP]  = 0xFC;
    mem[JBA.OBP0] = 0xFF;
    mem[JBA.OBP1] = 0xFF;
    mem[JBA.WY]   = 0x00;
    mem[JBA.WX]   = 0x00;
    mem[JBA.IE]   = 0x00;
  },

  read: function(addr) {
    if (addr < 0x8000 || (addr >=0xa000 && addr < 0xc000)) {
      if (this.rom == null) {
        throw "Haven't loaded a rom yet when reading memory!";
      } else {
        return this.rom.read(addr);
      }
    }

    return this.memory[addr];
  },

  write: function(addr, value, check) {
    if (typeof(check) == 'undefined') check = true;

    if (check) {
      switch (addr) {
        case JBA.DMA: _dma_transfer(value); break;

        case JBA.P1:
          var oldP1 = this.memory[JBA.P1];
          value = (value & 0x30) | (oldP1 & ~0x30);
          value = this.pad.update_input(value);
          if (value != oldP1 && (value & 0x0F) != 0x0F) {
            memory[JBA.IF] |= 0x10; // Should produce an interruption
          }
          break;

        case JBA.STAT:
          value = (value & ~0x07) | (memory[JBA.STAT] & 0x07);
          break;

        case JBA.LY:
        case JBA.DIV: value = 0; break;
      }

      if (addr >= 0xc000 && addr <= 0xddff)
        this.memory[addr + 0x2000] = value;
      if (addr >= 0xe000 && addr < 0xfdff)
        this.memory[addr - 0x2000] = value;

      if (addr < 0x8000 || (addr >= 0xa000 && addr < 0xc000)) {
        if (this.rom == null) {
          throw "A rom hasn't been loaded when writing to memory!";
        } else {
          return this.rom.write(addr, value);
        }
      }
    }

    return this.memory[addr] = value;
  },

  _dma_transfer: function(addr) {
    addr <<= 8;
    for (var i = 0; i < 0xa0; i++)
      this.write(0xfe00 + i, this.read(addr + i));
  }
};
