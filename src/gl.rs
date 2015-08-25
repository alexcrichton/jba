extern crate glutin;
extern crate libc;

use std::ffi::CString;
use std::iter::repeat;
use std::mem;
use std::ptr;
use std::str;
use self::gl::types as glt;
use self::glutin::Event;
use self::glutin::ElementState as ES;
use self::glutin::VirtualKeyCode as VKC;

use input::Button;
use gpu;
use gb::Gb;

mod gl {
    include!(concat!(env!("OUT_DIR"), "/gl_bindings.rs"));
}

struct Glcx {
    gl: gl::Gl,
    tex: glt::GLuint,
    program: glt::GLuint,
    frag: glt::GLuint,
    vert: glt::GLuint,
    ebo: glt::GLuint,
    vbo: glt::GLuint,
    vao: glt::GLuint,
}

pub fn run(mut gb: Gb) {
    const WIDTH: u32 = gpu::WIDTH as u32;
    const HEIGHT: u32 = gpu::HEIGHT as u32;
    let mut ratio = 1 + (WIDTH / 10);
    let window = glutin::WindowBuilder::new()
                        .with_title("JBA".to_string())
                        .with_dimensions(WIDTH + 10 * ratio,
                                         HEIGHT + 9 * ratio)
                        .build().unwrap();
    unsafe {
        window.make_current().unwrap();
    }

    let context = Glcx::new(&window);

    let mut focused = true;
    for event in window.wait_events() {
        if focused {
            gb.frame();
            context.draw(gb.image());
            window.swap_buffers().unwrap();
        }

        println!("{:?}", event);

        match event {
            Event::Closed => break,
            Event::Resized(width, height) => {
                let (width, height) = if width < height {
                    (width, width * HEIGHT / WIDTH)
                } else {
                    (height * WIDTH / HEIGHT, height)
                };
                window.set_inner_size(width, height);
            }
            Event::Focused(f) => focused = f,
            Event::KeyboardInput(ES::Pressed, _, Some(VKC::Equals)) => {
                ratio += 1;
                window.set_inner_size(WIDTH + 10 * ratio, HEIGHT + 9 * ratio);
            }
            Event::KeyboardInput(ES::Pressed, _, Some(VKC::Minus)) => {
                ratio -= 1;
                window.set_inner_size(WIDTH + 10 * ratio, HEIGHT + 9 * ratio);
            }
            Event::KeyboardInput(action, _, Some(virt)) => {
                let button = match virt {
                    VKC::Z => Button::A,
                    VKC::X => Button::B,
                    VKC::Return => Button::Select,
                    VKC::Comma => Button::Start,

                    VKC::Left => Button::Left,
                    VKC::Right => Button::Right,
                    VKC::Down => Button::Down,
                    VKC::Up => Button::Up,

                    _ => continue,
                };
                match action {
                    ES::Pressed => gb.keydown(button),
                    ES::Released => gb.keyup(button),
                }
            }
            _ => ()
        }
    }
}

// Shader sources
const VERTEX: &'static str = r"#version 150 core
in vec2 position;
in vec3 color;
in vec2 texcoord;
out vec3 Color;
out vec2 Texcoord;
void main() {
   Color = color;
   Texcoord = texcoord;
   gl_Position = vec4(position, 0.0, 1.0);
}
";

const FRAGMENT: &'static str = r"#version 150 core
in vec3 Color;
in vec2 Texcoord;
out vec4 outColor;
uniform sampler2D tex;
void main() {
   outColor = texture(tex, Texcoord);
}
";

impl Glcx {
    fn new(window: &glutin::Window) -> Glcx {
        // lots of code lifted from
        // http://www.open.gl/content/code/c3_multitexture.txt
        let gl = gl::Gl::load(window);
        unsafe {
            let mut vao = 0;
            gl.GenVertexArrays(1, &mut vao);
            gl.BindVertexArray(vao);

            let mut vbo = 0;
            gl.GenBuffers(1, &mut vbo);

            const VERTICES: &'static [f32] = &[
            //  Position   Color             Texcoords
                -1.0,  1.0, 1.0, 0.0, 0.0, 0.0, 0.0, // Top-left
                 1.0,  1.0, 0.0, 1.0, 0.0, 1.0, 0.0, // Top-right
                 1.0, -1.0, 0.0, 0.0, 1.0, 1.0, 1.0, // Bottom-right
                -1.0, -1.0, 1.0, 1.0, 1.0, 0.0, 1.0  // Bottom-left
            ];
            gl.BindBuffer(gl::ARRAY_BUFFER, vbo);
            gl.BufferData(gl::ARRAY_BUFFER,
                           (VERTICES.len() * 4) as i64,
                           VERTICES.as_ptr() as *const libc::c_void,
                           gl::STATIC_DRAW);

            let mut ebo = 0;
            gl.GenBuffers(1, &mut ebo);

            const ELEMENTS: &'static [glt::GLuint] = &[
                0, 1, 2,
                2, 3, 0
            ];

            gl.BindBuffer(gl::ELEMENT_ARRAY_BUFFER, ebo);
            gl.BufferData(gl::ELEMENT_ARRAY_BUFFER,
                        (ELEMENTS.len() * mem::size_of::<glt::GLuint>()) as i64,
                        ELEMENTS.as_ptr() as *const libc::c_void,
                        gl::STATIC_DRAW);

            // Create and compile the vertex shader
            let vert = gl.CreateShader(gl::VERTEX_SHADER);
            let src = CString::new(VERTEX).unwrap();
            gl.ShaderSource(vert, 1, &src.as_ptr(), 0 as *const i32);
            gl.CompileShader(vert);
            Glcx::check_shader_compile(&gl, vert);

