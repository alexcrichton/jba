/**
 * @constructor
 * @implements {Serializable}
 * @param {JBA.Input} input the input module connected to memory/cpu/gpu
 */
JBA.SGB = function(input) {
  this.input = input;
  this.reset();
};

/**
 * Enum for which state we are in when reading SGB information.
 * @enum {number}
 */
JBA.SGB.State =  {
  NONE: 0,
  RESET: 1,
  READ: 2
};

JBA.SGB.prototype = {
  /** @type {JBA.Input} */
  input: null,

  // 512 palettes, 4 colors each, 2 bytes a color = 4K
  sgbram: new Uint8Array(0x1000),

  /** @type {JBA.SGB.State} */
  state: JBA.SGB.State.NONE,

  // The SGB has 8 palettes of 16 colors each. The first four are for the game
  // screen and the last four are for the border. We don't care about the
  // border. Also, only the first four colors of each palette is used to color
  // the game screen.
  //
  // This means that we need 4 palettes, each of 8 bytes (2 bytes per color).
  // This array provides the 32 bytes needed.
  //
  // Each element is one color (16 bits), and each quadruple is one palette.
  sgbpal: new Uint16Array(16),

  // Actual compiled palettes where each palette is an array of 4 colors where
  // each color has 4 components.
  sgb_pals: new Array(4),

  // This is a 20x18 array which maps palettes to locations on the screen.
  // Each element defines an 8x8 block on the GB screen which should be
  // mapped through these palettes instead of using the normal grayscale.
  sgbatf: new Uint8Array(20 * 18),

  /**
   * Reset this SGB to its original state.
   */
  reset: function() {
    var i, j;
    this.state = JBA.SGB.State.NONE;
    for (i = 0; i < this.sgbram.length; i++) this.sgbram[i] = 0;
    for (i = 0; i < this.sgbpal.length; i++) this.sgbpal[i] = 0;
    for (i = 0; i < this.sgbatf.length; i++) this.sgbatf[i] = 0;
    for (i = 0; i < 4; i++) {
      this.sgb_pals[i] = new Array(4);
      for (j = 0; j < 4; j++) {
        this.sgb_pals[i][j] = [0, 0, 0, 255];
      }
    }
    this.update_palettes();
  },

  serialize: function(io) {
    if (!this.input.memory.sgb) {
      return;
    }
    var i;
    for (i = 0; i < this.sgbram.length; i++) io.wb(this.sgbram[i]);
    for (i = 0; i < this.sgbpal.length; i++) io.ww(this.sgbpal[i]);
    for (i = 0; i < this.sgbatf.length; i++) io.wb(this.sgbatf[i]);
    io.wb(this.state);
  },

  deserialize: function(io) {
    if (!this.input.memory.sgb) {
      return;
    }
    var i;
    for (i = 0; i < this.sgbram.length; i++) this.sgbram[i] = io.rb();
    for (i = 0; i < this.sgbpal.length; i++) this.sgbpal[i] = io.rw();
    for (i = 0; i < this.sgbatf.length; i++) this.sgbatf[i] = io.rb();
    this.state = io.rb(this.state);
    this.update_palettes();
  },

  receive: function(bits) {
    if (!this.input.memory.sgb) {
      return;
    }
    switch (this.state) {
      // Not currently in a state of reading packets, but we can transition
      // to the RESET state where we might begin reading packets.
      case JBA.SGB.State.NONE:
        if (bits == 0) {
          this.state = JBA.SGB.State.RESET;
          this.sgb_packets = 0;
        } else if (bits == 3) {
          this.input.joypad_sel = (this.input.joypad_sel + 1) % 4;
        }
        break;

      // In RESET, we can go to reading packets.
      case JBA.SGB.State.RESET:
        if (bits == 3) {
          this.state = JBA.SGB.State.READ;
          if (this.sgb_packets == 0) {
            this.sgb_packets = 1;
            this.sgb_datai   = 0;
          }
          this.sgb_byte    = 0;
          this.sgb_read    = 0;
        } else if (bits != 0) {
          this.state = JBA.SGB.State.NONE;
        }
        break;

      case JBA.SGB.State.READ:
        if (bits == 0) {
          this.state = JBA.SGB.State.RESET;
          if (this.sgb_datai == this.sgb_packets * 16)
            this.sgb_packets = 0;
        } else if (bits == 3){
          // we just received the reset bit
          if (this.sgb_read == 128) {
            // Have we read all the packets?
            if (this.sgb_datai == this.sgb_packets * 16) {
              this.process_sgb_data();
              this.state = JBA.SGB.State.NONE;

            // We have to read another packet
            } else {
              this.sgb_read = 0;
            }
          // we just received a data bit!
          } else {
            this.sgb_byte |= this.sgb_bit << (this.sgb_read % 8);
            this.sgb_read++;
            if (this.sgb_read % 8 == 0) {
              if (this.sgb_datai == 0) {
                this.sgb_packets = this.sgb_byte % 8;
                this.sgb_command = this.sgb_byte >> 3;
                this.sgb_data    = new Uint8Array(this.sgb_packets * 16);
              }
              this.sgb_data[this.sgb_datai++] = this.sgb_byte;
              this.sgb_byte = 0;
            }
          }
        } else {
          this.sgb_bit = bits & 1;
        }
        break;
    }
  },

  process_sgb_data: function() {
    var i, j, data = this.sgb_data, sgbram = this.sgbram, pals = this.sgbpal;
    // http://nocash.emubase.de/pandocs.htm#sgbfunctions

    switch (this.sgb_command) {
      case 0x00: this.update_pal(0, 1); break;
      case 0x01: this.update_pal(2, 3); break;
      case 0x02: this.update_pal(0, 3); break;
      case 0x03: this.update_pal(1, 2); break;
      case 0x04: this.attr_blk(); break;
      case 0x0A: this.pal_set(); break;
      case 0x0B: this.pal_trn(); break;
      case 0x17: this.mask_en(); break;

      /* Not really sure what this one does... Ignoring for now. */
      case 0x0F: //   DATA_SND  SUPER NES WRAM Transfer 1
        break;

      case 0x11: //   MLT_REG   Controller 2 Request
        this.input.joypad_sel = 0;
        break;

      /* Ignore these because they have to do with rendering the background
       * which is currently not supported */
      case 0x13: //   CHR_TRN   Transfer Character Font Data
      case 0x14: //   PCT_TRN   Set Screen Data Color Data
        break;

      case 0x05: //   ATTR_LIN  "Line" Area Designation Mode
      case 0x06: //   ATTR_DIV  "Divide" Area Designation Mode
      case 0x07: //   ATTR_CHR  "1CHR" Area Designation Mode
      case 0x08: //   SOUND     Sound On/Off
      case 0x09: //   SOU_TRN   Transfer Sound PRG/DATA
      case 0x0C: //   ATRC_EN   Enable/disable Attraction Mode
      case 0x0D: //   TEST_EN   Speed Function
      case 0x0E: //   ICON_EN   SGB Function
      case 0x10: //   DATA_TRN  SUPER NES WRAM Transfer 2
      case 0x12: //   JUMP      Set SNES Program Counter
      case 0x15: //   ATTR_TRN  Set Attribute from ATF
      case 0x16: //   ATTR_SET  Set Data to ATF
      case 0x18: //   OBJ_TRN   Super NES OBJ Mode
      default:
        /* Catch all other exceptions so we know what we need to implement */
        // console.log('process!');
        // console.log(this.sgb_command);
        // console.log(this.sgb_data);
        throw 'Unknown!';
    }
  },

  /**
   * Implements the PALXX commands received to the SGB. This function will
   * update the SGB palettes specified with the data provided in the packet
   * transfer.
   *
   * @param {number} p1 the first palette to update
   * @param {number} p2 the second palette to update
   */
  update_pal: function(p1, p2) {
    var i;
    var data = this.sgb_data,
        pals = this.sgbpal;
    // Color 0 specified applies to all palettes
    for (i = 0; i < 4; i++) {
      pals[i * 4] = (data[2] << 8) | data[1];
    }
    for (i = 1; i < 3; i++) {
      pals[p1 * 4 + i] = (data[1 + i * 2 + 1] << 8) | data[1 + i * 2];
    }
    for (i = 0; i < 3; i++) {
      pals[p2 * 4 + i] = (data[1 + (i + 4) * 2 + 1] << 8) |
                          data[1 + (i + 4) * 2];
    }
    // recompile these palettes
    this.update_palettes();
  },

  /**
   * Implements the ATTR_BLK functionality from the SGB. This will define
   * regions of the attribute block to map to certain SGB palettes.
   *
   * The way this works is that there's a 20x18 block which describes all this.
   * Each element in this block corresponds to an 8x8 block on the GB screen.
   * All colors displayed on this 8x8 block on the GB screen are one of
   * four gray shades. Using this mapping:
   *
   *  white -> color 0
   *  light gray -> color 1
   *  dark gray -> color 2
   *  black -> color 3
   *
   * All colors are mapped through the corresponding palette in the SGB. This
   * adds color to the screen.
   *
   * There are only four palettes that modify the screen, and each of these
   * will have four colors (so each gray shade can map to a color).
   */
  attr_blk: function() {
    var i, j, x, y, x1, y1, x2, y2;
    var insidepal, outsidepal, borderpal;
    var insideon,  outsideon,  borderon;
    var atf  = this.sgbatf,
        data = this.sgb_data;

    for (i = 0; i < data[1]; i++) {
      // extract all data from what was received
      var off = 2 + i * 6;
      x1 = data[off + 2];
      y1 = data[off + 3];
      x2 = data[off + 4];
      y2 = data[off + 5];
      insideon  = data[off] & 1;
      borderon  = data[off] & 2;
      outsideon = data[off] & 4;

      insidepal  = data[off + 1] & 3;
      borderpal  = (data[off + 1] >> 2) & 3;
      outsidepal = (data[off + 1] >> 4) & 3;

      // Apply to the attribute file for each block of data
      for (y = 0; y < 18; y++) {
        for (x = 0; x < 20; x++) {
          if (x > x1 && x < x2 && y > y1 && y < y2) {
            if (insideon)
              atf[y * 20 + x] = insidepal;
          } else if (x < x1 || x > x2 || y < y1 || y > y2) {
            if (outsideon)
              atf[y * 20 + x] = outsidepal;
          } else if (borderon) {
            atf[y * 20 + x] = borderpal;
          }
        }
      }
    }
  },

  /**
   * Implements the PAL_SET command received by the SGB. This command will set
   * the current four SGB palettes for the game based on the input given.
   * The data received is indices into the SGB VRAM
   */
  pal_set: function() {
    var i, j;
    var pals = this.sgbpal,   // raw memory of the palettes
        data = this.sgb_data; // data received from game

    // Each tile in SGB RAM is 8 bytes (4 colors)
    var pali = [
      ((data[2] << 8) | data[1]) * 8,
      ((data[4] << 8) | data[3]) * 8,
      ((data[6] << 8) | data[5]) * 8,
      ((data[8] << 8) | data[7]) * 8
    ];

    // i = palette number, j = color number (4 palettes, 4 colors)
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        pals[i * 4 + j] = (this.sgbram[pali[i] + 2 * j + 1] << 8) |
                           this.sgbram[pali[i] + 2 * j];
      }
    }

    // Not really sure what to do with this yet. Make sure we don't miss
    // any functionality by throwing an exception.
    if (data[9] & 0x80) {
      throw 'What is an attribute file?!';
    }
    // Recompile the palettes
    this.update_palettes();
  },

  /**
   * Implements the MASK_EN command received to the SGB. This will be used in
   * toggling whether the screen should continue to be updated or not.
   */
  mask_en: function() {
    var b = this.sgb_data[1];
    if (b == 0) {
      this.input.memory.gpu.lcdon = 1;
    } else if (b == 1) {
      this.input.memory.gpu.lcdon = 0;
    } else if (b == 2) {
      this.input.memory.gpu.white_canvas();
    } else if (b == 3) {
      this.input.memory.gpu.white_canvas();
    }
  },

  /**
   * Implements the PAL_TRN request for the SGB. This will transfer data in
   * VRAM over into the SGB's own VRAM. This cached copy is then used later
   * for loading SGB palettes.
   */
  pal_trn: function() {
    // This is completely different from what's documented on the website, but
    // it's what's implemented in macboyadvance and it seems to work.
    var i, j, k,
        sgbram  = this.sgbram,
        gpu     = this.input.memory.gpu,
        vram    = this.input.memory.gpu.vram;
    var mapbase = gpu.bgmap    ? 0x1c00 : 0x1800;
    var patbase = gpu.tiledata ? 0x0000 : 0x0800;
    var offset  = 0, sgboffset = 0;

    // Why 13x20? Fuck if I know. Talk to the macboyadvance people.
    for (i = 0; i < 13; i++) {
      for (j = 0; j < 20; j++) {
        var tilei = vram[mapbase + offset];
        offset++;
        if (!gpu.tiledata) {
          tilei = tilei > 127 ? tilei - 128 : tilei + 128;
        }
        for (k = 0; k < 16 && sgboffset < 4096; k++)
          sgbram[sgboffset++] = vram[patbase + tilei * 16 + k];
      }
      offset += 12;
    }
  },

  /**
   * Update the SGB palettes based on what's in memory. This only updates the
   * four relevant palettes with their first four colors because these are the
   * only ones that are used in colorizing the game screen.
   */
  update_palettes: function() {
    var i, j, color, data = this.sgbpal;
    for (i = 0; i < 4; i++) {
      for (j = 0; j < 4; j++) {
        // Stored data is 16 bits
        color = data[i * 4 + j];
        this.sgb_pals[i][j] = [
          (color & 0x1f) << 3,
          ((color >> 5) & 0x1f) << 3,
          ((color >> 10) & 0x1f) << 3,
          255
        ];
      }
    }
  }

};
