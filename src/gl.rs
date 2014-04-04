extern crate glfw;
extern crate gl;

use std::libc;
use std::mem;
use glt = self::gl::types;
use self::glfw::Context;

use input;
use gpu;
use gb::Gb;

struct Glcx {
    tex: glt::GLuint,
    program: glt::GLuint,
    frag: glt::GLuint,
    vert: glt::GLuint,
    ebo: glt::GLuint,
    vbo: glt::GLuint,
    vao: glt::GLuint,
}

pub fn run(mut gb: Gb) {
    let (glfw, errors) = glfw::init().unwrap();
    glfw::fail_on_error(&errors);

    let (mut window, events) = glfw.create_window(gpu::WIDTH as u32,
                                                  gpu::HEIGHT as u32,
                                                  "JBA",
                                                  glfw::Windowed).unwrap();
    window.set_key_polling(true);
    window.set_focus_polling(true);
    window.set_size_polling(true);
    glfw.make_context_current(Some(&window));

    let cx = Glcx::new();

    let mut focused = true;
    let mut ratio = 1 + (gpu::WIDTH as i32 / 10);
    window.set_size((gpu::WIDTH as i32) + 10 * ratio,
                    (gpu::HEIGHT as i32) + 9 * ratio);
    let context = window.render_context();
    while !window.should_close() {
        if focused {
            gb.frame();
            cx.draw(gb.image());
            context.swap_buffers();
            glfw.poll_events();
            glfw::fail_on_error(&errors);
        } else {
            glfw.wait_events();
        }

        for (_, event) in glfw::flush_messages(&events) {
            match event {
                glfw::SizeEvent(width, height) => {
                    let (width, height) = if width < height {
                        (width,
                         width * (gpu::HEIGHT as i32) / (gpu::WIDTH as i32))
                    } else {
                        (height * (gpu::WIDTH as i32) / (gpu::HEIGHT as i32),
                         height)
                    };
                    window.set_size(width, height);
                }
                glfw::FocusEvent(f) => {
                    focused = f;
                }
                glfw::KeyEvent(key, _, action, _) => {
                    match key {
                        glfw::KeyEqual => {
                            ratio += 1;
                            window.set_size((gpu::WIDTH as i32) + 10 * ratio,
                                            (gpu::HEIGHT as i32) + 9 * ratio);
                            continue
                        }
                        glfw::KeyMinus => {
                            ratio -= 1;
                            if ratio < 0 { ratio = 0; }
                            window.set_size((gpu::WIDTH as i32) + 10 * ratio,
                                            (gpu::HEIGHT as i32) + 9 * ratio);
                            continue
                        }
                        _ => {}
                    }

                    let button = match key {
                        glfw::KeyZ => input::A,
                        glfw::KeyX => input::B,
                        glfw::KeyEnter => input::Select,
                        glfw::KeyComma => input::Start,

                        glfw::KeyLeft => input::Left,
                        glfw::KeyRight => input::Right,
                        glfw::KeyDown => input::Down,
                        glfw::KeyUp => input::Up,

                        _ => continue
                    };

                    match action {
                        glfw::Release => gb.keyup(button),
                        glfw::Press => gb.keydown(button),
                        glfw::Repeat => {},
                    }
                }
                _ => {}
            }
        }
    }
}

// Shader sources
static VERTEX: &'static str = r"#version 150 core
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

static FRAGMENT: &'static str = r"#version 150 core
in vec3 Color;
in vec2 Texcoord;
out vec4 outColor;
uniform sampler2D tex;
void main() {
   outColor = texture(tex, Texcoord);
}
";

impl Glcx {
    fn new() -> Glcx {
        // lots of code lifted from
        // http://www.open.gl/content/code/c3_multitexture.txt
        unsafe {
            let mut vao = 0;
            gl::GenVertexArrays(1, &mut vao);
            gl::BindVertexArray(vao);

            let mut vbo = 0;
            gl::GenBuffers(1, &mut vbo);

            static VERTICES: &'static [f32] = &[
            //  Position   Color             Texcoords
                -1.0,  1.0, 1.0, 0.0, 0.0, 0.0, 0.0, // Top-left
                 1.0,  1.0, 0.0, 1.0, 0.0, 1.0, 0.0, // Top-right
                 1.0, -1.0, 0.0, 0.0, 1.0, 1.0, 1.0, // Bottom-right
                -1.0, -1.0, 1.0, 1.0, 1.0, 0.0, 1.0  // Bottom-left
            ];
            gl::BindBuffer(gl::ARRAY_BUFFER, vbo);
            gl::BufferData(gl::ARRAY_BUFFER,
                           (VERTICES.len() * 4) as i64,
                           VERTICES.as_ptr() as *libc::c_void,
                           gl::STATIC_DRAW);

            let mut ebo = 0;
            gl::GenBuffers(1, &mut ebo);

            static ELEMENTS: &'static [glt::GLuint] = &[
                0, 1, 2,
                2, 3, 0
            ];

