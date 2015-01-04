use std::hash;
use std::io::Command;
use std::thread::Thread;

use gb;
use mem;

fn run(compressed_rom: &'static [u8], answer: &str) {
    let mut p = Command::new("gunzip").arg("-c").arg("-d").spawn().unwrap();
    let i = p.stdin.take().unwrap();
    let _t = Thread::spawn(move|| {
        let mut i = i; i.write(compressed_rom).unwrap();
    });
    let rom = p.stdout.take().unwrap().read_to_end().unwrap();
    drop(p);

    let rom = rom.as_slice();
    let mut gb = gb::Gb::new(match mem::Memory::guess_target(rom) {
        Some(target) => target,
        None => gb::GameBoyColor,
    });
    gb.load(rom.to_vec());

    while !gb.test_done() {
        gb.frame();
    }

    let hash = hash::hash(&gb.image());
    if answer == "-" {
        panic!("{}", hash)
    } else if answer.to_string() != hash.to_string() {
        panic!("failed test");
    }
}

macro_rules! test {
    ($name:ident, $file:expr, $answer:expr) => (
        #[test]
        fn $name() { run($file, $answer) }
    )
}

test!(special, include_bytes!("cpu-01-special.gb.gz"),
      "3042476034633502306");
test!(interrupts, include_bytes!("cpu-02-interrupts.gb.gz"),
      "462176620006846018");
test!(op_sp_hl, include_bytes!("cpu-03-op-sp-hl.gb.gz"),
      "10657845603953411393");
test!(op_r_imm, include_bytes!("cpu-04-op-r-imm.gb.gz"),
      "11318613169574122426");
test!(op_rp, include_bytes!("cpu-05-op-rp.gb.gz"),
      "10170984252987847598");
test!(op_ld_r_r, include_bytes!("cpu-06-ld-r-r.gb.gz"),
      "6875792126886980649");
test!(jumping, include_bytes!("cpu-07-jumping.gb.gz"),
      "3365161897440759532");
test!(misc, include_bytes!("cpu-08-misc.gb.gz"),
      "8370387601342429963");
test!(op_r_r, include_bytes!("cpu-09-op-r-r.gb.gz"),
      "14541846169334570272");
test!(bit_ops, include_bytes!("cpu-10-bit-ops.gb.gz"),
      "12081860069910899791");
test!(op_a_hl, include_bytes!("cpu-11-op-a-hl.gb.gz"),
      "10885336760602814920");
test!(instr_timing, include_bytes!("instr_timing.gb.gz"),
      "3437662308716406134");
