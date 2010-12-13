module('Z80 - Instructions', {
  setup: function() {
    var arr = new Array(0xffff);
    window.reg = new Z80.Registers();

    window.mem = {
      rb: function(addr) { return arr[addr]; },
      rw: function(addr) { return this.rb(addr) + (this.rb(addr + 1) << 8); },
      wb: function(addr, val) { arr[addr] = val; },
      ww: function(addr, val) {
        this.wb(addr, val & 0xff); this.wb(addr + 1, (val >> 8) & 0xff);
      }
    };
  },

  teardown: function() {
    delete window.mem;
    delete window.reg;
  }
});

function opcode_test(opcode, pc_change, callback) {
  var prev = reg.pc;
  mem.wb(reg.pc, opcode);
  Z80.map[mem.rb(reg.pc++)](reg, mem);
  callback();
  equals(pc_change, reg.pc - prev, "Program counter changed by " + pc_change);
}

function stub_next_word(val) {
  mem.ww(reg.pc + 1, val);
}

test('nop', function() {
  // Just making sure the pc changed by 1
  opcode_test(0x00, 1, function(){});
});

test('ld BC, nn', function() {
  stub_next_word(0xf892);

  opcode_test(0x01, 3, function() {
    equals(reg.b, 0xf8);
    equals(reg.c, 0x92);
  });
});