            gl::BindBuffer(gl::ELEMENT_ARRAY_BUFFER, ebo);
            gl::BufferData(gl::ELEMENT_ARRAY_BUFFER,
                        (ELEMENTS.len() * mem::size_of::<glt::GLuint>()) as i64,
                        ELEMENTS.as_ptr() as *libc::c_void,
                        gl::STATIC_DRAW);

            // Create and compile the vertex shader
            let vert = gl::CreateShader(gl::VERTEX_SHADER);
            VERTEX.with_c_str(|src| {
                gl::ShaderSource(vert, 1, &src, 0 as *i32);
            });
            gl::CompileShader(vert);

            // Create and compile the fragment shader
            let frag = gl::CreateShader(gl::FRAGMENT_SHADER);
            FRAGMENT.with_c_str(|src| {
                gl::ShaderSource(frag, 1, &src, 0 as *i32);
            });
            gl::CompileShader(frag);

            // Link the vertex and fragment shader into a shader program
            let program = gl::CreateProgram();
            gl::AttachShader(program, vert);
            gl::AttachShader(program, frag);
            "outColor".with_c_str(|buf| {
                gl::BindFragDataLocation(program, 0, buf)
            });
            gl::LinkProgram(program);
            assert_eq!(gl::GetError(), 0);
            gl::UseProgram(program);

            // Specify the layout of the vertex data
            let posAttrib = "position".with_c_str(|buf| {
                gl::GetAttribLocation(program, buf)
            });
            gl::EnableVertexAttribArray(posAttrib as u32);
            gl::VertexAttribPointer(posAttrib as u32, 2, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        0 as *libc::c_void);

            let colAttrib = "color".with_c_str(|buf| {
                gl::GetAttribLocation(program, buf)
            });
            gl::EnableVertexAttribArray(colAttrib as u32);
            gl::VertexAttribPointer(colAttrib as u32, 3, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        (2 * mem::size_of::<glt::GLfloat>()) as *libc::c_void);

            let texAttrib = "texcoord".with_c_str(|buf| {
                gl::GetAttribLocation(program, buf)
            });
            gl::EnableVertexAttribArray(texAttrib as u32);
            gl::VertexAttribPointer(texAttrib as u32, 2, gl::FLOAT, gl::FALSE,
                        (7 * mem::size_of::<glt::GLfloat>()) as i32,
                        (5 * mem::size_of::<glt::GLfloat>()) as *libc::c_void);

            // Load textures
            let mut tex = 0;
            gl::GenTextures(1, &mut tex);

            gl::ActiveTexture(gl::TEXTURE0);
            gl::BindTexture(gl::TEXTURE_2D, tex);
            "tex".with_c_str(|buf| {
                gl::Uniform1i(gl::GetUniformLocation(program, buf), 0);
            });

            gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_S,
                              gl::CLAMP_TO_EDGE as i32);
            gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_WRAP_T,
                              gl::CLAMP_TO_EDGE as i32);
            gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MIN_FILTER,
                              gl::LINEAR as i32);
            gl::TexParameteri(gl::TEXTURE_2D, gl::TEXTURE_MAG_FILTER,
                              gl::LINEAR as i32);

            Glcx {
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

    fn draw(&self, data: &[u8]) {
        unsafe {
            gl::ClearColor(0.0, 0.0, 1.0, 1.0);
            gl::Clear(gl::COLOR_BUFFER_BIT);

            gl::TexImage2D(gl::TEXTURE_2D, 0, gl::RGB as i32,
                           gpu::WIDTH as i32, gpu::HEIGHT as i32,
                           0, gl::RGBA, gl::UNSIGNED_BYTE,
                           data.as_ptr() as *libc::c_void);
            assert_eq!(gl::GetError(), 0);

            // Draw a rectangle from the 2 triangles using 6
            // indices
            gl::DrawElements(gl::TRIANGLES, 6, gl::UNSIGNED_INT,
                             0 as *libc::c_void);
        }
    }
}

impl Drop for Glcx {
    fn drop(&mut self) {
        unsafe {
            gl::DeleteTextures(1, &self.tex);
            gl::DeleteProgram(self.program);
            gl::DeleteShader(self.vert);
            gl::DeleteShader(self.frag);
            gl::DeleteBuffers(1, &self.ebo);
            gl::DeleteBuffers(1, &self.vbo);
            gl::DeleteVertexArrays(1, &self.vao);
        }
    }
}
