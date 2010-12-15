module('GPU', {
  setup: function() {
    window.gpu = new JBA.GPU();
  },

  teardown: function() {
    delete window.gpu;
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

  gpu.lycly    = 1;
  gpu.mode2int = 0;
  gpu.mode1int = 1;
  gpu.mode0int = 1;
  gpu.coinc    = 0;
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
  equals(gpu.coinc, 0);
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
  gpu.mem = new JBA.Memory();
  gpu.mem.ramon = 1;

  gpu.mem.wb(0xa087, 0x32);
  gpu.wb(0xff46, 0xa0);

  equals(gpu.oam[0x87], 0x32);
});
