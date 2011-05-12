/**
 * Emulates the functionality of the GPU of the GB
 *
 * For more information, see: http://nocash.emubase.de/pandocs.htm#videodisplay
 *
 * @constructor
 */
JBA.GPU = function() {
  this.reset();
};

/**
 * Current mode the GPU is in
 * @enum
 */
JBA.GPU.Mode = {
  HBLANK: 0,
  VBLANK: 1,
  RDOAM:  2,
  RDVRAM: 3
};

/**
 * The palette for the monochrome GB. The possible values are:
 *
 * 0 - white
 * 1 - light gray
 * 2 - dark gray
 * 3 - black
 */
JBA.GPU.Palette = [
  [255, 255, 255, 255],
  [192, 192, 192, 255],
  [96, 96, 96, 255],
  [0, 0, 0, 255]
];

JBA.GPU.prototype = {
  /** @type {JBA.Memory} */
  mem: null,

  vram: null,
  oam: null,
  canvas: null,
  image: null,

  clock: 0,

  /**** Registers used by the GPU ******/
  // 0xff40 - LCD control (LCDC) - in order from most to least significant bit
  lcdon: 0,     // LCD monitor turned on or off?
  winmap: 0,    // Window Tile Map Display Select (0=9800-9BFF, 1=9C00-9FFF)
  winon: 0,     // Window Display Enable          (0=Off, 1=On)
  tiledata: 0,  // BG & Window Tile Data Select   (0=8800-97FF, 1=8000-8FFF)
  bgmap: 0,     // BG Tile Map Display Select     (0=9800-9BFF, 1=9C00-9FFF)
  objsize: 0,   // OBJ (Sprite) Size              (0=8x8, 1=8x16)
  objon: 0,     // OBJ (Sprite) Display Enable    (0=Off, 1=On)
  bgon: 0,      // BG Display                     (0=Off, 1=On)

  // 0xff41 - STAT - LCDC Status - starts with bit 6
  lycly: 0,     // LYC=LY Coincidence Interrupt (1=Enable)
  mode2int: 0,  // Mode 2 OAM Interrupt         (1=Enable)
  mode1int: 0,  // Mode 1 V-Blank Interrupt     (1=Enable)
  mode0int: 0,  // Mode 0 H-Blank Interrupt     (1=Enable)
  /** @type {JBA.GPU.Mode} */
  mode: JBA.GPU.Mode.RDOAM,      // bits 0,1 - Mode Flag

  // 0xff42 - SCY - Scroll Y
  scy: 0,
  // 0xff43 - SCX - Scroll X
  scx: 0,
  // 0xff44 - LY - LCDC Y-Coordinate
  ly: 0,
  // 0xff45 - LYC - LY Compare
  lyc: 0,

  // 0xff47 - BGP - BG Palette Data
  bgp: 0,
  // 0xff48 - OBP0 - Object Palette 0 Data
  obp0: 0,
  // 0xff49 - OBP1 - Object Palette 1 Data
  obp1: 0,
  // 0xff4a - WY - Window Y Position
  wy: 0,
  // 0xff4b - WX - Window X Position minus 7
  wx: 0,

  /* Compiled palettes. These are updated when writing to BGP/OBP0/OBP1 */
  _pal: {
    bg: [],
    obp0: [],
    obp1: []
  },

  /**
   * Reset this GPU. This clears all registers, re-initializes all ram banks
   * and such.
   */
  reset: function() {
    var i;
    this.vram = [];
    this.oam  = [];

    /* 8K of vram */
    for (i = 0; i < (8 << 10); i++) this.vram[i] = 0;

    /* 0xffe00 - 0xffe9f is OAM */
    for (i = 0; i < 0xa0; i++) this.oam[i] = 0;
  },

  /**
   * Set the canvas of this GPU to draw on
   *
   * @param {Element} canvas the element which is a canvas.
   */
  set_canvas: function(canvas) {
    this.canvas = canvas.getContext('2d');
    this.image  = this.canvas.createImageData(160, 144);
    this.white_canvas();
  },

  white_canvas: function() {
    for (var i = 0; i < this.image.data.length; i++)
      this.image.data[i] = 0xff;
    this.canvas.putImageData(this.image, 0, 0);
  },

  /**
   * Switch to hblank (mode0)
   * @private
   */
  switch_mode0: function() {
    this.mode = JBA.GPU.Mode.HBLANK;
    this.render_line();
    if (this.mode0int) {
      this.mem._if |= 0x02;
    }
  },

  /**
   * Switch to vblank (mode1)
   * @private
   */
  switch_mode1: function() {
    this.mode = JBA.GPU.Mode.VBLANK;
    if (this.canvas != null) {
      this.canvas.putImageData(this.image, 0, 0);
    }

    /* Deliver the interrupt as both a VBLANK and LCD STAT if necessary */
    this.mem._if |= 0x01;
    if (this.mode1int) {
      this.mem._if |= 0x02;
    }
  },

  /**
   * Switch to rdoam (mode2)
   * @private
   */
  switch_mode2: function() {
    this.mode = JBA.GPU.Mode.RDOAM;
    if (this.mode2int) {
      this.mem._if |= 0x02;
    }
  },

  /**
   * Switch to rdvram (mode3)
   * @private
   */
  switch_mode3: function() {
    this.mode = JBA.GPU.Mode.RDVRAM;
  },

  /**
   * Step the GPU a number of clock cycles forward. The GPU's screen is
   * synchronized with the CPU clock because in a real GB, the two are
   * matched up on the same clock.
   *
   * This function mostly doesn't do anything except for incrementing its own
   * internal counter of clock cycles that have passed. It's a state machine
   * between a few different states. In one state, however, the rendering of a
   * screen occurs, but that doesn't always happen when calling this function.
   *
   * @param {number} clocks the number of clock cycles to advance the counter
   */
  step: function(clocks) {
    // Timings located here:
    //    http://nocash.emubase.de/pandocs.htm#lcdstatusregister

    this.clock += clocks;

    /* If clock >= 456, then we've completed an entire line. This line might
       have been part of a vblank or part of a scanline. */
    if (this.clock >= 456) {
      this.clock -= 456;
      this.ly = (this.ly + 1) % 154; /* 144 lines tall, 10 for a vblank */

      if (this.ly >= 144 && this.mode != JBA.GPU.Mode.VBLANK) {
        this.switch_mode1();
      }

      if (this.ly == this.lyc && this.lycly) {
        this.mem._if |= 0x02;
      }
    }

    /* Hop between modes if we're not in vblank */
    if (this.ly < 144) {
      if (this.clock <= 80) { /* RDOAM takes 80 cycles */
        if (this.mode != JBA.GPU.Mode.RDOAM) { this.switch_mode2(); }
      } else if (this.clock <= 252) { /* RDVRAM takes 172 cycles */
        if (this.mode != JBA.GPU.Mode.RDVRAM) { this.switch_mode3(); }
      } else { /* HBLANK takes rest of time before line rendered */
        if (this.mode != JBA.GPU.Mode.HBLANK) { this.switch_mode0(); }
      }
    }
  },

  /**
   * Render the current line of data into the screen for this GPU. Only the line
   * set by `ly` will be rendered.
   *
   * @private
   */
  render_line: function() {
    if (!this.lcdon) return;

    if (this.bgon) {
      this.render_background();
    }

    if (this.objon) {
      this.render_sprites();
    }
  },

  /** @private */
  render_background: function() {
    var data = this.image.data, vram = this.vram, bgp = this._pal.bg;

    /* vram is from 0x8000-0x9fff
       this.bgmap: 0=9800-9bff, 1=9c00-9fff

       Each map is a 32x32 (1024) array of bytes. Each byte is an index into the
       tile map. Each tile is an 8x8 block of pixels.
       */
    var mapbase = this.bgmap ? 0x1c00 : 0x1800;
    /* Now offset from the base to the right location. We divide by 8 because
       each tile is 8 pixels high. We then multiply by 32 because each row is
       32 bytes long. We can't just multiply by 4 because we need the truncation
       to happen beforehand */
    mapbase += (((this.ly + this.scy) & 0xff) >> 3) * 32;

    /* X and Y location inside the tile itself to paint */
    var y = (this.ly + this.scy) % 8;
    var x = this.scx % 8;

    /* Offset into the canvas to draw. line * width * 4 colors */
    var coff = this.ly * 160 * 4;

    /* this.tiledata is a flag to determine which tile data table to use.
       0=8800-97FF, 1=8000-8FFF. For some odd reason, if tiledata = 0, then
       (&tiles[0]) == 0x9000, where if tiledata = 1, (&tiles[0]) = 0x8000.
       This implies that the indices are treated as signed numbers.*/
    var i = 0;
    var tilebase = this.tiledata ? 0x0000 : 0x0800;

    do {
      /* Backgrounds wrap around, so calculate the offset into the bgmap each
         loop to check for wrapping */
      var mapoff = ((i + this.scx) & 0xff) >> 3;
      /* Each tile is 16 bytes long. Each pair of bytes represents a line of
         pixels (making 8 lines). The first byte is the LSB of the color
         number and the second byte is the MSB of the color.

         For example, for:
            byte 0 : 01011011
            byte 1 : 01101010

         The colors are [0, 2, 2, 1, 3, 0, 3, 1] */
      var tilei = vram[mapbase + mapoff];

      /* Perform wankery with negative addresses here to get it to work out
         in the next section */
      if (this.tiledata == 0) {
        tilei = (tilei + 128) & 0xff;
      }

      /* The address of the pair of bytes we want will be:
            base + (sizeof(tile) = 16) * tilei + (offset into tile = 2 * y)
         Because each tile is 16 bytes and a row represents 2 bytes */
      var byteaddr = tilebase + tilei * 16 + 2 * y;
      var lsb = vram[byteaddr];
      var msb = vram[byteaddr + 1];

      for (; x < 8 && i < 160; x++, i++, coff += 4) {
        var colori =
          (((msb >> (7 - x)) & 1) << 1) |
          (((lsb >> (7 - x)) & 1) << 0);

        var color = bgp[colori];
        data[coff] = color[0];
        data[coff + 1] = color[1];
        data[coff + 2] = color[2];
        data[coff + 3] = color[3];
      }

      x = 0;
    } while (i < 160);
  },

  /** @private */
  render_sprites: function() {
    var data = this.image.data, vram = this.vram, oam = this.oam;

    // More information about sprites is located at:
    // http://nocash.emubase.de/pandocs.htm#vramspriteattributetableoam

    var line = this.ly;
    var zerocolor = this._pal.bg[0][0];

    /* All sprites are located in OAM */
    /* There are 40 sprites in total */
    for (var i = 0; i < 40; i++) {
      var offset = i * 4; /* each sprite is 4 bytes wide */
      var yoff   = oam[offset] - 16;
      var xoff   = oam[offset + 1] - 8;
      var tile   = oam[offset + 2];
      var flags  = oam[offset + 3];

      /* First make sure that this sprite even lands on the current line being
         rendered. The y value in the sprite is the top left corner, so if that
         is below the scanline or the bottom of the sprite (which is 8 pixels
         high) lands below the scanline, this sprite doesn't need to be
         rendered right now */
      if (yoff > line || yoff + 8 <= line) {
        continue;
      }

      /* bit4 is the palette number. 0 = obp0, 1 = obp1 */
      var pal  = (flags & 0x10) ? this._pal.obp1 : this._pal.obp0;
      var coff = (160 * line + xoff) * 4; /* 160px/line, 4 entries/px */

      /* All sprite tile palettes are at 0x8000-0x8fff => start of vram */
      var tileaddr = (tile * 16); /* tiles are 16 bytes each */

      /* bit6 = vertical flip */
      if (flags & 0x40) {
        tileaddr += 2 * (7 - (line - yoff));
      } else {
        tileaddr += 2 * (line - yoff);
      }

      var lsb = vram[tileaddr];
      var msb = vram[tileaddr + 1];

      for (var x = 0; x < 8; x++, coff += 4) {
        /* If these pixels are off screen, don't bother drawing anything */
        if (xoff + x < 0 || xoff + x >= 160) {
          continue;
        }
        /* bit5 is the horizontal flip flag */
        var shift = (flags & 0x20) ? x : 7 - x;
        var colori = (((msb >> shift) & 1) << 1) |
                     (((lsb >> shift) & 1) << 0);

        /* A color index of 0 for sprites means transparent */
        if (colori == 0) {
          continue;
        }

        /* bit7 0=OBJ Above BG, 1=OBJ Behind BG color 1-3. So if this sprite
           has this flag set and the data at this location already contains
           data (nonzero), then don't render this sprite */
        if ((flags & 0x80) && data[coff] != zerocolor) {
          continue;
        }

        var color = pal[colori];
        data[coff]     = color[0];
        data[coff + 1] = color[1];
        data[coff + 2] = color[2];
        data[coff + 3] = color[3];
      }
    }
  },

  rb: function(addr) {
    switch (addr & 0xff) {
      case 0x40:
        return (this.lcdon    << 7) |
               (this.winmap   << 6) |
               (this.winon    << 5) |
               (this.tiledata << 4) |
               (this.bgmap    << 3) |
               (this.objsize  << 2) |
               (this.objon    << 1) |
               this.bgon;

      case 0x41:
        return (this.lycly    << 6) |
               (this.mode2int << 5) |
               (this.mode1int << 4) |
               (this.mode0int << 3) |
               (this.lycly == this.ly ? 1 << 2 : 0) |
               (this.mode);

      case 0x42: return this.scy;
      case 0x43: return this.scx;
      case 0x44: return this.ly;
      case 0x45: return this.lyc;
      // 0x46 is DMA transfer, no reading
      case 0x47: return this.bgp;
      case 0x48: return this.obp0;
      case 0x49: return this.obp1;
      case 0x4a: return this.wy;
      case 0x4b: return this.wx;
    }

    return 0xff;
  },

  wb: function(addr, value) {
    switch (addr & 0xff) {
      case 0x40:
        this.lcdon    = (value >> 7) & 1;
        this.winmap   = (value >> 6) & 1;
        this.winon    = (value >> 5) & 1;
        this.tiledata = (value >> 4) & 1;
        this.bgmap    = (value >> 3) & 1;
        this.objsize  = (value >> 2) & 1;
        this.objon    = (value >> 1) & 1;
        this.bgon     =  value       & 1;
        break;

      case 0x41:
        this.lycly    = (value >> 6) & 1;
        this.mode2int = (value >> 5) & 1;
        this.mode1int = (value >> 4) & 1;
        this.mode0int = (value >> 3) & 1;
        /* The other bits of this register are mode and lycly, but thse are
           read-only and won't be modified */
        break;

      case 0x42: this.scy = value; break;
      case 0x43: this.scx = value; break;
      // 0x44 this.ly is read-only
      case 0x45: this.lyc = value; break;
      case 0x46: this.oam_dma_transfer(value); break;

      case 0x47:
        this.bgp = value;
        this.update_palette(this._pal.bg, value);
        break;
      case 0x48:
        this.obp0 = value;
        this.update_palette(this._pal.obp0, value);
        break;
      case 0x49:
        this.obp1 = value;
        this.update_palette(this._pal.obp1, value);
        break;

      case 0x4a: this.wy = value; break;
      case 0x4b: this.wx = value; break;
    }
  },

  /**
   * Update the cached palettes for BG/OBP0/OBP1. This should be called whenever
   * these registers are modified.
   *
   * @param {Array.<number>} pal the palette to update
   * @param {number} val the value written into the register
   *
   * @private
   */
  update_palette: function(pal, val) {
    // These registers are indices into the actual palette. See
    // http://nocash.emubase.de/pandocs.htm#lcdmonochromepalettes
    pal[0] = JBA.GPU.Palette[(val >> 0) & 0x3];
    pal[1] = JBA.GPU.Palette[(val >> 2) & 0x3];
    pal[2] = JBA.GPU.Palette[(val >> 4) & 0x3];
    pal[3] = JBA.GPU.Palette[(val >> 6) & 0x3];
  },

  /**
   * Trigger a DMA transfer into OAM. This happens whenever something is written
   * to 0xff46. See http://nocash.emubase.de/pandocs.htm#lcdoamdmatransfers for
   * the specifics, but the gist is that the value written to this memory is the
   * upper byte of the addresses which should be copied over into OAM.
   *
   * @param {number} value the byte written to 0xff46
   *
   * @private
   */
  oam_dma_transfer: function(value) {
    /* DMA transfer moves data in regular ram to OAM. It's triggered when
       writing to a specific address in memory. Here's what happens:

         Source:      XX00-XX9F   ;XX in range from 00-F1h
         Destination: FE00-FE9F */

    var orval = (value & 0xff) << 8;
    if (orval > 0xf100) {
      return;
    }

    for (var i = 0; i < 0xa0; i++) {
      this.oam[i] = this.mem.rb(orval | i);
    }
  }
};
