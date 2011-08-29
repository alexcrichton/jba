/**
 * Emulates the functionality of the GPU of the GB
 *
 * For more information, see: http://nocash.emubase.de/pandocs.htm#videodisplay
 *
 * @constructor
 * @implements {Serializable}
 */
JBA.GPU = function() {
  this.reset();
};

var VRAM_SIZE   = 8 << 10; // 8k
var OAM_SIZE    = 0xa0;    // 0xffe00 - 0xffe9f is OAM
var CGB_BP_SIZE = 64;      // 64 bytes of extra memory
var NUM_TILES   = 384;     // number of in-memory tiles

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

  /* The banks that are swappable into vram */
  vrambanks: null,
  /* Selected vram bank */
  vrambank: 0,

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

  // CGB VRAM DMA transfer, more info at:
  // http://nocash.emubase.de/pandocs.htm#lcdvramdmatransferscgbonly
  hdma_src: 0,
  hdma_dst: 0,
  hdma5: 0,

  /* Compiled palettes. These are updated when writing to BGP/OBP0/OBP1. Meant
     for non CGB use only. Each palette is an array of 4 color schemes. Each
     color scheme is one in JBA.GPU.Palette. */
  _pal: {
    bg: new Array(4),
    obp0: new Array(4),
    obp1: new Array(4)
  },

  /* Compiled tiles */
  _tiles: {
    data: new Array(NUM_TILES * 2),     /* Actual compiled tiles */
    need_update: false,                 /* Do we need to recompile any tiles? */
    to_update: new Array(NUM_TILES * 2) /* Which tiles we need to update */
  },

  /* When in CGB mode, the BGP and OBP memory is stored internally and is only
   * accessible through some I/O registers. Each section of memory is 64 bytes
   * and defines 8 palettes of 4 colors each */
  cgb: {
    /* Raw memory */
    bgp: new Uint8Array(CGB_BP_SIZE),
    obp: new Uint8Array(CGB_BP_SIZE),
    /* Index registers into memory */
    bgpi: 0,
    obpi: 0,
    /* Compiled palettes */
    _bgp: [],
    _obp: []
  },

  /**
   * Reset this GPU. This clears all registers, re-initializes all ram banks
   * and such.
   */
  reset: function() {
    var i, j;
     /* CGB supports only 2 banks of VRAM */
    this.vrambank  = 0;
    this.vrambanks = [new Uint8Array(VRAM_SIZE), new Uint8Array(VRAM_SIZE)];
    this.oam = new Uint8Array(OAM_SIZE);

    /* 8K of vram, 2 banks */
    for (i = 0; i < VRAM_SIZE; i++) {
      this.vrambanks[0][i] = 0;
      this.vrambanks[1][i] = 0;
    }
    this.vram = this.vrambanks[0];

    /* 0xffe00 - 0xffe9f is OAM */
    for (i = 0; i < OAM_SIZE; i++) {
      this.oam[i] = 0;
    }

    // 384 tile/bank of VRAM, 2 banks = 384*2 tiles in total
    for (i = 0; i < NUM_TILES * 2; i++) {
      this._tiles.data[i] = [];
      this._tiles.to_update[i] = false;
      for (j = 0; j < 8; j++) {
        this._tiles.data[i][j] = [0, 0, 0, 0, 0, 0, 0, 0];
      }
    }
    this._tiles.need_update = false;

    for (i = 0; i < CGB_BP_SIZE; i++) {
      this.cgb.bgp[i] = 255; // Background colors all initially white
      this.cgb.obp[i] = 0;
    }
    // 8 compiled palettes of colors
    for (i = 0; i < 8; i++) {
      this.cgb._bgp[i] = [];
      this.cgb._obp[i] = [];
      // Each palette has 4 colors, each of 4 components
      for (j = 0; j < 4; j++) {
        this.cgb._bgp[i][j] = [255, 255, 255, 255];
        this.cgb._obp[i][j] = [0, 0, 0, 255];
      }
    }
    this.cgb.bgpi = 0;
    this.cgb.obpi = 0;

    this.mode = JBA.GPU.Mode.RDOAM;
    this.wx = this.wy = this.obp1 = this.obp0 = this.bgp = 0;
    this.lyc = this.ly = this.scx = this.scy = 0;
    this.mode0int = this.mode1int = this.mode2int = this.lycly = 0;
    this.bgon = this.objon = this.objsize = this.bgmap = this.tiledata = 0;
    this.winon = this.winmap = this.lcdon = 0;
    this.clock = 0;

    this.hdma_src = this.hdma_dst = this.hdma5 = 0;

    if (this.canvas) {
      this.white_canvas();
    }
  },

  serialize: function(io) {
    var i;
    for (i = 0; i < VRAM_SIZE; i++) io.wb(this.vrambanks[0][i]);
    for (i = 0; i < VRAM_SIZE; i++) io.wb(this.vrambanks[1][i]);
    for (i = 0; i < OAM_SIZE;  i++) io.wb(this.oam[i]);
    for (i = 0; i < CGB_BP_SIZE; i++) {
      io.wb(this.cgb.bgp[i]);
      io.wb(this.cgb.obp[i]);
    }
    io.wb(this.mode);
    io.wb(this.wx + 7); io.wb(this.wy);
    io.wb(this.obp0); io.wb(this.obp1); io.wb(this.bgp);
    io.wb(this.scx); io.wb(this.scy);
    io.wb(this.ly); io.wb(this.lyc); io.wb(this.lycly);
    io.wb(this.mode0int); io.wb(this.mode1int); io.wb(this.mode2int);
    io.wb(this.bgon); io.wb(this.objon); io.wb(this.objsize);
    io.wb(this.bgmap); io.wb(this.tiledata);
    io.wb(this.winon); io.wb(this.winmap);
    io.wb(this.lcdon);
    io.ww(this.clock);
    io.ww(this.hdma_src);
    io.ww(this.hdma_dst);
    io.wb(this.hdma5);
    io.wb(this.cgb.bgpi);
    io.wb(this.cgb.obpi);
    io.wb(this.vrambank);
  },

  deserialize: function(io) {
    var i;
    for (i = 0; i < VRAM_SIZE; i++) this.vrambanks[0][i] = io.rb();
    for (i = 0; i < VRAM_SIZE; i++) this.vrambanks[1][i] = io.rb();
    for (i = 0; i < OAM_SIZE;  i++) this.oam[i] = io.rb();
    for (i = 0; i < CGB_BP_SIZE; i++) {
      this.cgb.bgp[i] = io.rb();
      this.cgb.obp[i] = io.rb();
    }
    this.mode = io.rb();
    this.wx = io.rb() - 7; this.wy = io.rb();
    this.obp0 = io.rb(); this.obp1 = io.rb(); this.bgp = io.rb();
    this.scx = io.rb(); this.scy = io.rb();
    this.ly = io.rb(); this.lyc = io.rb(); this.lycly = io.rb();
    this.mode0int = io.rb(); this.mode1int = io.rb(); this.mode2int = io.rb();
    this.bgon = io.rb(); this.objon = io.rb(); this.objsize = io.rb();
    this.bgmap = io.rb(); this.tiledata = io.rb();
    this.winon = io.rb(); this.winmap = io.rb();
    this.lcdon = io.rb();
    this.clock = io.rw();
    this.hdma_src = io.rw();
    this.hdma_dst = io.rw();
    this.hdma5 = io.rb();
    this.cgb.bgpi = io.rb();
    this.cgb.obpi = io.rb();
    this.vrambank = io.rb();

    this.vram = this.vrambanks[this.vrambank];
    // Update all compiled tiles now
    this.update_palette(this._pal.bg, this.bgp);
    this.update_palette(this._pal.obp0, this.obp0);
    this.update_palette(this._pal.obp1, this.obp1);
    this.update_cgb_palette(this.cgb._bgp, this.cgb.bgp, this.cgb.bgpi);
    this.update_cgb_palette(this.cgb._obp, this.cgb.obp, this.cgb.obpi);
    for (i = 0; i < NUM_TILES * 2; i++) {
      this._tiles.to_update[i] = true;
    }
    this._tiles.needs_update = true;
    this.update_tileset();
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
    var clock = this.clock + clocks;

    /* If clock >= 456, then we've completed an entire line. This line might
       have been part of a vblank or part of a scanline. */
    if (clock >= 456) {
      clock -= 456;
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
      if (clock <= 80) { /* RDOAM takes 80 cycles */
        if (this.mode != JBA.GPU.Mode.RDOAM) { this.switch_mode2(); }
      } else if (clock <= 252) { /* RDVRAM takes 172 cycles */
        if (this.mode != JBA.GPU.Mode.RDVRAM) { this.switch_mode3(); }
      } else { /* HBLANK takes rest of time before line rendered */
        if (this.mode != JBA.GPU.Mode.HBLANK) { this.switch_mode0(); }
      }
    }

    this.clock = clock;
  },

  /**
   * Render the current line of data into the screen for this GPU. Only the line
   * set by `ly` will be rendered.
   *
   * @private
   */
  render_line: function() {
    if (!this.lcdon) return;

    var scanline = [];

    if (this._tiles.need_update) {
      this.update_tileset();
      this._tiles.need_update = false;
    }

    if (this.bgon) {
      this.render_background(scanline);
    }

    if (this.winon) {
      this.render_window(scanline);
    }

    if (this.objon) {
      this.render_sprites(scanline);
    }
  },

  /** @private */
  update_tileset: function() {
    var to_update = this._tiles.to_update,
        tiles     = this._tiles.data,
        vram      = this.vram;

    for (var i = 0; i < NUM_TILES; i++) {
      if (!to_update[i]) {
        continue;
      }
      to_update[i] = false;

      /* All tiles are located 0x8000-0x97ff => 0x0000-0x17ff in VRAM =>
         that the index is simply an index into raw VRAM */
      var addr = i * 16;

      /* Each tile is 16 bytes long. Each pair of bytes represents a line of
         pixels (making 8 lines). The first byte is the LSB of the color
         number and the second byte is the MSB of the color.

         For example, for:
            byte 0 : 01011011
            byte 1 : 01101010

         The colors are [0, 2, 2, 1, 3, 0, 3, 1] */
      for (var j = 0; j < 8; j++, addr += 2) {
        var lsb = vram[addr];
        var msb = vram[addr + 1];

        /* LSB is the right-most pixel */
        for (var k = 7; k >= 0; k--) {
          tiles[i][j][k] = ((msb & 1) << 1) | (lsb & 1);
          lsb >>= 1;
          msb >>= 1;
        }
      }
    }
  },

  /** @private */
  render_background: function(scanline) {
    var data  = this.image.data,
        bank0 = this.vrambanks[0],
        bank1 = this.vrambanks[1],
        bgp   = this._pal.bg,
        cgb   = this.mem.cgb,
        tiles = this._tiles.data;

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
    var tilebase = this.tiledata == 0 ? 128 : 0;

    do {
      /* Backgrounds wrap around, so calculate the offset into the bgmap each
         loop to check for wrapping */
      var mapoff = ((i + this.scx) & 0xff) >> 3;
      var tilei = bank0[mapbase + mapoff];

      /* tiledata = 0 => tilei is a signed byte, so fix it here */
      if (this.tiledata == 0) {
        tilei = (tilei + 128) & 0xff;
      }

      var row, bgpri = 0, hflip = 0;
      if (cgb) {
        // See http://nocash.emubase.de/pandocs.htm#vrambackgroundmaps for what
        // the attribute byte all maps to

        /* Summary of attributes bits:
            Bit 0-2  Background Palette number  (BGP0-7)
            Bit 3    Tile VRAM Bank number      (0=Bank 0, 1=Bank 1)
            Bit 4    Not used
            Bit 5    Horizontal Flip       (0=Normal, 1=Mirror horizontally)
            Bit 6    Vertical Flip         (0=Normal, 1=Mirror vertically)
            Bit 7    BG-to-OAM Priority    (0=Use OAM priority, 1=BG Priority)
         */

        var attrs = bank1[mapbase + mapoff];

        var tile = tiles[tilebase + tilei + ((attrs >> 3) & 1) * NUM_TILES];
        bgp   = this.cgb._bgp[attrs & 0x7];
        bgpri = attrs & 0x80;
        row   = tile[attrs & 0x40 ? 7 - y : y];
        hflip = attrs & 0x20;

      } else {
        /* Non CGB backgrounds are boring :( */
        row = tiles[tilebase + tilei][y];
      }

      for (; x < 8 && i < 160; x++, i++, coff += 4) {
        var colori  = row[hflip ? 7 - x : x];
        var color   = bgp[colori];
        /* To indicate bg priority, list a color >= 4 */
        scanline[i] = bgpri ? 4 : colori;

        data[coff]     = color[0];
        data[coff + 1] = color[1];
        data[coff + 2] = color[2];
        data[coff + 3] = color[3];
      }

      x = 0;
    } while (i < 160);
  },

  /** @private */
  render_window: function(scanline) {
    // TODO: much less duplication
    if (this.wy >= 144 || this.wx >= 160) {
      return;
    }
    var data  = this.image.data,
        banks = this.vrambanks,
        bgp   = this._pal.bg,
        cgb   = this.mem.cgb,
        tiles = this._tiles.data;

    var mapbase = this.winmap ? 0x1c00 : 0x1800;
    mapbase += ((this.ly + this.wy) >> 3) * 32;

    /* X and Y location inside the tile itself to paint */
    var y = this.ly % 8;
    var x = this.wx % 8;

    /* Offset into the canvas to draw. line * width * 4 colors */
    var coff = (this.ly + this.wy) * 160 * 4;

    /* this.tiledata is a flag to determine which tile data table to use.
       0=8800-97FF, 1=8000-8FFF. For some odd reason, if tiledata = 0, then
       (&tiles[0]) == 0x9000, where if tiledata = 1, (&tiles[0]) = 0x8000.
       This implies that the indices are treated as signed numbers.*/
    var i = this.wx;
    var tilebase = this.tiledata == 0 ? 128 : 0;

    do {
      /* Backgrounds wrap around, so calculate the offset into the bgmap each
         loop to check for wrapping */
      var mapoff = (i) >> 3;
      var tilei = banks[0][mapbase + mapoff];

      /* tiledata = 0 => tilei is a signed byte, so fix it here */
      if (this.tiledata == 0) {
        tilei = (tilei + 128) & 0xff;
      }

      var row, bgpri = false, hflip = false;
      if (cgb) {
        var attrs = banks[1][mapbase + mapoff];

        var tile = tiles[tilebase + tilei + ((attrs >> 3) & 1) * NUM_TILES];
        bgp   = this.cgb._bgp[attrs & 0x7];
        bgpri = attrs & 0x80;
        row   = tile[attrs & 0x40 ? 7 - y : y];
        hflip = attrs & 0x20;

      } else {
        /* Non CGB backgrounds are boring :( */
        row = tiles[tilebase + tilei][y];
      }

      for (; x < 8 && i < 160; x++, i++, coff += 4) {
        var colori  = row[hflip ? 7 - x : x];
        var color   = bgp[colori];
        /* To indicate bg priority, list a color >= 4 */
        scanline[i] = bgpri ? 4 : row[colori];

        data[coff]     = color[0];
        data[coff + 1] = color[1];
        data[coff + 2] = color[2];
        data[coff + 3] = color[3];
      }

      x = 0;
    } while (i < 160);
  },

  /** @private */
  render_sprites: function(scanline) {
    var data  = this.image.data,
        banks = this.vrambanks,
        oam   = this.oam,
        cgb   = this.mem.cgb,
        tiles = this._tiles.data;

    // More information about sprites is located at:
    // http://nocash.emubase.de/pandocs.htm#vramspriteattributetableoam

    var line = this.ly;
    var zerocolor = this._pal.bg[0][0];
    /* If the objsize bit in LCDC is set, sprites are 8x16 */
    var ysize = this.objsize ? 16 : 8;

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
      if (yoff > line || yoff + ysize <= line || xoff <= -8 || xoff >= 160) {
        continue;
      }

      /* 8x16 tiles always use adjacent tile indices. If we're in 8x16 mode and
         this sprite needs the second tile, add 1 to the tile index and change
         yoff so it looks like we're rendering that tile */
      if (ysize == 16) {
        tile &= 0xfe; /* Ignore lowest bit */
        if (line - yoff >= 8) {
          tile += 1;
          yoff += 8;
        }
      }

      var coff = (160 * line + xoff) * 4; /* 160px/line, 4 entries/px */

      /* All sprite tile palettes are at 0x8000-0x8fff => start of vram.
         If we're in CGB mode, then we get our palette from the spite flags. We
         also need to take into account the tile being in a different bank.

         Otherwise, we just use the tile index as a raw index. */
      var pal, tiled;
      if (cgb) {
        tiled = tiles[((flags >> 3) & 1 * NUM_TILES) + tile];
        pal   = this.cgb._obp[flags & 0x3];
      } else {
        /* bit4 is the palette number. 0 = obp0, 1 = obp1 */
        pal   = (flags & 0x10) ? this._pal.obp1 : this._pal.obp0;
        tiled = tiles[tile];
      }

      /* bit6 is the vertical flip bit */
      var row = flags & 0x40 ? tiled[7 - (line - yoff)] : tiled[line - yoff];

      for (var x = 0; x < 8; x++, coff += 4) {
        /* If these pixels are off screen, don't bother drawing anything. Also,
           if the background tile at this pixel has priority, don't render this
           sprite at all. */
        if (xoff + x < 0 || xoff + x >= 160 || scanline[x + xoff] > 3) {
          continue;
        }
        /* bit5 is the horizontal flip flag */
        var colori = row[(flags & 0x20) ? 7 - x : x];

        /* A color index of 0 for sprites means transparent */
        if (colori == 0) {
          continue;
        }

        /* bit7 0=OBJ Above BG, 1=OBJ Behind BG color 1-3. So if this sprite
           has this flag set and the data at this location already contains
           data (nonzero), then don't render this sprite */
        if ((flags & 0x80) && scanline[xoff + x] != 0) {
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
      case 0x4b: return this.wx + 7;
      case 0x4f: return this.vrambank;

      // See http://nocash.emubase.de/pandocs.htm#lcdvramdmatransferscgbonly
      case 0x51: return this.hdma_src >> 8;
      case 0x52: return this.hdma_src & 0xff;
      case 0x53: return this.hdma_dst >> 8;
      case 0x54: return this.hdma_dst & 0xff;
      case 0x55: return this.hdma5;

      // See http://nocash.emubase.de/pandocs.htm#lcdcolorpalettescgbonly
      case 0x68: return this.cgb.bgpi;
      case 0x69: return this.cgb.bgp[this.cgb.bgpi & 0x3f];
      case 0x6a: return this.cgb.obpi;
      case 0x6b: return this.cgb.obp[this.cgb.obpi & 0x3f];
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
      case 0x4b: this.wx = value - 7; break;

      case 0x4f:
        if (this.mem.cgb) {
          this.vrambank = value & 1;
          this.vram = this.vrambanks[this.vrambank];
        }
        break;

      // See http://nocash.emubase.de/pandocs.htm#lcdvramdmatransferscgbonly
      case 0x51: this.hdma_src = (this.hdma_src & 0x00ff) | (value << 8); break;
      case 0x52: this.hdma_src = (this.hdma_src & 0xff00) | value;        break;
      case 0x53: this.hdma_dst = (this.hdma_dst & 0x00ff) | (value << 8); break;
      case 0x54: this.hdma_dst = (this.hdma_dst & 0xff00) | value;        break;
      case 0x55: this.hdma_dma_transfer(value); break;

      // See http://nocash.emubase.de/pandocs.htm#lcdcolorpalettescgbonly

      /* The two indices/palette memories work the same way. The index's lower
       * 6 bits are the actual index, and bit 7 indicates that the index should
       * be automatically incremented whenever this memory is written to. When
       * dealing with the index, make sure to mask out bit 6. */
      case 0x68: this.cgb.bgpi = value & 0xbf; break;
      case 0x6a: this.cgb.obpi = value & 0xbf; break;
      case 0x69:
        this.cgb.bgp[this.cgb.bgpi & 0x3f] = value;
        this.update_cgb_palette(this.cgb._bgp, this.cgb.bgp, this.cgb.bgpi);
        if (this.cgb.bgpi & 0x80) {
          this.cgb.bgpi = (this.cgb.bgpi + 1) & 0xbf;
        }
        break;
      case 0x6b:
        this.cgb.obp[this.cgb.obpi & 0x3f] = value;
        this.update_cgb_palette(this.cgb._obp, this.cgb.obp, this.cgb.obpi);
        if (this.cgb.obpi & 0x80) {
          this.cgb.obpi = (this.cgb.obpi + 1) & 0xbf;
        }
        break;
    }
  },

  /**
   * Register that a tile needs to be updated.
   *
   * @param {number} addr the address of the tile that needs to be updated.
   */
  update_tile: function(addr) {
    var tilei = (addr & 0x1fff) >> 4; /* each tile is 16 bytes, divide by 16 */
    tilei += this.vrambank * NUM_TILES;
    this._tiles.need_update = true;
    this._tiles.to_update[tilei] = true;
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
   * Update the cached CGB palette that was just written to
   *
   * @param {*} pal the cgb._(obp|bgp) palette object
   * @param {Array.<number>} mem the cgb.(obp|bgp) array object
   * @param {number} addr the address that was just written to (obpi|bgpi)
   */
  update_cgb_palette: function(pal, mem, addr) {
    // See http://nocash.emubase.de/pandocs.htm#lcdcolorpalettescgbonly
    var pali = (addr & 0x3f) >> 3; /* divide by 8 (size of one palette) */
    var colori = (addr & 0x7) >> 1; /* 2 bytes per color, divide by 2 */

    var byte1 = mem[(addr & 0x3e)];
    var byte2 = mem[(addr & 0x3e) + 1];

    var color = pal[pali][colori];

    // Bits 0-7 in byte1, others in byte2
    //  Bit 0-4   Red Intensity   (00-1F)
    //  Bit 5-9   Green Intensity (00-1F)
    //  Bit 10-14 Blue Intensity  (00-1F)
    color[0] = byte1 & 0x1f;
    color[1] = (byte1 >> 5) | ((byte2 & 0x3) << 3);
    color[2] = (byte2 >> 2) & 0x1f;
    color[3] = 255;

    for (var i = 0; i < 3; i++) {
      color[i] = (color[i] * 0xff) >> 5;
    }
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
  },

  /**
   * When in CGB mode, this triggers a DMA transfer to VRAM. For more info, see
   * http://nocash.emubase.de/pandocs.htm#lcdvramdmatransferscgbonly
   *
   * @param {number} value the byte written to 0xff55
   */
  hdma_dma_transfer: function(value) {
    var src = this.hdma_src & 0xfff0;
    var dst = this.hdma_dst & 0x1ff0;

    if ((src > 0x7ff0 && src < 0xa000) || src > 0xdff0 ||
          dst < 0x8000 || dst > 0x9ff0) {
      return;
    }

    throw 'Implement HDMA DMA transfer!';
  }
};
