/**
 * Represents the Memory Management Unit (MMU) for the GB
 *
 * This houses the logic for reading/writing to memory and managing the
 * Memory Bank Controller (MBC) logic.
 *
 * For more information about how these work, see this url:
 *    http://nocash.emubase.de/pandocs.htm#memorybankcontrollers
 *
 * @constructor
 */
JBA.Memory = function() {
  this.reset();
};

/**
 * Different MBCs supported
 * @enum
 */
JBA.Memory.MBC = {
  UNKNOWN: -1,
  NONE: 0,
  MBC1: 1,
  MBC2: 2,
  MBC3: 3
};

JBA.Memory.prototype = {
  /** @type {JBA.GPU} */
  gpu: null,

  reset: function() {
    this.rtc = new JBA.RTC();

    /** @type {JBA.Memory.MBC} */
    this.mbc = JBA.Memory.MBC.UNKNOWN;

    this.rom = '';
    this.ram = [];
    this.wram = []; // Special 'Work' ram
    this.hiram = []; // 256 bytes of ram at the end of the address space
    this.rombank = 1; // The number of the rom bank currently swapped in
    this.rambank = 0; // The number of the ram bank currently swapped in
    this.wrambank = 1; // The number of the wram bank currently swapped in
    this.ramon = 0; // A flag whether ram is enabled or not.
    this.mode  = 0; // Flag whether in ROM banking mode (0) or RAM banking mode

    for (var i = 0; i < 0xffff; i++) {
      this.ram[i] = 0;
      this.wram[i] = 0;
    }

    for (i = 0; i < 0xff; i++) {
      this.hiram[i] = 0;
    }
  },

  /**
   * Loads a string of data as a cartridge into this memory. The data provided
   * will be used as ROM.
   *
   * @param {string} data the data of the cartridge
   */
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

  /**
   * Reads a word at the given address (2 bytes)
   *
   * @param {number} addr the 16 bit address in memory to read
   * @return {number} the 16 bit value at this address
   */
  rw: function(addr) { return this.rb(addr) | (this.rb(addr + 1) << 8); },

  /**
   * Writes a word at the given address (2 bytes)
   *
   * @param {number} addr the 16 bit address in memory to read
   * @param {number} v the 16 bit value to write to memory
   */
  ww: function(addr, v) { this.wb(addr, v & 0xff); this.wb(addr + 1, v >> 8); },

  /**
   * Reads a byte at the given address
   *
   * @param {number} addr the 16 bit address in memory to read
   * @return {number} the 8 bit value at this address
   */
  rb: function(addr) {
    switch (addr >> 12) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        // Always mapped in as first bank of cartridge
        return this.rom.charCodeAt(addr);

      case 0x4:
      case 0x5:
      case 0x6:
      case 0x7:
        // Swappable banks of ROM
        return this.rom.charCodeAt((this.rombank << 14) | (addr & 0x3fff));

      case 0x8:
      case 0x9:
        return this.gpu.vram[addr & 0x1fff];

      case 0xa:
      case 0xb:
      // Swappable banks of RAM
        if (this.ramon) {
          if (this.rtc.current & 0x8) {
            return this.rtc.regs[this.rtc.current & 0x7];
          } else {
            return this.ram[(this.rambank << 13) | (addr & 0x1fff)];
          }
        } else {
          return 0xff;
        }

      case 0xc:
      case 0xe:
        return this.wram[addr & 0xfff];

      case 0xd:
        return this.wram[(this.wrambank << 12) | (addr & 0xfff)];

      case 0xf:
        if (addr < 0xfe00) {
          return this.rb(addr & 0xdfff); // mirrored RAM
        } else if (addr < 0xfea0) {
          return this.gpu.oam[addr & 0xff];
        } else if (addr < 0xff00) {
          // unusable ram
        } else if (addr < 0xff80) {
          return this.ioreg_rb(addr);
        } else if (addr < 0xffff) {
          return this.hiram[addr & 0xff];
        }
    }

    return 0xff; // Should not get here
  },

  /**
   * Reads a value from a known IO type register
   */
  ioreg_rb: function(addr) {
    switch ((addr >> 4) & 0xf) {
      case 0x4: case 0x5: case 0x6: case 0x7:
        return this.gpu.rb(addr);
      default: throw "Not implemented reading that address!";
    }
  },

  /**
   * Writes a byte at the given address (2 bytes)
   *
   * @param {number} addr the 16 bit address in memory to read
   * @param {number} value the 8 bit value to write to memory
   */
  wb: function(addr, value) {
    switch (addr >> 12) {
      case 0x0:
      case 0x1:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
          case JBA.Memory.MBC.MBC3:
            this.ramon = (value & 0xf) == 0xa ? 1 : 0; break;

          case JBA.Memory.MBC.MBC2:
            if (!(addr & 0x100)) this.ramon = 1 ^ this.ramon; break;
        }
        break;

      case 0x2:
      case 0x3:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            this.rombank = (this.rombank & 0x60) | (value & 0x1f);
            if (this.rombank == 0) this.rombank = 1;
            break;

          case JBA.Memory.MBC.MBC2:
            if (addr & 0x100) this.rombank = value & 0xf; break;

          case JBA.Memory.MBC.MBC3:
            value &= 0x7f;
            this.rombank = value + (!value); break;
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

          case JBA.Memory.MBC.MBC3:
            this.rtc.current = value & 0xf;
            this.rambank     = value & 3;
            break;
        }
        break;

      case 0x6:
      case 0x7:
        switch (this.mbc) {
          case JBA.Memory.MBC.MBC1:
            this.mode = value & 0x1;
            break;

          case JBA.Memory.MBC.MBC3:
            this.rtc.latch(value); break;
        }
        break;

      case 0x8:
      case 0x9:
        this.gpu.vram[addr & 0x1fff] = value;
        break;

      case 0xa:
      case 0xb:
        // Swappable banks of RAM
        if (this.ramon) {
          if (this.rtc.current & 0x8) {
            this.rtc.wb(value);
          } else {
            if (this.mbc == JBA.Memory.MBC.MBC2) value &= 0xf;
            this.ram[(this.rambank << 13) | (addr & 0x1fff)] = value;
          }
        }
        break;

      case 0xc:
      case 0xe:
        this.wram[addr & 0xfff] = value; break;

      case 0xd:
        this.wram[(this.wrambank << 12) | (addr & 0xfff)] = value; break;

      case 0xf:
        if (addr < 0xfe00) {
          this.wb(addr & 0xdfff, value); // mirrored RAM
        } else if (addr < 0xfea0) {
          this.gpu.oam[addr & 0xff] = value;
        } else if (addr < 0xff00) {
          // unusable ram
        } else if (addr < 0xff80) {
          this.ioreg_wb(addr, value);
        } else if (addr < 0xffff) {
          this.hiram[addr & 0xff] = value;
        }
        break;
    }
  },

  /**
   * Writes a value into a known IO type register
   */
  ioreg_wb: function(addr, value) {
    switch ((addr >> 4) & 0xf) {
      case 0x4: case 0x5: case 0x6: case 0x7:
        this.gpu.wb(addr, value);
      default: throw "Not implemented reading that address!";
    }
  }
};
