/**
 * Represents the Memory Management Unit (MMU) for the GB
 *
 * This houses the logic for reading/writing to memory and managing the
 * Memory Bank Controller (MBC) logic. T
 */
JBA.Memory = function(data) {
  this.reset();
};

JBA.Memory.MBC = {
  NONE: 0,
  MBC1: 1,
  MBC2: 2,
  MBC3: 3
};

JBA.Memory.prototype = {
  reset: function() {
    this.rom = '';
    this.mbc = -1;
    this.ram = [];
    this.rombank = 1; // The number of the rom bank currently swapped in
    this.rambank = 0; // The number of the ram bank currently swapped in
    this.ramon = 0; // A flag whether ram is enabled or not.
    this.mode  = 0; // Flag whether in ROM banking mode (0) or RAM banking mode

    for (var i = 0; i < 0xffff; i++) {
      this.ram[i] = 0;
    }
  },

  load_cartridge: function(data) {
    switch (data.charCodeAt(0x0147)) {
      case 0x00:            // rom only
      case 0x08:            // rom + ram
      case 0x09:            // rom + ram + battery
        this.mbc = JBA.Memory.MBC.NONE;
        break;

      case 0x01:            // rom + mbc1
      case 0x02:            // rom + mbc1 + ram
      case 0x03:            // rom + mbc1 + ram + batt
        this.mbc = JBA.Memory.MBC.MBC1;
        break;

      case 0x05:            // rom + mbc2
      case 0x06:            // rom + mbc2 + battery
        this.mbc = JBA.Memory.MBC.MBC2;
        break;

      case 0x0f:            // rom + mbc3 + timer + batt
      case 0x10:            // rom + mbc3 + timer + ram + batt
      case 0x11:            // rom + mbc3
      case 0x12:            // rom + mbc3 + ram
      case 0x13:            // rom + mbc3 + ram + batt
        this.mbc = JBA.Memory.MBC.MBC3;
        break;

      default: throw "Unknown/unimplemented MBC type!";
    }

    this.rom = data;
  },

  rw: function(addr) { return this.rb(addr) | (this.rb(addr + 1) << 8); },
  ww: function(addr, v) { this.wb(addr, v & 0xff); this.wb(addr + 1, v >> 8); },

  rb: function(addr) {
    switch (addr >> 12) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        // Always mapped in as first bytes of cartridge
        return this.rom.charCodeAt(addr);
      case 0x4:
      case 0x5:
      case 0x6:
      case 0x7:
        // Swappable banks of ROM
        return this.rom.charCodeAt((this.rombank << 14) | (addr & 0x3fff));

      case 0x8:
      case 0x9:
        // FIGURE OUT WHAT GOES HERE

      case 0xa:
      case 0xb:
      // Swappable banks of RAM
        if (this.ramon) {
          return this.ram[(this.rambank << 13) | (addr & 0x1fff)];
        } else {
          return 0xff;
        }

      case 0xc:
      case 0xe:
      case 0xf:
        // FIGURE OUT WHAT GOES HERE
    }

    return 0xff; // Should not get here
  },

  wb: function(addr, value) {
    switch (addr >> 12) {
      case 0x0:
      case 0x1:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            this.ramon = (value & 0xf) == 0xa ? 1 : 0; break;
        }
        break;

      case 0x2:
      case 0x3:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            this.rombank = (this.rombank & 0x60) | (value & 0x1f);
            if (this.rombank == 0) this.rombank = 1;
            break;
        }
        break;

      case 0x4:
      case 0x5:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            if (this.mode == 0) { // ROM banking mode
              this.rombank = (this.rombank & 0x1f) | ((value & 0x3) << 5);
            } else { // RAM banking mode
              this.rambank = value & 0x3;
            }
            break;
        }
        break;

      case 0x6:
      case 0x7:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            this.mode = value & 0x1;
            break;
        }
        break;

      case 0x8:
      case 0x9:
        // FIGURE OUT WHAT GOES HERE
        break;

      case 0xa:
      case 0xb:
        // Swappable banks of RAM
        if (this.ramon) {
          this.ram[(this.rambank << 13) | (addr & 0x1fff)] = value;
        }
        break;

      case 0xc:
      case 0xe:
      case 0xf:
        // FIGURE OUT WHAT GOES HERE
    }
  }
};
