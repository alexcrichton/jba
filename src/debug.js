window.hex = function(i, digits) {
  if (i < 0) {
    for (var j = 0; j < digits; j++) {
      i += (0xf << (j * 4));
    }
    i++;
  }

  var string = i.toString(16);

  if (string.length > digits) {
    throw "Supplied number: " + i + " has more than " + digits + " digit(s)";
  }

  while (string.length < digits) {
    string = '0' + string;
  }

  return string;
};

window.hexw = function(i) { return '0x' + hex(i, 4); };
window.hexb = function(i) { return '0x' + hex(i, 2); };
window.linkmem = function(addr) {
  var onclick = 'debug.highlight(\'' + addr + '\'); return false;';

  return '<a href="#" onclick="' + onclick + '">' + addr + '</a>';
};

JBA.Debug = function() {
  this.gb = new JBA();
};

JBA.Debug.ROWS = 22; /* Rows of memory to show */
JBA.Debug.COLS = 16; /* Bytes per row of memory to show */
JBA.Debug.INST = 16; /* Number of instructions to disassemble */

JBA.Debug.prototype = {

  memstart: 0,

  update: function() {
    this.update_registers();
    this.update_flags();
    this.update_memory();
    this.update_disassembly();
    this.update_gpu();

    this.highlight(hexw(this.gb.cpu.registers.pc));
  },

  /** @param addr the address as a string ('0x----') in memory to highlight */
  highlight: function(addr) {
    var row = Math.floor(parseInt(addr, 16) / JBA.Debug.COLS);
    row -= JBA.Debug.ROWS / 2;
    if (row + JBA.Debug.ROWS > 0x1000) {
      row = 0x1000 - JBA.Debug.ROWS;
    }

    this.memstart = row * JBA.Debug.COLS;
    this.update_memory();

    var anchor = hexw(parseInt(addr, 16) & 0xfff0);
    $('#' + anchor).next().
      find(':eq(' + (parseInt(addr, 16) & 0xf) + ')').addClass('highlight');
  },

  /**
   * Scroll up the window of memory
   */
  memory_up: function() {
    var start = this.memstart / JBA.Debug.COLS + JBA.Debug.ROWS;

    if (start + JBA.Debug.ROWS > 0x1000) {
      start = 0x1000 - JBA.Debug.ROWS;
    }

    this.memstart = start * JBA.Debug.COLS;
    this.update_memory();
  },

  /**
   * Scroll down the window of memory
   */
  memory_down: function() {
    var start = this.memstart / JBA.Debug.COLS - JBA.Debug.ROWS;

    if (start < 0) {
      start = 0;
    }

    this.memstart = start * JBA.Debug.COLS;
    this.update_memory();
  },

  /**
   * Update the display of the registers
   */
  update_registers: function() {
    var gb = this.gb;

    $('#registers .a').text(hexb(gb.cpu.registers.a));
    $('#registers .b').text(hexb(gb.cpu.registers.b));
    $('#registers .c').text(hexb(gb.cpu.registers.c));
    $('#registers .d').text(hexb(gb.cpu.registers.d));
    $('#registers .e').text(hexb(gb.cpu.registers.e));
    $('#registers .f').text(hexb(gb.cpu.registers.f));
    $('#registers .h').text(hexb(gb.cpu.registers.h));
    $('#registers .l').text(hexb(gb.cpu.registers.l));

    $('#registers .af').text(hexw(gb.cpu.registers.af()));
    $('#registers .bc').html(linkmem(hexw(gb.cpu.registers.bc())));
    $('#registers .de').html(linkmem(hexw(gb.cpu.registers.de())));
    $('#registers .hl').html(linkmem(hexw(gb.cpu.registers.hl())));

    $('#registers .sp').html(linkmem(hexw(gb.cpu.registers.sp)));
    $('#registers .pc').html(linkmem(hexw(gb.cpu.registers.pc)));
  },

  /**
   * Update the display of flags
   */
  update_flags: function() {
    var string = '';
    var flags = this.gb.cpu.registers.f;

    for (i = 0; i < 8; i++) {
      string = (flags & 1) + ' ' + string;
      flags >>= 1;
    }

    $('#flags .flags').text(string);
  },

  /**
   * Update the showing window of memory
   */
  update_memory: function() {
    var el = $('#memory dl');
    el.html('');
    var gb = this.gb;

    for (var i = 0; i < JBA.Debug.ROWS; i++) {
      var row = document.createElement('dt');
      row.id = hexw(this.memstart + i * JBA.Debug.COLS);
      row.textContent = row.id + ':';
      el.append(row);

      row = document.createElement('dd');
      var string = ' ';
      var translation = '';

      for (var j = 0; j < JBA.Debug.COLS; j++) {
        var addr = this.memstart + i * JBA.Debug.COLS + j;
        try {
          var val = gb.memory.rb(addr);
          string += '<span>' + hex(val, 2) + '</span>';

          var s = String.fromCharCode(val);
          if (s.match(/[\x00-\x1F\x80-\xFF]/)) {
            translation += '.';
          } else {
            if (s.match(/\s/)) {
              translation += '&nbsp;';
            } else {
              translation += s;
            }
          }
        } catch(e) {
          string += '<span class="bad">ff</span>';
          translation += '<span class="bad">.</span>';
        }

        string += ' ';
      }

      row.innerHTML = string + ' <span class="translation">' + translation + '</span>';
      el.append(row);
    }
  },

  /**
   * Update the disassembler to disassemble the current program counter
   */
  update_disassembly: function() {
    var el = $('#disas dl');
    el.html('');
    var gb = this.gb;
    var pc = gb.cpu.registers.pc;

    for (var i = 0; i < JBA.Debug.INST; i++, pc++) {
      var row = document.createElement('dt');
      row.id = hexw(pc);
      row.innerHTML = linkmem(row.id) + ':';
      el.append(row);

      row = document.createElement('dd');

      var opcode = gb.memory.rb(pc), map = Z80.map;
      if (opcode == 0xcb) {
        opcode = gb.memory.rb(++pc);
        map = Z80.cbmap;
      }
      var instruction = map[opcode];

      for (op in Z80.ops) {
        if (Z80.ops[op] == instruction) {
          row.textContent = hexb(opcode) + ' = ' + op;

          if (op.match(/nn/)) {
            row.textContent += '(' + hexw(gb.memory.rw(++pc)) + ')';
            pc++;
          } else if (op.match(/n/) && !op.match(/ret|inc/) && op != 'nop') {
            row.textContent += '(' + hexb(gb.memory.rb(++pc)) + ')';
          }

          break;
        }
      }

      el.append(row);
    }
  },

  /**
   * Update the GPU variables listed
   */
  update_gpu: function() {
    var gpu = this.gb.gpu;
    $('#gpu .clocks').text(gpu.clock);

    $('#gpu .lcdon').text(gpu.lcdon);
    $('#gpu .winmap').text(gpu.winmap);
    $('#gpu .winon').text(gpu.winon);
    $('#gpu .tiledata').text(gpu.tiledata);
    $('#gpu .bgmap').text(gpu.bgmap);
    $('#gpu .objsize').text(gpu.objsize);
    $('#gpu .objon').text(gpu.objon);
    $('#gpu .bgon').text(gpu.bgon);

    $('#gpu .lycly').text(gpu.lycly);
    $('#gpu .mode2int').text(gpu.mode2int);
    $('#gpu .mode1int').text(gpu.mode1int);
    $('#gpu .mode0int').text(gpu.mode0int);
    $('#gpu .mode').text(gpu.mode);

    $('#gpu .scy').text(gpu.scy);
    $('#gpu .scx').text(gpu.scx);
    $('#gpu .ly').text(gpu.ly);
    $('#gpu .lyc').text(gpu.lyc);

    $('#gpu .bgp').text(hexb(gpu.bgp));
    $('#gpu .obp0').text(hexb(gpu.obp0));
    $('#gpu .obp1').text(hexb(gpu.obp1));

    $('#gpu .wy').text(gpu.wy);
    $('#gpu .wx').text(gpu.wx);
  }
};
