(() => {
  const TAU = Math.PI * 2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const hexToRgb=h=>({r:(h>>16)&255,g:(h>>8)&255,b:h&255});
  const rgbToCss=(c,a=1)=>`rgba(${clamp(c.r,0,255)|0},${clamp(c.g,0,255)|0},${clamp(c.b,0,255)|0},${a})`;
  const shade=(hex,k)=>{const c=hexToRgb(hex);return rgbToCss({r:c.r*k,g:c.g*k,b:c.b*k})};
  const V=(x=0,y=0,z=0)=>({x,y,z});
  const add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z), sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z);
  const cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  const norm=a=>{const l=Math.hypot(a.x,a.y,a.z)||1;return V(a.x/l,a.y/l,a.z/l)};
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  function rot(p,r){
    let {x,y,z}=p; let c=Math.cos(r.x||0),s=Math.sin(r.x||0); let y1=y*c-z*s,z1=y*s+z*c; y=y1;z=z1;
    c=Math.cos(r.y||0);s=Math.sin(r.y||0);let x1=x*c+z*s,z2=-x*s+z*c;x=x1;z=z2;
    c=Math.cos(r.z||0);s=Math.sin(r.z||0);x1=x*c-y*s;y1=x*s+y*c;return V(x1,y1,z);
  }
  function box(w,h,d){const x=w/2,y=h/2,z=d/2;return {v:[V(-x,-y,-z),V(x,-y,-z),V(x,y,-z),V(-x,y,-z),V(-x,-y,z),V(x,-y,z),V(x,y,z),V(-x,y,z)],f:[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]]}}
  function cylinder(r,h,n=18,r2=r){const v=[],f=[];for(let i=0;i<n;i++){let a=i/n*TAU;v.push(V(Math.cos(a)*r,-h/2,Math.sin(a)*r));v.push(V(Math.cos(a)*r2,h/2,Math.sin(a)*r2))}for(let i=0;i<n;i++){let j=(i+1)%n;f.push([i*2,j*2,j*2+1,i*2+1])}let b=v.length;v.push(V(0,-h/2,0));let t=v.length;v.push(V(0,h/2,0));for(let i=0;i<n;i++){let j=(i+1)%n;f.push([b,j*2,i*2]);f.push([t,i*2+1,j*2+1])}return {v,f}}
  function ellipsoid(rx,ry,rz,lat=8,lon=14){const v=[],f=[];for(let iy=0;iy<=lat;iy++){let p=iy/lat*Math.PI;for(let ix=0;ix<lon;ix++){let a=ix/lon*TAU;v.push(V(Math.sin(p)*Math.cos(a)*rx,Math.cos(p)*ry,Math.sin(p)*Math.sin(a)*rz))}}for(let iy=0;iy<lat;iy++)for(let ix=0;ix<lon;ix++){let j=(ix+1)%lon,a=iy*lon+ix,b=iy*lon+j,c=(iy+1)*lon+j,d=(iy+1)*lon+ix;f.push([a,b,c,d])}return {v,f}}
  function makeObj(geom,color,pos=V(),rotation=V(),part='',opts={}){return {geom,color,pos,rotation,part,alpha:opts.alpha??1,outline:opts.outline??false,visible:true,home:{pos:{...pos},rotation:{...rotation}},id:opts.id||''}}
  function groupTransform(obj,global){let verts=obj.geom.v.map(p=>add(rot(p,obj.rotation),obj.pos));return verts.map(p=>rot(p,global))}
  class Viewer{
    constructor(el, build){this.el=el;this.canvas=document.createElement('canvas');this.canvas.setAttribute('aria-label','Interactive 3D concept model');el.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.yaw=-.45;this.pitch=.18;this.dist=10;this.auto=true;this.highlight='';this.objects=[];this.build=build;this.state={};build(this);this.resize();new ResizeObserver(()=>this.resize()).observe(el);this.bind();this.last=performance.now();requestAnimationFrame(t=>this.loop(t));}
    resize(){let r=this.el.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.max(1,r.width*d);this.canvas.height=Math.max(1,r.height*d);this.canvas.style.width=r.width+'px';this.canvas.style.height=r.height+'px';this.dpr=d}
    bind(){let drag=false,lx=0,ly=0;this.canvas.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!drag)return;this.yaw+=(e.clientX-lx)*.009;this.pitch=clamp(this.pitch+(e.clientY-ly)*.007,-1.2,1.2);lx=e.clientX;ly=e.clientY;this.auto=false});this.canvas.addEventListener('pointerup',()=>drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.dist=clamp(this.dist+e.deltaY*.008,5,22)},{passive:false});}
    project(p){let z=p.z+this.dist;if(z<.5)return null;let f=this.canvas.height*.72;return {x:this.canvas.width/2+p.x*f/z,y:this.canvas.height/2-p.y*f/z,z}}
    render(){let c=this.ctx,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);let grd=c.createRadialGradient(w*.5,h*.25,0,w*.5,h*.45,w*.72);grd.addColorStop(0,'#0e4a5b');grd.addColorStop(.55,'#08222d');grd.addColorStop(1,'#051017');c.fillStyle=grd;c.fillRect(0,0,w,h);
      // seabed glow + grid
      c.save();c.globalAlpha=.18;c.strokeStyle='#5ad9e5';c.lineWidth=1*this.dpr;for(let i=0;i<11;i++){let yy=h*.76+i*h*.028;c.beginPath();c.moveTo(0,yy);c.lineTo(w,yy);c.stroke()}for(let i=-10;i<=10;i++){c.beginPath();c.moveTo(w/2+i*22*this.dpr,h*.76);c.lineTo(w/2+i*85*this.dpr,h);c.stroke()}c.restore();
      let global=V(this.pitch,this.yaw,0),polys=[];const light=norm(V(-.3,.7,1));
      for(const o of this.objects){if(!o.visible)continue;let vv=groupTransform(o,global);for(const face of o.geom.f){let wp=face.map(i=>vv[i]);let p2=wp.map(p=>this.project(p));if(p2.some(p=>!p))continue;let n=norm(cross(sub(wp[1],wp[0]),sub(wp[2],wp[0])));let lum=.38+.62*Math.max(0,dot(n,light));let depth=p2.reduce((s,p)=>s+p.z,0)/p2.length;polys.push({p:p2,depth,color:o.color,lum,alpha:o.alpha,part:o.part,outline:o.outline})}}
      polys.sort((a,b)=>b.depth-a.depth);for(const q of polys){c.beginPath();c.moveTo(q.p[0].x,q.p[0].y);for(let i=1;i<q.p.length;i++)c.lineTo(q.p[i].x,q.p[i].y);c.closePath();let hi=this.highlight&&q.part===this.highlight;c.fillStyle=hi?'rgba(88,231,242,.92)':shade(q.color,q.lum);c.globalAlpha=q.alpha;c.fill();c.globalAlpha=1;if(hi||q.outline){c.strokeStyle=hi?'#b8fff6':'rgba(220,247,251,.18)';c.lineWidth=(hi?2:1)*this.dpr;c.stroke()}}
      // atmosphere particles
      c.save();c.globalAlpha=.25;for(let i=0;i<24;i++){let x=(Math.sin(i*19.17+this.yaw)*.5+.5)*w,y=(Math.sin(i*7.73+1.2)*.5+.5)*h*.7;c.fillStyle='#c9fbff';c.fillRect(x,y,1.2*this.dpr,1.2*this.dpr)}c.restore();
    }
    loop(t){let dt=Math.min((t-this.last)/1000,.05);this.last=t;if(this.auto)this.yaw+=dt*.14;if(this.tick)this.tick(dt);this.render();requestAnimationFrame(tt=>this.loop(tt))}
    reset(yaw=-.45,pitch=.18,dist=10){this.yaw=yaw;this.pitch=pitch;this.dist=dist;this.auto=true}
    flash(part){this.highlight=part;setTimeout(()=>{if(this.highlight===part)this.highlight=''},1600)}
  }

  function addMeshModule(view,x,id,visible=true){
    const o=[];const push=a=>{a.visible=visible;a.module=id;view.objects.push(a);o.push(a);return a};
    push(makeObj(box(4.15,4.6,.13),0x20292d,V(x,0,0),V(),'belt',{id:'belt'}));
    // perforation discs
    for(let iy=-6;iy<=6;iy++)for(let ix=-5;ix<=5;ix++){let px=x+ix*.34,py=iy*.31;push(makeObj(cylinder(.055,.035,8),0x050a0c,V(px,py,.09),V(Math.PI/2,0,0),'belt',{id:'hole'}))}
    push(makeObj(cylinder(.46,5.05,22),0x8d5141,V(x-2.25,0,-.08),V(),'drums',{id:'drumL'}));
    push(makeObj(cylinder(.46,5.05,22),0x8d5141,V(x+2.25,0,-.08),V(),'drums',{id:'drumR'}));
    push(makeObj(box(5.4,.28,1.15),0x15232a,V(x,-2.65,-.12),V(),'base'));
    let scraper=push(makeObj(box(.15,4.1,.72),0x8e989b,V(x+2.82,-.05,.20),V(0,0,-.04),'scraper',{id:'scraper'})); scraper.explodePos=V(x+3.45,-.05,.45);
    push(makeObj(cylinder(.05,.72,10),0xa8bac2,V(x+1.38,2.88,0),V(),'beacon'));
    push(makeObj(ellipsoid(.16,.16,.16,5,9),0x66f2c9,V(x+1.38,3.28,0),V(),'beacon'));
    return o;
  }
  function buildMesh(view){view.state.modules=[];view.state.modules.push(addMeshModule(view,0,0,true));view.state.modules.push(addMeshModule(view,-5.65,1,false));view.state.modules.push(addMeshModule(view,5.65,2,false));view.state.multi=false;view.state.exploded=false;view.tick=dt=>{};}

  function buildRobot(view){const O=view.objects;const put=(g,c,p,r,part,id)=>{let o=makeObj(g,c,p,r,part,{id});O.push(o);return o};
    put(ellipsoid(2.25,1.0,1.3,10,18),0xaec8d2,V(0,.3,0),V(),'body');
    put(box(1.75,1.15,.85),0x213744,V(0,.05,1.15),V(),'body');
    put(cylinder(.36,.30,20),0x05090b,V(0,.22,1.66),V(Math.PI/2,0,0),'camera','cameraRing');
    put(cylinder(.23,.31,20),0x173d4a,V(0,.22,1.82),V(Math.PI/2,0,0),'camera','cameraLens');
    const ledPos=[[-.62,-.28,1.62],[.62,-.28,1.62],[-.62,.45,1.62],[.62,.45,1.62]];view.state.led=[];ledPos.forEach((p,i)=>view.state.led.push(put(box(.22,.30,.10),0xeafcff,V(...p),V(),'camera','led'+i)));
    put(cylinder(.32,.75,18),0x29424f,V(.27,1.47,-.10),V(),'sonar','sonar');put(cylinder(.24,.08,18),0x102832,V(.27,1.88,-.10),V(),'sonar');
    const thr=[[-2.55,.45,.25],[2.55,.45,.25],[-2.38,-.72,-.05],[2.38,-.72,-.05]];thr.forEach((p,i)=>{put(cylinder(.62,.92,20),0xa7bdc6,V(...p),V(0,0,Math.PI/2),'thrusters','thr'+i);put(cylinder(.47,.08,16),0x091218,V(p[0]+(p[0]>0?.49:-.49),p[1],p[2]),V(0,0,Math.PI/2),'thrusters')});
    // arm, home positions allow animation
    view.state.arm=[];
    const shoulder=put(ellipsoid(.27,.27,.27,6,10),0x203944,V(-.55,-.72,1.20),V(),'arm');
    const upper=put(box(.28,1.2,.28),0xb0c4cc,V(-.30,-1.10,1.54),V(0,0,-.68),'arm','upper');
    const elbow=put(ellipsoid(.23,.23,.23,6,10),0x203944,V(-.03,-1.48,1.84),V(),'arm');
    const fore=put(box(.24,1.25,.24),0xb0c4cc,V(.30,-1.79,2.20),V(.10,0,-.78),'arm','fore');
    const tool=put(cylinder(.12,.48,12,.04),0xe1e9eb,V(.70,-2.12,2.57),V(1.1,0,-.55),'arm','tool');
    view.state.arm=[upper,elbow,fore,tool];view.state.armMoved=false;
    put(cylinder(.22,.85,16,.28),0xa9c0c8,V(.82,-1.02,1.50),V(.95,0,-.40),'suction','suctionBody');put(cylinder(.28,.36,16,.14),0x304d58,V(1.12,-1.31,1.86),V(.95,0,-.40),'suction','suctionNozzle');
    view.state.lights=true;
    view.tick=dt=>{};
  }

  const meshV=new Viewer(document.getElementById('meshViewer'),buildMesh);
  meshV.dist=11.5;meshV.yaw=-.5;meshV.pitch=.13;
  const robotV=new Viewer(document.getElementById('robotViewer'),buildRobot);
  robotV.dist=11.8;robotV.yaw=-.35;robotV.pitch=.10;

  function flash(model,part,btn){let v=model==='mesh'?meshV:robotV;v.flash(part);document.querySelectorAll(`[data-model="${model}"]`).forEach(x=>x.classList.toggle('active',x===btn));setTimeout(()=>btn.classList.remove('active'),1600)}
  document.querySelectorAll('[data-model][data-part]').forEach(btn=>btn.addEventListener('click',()=>flash(btn.dataset.model,btn.dataset.part,btn)));

  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
    if(a==='mesh-rotate'){meshV.auto=!meshV.auto;b.textContent=meshV.auto?'Pause rotation':'Resume rotation'}
    if(a==='mesh-reset'){meshV.reset(-.5,.13,11.5)}
    if(a==='mesh-modules'){meshV.state.multi=!meshV.state.multi;for(let i=1;i<3;i++)meshV.state.modules[i].forEach(o=>o.visible=meshV.state.multi);b.textContent=meshV.state.multi?'Show 1 module':'Show 3 modules';meshV.dist=meshV.state.multi?16:11.5}
    if(a==='mesh-explode'){meshV.state.exploded=!meshV.state.exploded;meshV.objects.filter(o=>o.id==='scraper').forEach(o=>o.pos=meshV.state.exploded?{...o.explodePos}:{...o.home.pos});b.textContent=meshV.state.exploded?'Assemble view':'Explode view'}
    if(a==='robot-rotate'){robotV.auto=!robotV.auto;b.textContent=robotV.auto?'Pause rotation':'Resume rotation'}
    if(a==='robot-reset'){robotV.reset(-.35,.10,11.8);robotV.state.armMoved=false;robotV.state.arm.forEach(o=>{o.pos={...o.home.pos};o.rotation={...o.home.rotation}})}
    if(a==='robot-lights'){robotV.state.lights=!robotV.state.lights;robotV.state.led.forEach(o=>o.color=robotV.state.lights?0xeafcff:0x33464e);b.textContent=robotV.state.lights?'Turn lights off':'Turn lights on'}
    if(a==='robot-arm'){
      robotV.state.armMoved=!robotV.state.armMoved;let [u,e1,f,t]=robotV.state.arm;if(robotV.state.armMoved){u.rotation.z=-1.00;u.pos=V(-.12,-1.0,1.60);e1.pos=V(.25,-1.45,1.98);f.rotation.z=-1.05;f.pos=V(.62,-1.78,2.35);t.pos=V(1.05,-2.03,2.72)}else{[u,e1,f,t].forEach(o=>{o.pos={...o.home.pos};o.rotation={...o.home.rotation}})}b.textContent=robotV.state.armMoved?'Reset arm':'Move arm';
    }
  });
})();
