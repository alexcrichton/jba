var BGP  = 0xff47,
    LCDC = 0xff40,
    SCY = 0xff42,
    SCX = 0xff43;

var LCDON   = 0x80,
    TILESEL = 0x10,
    BGSEL   = 0x08,
    OBJON   = 0x02,
    BGON    = 0x01;

module('GPU', {
  setup: function() {
    window.gpu = new JBA.GPU();
    window.mem = new JBA.Memory();
    gpu.mem = mem;
    mem.gpu = gpu;
    gpu.mem.ramon = 1;
    gpu.reset();
    gpu.image = {data: []};
  },

  teardown: function() {
    delete window.gpu;
    delete window.mem;
  }
});

test('reading from GPU registers', function() {
  gpu.lcdon    = 1;
  gpu.winmap   = 0;
  gpu.winon    = 1;
  gpu.tiledata = 1;
  gpu.bgmap    = 1;
  gpu.objsize  = 0;
  gpu.objon    = 0;
  gpu.bgon     = 1;
  equals(gpu.rb(0xff40), 0xb9);

  gpu.ly = 0; /* So coinc flag is 0 */
  gpu.lycly    = 1;
  gpu.mode2int = 0;
  gpu.mode1int = 1;
  gpu.mode0int = 1;
  gpu.mode     = 2;
  equals(gpu.rb(0xff41), 0x5a);

  gpu.scy = 0x98;
  gpu.scx = 0x32;
  equals(gpu.rb(0xff42), 0x98);
  equals(gpu.rb(0xff43), 0x32);

  gpu.ly  = 0x89;
  gpu.lyc = 0x42;
  equals(gpu.rb(0xff44), 0x89);
  equals(gpu.rb(0xff45), 0x42);

  gpu.bgp  = 0x42;
  gpu.obp0 = 0xd8;
  gpu.obp1 = 0x20;
  equals(gpu.rb(0xff47), 0x42);
  equals(gpu.rb(0xff48), 0xd8);
  equals(gpu.rb(0xff49), 0x20);

  gpu.wy = 0x42;
  gpu.wx = 0x93;
  equals(gpu.rb(0xff4a), 0x42);
  equals(gpu.rb(0xff4b), 0x93);
});

test('writing the GPU registers', function() {
  gpu.wb(0xff40, 0xb9);
  equals(gpu.lcdon, 1);
  equals(gpu.winmap, 0);
  equals(gpu.winon, 1);
  equals(gpu.tiledata, 1);
  equals(gpu.bgmap, 1);
  equals(gpu.objsize, 0);
  equals(gpu.objon, 0);
  equals(gpu.bgon, 1);

  gpu.wb(0xff41, 0x5a);
  equals(gpu.lycly, 1);
  equals(gpu.mode2int, 0);
  equals(gpu.mode1int, 1);
  equals(gpu.mode0int, 1);
  equals(gpu.mode, 2);

  gpu.wb(0xff42, 0x98);
  gpu.wb(0xff43, 0x32);
  equals(gpu.scy, 0x98);
  equals(gpu.scx, 0x32);

  gpu.wb(0xff44, 0x89);
  gpu.wb(0xff45, 0x42);
  equals(gpu.ly, 0x00); // this should be read only
  equals(gpu.lyc, 0x42);

  gpu.wb(0xff47, 0x42);
  gpu.wb(0xff48, 0xd8);
  gpu.wb(0xff49, 0x20);
  equals(gpu.bgp, 0x42);
  equals(gpu.obp0, 0xd8);
  equals(gpu.obp1, 0x20);

  gpu.wb(0xff4a, 0x42);
  gpu.wb(0xff4b, 0x93);
  equals(gpu.wy, 0x42);
  equals(gpu.wx, 0x93);
});

test('DMA transfers', function() {
  /* This first byte should by copied in the DMA transfer */
  mem.wb(0xa087, 0x32);
  gpu.wb(0xff46, 0xa0); /* trigger the transfer */

  equals(gpu.oam[0x87], 0x32); /* Make sure the byte was copied */
});

test('clocking between modes', function() {
  gpu.render_line = function(){};

  gpu.mode = JBA.GPU.Mode.RDOAM;
  gpu.step(1); // Don't change the mode
  equals(gpu.mode, JBA.GPU.Mode.RDOAM);

  gpu.step(19); // Change the mode now
  equals(gpu.mode, JBA.GPU.Mode.RDVRAM);

  gpu.step(42);
  equals(gpu.mode, JBA.GPU.Mode.RDVRAM);

  gpu.step(1);
  equals(gpu.mode, JBA.GPU.Mode.HBLANK);

  gpu.step(51);
  equals(gpu.mode, JBA.GPU.Mode.RDOAM);

  gpu.mode = JBA.GPU.Mode.HBLANK;
  gpu.ly   = 143;
  gpu.step(51);
  equals(gpu.mode, JBA.GPU.Mode.VBLANK);

  for (var i = 0; i < 10; i++) gpu.step(114);

  equals(gpu.mode, JBA.GPU.Mode.RDOAM);
});

