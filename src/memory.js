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
  this.rtc   = new JBA.RTC();
  this.input = new JBA.Input(this);
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
  /** @type {JBA.RTC} */
  rtc: null,
  /** @type {JBA.Input} */
  input: null,
  /** @type {JBA.Timer} */
  timer: null,

  /** @type {JBA.Memory.MBC} */
  mbc: JBA.Memory.MBC.UNKNOWN,

  /* Flag if this is a CGB cartridge or not */
  cgb: 0,

  // See reset() for descriptions
  rom: [],
  ram: [],
  wram: [],
  hiram: [],
  rombank: 1,
  rambank: 0,
  wrambank: 1,
  ramon: 0,
  mode: 0,

  /* Interrupt flags, http://nocash.emubase.de/pandocs.htm#interrupts.
     The master enable flag is on the cpu */
  _ie: 0,
  _if: 0,

  reset: function() {
    this.rtc.reset();
    this.input.reset();

    this.rom      = [];
    this.ram      = [];
    this.wram     = []; // Special 'Work' ram
    this.hiram    = []; // 256 bytes of ram at the end of the address space
    this.rombank  = 1; // The number of the rom bank currently swapped in
    this.rambank  = 0; // The number of the ram bank currently swapped in
    this.wrambank = 1; // The number of the wram bank currently swapped in
    this.ramon    = 0; // A flag whether ram is enabled or not.
    this.mode     = 0; // Flag whether in ROM banking (0) or RAM banking mode

    for (var i = 0; i < 0xffff; i++) {
      this.ram[i] = 0;
      this.wram[i] = 0;
    }

    for (i = 0; i < 0xff; i++) {
      this.hiram[i] = 0;
    }
  },

  serialize: function(io) {
    var i;
    this.input.serialize(io);
    // http://nocash.emubase.de/pandocs.htm#thecartridgeheader specifies that
    // byte 0x148 is the size of the ROM.
    io.wb(this.rom[0x148]);
    for (i = 0; i < this.rom.length; i++)   io.wb(this.rom[i]);
    for (i = 0; i < this.ram.length; i++)   io.wb(this.ram[i]);
    for (i = 0; i < this.wram.length; i++)  io.wb(this.wram[i]);
    for (i = 0; i < this.hiram.length; i++) io.wb(this.hiram[i]);
    io.wb(this.rombank);
    io.wb(this.rambank);
    io.wb(this.wrambank);
    io.wb(this.ramon);
    io.wb(this.mode);
    io.wb(this.mbc);
    io.wb(this._if);
    io.wb(this._ie);
  },

  deserialize: function(io) {
    var romsize, i;
    this.input.deserialize(io);
    // For specifics on romsize, see comment above in serialize()
    switch (io.rb()) {
      case 0x00: romsize =  32 << 10; break; // 32 KB
      case 0x01: romsize =  64 << 10; break; // 64 KB
      case 0x02: romsize = 128 << 10; break; // 128 KB
      case 0x03: romsize = 256 << 10; break; // 256 KB
      case 0x04: romsize = 512 << 10; break; // 512 KB
      case 0x05: romsize =   1 << 20; break; // 1 MB
      case 0x06: romsize =   2 << 20; break; // 2 MB
      case 0x07: romsize =   4 << 20; break; // 4 MB
      case 0x52: romsize =   1179648; break; // 1.1 MB = 72 banks * 16 KB/bank
      case 0x53: romsize =   1310720; break; // 1.2 MB = 80 banks * 16 KB/bank
      case 0x54: romsize =   1572864; break; // 1.5 MB = 96 banks * 16 KB/bank
      default: throw "Unknown romsize type";
    }
    for (i = 0; i < romsize; i++)           this.rom[i]   = io.rb();
    for (i = 0; i < this.ram.length; i++)   this.ram[i]   = io.rb();
    for (i = 0; i < this.wram.length; i++)  this.wram[i]  = io.rb();
    for (i = 0; i < this.hiram.length; i++) this.hiram[i] = io.rb();
    this.rombank  = io.rb();
    this.rambank  = io.rb();
    this.wrambank = io.rb();
    this.ramon    = io.rb();
    this.mode     = io.rb();
    this.mbc      = io.rb();
    this._if      = io.rb();
    this._ie      = io.rb();
  },

  powerOn: function() {
    // See http://nocash.emubase.de/pandocs.htm#powerupsequence
    this.wb(0xff05, 0x00); // TIMA
    this.wb(0xff06, 0x00); // TMA
    this.wb(0xff07, 0x00); // TAC
    this.wb(0xff10, 0x80); // NR10
    this.wb(0xff11, 0xbf); // NR11
    this.wb(0xff12, 0xf3); // NR12
    this.wb(0xff14, 0xbf); // NR14
    this.wb(0xff16, 0x3f); // NR21
    this.wb(0xff17, 0x00); // NR22
    this.wb(0xff19, 0xbf); // NR24
    this.wb(0xff1a, 0x7f); // NR30
    this.wb(0xff1b, 0xff); // NR31
    this.wb(0xff1c, 0x9F); // NR32
    this.wb(0xff1e, 0xbf); // NR33
    this.wb(0xff20, 0xff); // NR41
    this.wb(0xff21, 0x00); // NR42
    this.wb(0xff22, 0x00); // NR43
    this.wb(0xff23, 0xbf); // NR30
    this.wb(0xff24, 0x77); // NR50
    this.wb(0xff25, 0xf3); // NR51
    this.wb(0xff26, 0xf1); // NR52
    this.wb(0xff40, 0x91); // LCDC
    this.wb(0xff42, 0x00); // SCY
    this.wb(0xff43, 0x00); // SCX
    this.wb(0xff45, 0x00); // LYC
    this.wb(0xff47, 0xfc); // BGP
    this.wb(0xff48, 0xff); // OBP0
    this.wb(0xff49, 0xff); // OBP1
    this.wb(0xff4a, 0x00); // WY
    this.wb(0xff4b, 0x00); // WX
    this.wb(0xffff, 0x00); // IE
  },

  /**
   * Returns the name of the ROM currently loaded into memory.
   * @return {string} the name of the loaded ROM.
   */
  rom_title: function() {
    // http://nocash.emubase.de/pandocs.htm#thecartridgeheader specifies that
    // bytes 0x134 - 0x143 are the title of the ROM
    var title = '';
    for (var i = 0x134; i <= 0x143; i++) {
      if (this.rom[i] == 0) {
        break;
      }
      title += String.fromCharCode(this.rom[i]);
    }
    return title;
  },

  /**
   * Loads a string of data as a cartridge into this memory. The data provided
   * will be used as ROM.
   *
   * @param {(string|Object)} data the data of the cartridge. If a string is
   *    supplied, then the entire string is loaded into rom using charCodeAt. If
   *    the argument is an object, then it's interpreted as a sparse mapping of
   *    data. The key/value pairs are interpreted as address/value pairs
   */
  load_cartridge: function(data) {
    if (typeof data == 'string') {
      for (var i = 0; i < data.length; i++) {
        this.rom[i] = data.charCodeAt(i) & 0xff;
      }
    } else {
      for (var addr in data) {
        this.rom[addr] = data[addr];
      }
    }

    // See http://nocash.emubase.de/pandocs.htm#thecartridgeheader for
    // header information.

    switch (this.rom[0x0147]) {
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

      default: throw "Unknown/unimplemented MBC type: " + this.rom[0x147];
    }

    this.cgb = this.rom[0x0143] & 0x80;
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
    /* More information about mappings can be found online at
       http://nocash.emubase.de/pandocs.htm#memorymap */
    switch (addr >> 12) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        // Always mapped in as first bank of cartridge
        return this.rom[addr];

      case 0x4:
      case 0x5:
      case 0x6:
      case 0x7:
        // Swappable banks of ROM
        return this.rom[(this.rombank << 14) | (addr & 0x3fff)];

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

      // e000-fdff same as c000-ddff
      case 0xe:
      case 0xc:
        return this.wram[addr & 0xfff];

      case 0xd:
        return this.wram[(this.wrambank << 12) | (addr & 0xfff)];

      case 0xf:
        if (addr < 0xfe00) { // mirrored RAM
          return this.rb(addr & 0xdfff);
        } else if (addr < 0xfea0) { // sprite attribute table (oam)
          return this.gpu.oam[addr & 0xff];
        } else if (addr < 0xff00) { // unusable ram
          return 0xff;
        } else if (addr < 0xff80) { // I/O ports
          return this.ioreg_rb(addr);
        } else if (addr < 0xffff) { // High RAM
          return this.hiram[addr & 0xff];
        } else {
          return this._ie;
        }
    }

    return 0xff; // Should not get here
  },

  /**
   * Reads a value from a known IO type register
   */
  ioreg_rb: function(addr) {
    switch ((addr >> 4) & 0xf) {
      case 0x0:
        // joypad data, http://nocash.emubase.de/pandocs.htm#joypadinput
        // interrupts, http://nocash.emubase.de/pandocs.htm#interrupts
        // timer, http://nocash.emubase.de/pandocs.htm#timeranddividerregisters
        switch (addr & 0xf) {
          case 0x0: return this.input.rb(addr);
          case 0x4: return this.timer.div;
          case 0x5: return this.timer.tima;
          case 0x6: return this.timer.tma;
          case 0x7: return this.timer.tac;
          case 0xf: return this._if;

        // TODO: serial data transfer
        //      http://nocash.emubase.de/pandocs.htm#serialdatatransferlinkcable
          default: return 0xff;
        }

      /* Sound info: http://nocash.emubase.de/pandocs.htm#soundcontroller */
      case 0x1:
      case 0x2:
      case 0x3:
        // TODO: sound registers
        //       http://nocash.emubase.de/pandocs.htm#soundcontroller
        return 0xff;

      case 0x4:
        if (this.cgb && addr == 0xff4d) {
          throw "Can't go in double speed mode just yet for CGB!";
        }
      case 0x5:
      case 0x6:
        return this.gpu.rb(addr);

      case 0x7:
        if (this.cgb && addr == 0xff70) {
          return this.wrambank;
        }

      default:
        throw "Not implemented reading that address!";
    }
  },

  /**
   * Writes a byte at the given address (2 bytes)
   *
   * @param {number} addr the 16 bit address in memory to read
   * @param {number} value the 8 bit value to write to memory
   */
  wb: function(addr, value) {
    /* More information about mappings can be found online at
       http://nocash.emubase.de/pandocs.htm#memorymap */
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
        if (addr < 0x9800) {
          this.gpu.update_tile(addr);
        }
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
        } else {
          this._ie = value;
        }
        break;
    }
  },

  /**
   * Writes a value into a known IO type register
   */
  ioreg_wb: function(addr, value) {
    switch ((addr >> 4) & 0xf) {
      case 0x0:
        switch (addr & 0xf) {
          case 0x0: this.input.wb(addr, value); break;

          case 0x4: this.timer.div  = 0;     break; // writing zeros out counter
          case 0x5: this.timer.tima = value; break;
          case 0x6: this.timer.tma  = value; break;
          case 0x7:
            this.timer.tac = value;
            this.timer.update();
            break;

          case 0xf: this._if = value; break;
        }
        // TODO: serial data transfer
        //      http://nocash.emubase.de/pandocs.htm#serialdatatransferlinkcable
        break;

      /* Sound info: http://nocash.emubase.de/pandocs.htm#soundcontroller */
      case 0x1:
      case 0x2:
      case 0x3:
        // TODO: sound registers
        //       http://nocash.emubase.de/pandocs.htm#soundcontroller
        break;

      case 0x4:
        // See http://nocash.emubase.de/pandocs.htm#cgbregisters
        if (this.cgb && addr == 0xff4d) {
          throw "Can't go in double speed mode just yet for CGB!";
        }
        /* fall through */
      case 0x5:
      case 0x6:
        this.gpu.wb(addr, value);
        break;

      case 0x7:
        // WRAM banks only for CGB mode, see
        // http://nocash.emubase.de/pandocs.htm#cgbregisters
        if (this.cgb && addr == 0xff70) {
          value &= 0x7; /* only bits 0-2 are used */
          this.wrambank = value + (!value); /* default to 1 */
        }
        break;

      default:
        throw "Not implemented writing that address!";
    }
  }
};
