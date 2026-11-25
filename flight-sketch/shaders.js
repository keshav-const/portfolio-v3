// GLSL for the planets, atmospheres, clouds and aurora. Throwaway sketch code.

export const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p,int oct){float a=0.5,s=0.0;for(int i=0;i<8;i++){if(i>=oct)break;s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
float f01(vec3 p,int oct){return fbm(p,oct)*0.5+0.5;}
float ridged(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){float n=1.0-abs(snoise(p));s+=a*n*n;p=p*2.1+vec3(3.3);a*=0.5;}return s;}
`;

const VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vP; varying vec3 vWP; varying vec3 vWN; varying vec3 vT1; varying vec3 vT2;
void main(){
  vP = normalize(position);
  vec4 wp = modelMatrix*vec4(position,1.0);
  vWP = wp.xyz; vWN = normalize(transpose(inverse(mat3(modelMatrix)))*normal);
  vec3 t1 = normalize(cross(vec3(0.0,1.0,0.0001), vP)); vec3 t2 = cross(vP, t1);
  vT1 = normalize(mat3(modelMatrix)*t1); vT2 = normalize(mat3(modelMatrix)*t2);
  gl_Position = projectionMatrix*viewMatrix*wp;
  #include <logdepthbuf_vertex>
}`;
export const PLANET_VERT = VERT;

const PLANET_PROC = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform int uType; uniform vec3 uSun; uniform float uR; uniform float uSeed; uniform vec3 uAtmo; uniform float uAtmoK; uniform float uBump; uniform float uTime; uniform float uNear; uniform vec3 uCloud;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN; varying vec3 vT1; varying vec3 vT2;
${NOISE}
vec3 perturb(vec3 N, vec3 pos, float hgt){
  vec3 dpx=dFdx(pos), dpy=dFdy(pos); float dhx=dFdx(hgt), dhy=dFdy(hgt);
  vec3 r1=cross(dpy,N), r2=cross(N,dpx); float det=dot(dpx,r1);
  vec3 g=sign(det)*(dhx*r1+dhy*r2); return normalize(abs(det)*N-g);
}
void surface(vec3 p, out vec3 alb, out float h, out float water, out vec3 emis){
  // a gentle warp only: strong warping smears noise into marble
  vec3 sp = p + uSeed;
  vec3 q = p + 0.09*vec3(fbm(sp*2.2,3), fbm(sp*2.2+5.2,3), fbm(sp*2.2+9.7,3));
  vec3 sq = q + uSeed;
  float cont = f01(sq*1.5,7);
  float rid = ridged(sq*4.2);
  float det = f01(p*11.0+uSeed,4);
  float nb = f01(sq*2.6+5.0,5);
  float lat = abs(p.y);
  float fine = f01(p*60.0+uSeed,2);
  emis = vec3(0.0); water = 0.0;
  if(uType==0){ // TECHNOVA: terraced basalt plateaus, canyons, rust flats, ore veins, frost at the poles
    float tz = cont*9.0; float terr = (floor(tz) + smoothstep(0.6,0.95,fract(tz)))/9.0;
    h = mix(cont, terr, 0.7)*0.75 + rid*0.25;
    float plateau = smoothstep(0.45,0.6,cont);
    alb = mix(vec3(0.055,0.054,0.058), vec3(0.15,0.145,0.15), plateau*0.7 + det*0.3);
    float scarp = smoothstep(0.75,0.95,fract(tz))*plateau;
    alb = mix(alb, vec3(0.03,0.03,0.033), scarp*0.6);
    float rust = smoothstep(0.5,0.62,nb)*(1.0-plateau);
    alb = mix(alb, mix(vec3(0.24,0.11,0.06), vec3(0.36,0.18,0.09), det), rust*0.85);
    float can = 1.0-smoothstep(0.0,0.012,abs(fbm(sq*2.4+11.0,6)));
    alb = mix(alb, vec3(0.02,0.02,0.022), can*0.8*smoothstep(0.35,0.5,cont)); h -= can*0.05;
    float vein = (1.0-smoothstep(0.0,0.006,abs(fbm(sq*5.0+7.0,5))))*smoothstep(0.5,0.65,det);
    alb = mix(alb, vec3(0.62,0.47,0.26), vein*0.6);
    alb = mix(alb, vec3(0.42,0.41,0.4), smoothstep(0.8,0.95,rid)*0.4);
    alb = mix(alb, vec3(0.82,0.84,0.88), smoothstep(0.86,0.93,lat+(det-0.5)*0.12));
    alb *= 0.88+0.24*fine;
    float site = smoothstep(0.82,0.85,f01(p*26.0+uSeed,3))*plateau;
    emis = vec3(1.0,0.86,0.62)*site*0.7;
  } else if(uType==1){ // EKATVA: russet forest where it is wet, gold grass where it is drier, a sandstone belt, silt seas
    h = cont*0.82+rid*0.18*smoothstep(0.5,0.68,cont);
    float sea=0.48; water = 1.0-smoothstep(sea,sea+0.003,h);
    float e = clamp((h-sea)/0.32,0.0,1.0);
    float wet = nb + (0.35-lat)*0.25 - e*0.25;
    vec3 forest = mix(vec3(0.24,0.06,0.04), vec3(0.42,0.14,0.06), det);
    vec3 grass = mix(vec3(0.50,0.33,0.10), vec3(0.62,0.45,0.16), det);
    vec3 sand = mix(vec3(0.56,0.38,0.25), vec3(0.68,0.5,0.35), f01(sq*18.0,3));
    vec3 land = mix(sand, grass, smoothstep(0.3,0.38,wet));
    land = mix(land, forest, smoothstep(0.45,0.53,wet));
    land = mix(land, vec3(0.30,0.25,0.21), smoothstep(0.5,0.75,e)*smoothstep(0.45,0.7,rid));
    land = mix(land, vec3(0.92,0.9,0.86), smoothstep(0.78,0.9,e+(lat-0.4)*0.25));
    float rv = abs(fbm(sq*3.0+2.0,6));
    land = mix(land, vec3(0.13,0.13,0.08), (1.0-smoothstep(0.004,0.012,rv))*(1.0-smoothstep(0.15,0.4,e))*smoothstep(0.4,0.5,wet));
    land = mix(land, vec3(0.92,0.9,0.86), smoothstep(0.83,0.9,lat+(det-0.5)*0.14));
    vec3 sw = mix(vec3(0.02,0.028,0.022), vec3(0.16,0.15,0.09), smoothstep(sea-0.025,sea,h));
    alb = mix(land*(0.88+0.24*det), sw, water);
    float town = smoothstep(0.84,0.87,f01(p*22.0+uSeed+3.0,3))*(1.0-water)*(1.0-smoothstep(0.3,0.6,e));
    emis = vec3(1.0,0.72,0.42)*town*0.5;
  } else if(uType==2){ // THE ARENA: a festival world. Emerald grass, broad flower plains, ochre mesas, salt and turquoise lakes
    h = cont*0.85+rid*0.15*smoothstep(0.5,0.75,cont);
    vec3 land = mix(vec3(0.05,0.32,0.07), vec3(0.30,0.55,0.10), smoothstep(0.35,0.75,nb*0.7+det*0.3));
    float fh = f01(sq*1.6+20.0,3);
    vec3 fc = mix(vec3(0.98,0.52,0.06), vec3(0.95,0.30,0.10), smoothstep(0.40,0.55,fh));
    fc = mix(fc, vec3(0.78,0.14,0.36), smoothstep(0.64,0.72,fh)*0.7);
    fc = mix(fc, vec3(1.0,0.80,0.12), smoothstep(0.30,0.18,fh));
    float fields = smoothstep(0.50,0.60,f01(sq*3.0+33.0,4))*(1.0-smoothstep(0.62,0.75,h));
    land = mix(land, fc*(0.75+0.5*f01(p*40.0+uSeed,2)), fields*(0.45+0.45*smoothstep(0.3,0.7,f01(p*24.0+uSeed+3.0,3))));
    land = mix(land, vec3(0.62,0.36,0.18), smoothstep(0.66,0.78,h));
    land = mix(land, vec3(0.95,0.95,0.93), smoothstep(0.86,0.93,h));
    float salt = 1.0-smoothstep(0.355,0.375,h);
    land = mix(land, vec3(0.93,0.91,0.86), salt);
    float lake = 1.0-smoothstep(0.33,0.34,h);
    float deep = 1.0-smoothstep(0.29,0.325,h);
    vec3 lk = mix(vec3(0.10,0.58,0.58), vec3(0.02,0.16,0.28), deep);
    water = lake;
    alb = mix(land*(0.85+0.3*det), lk, lake);
    alb = mix(alb, vec3(0.94,0.95,0.97), smoothstep(0.88,0.94,lat+(det-0.5)*0.12));
    // the Grand Arena: a floodlit bowl visible from orbit
    vec3 A = normalize(vec3(0.35,0.18,0.92));
    float d = acos(clamp(dot(p,A),-1.0,1.0));
    float ring = 1.0-smoothstep(0.0,0.0035,abs(d-0.03));
    float turf = 1.0-smoothstep(0.025,0.028,d);
    float stripes = step(0.5,fract(dot(p,vec3(1.0,0.0,0.0))*900.0));
    alb = mix(alb, mix(vec3(0.06,0.42,0.06),vec3(0.09,0.5,0.08),stripes), turf);
    alb = mix(alb, vec3(0.92,0.9,0.85), ring);
    float near = 1.0-smoothstep(0.05,0.35,d);
    float cluster = smoothstep(0.58-near*0.25,0.70-near*0.25,f01(p*5.0+uSeed+44.0,3));
    float city = cluster*smoothstep(0.62,0.80,f01(p*90.0+uSeed+40.0,3))*(1.0-lake)*(1.0-salt*0.7)*(1.0-smoothstep(0.75,0.82,h));
    float hue = f01(p*6.0+uSeed+50.0,2);
    vec3 lc = mix(vec3(1.0,0.84,0.58), vec3(1.0,0.50,0.16), smoothstep(0.55,0.7,hue));
    lc = mix(lc, vec3(1.0,0.32,0.45), smoothstep(0.72,0.8,hue));
    emis = lc*city*1.4 + vec3(1.0,0.95,0.85)*ring*1.6;
  } else if(uType==4){ // a small grey moon
    h = cont*0.6+rid*0.25;
    alb = mix(vec3(0.18,0.17,0.16), vec3(0.42,0.4,0.37), smoothstep(0.3,0.75,det));
    float cr2 = 1.0-smoothstep(0.0,0.06,abs(snoise(p*6.0+uSeed)-0.5)); alb = mix(alb, vec3(0.55,0.53,0.5), cr2*0.5); h -= cr2*0.05;
  } else { // COSMOS: ice plains, fractures, basins, bare rock
    h = cont*0.5+rid*0.25;
    alb = mix(vec3(0.62,0.69,0.76), vec3(0.86,0.89,0.92), smoothstep(0.35,0.7,det));
    float crack = 1.0-smoothstep(0.0,0.02,abs(fbm(sq*2.6+3.0,5)));
    alb = mix(alb, vec3(0.30,0.44,0.58), crack*0.6);
    float rock = smoothstep(0.62,0.7,rid)*smoothstep(0.45,0.6,nb);
    alb = mix(alb, vec3(0.15,0.14,0.13), rock*0.9);
    float basin = smoothstep(0.42,0.32,cont);
    alb = mix(alb, vec3(0.42,0.50,0.60), basin*0.55); h -= basin*0.08;
    float cr = 1.0-smoothstep(0.0,0.05,abs(snoise(p*7.0+uSeed)-0.55));
    alb = mix(alb, vec3(0.95,0.96,0.98), cr*0.35);
    float obs = smoothstep(0.86,0.88,f01(p*30.0+uSeed,3))*rock;
    emis = vec3(0.9,0.95,1.0)*obs*0.6;
  }
  alb *= 0.9+0.2*fine*(1.0-water);
  h += (fine-0.5)*0.01;
}
float hq(vec3 p){ // the relief alone, for shading
  vec3 sp = p + uSeed;
  vec3 q = p + 0.09*vec3(fbm(sp*2.2,3), fbm(sp*2.2+5.2,3), fbm(sp*2.2+9.7,3));
  vec3 sq = q + uSeed;
  return f01(sq*1.5,6)*0.75 + ridged(sq*4.2)*0.25 + f01(p*11.0+uSeed,3)*0.04 + f01(p*60.0+uSeed,2)*0.01;
}
float cloudAt(vec3 p){
  float a0 = uTime*0.004; float c0=cos(a0), s0=sin(a0);
  vec3 q = vec3(c0*p.x - s0*p.z, p.y, s0*p.x + c0*p.z);
  vec3 w = vec3(fbm(q*3.0+uCloud.z,3), fbm(q*3.0+uCloud.z+4.0,3), fbm(q*3.0+uCloud.z+8.0,3));
  float c = f01(vec3(q.x*uCloud.y, q.y*uCloud.y*1.3, q.z*uCloud.y)+w*0.45+uCloud.z, 5);
  return smoothstep(uCloud.x, uCloud.x+0.12, c*0.75*(0.8+0.2*cos(q.y*7.0)) + 0.12);
}
void main(){
  #include <logdepthbuf_fragment>
  vec3 N0 = normalize(vWN);
  vec3 L = normalize(uSun - vWP);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb, emis; float h, water;
  vec3 P = normalize(vP);
  surface(P, alb, h, water, emis);
  vec3 N = N0;
  if (uNear > 0.5) {
    vec3 t1 = normalize(cross(vec3(0.0,1.0,0.0001), P)); vec3 t2 = cross(P, t1);
    float e = 0.0012;
    float h0 = hq(P), h1 = hq(normalize(P+t1*e)), h2 = hq(normalize(P+t2*e));
    float k = uBump*(1.0-water)*120.0;
    N = normalize(N0 - k*((h1-h0)/e*0.01*vT1 + (h2-h0)/e*0.01*vT2));
    alb *= 0.9 + 0.2*f01(P*180.0+uSeed, 2)*(1.0-water);
  }
  float ndl0 = dot(N0,L);
  float dif = max(dot(N,L),0.0)*smoothstep(-0.05,0.15,ndl0);
  vec3 sunc = mix(vec3(1.0,0.55,0.30), vec3(1.0,0.97,0.92), smoothstep(0.0,0.35,ndl0));
  float shade = 1.0;
  if (uCloud.x >= 0.0) shade = 1.0 - cloudAt(P)*0.5;
  vec3 col = alb*dif*sunc*1.7*shade;
  vec3 H = normalize(L+V);
  float nh = max(dot(N0,H),0.0); float glint = pow(nh, 600.0)*3.0 + pow(nh, 60.0)*0.08*(0.5+f01(P*120.0,2));
  col += water*glint*smoothstep(0.0,0.1,ndl0)*sunc*shade;
  col += water*uAtmo*0.05*pow(1.0-max(dot(N0,V),0.0),4.0)*smoothstep(-0.1,0.3,ndl0);
  float night = smoothstep(0.08,-0.15,ndl0);
  col += emis*(night + 0.06);
  // the warm band along the terminator, where light skims through the air
  col += uAtmo*vec3(1.0,0.6,0.4)*uAtmoK*0.35*exp(-abs(ndl0+0.02)*14.0);
  float fres = pow(1.0-max(dot(N0,V),0.0),3.0);
  float day = smoothstep(-0.2,0.4,ndl0);
  col = mix(col, uAtmo*day*1.3, clamp(fres*uAtmoK + uAtmoK*0.12*day, 0.0, 1.0));
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const ATMO_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform vec3 uCenter; uniform vec3 uAtmo; uniform float uR; uniform float uRs; uniform float uK; uniform mat4 uInvM;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN;
void main(){
  #include <logdepthbuf_fragment>
  vec3 dir = normalize(vWP - cameraPosition);
  vec3 c = (uInvM*vec4(cameraPosition,1.0)).xyz, f = (uInvM*vec4(vWP,1.0)).xyz;
  vec3 ld = normalize(f - c);
  float tc = dot(-c, ld);
  vec3 pc = c + ld*tc;
  float b = length(pc);
  float t = clamp((b-uR)/(uRs-uR),0.0,1.0);
  float inten = exp(-t*4.5)*(1.0-t);
  vec3 Ls = normalize(uSun-uCenter);
  float lit = smoothstep(-0.35,0.45,dot(normalize(pc),Ls));
  float fwd = pow(max(dot(dir,normalize(uSun-cameraPosition)),0.0),6.0);
  gl_FragColor = vec4(uAtmo*inten*uK*(lit+fwd*0.8),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const AURORA_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform vec3 uCenter; uniform float uTime;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  float lat = abs(vP.y);
  float wob = snoise(vP*3.0+vec3(0.0,0.0,uTime*0.03))*0.05;
  float band = smoothstep(0.09,0.0,abs(lat-0.84+wob));
  float lon = atan(vP.z,vP.x);
  float curtain = 0.35+0.65*smoothstep(-0.2,0.8,snoise(vec3(lon*9.0, lat*14.0, uTime*0.12)));
  vec3 up = normalize(vWP-uCenter); vec3 L = normalize(uSun-uCenter);
  float night = smoothstep(0.15,-0.25,dot(up,L));
  vec3 V = normalize(cameraPosition - vWP);
  float edge = 0.35+1.2*pow(1.0-abs(dot(normalize(vWN),V)),2.0);
  vec3 col = mix(vec3(0.15,1.0,0.42), vec3(1.0,0.22,0.32), smoothstep(0.80,0.90,lat+wob*2.0));
  gl_FragColor = vec4(col*band*curtain*edge*(night*1.3+0.08),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const HASH33 = /* glsl */`
vec3 hash33(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
vec2 worley(vec3 p){ vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){
    vec3 o = vec3(float(x),float(y),float(z)); vec3 r = o + hash33(i+o) - f; float d = dot(r,r);
    if(d<d1){ d2=d1; d1=d; } else if(d<d2) d2=d; }
  return vec2(sqrt(d1), sqrt(d2)); }`;
export const STAR_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime; uniform float uGain;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN;
${NOISE}
${HASH33}
void main(){
  #include <logdepthbuf_fragment>
  vec3 N = normalize(vWN); vec3 V = normalize(cameraPosition - vWP);
  float mu = max(dot(N,V),0.0);
  vec3 p = normalize(vP); float t = uTime;
  vec3 q = p + 0.03*vec3(snoise(p*3.0+t*0.02), snoise(p*3.0+7.0-t*0.02), snoise(p*3.0+13.0));
  // granulation: bright cells of rising gas in dark lanes, fading out where they would alias
  vec3 gq = q*75.0 + vec3(0.0, t*0.05, 0.0);
  vec2 g1 = worley(gq); float gran = smoothstep(0.0, 0.5, g1.y - g1.x)*0.7 + (1.0 - smoothstep(0.1, 0.9, g1.x))*0.3;
  gran = mix(gran, 0.55, clamp(length(fwidth(gq))*0.9, 0.0, 1.0));
  vec2 g2 = worley(q*9.0 + 3.0); float sup = smoothstep(0.0, 0.25, g2.y - g2.x);
  // spots: dark umbra, filamented penumbra, kept to the low latitudes
  float sn = fbm(p*2.4 + vec3(t*0.003), 4)*0.5+0.5;
  float band = smoothstep(0.6, 0.12, abs(p.y));
  float pen = smoothstep(0.64, 0.70, sn)*band, umb = smoothstep(0.715, 0.75, sn)*band;
  float fil = 0.7 + 0.3*snoise(vec3(atan(p.z,p.x)*90.0, p.y*90.0, 1.0));
  float fac = smoothstep(0.55, 0.75, fbm(p*6.0+11.0,3)*0.5+0.5)*pow(1.0-mu, 1.5);
  float limbI = 0.3 + 0.7*pow(mu, 0.6);
  vec3 limbC = mix(vec3(0.95,0.36,0.1), vec3(1.0,0.74,0.42), pow(mu, 0.5));
  float I = (0.8 + 0.2*gran)*(0.9 + 0.1*sup)*limbI;
  I *= 1.0 - pen*0.42*fil - umb*0.5;
  I += fac*0.45;
  vec3 col = limbC*I;
  col = mix(col, col*vec3(1.0,0.66,0.45), pen*0.6);
  gl_FragColor = vec4(col*1.9*uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const CORONA_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime; uniform vec3 uCenter; uniform float uR; uniform float uRs; uniform float uGain;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  vec3 dir = normalize(vWP - cameraPosition);
  vec3 oc = uCenter - cameraPosition; float tc = dot(oc,dir); vec3 pc = cameraPosition + dir*tc;
  vec3 rel = pc - uCenter; float b = length(rel); vec3 nd = rel/max(b,1e-3);
  float t = clamp((b-uR)/(uRs-uR),0.0,1.0);
  float lon = atan(nd.z, nd.x);
  float streamer = pow(snoise(vec3(lon*2.5, nd.y*2.0, uTime*0.01))*0.5+0.5, 2.0)*smoothstep(0.85, 0.0, abs(nd.y));
  float streak = 0.55 + 0.45*snoise(nd*4.0 + vec3(0.0,0.0,uTime*0.02));
  float fine = 0.72 + 0.28*snoise(vec3(lon*30.0, nd.y*30.0, uTime*0.03));
  float flare = smoothstep(0.75,0.95, snoise(nd*9.0 + vec3(uTime*0.05)))*exp(-t*14.0)*1.2;
  float outside = smoothstep(uR*0.996, uR*1.004, b);
  float inten = ((exp(-t*10.0)*1.0 + exp(-t*2.6)*0.2*(0.4+streamer*2.0))*streak*fine*(1.0-t) + flare)*outside;
  float chromo = exp(-t*70.0)*outside*1.3;
  vec3 col = vec3(1.0,0.72,0.42)*inten + vec3(1.0,0.32,0.26)*chromo;
  gl_FragColor = vec4(col*1.1*uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const PROM_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
  #include <logdepthbuf_vertex>
}`;
export const PROM_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime; uniform float uGain; uniform float uSeed;
varying vec2 vUv;
${NOISE}
void main(){
  #include <logdepthbuf_fragment>
  float flow = snoise(vec3(vUv.x*14.0 - uTime*0.25, vUv.y*3.0, uSeed));
  float knots = smoothstep(-0.2, 0.8, snoise(vec3(vUv.x*40.0 - uTime*0.4, uSeed*2.0, 0.0)));
  float edge = sin(vUv.y*3.14159);
  float along = smoothstep(0.0,0.06,vUv.x)*smoothstep(1.0,0.94,vUv.x);
  float a = (0.35 + 0.65*(0.5+0.5*flow))*(0.6+0.4*knots)*edge*along;
  gl_FragColor = vec4(vec3(1.0,0.36,0.15)*a*1.6*uGain, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export const RING_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWP; varying float vR;
void main(){ vR = length(position.xy); vec4 wp = modelMatrix*vec4(position,1.0); vWP = wp.xyz; gl_Position = projectionMatrix*viewMatrix*wp;
  #include <logdepthbuf_vertex>
}`;
export const RING_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform vec3 uCenter; uniform float uR; uniform float uIn; uniform float uOut;
varying vec3 vWP; varying float vR;
float h1(float x){ return fract(sin(x*127.1)*43758.5453); }
void main(){
  #include <logdepthbuf_fragment>
  float u = (vR - uIn)/(uOut - uIn);
  float bands = 0.5 + 0.5*sin(u*80.0)*sin(u*23.0+1.0) ; float gap = smoothstep(0.02,0.0,abs(u-0.62));
  float dens = smoothstep(0.0,0.06,u)*smoothstep(1.0,0.9,u)*(0.35+0.65*bands)*(1.0-gap*0.9)*(0.6+0.4*h1(floor(u*140.0)));
  vec3 L = normalize(uSun - uCenter); vec3 rel = vWP - uCenter;
  float behind = step(dot(rel, L), 0.0); float dl = length(rel - L*dot(rel,L));
  float shadow = 1.0 - behind*smoothstep(uR*1.02, uR*0.95, dl);
  vec3 col = vec3(0.86,0.88,0.92)*(0.25 + 0.95*shadow);
  gl_FragColor = vec4(col, dens*0.85);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---------- planets, pre-rendered: the surface is computed once into cube maps, then only sampled ----------
// Baking moves ~100 noise evaluations per pixel per frame to a one-off at load; it also lets every planet carry
// bump-mapped relief at all distances, not just up close.
const PLANET_LIB = PLANET_PROC.slice(0, PLANET_PROC.indexOf('float cloudAt'));
export const BAKE_VERT = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
  #include <logdepthbuf_vertex>
}`;
// uOut 0: albedo (sqrt-encoded) + water; 1: object-space normal; 2: emission / 2; 3: cloud density
export const BAKE_FRAG = PLANET_LIB + /* glsl */`
uniform int uOut; uniform float uTexel; uniform float uCScale; uniform float uCSeed;
varying vec3 vDir;
void main(){
  #include <logdepthbuf_fragment>
  vec3 P = normalize(vDir);
  if (uOut == 3) {
    vec3 w = vec3(fbm(P*3.0+uCSeed,3), fbm(P*3.0+uCSeed+4.0,3), fbm(P*3.0+uCSeed+8.0,3));
    float c = f01(vec3(P.x*uCScale, P.y*uCScale*1.3, P.z*uCScale)+w*0.45+uCSeed, 6);
    c = c*0.75 + f01(P*uCScale*5.0+uCSeed+w, 3)*0.25;
    gl_FragColor = vec4(c*(0.8+0.2*cos(P.y*7.0)), 0.0, 0.0, 1.0); return;
  }
  vec3 alb, emis; float h, water;
  surface(P, alb, h, water, emis);
  if (uOut == 0) { gl_FragColor = vec4(sqrt(clamp(alb, 0.0, 1.0)), water); return; }
  if (uOut == 2) { gl_FragColor = vec4(clamp(emis*0.5, 0.0, 1.0), 1.0); return; }
  vec3 t1 = normalize(cross(vec3(0.0,1.0,0.0001), P)); vec3 t2 = cross(P, t1);
  float e = max(uTexel, 0.0008);
  float h0 = hq(P), h1 = hq(normalize(P+t1*e)), h2 = hq(normalize(P+t2*e));
  float k = uBump*(1.0-water)*120.0;
  vec3 N = normalize(P - k*((h1-h0)/e*0.01*t1 + (h2-h0)/e*0.01*t2));
  gl_FragColor = vec4(N*0.5+0.5, 1.0);
}`;

const CLOUD_SAMPLE = /* glsl */`
vec3 cloudDir(vec3 p){ float a0 = uTime*0.004; float c0=cos(a0), s0=sin(a0); return vec3(c0*p.x - s0*p.z, p.y, s0*p.x + c0*p.z); }`;

export const PLANET_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform float uSeed; uniform vec3 uAtmo; uniform float uAtmoK; uniform float uTime; uniform float uNear; uniform vec3 uCloud;
uniform samplerCube uA; uniform samplerCube uB; uniform samplerCube uE; uniform samplerCube uC; uniform mat3 uNM;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN; varying vec3 vT1; varying vec3 vT2;
#ifdef DETAIL
${NOISE}
#endif
${CLOUD_SAMPLE}
void main(){
  #include <logdepthbuf_fragment>
  vec3 N0 = normalize(vWN);
  vec3 L = normalize(uSun - vWP);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 P = normalize(vP);
  vec4 A = texture(uA, P);
  vec3 alb = A.rgb*A.rgb; float water = A.a;
  vec3 emis = texture(uE, P).rgb*2.0;
  vec3 N = normalize(uNM*(texture(uB, P).xyz*2.0-1.0));
  #ifdef DETAIL
  if (uNear > 0.5) { // up close, fine grain the maps are too coarse to hold
    float g = snoise(P*180.0+uSeed)*0.5+0.5, g2 = snoise(P*520.0+uSeed)*0.5+0.5;
    alb *= (0.9 + 0.2*g)*(0.95+0.1*g2*(1.0-water));
  }
  #endif
  float ndl0 = dot(N0,L);
  float dif = max(dot(N,L),0.0)*smoothstep(-0.05,0.15,ndl0);
  vec3 sunc = mix(vec3(1.0,0.55,0.30), vec3(1.0,0.97,0.92), smoothstep(0.0,0.35,ndl0));
  float shade = 1.0;
  if (uCloud.x >= 0.0) shade = 1.0 - smoothstep(uCloud.x, uCloud.x+0.12, texture(uC, cloudDir(P)).r)*0.5;
  vec3 col = alb*dif*sunc*1.7*shade;
  vec3 H = normalize(L+V);
  float nh = max(dot(N0,H),0.0); float glint = pow(nh, 600.0)*3.0 + pow(nh, 60.0)*0.08*(0.5+0.5*A.r);
  col += water*glint*smoothstep(0.0,0.1,ndl0)*sunc*shade;
  col += water*uAtmo*0.05*pow(1.0-max(dot(N0,V),0.0),4.0)*smoothstep(-0.1,0.3,ndl0);
  float night = smoothstep(0.08,-0.15,ndl0);
  col += emis*(night + 0.06);
  col += uAtmo*vec3(1.0,0.6,0.4)*uAtmoK*0.35*exp(-abs(ndl0+0.02)*14.0);
  float fres = pow(1.0-max(dot(N0,V),0.0),3.0);
  float day = smoothstep(-0.2,0.4,ndl0);
  col = mix(col, uAtmo*day*1.3, clamp(fres*uAtmoK + uAtmoK*0.12*day, 0.0, 1.0));
  gl_FragColor = vec4(col,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const CLOUD_FRAG = /* glsl */`
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uSun; uniform float uTime; uniform float uCov; uniform samplerCube uC;
varying vec3 vP; varying vec3 vWP; varying vec3 vWN;
${CLOUD_SAMPLE}
void main(){
  #include <logdepthbuf_fragment>
  float a = smoothstep(uCov, uCov+0.12, texture(uC, cloudDir(normalize(vP))).r);
  vec3 N = normalize(vWN); vec3 L = normalize(uSun - vWP);
  float ndl = dot(N,L);
  vec3 sunc = mix(vec3(1.0,0.6,0.35), vec3(1.0,0.98,0.95), smoothstep(0.0,0.3,ndl));
  vec3 col = vec3(0.98,0.96,0.93)*(max(ndl,0.0)*1.25+0.015)*sunc;
  gl_FragColor = vec4(col, a*0.94*smoothstep(-0.25,0.05,ndl+0.2));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
