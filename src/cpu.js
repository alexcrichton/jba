/**
 * Contains logic for the CPU of the GB.
 *
 * @constructor
 * @implements {Serializable}
 */
JBA.CPU = function() {
  this.registers = new Z80.Registers();
  this.reset();
};

/* Table of what action to take on delivering an interrupt. This table is
   indexed based on the IF and IE flags AND'ed together. That index leads to
   a function which will deliver the necessary interrupt. */
JBA.CPU.Interrupts = [];

(function() {
  function deliver_interrupt(mask, rst) {
    return function(r, m) {
      r.ime = 0;
      r.halt = 0;
      m._if &= (~mask) & 0xff;
      rst(r, m);
    };
  }

  for (var i = 0; i < 32; i++) {
    if (i & 0x01) { /* vblank => INT 40 */
      JBA.CPU.Interrupts[i] = deliver_interrupt(0x01, Z80.ops.rst_40);
    } else if (i & 0x02) { /* LCD STAT => INT 48 */
      JBA.CPU.Interrupts[i] = deliver_interrupt(0x02, Z80.ops.rst_48);
    } else if (i & 0x04) { /* timer => INT 50 */
      JBA.CPU.Interrupts[i] = deliver_interrupt(0x04, Z80.ops.rst_50);
    } else if (i & 0x08) { /* serial => INT 58 */
      JBA.CPU.Interrupts[i] = deliver_interrupt(0x08, Z80.ops.rst_58);
    } else if (i & 0x10) { /* joypad => INT 60 */
      JBA.CPU.Interrupts[i] = deliver_interrupt(0x10, Z80.ops.rst_60);
    } else { /* No interrupt to deliver */
      JBA.CPU.Interrupts[i] = function() {};
    }
  }
})();

JBA.CPU.prototype = {
  /** @type {JBA.Memory} */
  memory: null,

  ticks: 0,

  reset: function() {
    this.ticks = 0;
    this.registers.reset();
  },

  // Don't care about ticks, not sure about size anyway.
  serialize: function(io) { this.registers.serialize(io); },
  deserialize: function(io) { this.registers.deserialize(io); },

  /**
   * Exec one instruction for this CPU
   *
   * @return {number} the number of cycles the instruction took to run.
   */
  exec: function() {
    var r = this.registers, m = this.memory;

    /* When the CPU halts, it simply goes into a "low power mode" that doesn't
       execute any more instructions until an interrupt comes in. Deferring
       until this interrupt happens is fairly difficult, so we just don't
       execute any instructions. We simulate that the 'nop' instruction
       continuously happens until an interrupt comes in which will disable the
       halt flag */
    if (r.halt == 0) {
      var instruction = m.rb(r.pc++);
      Z80.map[instruction](r, m);
    } else {
      r.m = 1;
    }

    var ticks = r.m * 4;
    r.m = 0;

    // See http://nocash.emubase.de/pandocs.htm#interrupts
    if (r.ime) {
      var interrupts = m._if & m._ie;

      JBA.CPU.Interrupts[interrupts](r, m);

      ticks += r.m * 4;
    }

    this.ticks += ticks;
    if (m.timer) {
      m.timer.step(ticks / 4);
    }

    return ticks;
  }
};