test('painting the background', function() {
  var i;

  /* BGP is a mapping of indices to shades. Each 2 bits in the mapping specify
     a shade of grey (0=white, 3=black). Specify a reverse mapping here where
     obp[0] = 3, obp[1] = 2, ... */
  mem.wb(BGP, 0x1b); /* 0b_0001_1011 */

  /* Now paint in that the 10th line needs 8 pixels of each color */
  mem.wb(SCX, 5);
  mem.wb(SCY, 3);
  /* We're going to be simulating rendering line 10. This means that we're
     actually rendering line 13, offset 5 pixels in from the left. */

  /* Fill in the bgmap data first
     - bgmap = 0 => bgmap base = 0x9800
     - 13 lines in where each line is 32 bytes
     - each tile is 8 pixels high, so we're on second row */
  mem.wb(0x9800 + 1 * 32, 0); /* first 8 pixels are tile 0 */
  mem.wb(0x9800 + 1 * 32 + 1, 1); /* next 8 pixels are tile 1 */
  mem.wb(0x9800 + 1 * 32 + 2, 2); /* next 8 pixels are tile 2 */
  mem.wb(0x9800 + 1 * 32 + 3, 3); /* next 8 pixels are tile 3 */
  mem.wb(0x9800 + 1 * 32 + 4, 0); /* next 8 pixels are tile 0 */

  /* Now fill in the tile data for tiles 0,1,2,3
      - tiledata = 0 => tile base = 0x8800 => 0x0800 in vram
      - if tiledata = 0, numbers are 2's complement, and zero index is at 0x9000
      - Mappings are weird. Each tile is 2 bytes. Each byte has 8 bits to define
        8 pixels, but each tile is 8 pixels wide. This means that the two bytes
        are interpreted as such:

          byte[0] = a7 a6 a5 a4 a3 a2 a1 a0
          byte[1] = b7 b6 b5 b4 b3 b2 b1 b0

        and the color for the pixels is:
            [ {b7,a7}, {b6,a6}, ...]
        where {b,a} is a binary number with digits b,a
   */

  /* Data for tile 0, each pixel is color 0 */
  for (i = 0; i < 8; i++) { /* 8 rows of pixels */
    mem.wb(0x9000 + i * 2, 0x00);
    mem.wb(0x9000 + i * 2 + 1, 0x00);
  }

  /* Data for tile 1, each pixel is color 1 */
  for (i = 0; i < 8; i++) {
    mem.wb(0x9010 + i * 2, 0xff);
    mem.wb(0x9010 + i * 2 + 1, 0x00);
  }

  /* Data for tile 2, each pixel is color 2 */
  for (i = 0; i < 8; i++) {
    mem.wb(0x9020 + i * 2, 0x00);
    mem.wb(0x9020 + i * 2 + 1, 0xff);
  }

  /* Data for tile 3, each pixel is color 3 */
  for (i = 0; i < 8; i++) {
    mem.wb(0x9030 + i * 2, 0xff);
    mem.wb(0x9030 + i * 2 + 1, 0xff);
  }

  gpu.ly = 10;
  var offset = 10 * 160 * 4;
  for (i = 0; i < 160 * 4; i++)
    gpu.image.data[offset + i] = 10;

  /* disable everything, so previous data should not be overwritten */
  gpu.wb(LCDC, 0);
  gpu.render_line();
  for (i = 0; i < 160 * 4; i++)
    equals(gpu.image.data[offset], 10);

  gpu.wb(LCDC, LCDON | BGON);
  gpu.render_line();

  /* First 3 pixels are all black. SCX = 5 so only 3 pixels of first tile should
     be shown */
  for (i = 0; i < 3; i++) {
    equals(gpu.image.data[offset + i * 4], 0);
    equals(gpu.image.data[offset + i * 4 + 1], 0);
    equals(gpu.image.data[offset + i * 4 + 2], 0);
    equals(gpu.image.data[offset + i * 4 + 3], 255);
  }

  /* Next 8 pixels should all be next color (dark grey) */
  for (i = 3; i < 11; i++) {
    equals(gpu.image.data[offset + i * 4], 96);
    equals(gpu.image.data[offset + i * 4 + 1], 96);
    equals(gpu.image.data[offset + i * 4 + 2], 96);
    equals(gpu.image.data[offset + i * 4 + 3], 255);
  }

  /* Next 8 pixels should all be next color (light grey) */
  for (i = 11; i < 19; i++) {
    equals(gpu.image.data[offset + i * 4], 192);
    equals(gpu.image.data[offset + i * 4 + 1], 192);
    equals(gpu.image.data[offset + i * 4 + 2], 192);
    equals(gpu.image.data[offset + i * 4 + 3], 255);
  }

  /* Next 8 pixels should all be next color (light grey) */
  for (i = 19; i < 27; i++) {
    equals(gpu.image.data[offset + i * 4], 255);
    equals(gpu.image.data[offset + i * 4 + 1], 255);
    equals(gpu.image.data[offset + i * 4 + 2], 255);
    equals(gpu.image.data[offset + i * 4 + 3], 255);
  }

  /* Finally, the next 8 should be black */
  for (i = 27; i < 35; i++) {
    equals(gpu.image.data[offset + i * 4], 0);
    equals(gpu.image.data[offset + i * 4 + 1], 0);
    equals(gpu.image.data[offset + i * 4 + 2], 0);
    equals(gpu.image.data[offset + i * 4 + 3], 255);
  }

});
