/**
 * Emulates the functionality of the GPU of the GB
 *
 * For more information, see: http://nocash.emubase.de/pandocs.htm#videodisplay
 *
 * @param {JBA.Memory} mem the memory this GPU is attached to
 * @constructor
 */
JBA.GPU = function(mem) {
  this.mem = mem;
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

JBA.GPU.prototype = {
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
  coinc: 0,     // Coincidence Flag  (0:LYC<>LY, 1:LYC=LY)
  /** @type {JBA.GPU.Mode} */
  mode: JBA.GPU.HBLANK,      // bits 0,1 - Mode Flag

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

  reset: function() {
    this.vram = [];
    this.oam  = [];
    for (var i = 0; i < (8 << 10); i++) this.vram[i] = 0;
    for (i = 0; i < 0xa0; i++) this.oam[i] = 0;

    this.canvas = document.getElementById('gb').getContext('2d');
    this.image = this.canvas.createImageData(160, 144);
  },

  white_canvas: function() {
    for (var i = 0; i < this.image.data.length; i++)
      this.image.data[i] = 0xff;
    this.canvas.putImageData(this.image, 0, 0);
  },

  step: function(clocks) {
    // Timings located here:
    //    http://imrannazar.com/GameBoy-Emulation-in-JavaScript:-GPU-Timings

    this.clock += clocks;

    switch (this.mode) {
      case JBA.GPU.Mode.HBLANK: // 51 CPU cycles here
        if (this.clock >= 51) {
          if (this.ly == 143) {
            this.mode = JBA.GPU.Mode.VBLANK;
            this.canvas.putImageData(this.image, 0, 0);
          } else {
            this.mode = JBA.GPU.Mode.RDOAM;
          }
          this.ly++;
          this.clock = 0;
        }
        break;

      case JBA.GPU.Mode.VBLANK: // 114 CPU cycles per line, 10 more lines
        if (this.clock >= 114) {
          this.ly++;
          this.clock = 0;

          if (this.ly > 153) {
            this.mode = JBA.GPU.Mode.RDOAM;
            this.ly   = 0;
          }
        }
        break;

      case JBA.GPU.Mode.RDOAM: // 20 cycles here
        if (this.clock >= 20) {
          this.mode  = JBA.GPU.Mode.RDVRAM;
          this.clock = 0;
        }
        break;

      case JBA.GPU.Mode.RDVRAM: // 43 cycles here
        if (this.clock >= 43) {
          this.mode = JBA.GPU.Mode.HBLANK;
          this.clock = 0;
          this.render_line();
        }
        break;
    }
  },

  /** @private */
  render_line: function() {
    if (!this.lcdon) return;
    if (this.bgon) {

    }

    if (this.objon) {

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
               (this.coinc    << 2) |
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
        this.coinc    = (value >> 2) & 1;
        this.mode     =  value       & 0x3;
        break;

      case 0x42: this.scy = value; break;
      case 0x43: this.scx = value; break;
      // 0x44 this.ly is read-only
      case 0x45: this.lyc = value; break;
      case 0x46: this.oam_dma_transfer(value); break;
      case 0x47: this.bgp  = value; break;
      case 0x48: this.obp0 = value; break;
      case 0x49: this.obp1 = value; break;
      case 0x4a: this.wy   = value; break;
      case 0x4b: this.wx   = value; break;
    }
  },

  /** @private */
  oam_dma_transfer: function(value) {
    var orval = (value & 0xff) << 8;
    for (var i = 0; i < 0xa0; i++) {
      this.oam[i] = this.mem.rb(orval | i);
    }
  }
};
