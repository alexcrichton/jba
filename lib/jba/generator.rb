# For a list of instructions, see:
#   http://nocash.emubase.de/pandocs.htm#cpuinstructionset

require 'active_support/core_ext/string/strip'

class JBA
  module Generator
    Z = 0x80
    N = 0x40
    H = 0x20
    C = 0x10

    def generate_z80 out = nil
      @out = out || STDOUT

      @a = "r.a"
      @b = "r.b"
      @c = "r.c"
      @d = "r.d"
      @e = "r.e"
      @f = "r.f"
      @h = "r.h"
      @l = "r.l"
      @m = "r.m"
      @sp = 'r.sp'
      @pc = 'r.pc'
      regs = {:b => @b, :c => @c, :d => @d, :e => @e, :h => @h, :l => @l, :a => @a}
      hl = "(#{@h} << 8) | #{@l}"
      bc = "(#{@b} << 8) | #{@c}"
      de = "(#{@d} << 8) | #{@e}"
      af = "(#{@a} << 8) | #{@f}"

      pairs = {'hl' => hl, 'bc' => bc, 'de' => de, 'af' => af}

      hlpp = "#{@l} = (#{@l} + 1) & 0xff; if (!#{@l}) #{@h} = (#{@h} + 1) & 0xff"
      hlmm = "#{@l} = (#{@l} - 1) & 0xff; if (#{@l} == 0xff) #{@h} = (#{@h} - 1) & 0xff"

      def sign_fix var
        "(#{var} > 127 ? ((#{var} & 127) - 128) : #{var})"
      end

      @funs = {}

      section '8 bit loading' do
        regs.each{ |i, il|
          regs.each{ |j, jl|
            @funs["ld_#{i}#{j}"] = if i != j
              "#{il} = #{jl}; #{@m} = 1;"
            else
              "#{@m} = 1;"
            end
          }
        }

        regs.each{ |i, il| @funs["ld_#{i}n"] =  "#{il} = m.rb(#{@pc}++); #{@m} = 2;" }
        regs.each{ |i, il| @funs["ld_#{i}hlm"] = "#{il} = m.rb(#{hl}); #{@m} = 2;" }
        regs.each{ |i, il| @funs["ld_hlm#{i}"] = "m.wb(#{hl}, #{il}); #{@m} = 2;" }

        @funs['ld_hlmn'] = "m.wb(#{hl}, m.rb(#{@pc}++)); #{@m} = 3;"
        @funs['ld_abc'] = "#{@a} = m.rb(#{bc}); #{@m} = 2;"
        @funs['ld_ade'] = "#{@a} = m.rb(#{de}); #{@m} = 2;"
        @funs['ld_ann'] = "#{@a} = m.rb(m.rw(#{@pc})); #{@pc} += 2; #{@m} = 4;"

        @funs['ld_bca'] = "m.wb(#{bc}, #{@a}); #{@m} = 2;"
        @funs['ld_dea'] = "m.wb(#{de}, #{@a}); #{@m} = 2;"
        @funs['ld_nna'] = "m.wb(m.rw(#{@pc}), #{@a}); #{@pc} += 2; #{@m} = 4;"
        @funs['ld_nnsp'] = "m.ww(m.rw(#{@pc}), #{@sp}); #{@pc} += 2; #{@m} = 4;"

        @funs['ld_aIOn'] = "#{@a} = m.rb(0xff00 | m.rb(#{@pc}++)); #{@m} = 3;"
        @funs['ld_IOan'] = "m.wb(0xff00 | m.rb(#{@pc}++), #{@a}); #{@m} = 3;"
        @funs['ld_aIOc'] = "#{@a} = m.rb(0xff00 | #{@c}); #{@m} = 2;"
        @funs['ld_IOca'] = "m.wb(0xff00 | #{@c}, #{@a}); #{@m} = 2;"

        @funs['ldi_hlma'] = "m.wb(#{hl}, #{@a}); #{hlpp}; #{@m} = 2;"
        @funs['ldi_ahlm'] = "#{@a} = m.rb(#{hl}); #{hlpp}; #{@m} = 2;"
        @funs['ldd_hlma'] = "m.wb(#{hl}, #{@a}); #{hlmm}; #{@m} = 2;"
        @funs['ldd_ahlm'] = "#{@a} = m.rb(#{hl}); #{hlmm}; #{@m} = 2;"
      end

      section '16 bit loading commands' do
        %w(bc de hl).each do |p|
          u = instance_variable_get '@' + p.bytes.to_a[0].chr
          l = instance_variable_get '@' + p.bytes.to_a[1].chr
          @funs["ld_#{p}nn"] = "#{l} = m.rb(#{@pc}++); " \
            "#{u} = m.rb(#{@pc}++); #{@m} = 3;"
        end
        @funs['ld_spnn'] = "#{@sp} = m.rw(#{@pc}); #{@pc} += 2; #{@m} = 3;"
        @funs['ld_sphl'] = "#{@sp} = #{hl}; #{@m} = 2;"

        %w(bc de hl af).each do |p|
          u = instance_variable_get '@' + p.bytes.to_a[0].chr
          l = instance_variable_get '@' + p.bytes.to_a[1].chr
          @funs["push_#{p}"] = "m.wb(--#{@sp}, #{u}); " \
            "m.wb(--#{@sp}, #{l}); #{@m} = 4;"
          @funs["pop_#{p}"] = "#{l} = m.rb(#{@sp}++); " \
            "#{u} = m.rb(#{@sp}++); #{@m} = 3;"
        end
      end

      section '8 bit addition' do
        def add var, name, cycles
          @funs["add_a#{name}"] = <<-JS.strip_heredoc
            var i = #{@a}, j = #{var};
            #{@f} = ((i & 0xf) + (j & 0xf) > 0xf ? #{H} : 0);
            #{@f} |= (i + j > 0xff ? #{C} : 0);
            #{@a} = (i + j) & 0xff;
            #{@f} |= (#{@a} ? 0 : #{Z});
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| add il, i, 1 }
        add "m.rb(#{hl})", 'hlm', 2
        add "m.rb(#{@pc}++)", 'n', 2

        def adc var, name, cycles
          @funs["adc_a#{name}"] = <<-JS.strip_heredoc
            var i = #{@a}, j = #{var}, k = !!(#{@f} & #{C});
            #{@f} = ((i & 0xf) + (j & 0xf) + k > 0xf ? #{H} : 0);
            #{@f} |= (i + j + k > 0xff ? #{C} : 0);
            #{@a} = (i + j + k) & 0xff;
            #{@f} |= (#{@a} ? 0 : #{Z});
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| adc il, i, 1 }
        adc "m.rb(#{hl})", 'hlm', 2
        adc "m.rb(#{@pc}++)", 'n', 2
      end

      section '8 bit subtraction' do
        def sub var, name, cycles
          @funs["sub_a#{name}"] = <<-JS.strip_heredoc
            var a = #{@a};
            var b = #{var};
            #{@f} = #{N} | (a < b ? #{C} : 0) |
              (((a & 0xf) < (b & 0xf)) ? #{H} : 0);
            #{@a} = (a - b) & 0xff;
            #{@f} |= (#{@a} ? 0 : #{Z});
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| sub il, i, 1 }
        sub "m.rb(#{hl})", 'hlm', 2
        sub "m.rb(#{@pc}++)", 'n', 2

        def sbc var, name, cycles
          @funs["sbc_a#{name}"] = <<-JS.strip_heredoc
            var a = #{@a};
            var b = #{var} + (!!(#{@f} & #{C}));
            #{@f} = #{N} | (a < b ? #{C} : 0) |
              (((a & 0xf) < (b & 0xf)) ? #{H} : 0);
            #{@a} = (a - b) & 0xff;
            #{@f} |= (#{@a} ? 0 : #{Z});
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| sbc il, i, 1 }
        sbc "m.rb(#{hl})", 'hlm', 2
        sbc "m.rb(#{@pc}++)", 'n', 2
      end

      section '8 bit bit-ops' do
        def anda var, name, cycles
          @funs["and_a#{name}"] = <<-JS.strip_heredoc
            #{@a} &= #{var};
            #{@f} = (#{@a} ? 0 : #{Z}) | #{H};
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| anda il, i, 1 }
        anda "m.rb(#{hl})", 'hlm', 2
        anda "m.rb(#{@pc}++)", 'n', 2

        def xora var, name, cycles
          @funs["xor_a#{name}"] = <<-JS.strip_heredoc
            #{@a} ^= #{var};
            #{@f} = #{@a} ? 0 : #{Z};
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| xora il, i, 1 }
        xora "m.rb(#{hl})", 'hlm', 2
        xora "m.rb(#{@pc}++)", 'n', 2

        def ora var, name, cycles
          @funs["or_a#{name}"] = <<-JS.strip_heredoc
            #{@a} |= #{var};
            #{@f} = #{@a} ? 0 : #{Z};
            #{@m} = #{cycles};
          JS
        end
        regs.each{ |i, il| ora il, i, 1 }
        ora "m.rb(#{hl})", 'hlm', 2
        ora "m.rb(#{@pc}++)", 'n', 2
      end

      section '8 bit comparisons' do
        def cp var, name, cycles
          @funs["cp_a#{name}"] = <<-JS.strip_heredoc
            var a = #{@a};
            var b = #{var};
            #{@f} = #{N} | (a == b ? #{Z} : 0) | (a < b ? #{C} : 0) |
              ((a & 0xf) < (b & 0xf) ? #{H} : 0);
            #{@m} = #{cycles};
          JS
        end

        regs.each{ |i, il| cp il, i, 1 }
        cp "m.rb(#{hl})", 'hlm', 2
        cp "m.rb(#{@pc}++)", 'n', 2
      end

      section '8 bit increments/decrements' do
        regs.each{ |i, il|
          @funs["inc_#{i}"] = "#{il} = (#{il} + 1) & 0xff; " \
            "#{@f} = (#{il} ? 0 : #{Z}); #{@m} = 1;"
        }
        @funs['inc_hlm'] = "var hl = #{hl}, k = (m.rb(hl) + 1) & 0xff;" \
          " m.wb(hl, k); #{@f} = k ? 0 : #{Z}; #{@m} = 3;"

        regs.each{ |i, il|
          @funs["dec_#{i}"] = "#{il} = (#{il} - 1) & 0xff; " \
            "#{@f} = #{@f} & 0x1f | #{N} | (#{il} ? 0 : #{Z}) | " \
              "(((#{il} & 0xf) == 0xf) << 5); #{@m} = 1;"
        }
        @funs['dec_hlm'] = "var hl = #{hl}, k = (m.rb(hl) - 1) & 0xff;" \
          " m.wb(hl, k); #{@f} = (k ? 0 : #{Z}) | #{N}; #{@m} = 3;"
      end

      section 'Miscellaneous 8 bit arithmetic' do
        @funs['daa'] = <<-JS.strip_heredoc
          var daa = Z80.daa_table[#{@a} | (#{@f} << 4)];
          #{@a} = daa >> 8;
          #{@f} = daa & 0xff;
          #{@m} = 1;
        JS

        @funs['cpl'] = "#{@a} ^= 0xff; #{@f} |= #{N} | #{H}; #{@m} = 1;"
      end

      section '16 bit arithmetic' do
        def add_hl name, add_in, hl
          @funs["add_hl#{name}"] = <<-JS.strip_heredoc
            var a = #{hl}, b = #{add_in}, hl = a + b;
            #{@f} &= #{~N & 0xff};
            if (hl > 0xffff) #{@f} |= #{C}; else #{@f} &= #{~C & 0xff};
            if ((a & 0xfff) + (b & 0xfff) > 0xfff) #{@f} |= #{H};
            #{@l} = hl & 0xff;
            #{@h} = (hl >> 8) & 0xff;
            #{@m} = 2;
          JS
        end
        %w(hl bc de).each{ |p| add_hl p, pairs[p], hl }
        add_hl 'sp', @sp, hl

        %w(bc de hl).each{ |p|
          u = instance_variable_get '@' + p.bytes.to_a[0].chr
          l = instance_variable_get '@' + p.bytes.to_a[1].chr

          @funs["inc_#{p}"] = "#{l} = (#{l} + 1) & 0xff; " \
            "if (!#{l}) #{u} = (#{u} + 1) & 0xff; #{@m} = 2;"
          @funs["dec_#{p}"] = "#{l} = (#{l} - 1) & 0xff; " \
            "if (#{l} == 0xff) #{u} = (#{u} - 1) & 0xff; #{@m} = 2;"
        }
        @funs['inc_sp'] = "#{@sp} = (#{@sp} + 1) & 0xffff; #{@m} = 2;"
        @funs['dec_sp'] = "#{@sp} = (#{@sp} - 1) & 0xffff; #{@m} = 2;"

        @funs['add_spn'] = <<-JS.strip_heredoc
          var i = m.rb(#{@pc}++);
          i = #{sign_fix 'i'};
          #{@sp} = (#{@sp} + i) & 0xffff;
          #{@m} = 4;
        JS

        @funs['ld_hlspn'] = <<-JS.strip_heredoc
          var i = m.rb(#{@pc}++);
          i = #{sign_fix 'i'};
          i += #{@sp};
          #{@h} = (i >> 8) & 0xff;
          #{@l} = i & 0xff;
          #{@m} = 3;
        JS
      end

      section 'Rotating left' do
        def rlc name, var, cy, before='', after=''
          @funs["rlc#{name}"] = <<-JS.strip_heredoc
            #{before};
            var ci = (#{var} & 0x80) ? 1 : 0;
            #{var} = ((#{var} << 1) & 0xff) | ci;
            #{@f} = (#{var} ? 0 : #{Z}) | (ci ? #{C} : 0);
            #{after};
            #{@m} = #{cy};
          JS
        end

        def rl name, var, cy, before='', after=''
          @funs["rl#{name}"] = <<-JS.strip_heredoc
            #{before};
            var ci = (#{@f} & #{C}) ? 1 : 0;
            var co = #{var} & 0x80;
            #{var} = ((#{var} << 1) & 0xff) | ci;
            #{@f} = (#{var} ? 0 : #{Z}) | (co ? #{C} : 0);
            #{after};
            #{@m} = #{cy};
          JS
        end

        rlc 'a', @a, 1
        rl 'a', @a, 1
        regs.each{ |i, il|
          rlc "_#{i}", il, 2
          rl "_#{i}", il, 2
        }
        rlc '_hlm', 'hl', 4, "var hl = m.rb(#{hl})", "m.wb(#{hl}, hl)"
        rl '_hlm', 'hl', 4, "var hl = m.rb(#{hl})", "m.wb(#{hl}, hl)"
      end

      section 'Rotating right' do
        def rrc name, var, cy, before='', after=''
          @funs["rrc#{name}"] = <<-JS.strip_heredoc
            #{before};
            var ci = #{var} & 1;
            #{var} = (#{var} >> 1) | (ci << 7);
            #{@f} = (#{var} ? 0 : #{Z}) | (ci ? #{C} : 0);
            #{after};
            #{@m} = #{cy};
          JS
        end

        def rr name, var, cy, before='', after=''
          @funs["rr#{name}"] = <<-JS.strip_heredoc
            #{before};
            var ci = (#{@f} & #{C}) ? 0x80 : 0;
            var co = (#{var} & 1) ? #{C} : 0;
            #{var} = (#{var} >> 1) | ci;
            #{@f} = (#{var} ? 0 : #{Z}) | co;
            #{after};
            #{@m} = #{cy};
          JS
        end

        rrc 'a', @a, 1
        rr 'a', @a, 1
        regs.each{ |i, il|
          rrc "_#{i}", il, 2
          rr "_#{i}", il, 2
        }
        rrc '_hlm', 'hl', 4, "var hl = m.rb(#{hl})", "m.wb(#{hl}, hl)"
        rr '_hlm', 'hl', 4, "var hl = m.rb(#{hl})", "m.wb(#{hl}, hl)"
      end

      section 'Shifting arithmetically left' do
        def sla name, var, cy, before='', after=''
          @funs["sla_#{name}"] = <<-JS.strip_heredoc
            #{before};
            var co = (#{var} >> 7) & 1;
            #{var} = (#{var} << 1) & 0xff;
            #{@f} = (#{var} ? 0 : #{Z}) | (co ? #{C} : 0);
            #{after};
            #{@m} = #{cy};
          JS
        end

        regs.each { |i, il| sla i, il, 2 }
        sla 'hlm', 'hl', 4, "var hl = m.rb(#{hl})", "m.wb(#{hl}, hl)"
      end

      section 'Swapping' do
        regs.each do |i, il|
          @funs["swap_#{i}"] = <<-JS.strip_heredoc
            var t = #{il}; #{il} = ((t & 0xf) << 4) | ((t & 0xf0) >> 4);
            #{@f} = t ? 0 : #{Z}; #{@m} = 2;
          JS
        end

        @funs['swap_hlm'] = <<-JS.strip_heredoc
          var t = m.rb(#{hl}); m.wb(#{hl}, ((t & 0xf) << 4) | ((t & 0xf0) >> 4));
          #{@f} = t ? 0 : #{Z}; #{@m} = 4;
        JS
      end

      section 'Shifting arithmetically right' do
        # shift right arithmetic (b7=b7)
        regs.each do |i, il|
          @funs["sra_#{i}"] = <<-JS.strip_heredoc
            var a = #{il};
            var co = a & 1;
            a = (a >> 1) | (a & 0x80);
            #{@f} = (a ? 0 : #{Z}) | (co ? #{C} : 0);
            #{il} = a;
            #{@m} = 2;
          JS
        end

        @funs['sra_hlm'] = <<-JS.strip_heredoc
          var a = m.rb(#{hl});
          var co = a & 1;
          a = (a >> 1) | (a & 0x80);
          #{@f} = (a ? 0 : #{Z}) | (co ? #{C} : 0);
          m.wb(#{hl}, a);
          #{@m} = 4;
        JS
      end

      section 'Shifting logically right' do
        # shift right logical (b7=0)
        regs.each do |i, il|
          @funs["srl_#{i}"] = <<-JS.strip_heredoc
            var a = #{il};
            var co = (a & 1) ? #{C} : 0;
            a = (a >> 1) & 0x7f;
            #{@f} = (a ? 0 : #{Z}) | co;
            #{il} = a;
            #{@m} = 2;
          JS
        end

        @funs['srl_hlm'] = <<-JS.strip_heredoc
          var a = m.rb(#{hl});
          var co = (a & 1) ? #{C} : 0;
          a = (a >> 1) & 0x7f;
          #{@f} = (a ? 0 : #{Z}) | co;
          m.wb(#{hl}, a);
          #{@m} = 4;
        JS
      end

      section 'Bit checking' do
        def bitcmp pos, name, reader, cy
          @funs["bit_#{pos}#{name}"] = <<-JS.strip_heredoc
            var b = #{reader} & #{1 << pos};
            #{@f} = (#{@f} & #{C}) | #{H} | (b ? 0 : #{Z});
            #{@m} = #{cy};
          JS
        end

        (0..7).each do |pos|
          regs.each{ |i, il| bitcmp pos, i, il, 2 }
          bitcmp pos, 'hlm', "m.rb(#{hl})", 3
        end
      end

      section 'Bit setting/resetting' do
        (0..7).each do |pos|
          regs.each{ |i, il|
            @funs["set_#{pos}#{i}"] = "#{il} |= #{1 << pos}; #{@m} = 2;"
          }
          @funs["set_#{pos}hlm"] = "m.wb(#{hl}, m.rb(#{hl}) | " \
            " #{1 << pos}); #{@m} = 4;"
        end

        (0..7).each do |pos|
          mask = (~(1 << pos) & 0xff)
          regs.each{ |i, il|
            @funs["res_#{pos}#{i}"] = "#{il} &= #{mask}; #{@m} = 2;"
          }
          @funs["res_#{pos}hlm"] = \
            "m.wb(#{hl}, m.rb(#{hl}) & #{mask}); #{@m} = 4;"
        end
      end

      section 'CPU control commands' do
        @funs['ccf'] = "#{@f} = (#{@f} & #{Z}) | ((#{@f} & #{C}) ^ #{C}); #{@m} = 1;"
        @funs['scf'] = "#{@f} = (#{@f} & #{Z}) | #{C}; #{@m} = 1;"
        @funs['nop'] = "#{@m} = 1;"
        @funs['halt'] = "r.halt = 1; #{@m} = 1;"
        @funs['stop'] = "r.stop = 1; #{@m} = 1; throw 'stop';"
        @funs['di'] = "r.ime = 0; #{@m} = 1;"
        @funs['ei'] = "r.ime = 1; #{@m} = 1;"
      end

      section 'Jump commands' do
        @do_jp = "#{@pc} = m.rw(#{@pc}); #{@m} = 4;"
        @funs['jp_nn'] = @do_jp
        @funs['jp_hl'] = "#{@pc} = #{hl}; #{@m} = 1;"

        def jp_n name, cond
          @funs["jp_#{name}_nn"] =
            "if (#{cond}) { #{@do_jp} } else { #{@pc} += 2; #{@m} = 3; }"
        end

        jp_n 'nz', "!(#{@f} & #{Z})"
        jp_n 'z', "#{@f} & #{Z}"
        jp_n 'nc', "!(#{@f} & #{C})"
        jp_n 'c', "#{@f} & #{C}"

        @do_jr = <<-JS.strip_heredoc
          var i = m.rb(#{@pc}++);
          i = #{sign_fix 'i'};
          #{@pc} += i;
          #{@m} = 3;
        JS
        @funs['jr_n'] = @do_jr

        def jr_n name, cond
          @funs["jr_#{name}_n"] =
            "if (#{cond}) { #{@do_jr} } else { #{@pc}++; #{@m} = 2; }"
        end

        jr_n 'nz', "!(#{@f} & #{Z})"
        jr_n 'z', "#{@f} & #{Z}"
        jr_n 'nc', "!(#{@f} & #{C})"
        jr_n 'c', "#{@f} & #{C}"
      end

      section 'Call/return commands' do
        @do_call = "#{@sp} -= 2; m.ww(#{@sp}, #{@pc} + 2); #{@pc} = m.rw(#{@pc}); #{@m} = 6;"
        @funs['call_nn'] = @do_call

        def call_f_n name, cond
          @funs["call_#{name}_nn"] = "if (#{cond}) { #{@do_call} } " \
            "else { #{@m} = 3; #{@pc} += 2; }"
        end

        call_f_n 'nz', "!(#{@f} & #{Z})"
        call_f_n 'z', "#{@f} & #{Z}"
        call_f_n 'nc', "!(#{@f} & #{C})"
        call_f_n 'c', "#{@f} & #{C}"

        @do_ret = "#{@pc} = m.rw(#{@sp}); #{@sp} += 2;"
        @funs['ret'] = "#{@do_ret} #{@m} = 4;"

        def ret_f name, cond
          @funs["ret_#{name}"] =
            "if (#{cond}) { #{@do_ret} #{@m} = 5; } else { #{@m} = 2; }"
        end

        ret_f 'nz', "!(#{@f} & #{Z})"
        ret_f 'z', "#{@f} & #{Z}"
        ret_f 'nc', "!(#{@f} & #{C})"
        ret_f 'c', "#{@f} & #{C}"

        @funs['reti'] = "r.ime = 1; #{@do_ret} #{@m} = 4;"
      end

      section 'Resetting' do
        %w(00 08 10 18 20 28 30 38 40 48 50 58 60).each do |code|
          @funs["rst_#{code}"] = "#{@sp} -= 2; " +
            "m.ww(#{@sp}, #{@pc}); #{@pc} = 0x#{code}; #{@m} = 4;"
        end
      end

      @funs.each_pair do |name, body|
        @out.print '/** @param {Z80.Registers} r ; @param {JBA.Memory} m */ '
        @out.print name
        @out.print ': function(r, m){ '
        @out.print body.gsub("\n", '')
        @out.puts ' },'
      end
    end

    def section desc
      yield
    end

  end
end
