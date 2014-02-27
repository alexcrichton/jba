use std::hash;
use gb;

pub fn run(gb: &mut gb::Gb, file: &str) {
    while !gb.test_done() {
        gb.frame();
    }

    let hash = hash::hash(&gb.image());
    if file == "-" {
        println!("{}", hash);
    } else if file.to_owned() != hash.to_str() {
        fail!("failed test");
    }
}
