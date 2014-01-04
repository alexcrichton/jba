use gb;

pub fn run(gb: &mut gb::Gb, file: &str) {
    while !gb.test_done() {
        gb.frame();
    }

    let hash = gb.image().hash();
    if file == "-" {
        println!("{}", hash);
    } else if file.to_owned() != hash.to_str() {
        fail!("failed test");
    }
}
