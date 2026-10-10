import { orbFragment } from "./orbShader";

const vertex = `attribute vec2 position; varying vec2 vUv;
void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
// Original surrounding star field. The central energy surface adapts React Bits Orb.
const space = `
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 spaceField(vec2 uv){
  vec3 color=vec3(0.);
  for(int j=0;j<5;j++){
    float layer=float(j),depth=fract(layer*.2+iTime*.018);
    float scale=mix(55.,8.,depth);
    vec2 p=uv*scale+vec2(layer*41.,iTime*.035);
    vec2 id=floor(p),f=fract(p)-.5;
    float n=hash21(id);
    vec2 offset=vec2(hash21(id+7.),hash21(id+19.))-.5;
    float d=length(f-offset*.7);
    float star=.0015/(d*d+.001);
    float spark=pow(max(0.,1.-abs(f.x-offset.x*.7)*28.),7.)*pow(max(0.,1.-abs(f.y-offset.y*.7)*4.),7.);
    float fade=sin(depth*3.14159);
    color+=(star+spark*.25)*step(.94,n)*fade*(.65+.35*sin(iTime*.6+n*80.))*mix(vec3(.21,.43,.88),vec3(.7,.85,1.),n);
  }
  float mist=snoise3(vec3(uv*1.5,iTime*.04))*.5+.5;
  color+=vec3(.012,.024,.07)*pow(mist,3.);
  return color;
}
`;
const fragment = orbFragment
  .replace(
    "uniform float iTime;",
    "uniform float iTime; uniform vec2 coreCenter; uniform float coreSize;",
  )
  .replace(
    "vec2 center = iResolution.xy * 0.5;",
    "vec2 center = iResolution.xy * coreCenter;",
  )
  .replace(
    "float size = min(iResolution.x, iResolution.y);",
    "float size = coreSize;",
  )
  .replace(
    "vec4 mainImage(vec2 fragCoord)",
    space + "\nvec4 mainImage(vec2 fragCoord)",
  )
  .replace(
    "gl_FragColor = vec4(col.rgb * col.a, col.a);",
    `
    vec2 spaceUv=(fragCoord-iResolution.xy*.5)/min(iResolution.x,iResolution.y);
    float wide=1.-step(.4,coreCenter.x);
    float quiet=mix(1.-smoothstep(.38,.58,vUv.y),smoothstep(.5,.9,vUv.x),wide);
    vec3 background=spaceField(spaceUv)*(1.-quiet*.72);
    vec3 finalColor=background+col.rgb*col.a;
    gl_FragColor=vec4(finalColor,1.);`,
  );

export function createCognitionRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("GPU allocation failed");
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw new Error("GPU shader unavailable");
    return shader;
  };
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("GPU program unavailable");
  } catch {
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniforms = Object.fromEntries(
    [
      "iTime",
      "iResolution",
      "hue",
      "hover",
      "rot",
      "hoverIntensity",
      "backgroundColor",
      "coreCenter",
      "coreSize",
    ].map((key) => [key, gl.getUniformLocation(program, key)]),
  );
  return {
    render(
      seconds: number,
      width: number,
      height: number,
      focus: { x: number; y: number; size: number },
    ) {
      if (gl.isContextLost()) return;
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        1.25,
        Math.sqrt(1400000 / Math.max(1, width * height)),
      );
      const w = Math.max(1, Math.round(width * ratio)),
        h = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.useProgram(program);
      gl.uniform1f(uniforms.iTime, seconds * 0.6);
      gl.uniform3f(uniforms.iResolution, w, h, w / h);
      gl.uniform1f(uniforms.hue, -12);
      gl.uniform1f(uniforms.hover, 0.65 + 0.25 * Math.sin(seconds * 0.7));
      gl.uniform1f(uniforms.rot, seconds * 0.045);
      gl.uniform1f(uniforms.hoverIntensity, 0.27);
      gl.uniform3f(uniforms.backgroundColor, 0, 0, 0);
      gl.uniform2f(uniforms.coreCenter, focus.x, focus.y);
      gl.uniform1f(uniforms.coreSize, Math.max(1, focus.size * ratio));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
