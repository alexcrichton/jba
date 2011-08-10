module('Z80 - Registers');

test('initialized values', function() {
  var reg = new Z80.Registers();

  equals(reg.a, 0x11);
  equals(reg.f, 0xb0);
  equals(reg.b, 0x00);
  equals(reg.c, 0x13);
  equals(reg.d, 0x00);
  equals(reg.e, 0xd8);
  equals(reg.h, 0x01);
  equals(reg.l, 0x4d);

  equals(reg.pc, 0x100);
  equals(reg.sp, 0xfffe);
});

test('serialization/deserialization', function() {
  var reg = new Z80.Registers();
  reg.a = 0x54; reg.f = 0x84;
  reg.b = 0x42; reg.c = 0x82;
  reg.d = 0xf8; reg.e = 0x32;
  reg.h = 0x21; reg.l = 0x89;
  reg.pc = 0x3910;
  reg.sp = 0x4224;

  var io = new JBA.StringIO();
  reg.serialize(io);
  io.rewind();
  var reg2 = new Z80.Registers();
  reg2.deserialize(io);

  equals(reg2.a, 0x54); equals(reg2.f, 0x84);
  equals(reg2.b, 0x42); equals(reg2.c, 0x82);
  equals(reg2.d, 0xf8); equals(reg2.e, 0x32);
  equals(reg2.h, 0x21); equals(reg2.l, 0x89);
  equals(reg2.pc, 0x3910);
  equals(reg2.sp, 0x4224);
});
