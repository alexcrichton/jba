module('Z80 - Registers');

test('initialized values', function() {
  var reg = new Z80.Registers();

  equals(reg.u8regs[Z80.A], 0x11);
  equals(reg.u8regs[Z80.F], 0xb0);
  equals(reg.u8regs[Z80.B], 0x00);
  equals(reg.u8regs[Z80.C], 0x13);
  equals(reg.u8regs[Z80.D], 0x00);
  equals(reg.u8regs[Z80.E], 0xd8);
  equals(reg.u8regs[Z80.H], 0x01);
  equals(reg.u8regs[Z80.L], 0x4d);

  equals(reg.u16regs[Z80.PC], 0x100);
  equals(reg.u16regs[Z80.SP], 0xfffe);
});

test('serialization/deserialization', function() {
  var reg = new Z80.Registers();
  reg.u8regs[Z80.A] = 0x54; reg.u8regs[Z80.F] = 0x84;
  reg.u8regs[Z80.B] = 0x42; reg.u8regs[Z80.C] = 0x82;
  reg.u8regs[Z80.D] = 0xf8; reg.u8regs[Z80.E] = 0x32;
  reg.u8regs[Z80.H] = 0x21; reg.u8regs[Z80.L] = 0x89;
  reg.u16regs[Z80.PC] = 0x3910;
  reg.u16regs[Z80.SP] = 0x4224;

  var io = new JBA.StringIO();
  reg.serialize(io);
  io.rewind();
  var reg2 = new Z80.Registers();
  reg2.deserialize(io);

  equals(reg2.u8regs[Z80.A], 0x54); equals(reg2.u8regs[Z80.F], 0x84);
  equals(reg2.u8regs[Z80.B], 0x42); equals(reg2.u8regs[Z80.C], 0x82);
  equals(reg2.u8regs[Z80.D], 0xf8); equals(reg2.u8regs[Z80.E], 0x32);
  equals(reg2.u8regs[Z80.H], 0x21); equals(reg2.u8regs[Z80.L], 0x89);
  equals(reg2.u16regs[Z80.PC], 0x3910);
  equals(reg2.u16regs[Z80.SP], 0x4224);
});
