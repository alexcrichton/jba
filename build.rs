extern crate gl_generator;
extern crate khronos_api;

use std::path::PathBuf;
use std::env;
use std::fs::{self, File};

fn main() {
    let dest = PathBuf::from(env::var_os("OUT_DIR").unwrap())
                       .join("gl_bindings.rs");
    if fs::metadata(&dest).is_err() {
        let mut file = File::create(&dest).unwrap();
        gl_generator::generate_bindings(gl_generator::StructGenerator,
                                        gl_generator::registry::Ns::Gl,
                                        gl_generator::Fallbacks::All,
                                        khronos_api::GL_XML, vec![],
                                        "3.2", "core", &mut file).unwrap();
    }
}