            // Create and compile the fragment shader
            let frag = gl.CreateShader(gl::FRAGMENT_SHADER);
            let src = CString::new(FRAGMENT).unwrap();
            gl.ShaderSource(frag, 1, &src.as_ptr(), 0 as *const i32);
            gl.CompileShader(frag);
            Glcx::check_shader_compile(&gl, frag);

            // Link the vertex and fragment shader into a shader program
            let program = gl.CreateProgram();
            gl.AttachShader(program, vert);
            gl.AttachShader(program, frag);
            let buf = CString::new("outColor").unwrap();
            gl.BindFragDataLocation(program, 0, buf.as_ptr());
            gl.LinkProgram(program);
            Glcx::check_program_link(&gl, program);
            assert_eq!(gl.GetError(), 0);
            gl.UseProgram(program);

            // Specify the layout of the vertex data
            let buf = CString::new("position").unwrap();
            let pos_attrib = gl.GetAttribLocation(program, buf.as_ptr());
            gl.EnableVertexAttribArray(pos_attrib as u32);
            gl.VertexAttribPointer(pos_attrib as u32, 2, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        0 as *const libc::c_void);

            let buf = CString::new("color").unwrap();
            let col_attrib = gl.GetAttribLocation(program, buf.as_ptr());
            gl.EnableVertexAttribArray(col_attrib as u32);
            gl.VertexAttribPointer(col_attrib as u32, 3, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        (2 * mem::size_of::<glt::GLfloat>()) as *const libc::c_void);

            let buf = CString::new("texcoord").unwrap();
            let tex_attrib = gl.GetAttribLocation(program, buf.as_ptr());
            gl.EnableVertexAttribArray(tex_attrib as u32);
            gl.VertexAttribPointer(tex_attrib as u32, 2, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        (5 * mem::size_of::<glt::GLfloat>()) as *const libc::c_void);

            // Load textures
            let mut tex = 0;
            gl.GenTextures(1, &mut tex);

            gl.ActiveTexture(gl::TEXTURE0);
            gl.BindTexture(gl::TEXTURE_2D, tex);
            let buf = CString::new("tex").unwrap();
            gl.Uniform1i(gl.GetUniformLocation(program, buf.as_ptr()), 0);

            gl.TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_S,
                             gl::CLAMP_TO_EDGE as i32);
            gl.TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_T,
                             gl::CLAMP_TO_EDGE as i32);
            gl.TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MIN_FILTER,
                             gl::LINEAR as i32);
            gl.TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MAG_FILTER,
                             gl::LINEAR as i32);

            Glcx {
                gl: gl,
                tex: tex,
                program: program,
                frag: frag,
                vert: vert,
                ebo: ebo,
                vbo: vbo,
                vao: vao,
            }
        }
    }

    unsafe fn check_shader_compile(gl: &gl::Gl, shader: glt::GLuint) {
        let mut status = gl::FALSE as glt::GLint;
        gl.GetShaderiv(shader, gl::COMPILE_STATUS, &mut status);
        if status == (gl::TRUE as glt::GLint) { return }

        let mut len: glt::GLint = 0;
        gl.GetShaderiv(shader, gl::INFO_LOG_LENGTH, &mut len);
        let mut buf = repeat(0u8).take(len as usize).collect::<Vec<_>>();
        gl.GetShaderInfoLog(shader, len, ptr::null_mut(),
                            buf.as_mut_ptr() as *mut glt::GLchar);
        panic!("{}", str::from_utf8(&buf).unwrap());
    }

    unsafe fn check_program_link(gl: &gl::Gl, program: glt::GLuint) {
        let mut status = gl::FALSE as glt::GLint;
        gl.GetProgramiv(program, gl::LINK_STATUS, &mut status);
        if status == (gl::TRUE as glt::GLint) { return }

        let mut len: glt::GLint = 0;
        gl.GetProgramiv(program, gl::INFO_LOG_LENGTH, &mut len);
        let mut buf = repeat(0u8).take(len as usize).collect::<Vec<_>>();
        gl.GetProgramInfoLog(program, len, ptr::null_mut(),
                            buf.as_mut_ptr() as *mut glt::GLchar);
        panic!("{}", str::from_utf8(&buf).unwrap());
    }

    fn draw(&self, data: &[u8]) {
        unsafe {
            self.gl.ClearColor(0.0, 0.0, 1.0, 1.0);
            self.gl.Clear(gl::COLOR_BUFFER_BIT);

            self.gl.TexImage2D(gl::TEXTURE_2D, 0, gl::RGB as i32,
                               gpu::WIDTH as i32, gpu::HEIGHT as i32,
                               0, gl::RGBA, gl::UNSIGNED_BYTE,
                               data.as_ptr() as *const libc::c_void);
            assert_eq!(self.gl.GetError(), 0);

            // Draw a rectangle from the 2 triangles using 6
            // indices
            self.gl.DrawElements(gl::TRIANGLES, 6, gl::UNSIGNED_INT,
                                 0 as *const libc::c_void);
        }
    }
}

impl Drop for Glcx {
    fn drop(&mut self) {
        unsafe {
            self.gl.DeleteTextures(1, &self.tex);
            self.gl.DeleteProgram(self.program);
            self.gl.DeleteShader(self.vert);
            self.gl.DeleteShader(self.frag);
            self.gl.DeleteBuffers(1, &self.ebo);
            self.gl.DeleteBuffers(1, &self.vbo);
            self.gl.DeleteVertexArrays(1, &self.vao);
        }
    }
}
