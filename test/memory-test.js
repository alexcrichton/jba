module('Memory');

test('initialization of memory', function() {
  var mem = new JBA.Memory();

  equals(mem.memory.length, 65536);

  equals(mem.memory[JBA.TIMA],  0x00);
  equals(mem.memory[JBA.TMA],   0x00);
  equals(mem.memory[JBA.TAC],   0x00);
  equals(mem.memory[JBA.NR10],  0x80);
  equals(mem.memory[JBA.NR11],  0xBF);
  equals(mem.memory[JBA.NR12],  0xF3);
  equals(mem.memory[JBA.NR14],  0xBF);
  equals(mem.memory[JBA.NR21],  0x3F);
  equals(mem.memory[JBA.NR22],  0x00);
  equals(mem.memory[JBA.NR24],  0xBF);
  equals(mem.memory[JBA.NR31],  0xFF);
  equals(mem.memory[JBA.NR32],  0x9F);
  equals(mem.memory[JBA.NR33],  0xBF);
  equals(mem.memory[JBA.NR41],  0xFF);
  equals(mem.memory[JBA.NR42],  0x00);
  equals(mem.memory[JBA.NR43],  0x00);
  equals(mem.memory[JBA.NR30],  0xBF);
  equals(mem.memory[JBA.NR50],  0x77);
  equals(mem.memory[JBA.NR51],  0xF3);
  equals(mem.memory[JBA.NR52],  0xF1);
  equals(mem.memory[JBA.LCDC],  0x91);
  equals(mem.memory[JBA.STAT],  0x02);
  equals(mem.memory[JBA.SCY],   0x00);
  equals(mem.memory[JBA.SCX],   0x00);
  equals(mem.memory[JBA.LYC],   0x00);
  equals(mem.memory[JBA.BGP],   0xFC);
  equals(mem.memory[JBA.OBP0],  0xFF);
  equals(mem.memory[JBA.OBP1],  0xFF);
  equals(mem.memory[JBA.WY],    0x00);
  equals(mem.memory[JBA.WX],    0x00);
  equals(mem.memory[JBA.IE],    0x00);
});

test('reading and writing from memory', function() {
  var mem = new JBA.Memory();

  mem.write(0x8100, 3);
  equals(mem.read(0x8100), 3);

  mem.write(0x8104, 0xf2);
  equals(mem.read(0x8104), 0xf2);
});

test('reading memory that belongs to the rom', function() {
  var mem = new JBA.Memory();
  mem.rom = {read: function(_){ return 3; }};

  equals(mem.read(0x200), 3);
  equals(mem.read(0xa000), 3);
  equals(mem.read(0xb314), 3);
  equals(mem.read(0xbfff), 3);
});

test('writing into memory that belongs to the rom', function() {
  expect(4);

  var mem = new JBA.Memory();
  mem.rom = {write: function(a, b){ ok(true, 'Wrote to the rom!'); }};

  mem.write(0x200, 3);
  mem.write(0xa000, 3);
  mem.write(0xb314, 3);
  mem.write(0xbfff, 3);
});
