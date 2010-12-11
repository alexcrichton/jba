module('Registers');

test('initializes all registers correctly', function() {
  var registers = new JBA.Registers();

  equal(registers.get_register(JBA.Reg.PC), 0x100);
  equal(registers.get_register(JBA.Reg.SP), 0xfffe);
  equal(registers.get_register(JBA.Reg.AF), 0x1b0);
  equal(registers.get_register(JBA.Reg.BC), 0x13);
  equal(registers.get_register(JBA.Reg.DE), 0xd8);
  equal(registers.get_register(JBA.Reg.HL), 0x14d);
  equal(registers.get_register(JBA.Reg.A), 0x1);
  equal(registers.get_register(JBA.Reg.B), 0x0);
  equal(registers.get_register(JBA.Reg.C), 0x13);
  equal(registers.get_register(JBA.Reg.D), 0x0);
  equal(registers.get_register(JBA.Reg.E), 0xd8);
  equal(registers.get_register(JBA.Reg.F), 0xb0);
  equal(registers.get_register(JBA.Reg.H), 0x1);
  equal(registers.get_register(JBA.Reg.L), 0x4d);
});

test('setting register values', function() {
  var reg = new JBA.Registers();

  reg.set_register(JBA.Reg.PC, 0x02);
  equal(reg.get_register(JBA.Reg.PC), 0x02);

  reg.set_register(JBA.Reg.SP, 0x98);
  equal(reg.get_register(JBA.Reg.SP), 0x98);

  reg.set_register(JBA.Reg.A, 0x02);
  equal(reg.get_register(JBA.Reg.A), 0x02);

  reg.set_register(JBA.Reg.B, 0x4f);
  equal(reg.get_register(JBA.Reg.B), 0x4f);

  reg.set_register(JBA.Reg.E, 0xab);
  equal(reg.get_register(JBA.Reg.E), 0xab);

  reg.set_register(JBA.Reg.H, 0x98);
  equal(reg.get_register(JBA.Reg.H), 0x98);

  reg.set_register(JBA.Reg.AF, 0x198);
  equal(reg.get_register(JBA.Reg.AF), 0x198);
  equal(reg.get_register(JBA.Reg.A), 0x1);
  equal(reg.get_register(JBA.Reg.F), 0x98);

  reg.set_register(JBA.Reg.HL, 0xdead);
  equal(reg.get_register(JBA.Reg.HL), 0xdead);
  equal(reg.get_register(JBA.Reg.H), 0xde);
  equal(reg.get_register(JBA.Reg.L), 0xad);
});

test('setting flags in the registers', function() {
  var reg = new JBA.Registers();

  reg.set_flag(JBA.Reg.f_Z, 1);
  reg.set_flag(JBA.Reg.f_N, 1);
  reg.set_flag(JBA.Reg.f_H, 1);
  reg.set_flag(JBA.Reg.f_C, 1);
  equal(reg.get_flag(JBA.Reg.f_Z), 1);
  equal(reg.get_flag(JBA.Reg.f_N), 1);
  equal(reg.get_flag(JBA.Reg.f_H), 1);
  equal(reg.get_flag(JBA.Reg.f_C), 1);

  equal(reg.get_register(JBA.Reg.F), 0xf0);

  reg.set_flag(JBA.Reg.f_Z, 1);
  reg.set_flag(JBA.Reg.f_N, 0);
  reg.set_flag(JBA.Reg.f_H, 1);
  reg.set_flag(JBA.Reg.f_C, 0);
  equal(reg.get_register(JBA.Reg.F), 0xa0);
});

test('setting/getting invalid registers and flags', function() {
  var reg = new JBA.Registers();

  raises(function(){ reg.get_flag(13); });
  raises(function(){ reg.set_flag(17, 2); });

  raises(function(){ reg.get_register(0x102); });
  raises(function(){ reg.set_register(0x201, 2); });
});
